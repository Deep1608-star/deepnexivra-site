function openAIKey() {
  return String(process.env.OPENAI_API_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ok:false,message:"Method not allowed"});
  }

  const appId = process.env.ADZUNA_APP_ID || "";
  const appKey = process.env.ADZUNA_APP_KEY || "";
  if (!appId || !appKey) {
    return res.status(503).json({
      ok:false,
      message:"Live job discovery is not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY, or use job URL/paste intake."
    });
  }

  const body = req.body || {};
  const keywords = String(body.keywords || "").trim();
  const location = String(body.location || "").trim();
  const country = String(body.country || "ca").trim().toLowerCase();
  const graph = body.careerGraph;

  if (!keywords) return res.status(400).json({ok:false,message:"Job search keywords are required"});
  if (!/^[a-z]{2}$/.test(country)) return res.status(400).json({ok:false,message:"Country code must be two letters"});
  if (!graph || !Array.isArray(graph.evidenceRecords)) {
    return res.status(400).json({ok:false,message:"Career Graph is required"});
  }

  try {
    const params = new URLSearchParams({
      app_id:appId,
      app_key:appKey,
      results_per_page:"8",
      what:keywords,
      "content-type":"application/json"
    });
    if (location) params.set("where",location);

    const url = "https://api.adzuna.com/v1/api/jobs/" + encodeURIComponent(country) + "/search/1?" + params.toString();
    const response = await fetch(url, {
      headers:{"Accept":"application/json"},
      signal:AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ok:false,message:data && data.error ? String(data.error) : "Job search provider request failed"});
    }

    const listings = (data.results || []).slice(0,8).map(function(job) {
      return {
        externalId:String(job.id || ""),
        title:String(job.title || ""),
        company:String(job.company && job.company.display_name || ""),
        location:String(job.location && job.location.display_name || ""),
        description:String(job.description || ""),
        sourceUrl:String(job.redirect_url || ""),
        created:String(job.created || ""),
        salaryMin:Number.isFinite(job.salary_min) ? job.salary_min : null,
        salaryMax:Number.isFinite(job.salary_max) ? job.salary_max : null,
        contractType:String(job.contract_type || ""),
        contractTime:String(job.contract_time || "")
      };
    }).filter(function(job){return job.title && job.description;});

    if (!listings.length) {
      return res.status(200).json({ok:true,result:{provider:"Adzuna",jobs:[]}});
    }

    const evidence = (graph.evidenceRecords || []).slice(0,70).map(function(record,index) {
      return {
        evidenceId:record.evidenceId || ("E" + String(index + 1).padStart(3,"0")),
        category:record.category || "",
        title:record.title || "",
        text:record.text || "",
        employer:record.employer || "",
        role:record.role || ""
      };
    });
    const experience = (graph.experience || []).slice(0,18).map(function(role,index) {
      return {
        roleId:role.roleId || ("R" + String(index + 1).padStart(3,"0")),
        employer:role.employer || "",
        title:role.title || "",
        responsibilities:role.responsibilities || [],
        achievements:role.achievements || [],
        tools:role.tools || [],
        skills:role.skills || []
      };
    });

    const ids = listings.map(function(job){return job.externalId || job.title;});
    const stringArray={type:"array",items:{type:"string"}};
    const schema={
      type:"object",
      additionalProperties:false,
      required:["jobs"],
      properties:{
        jobs:{
          type:"array",
          items:{
            type:"object",
            additionalProperties:false,
            required:["externalId","fitLevel","scores","summary","criticalGaps","recurringGapTags"],
            properties:{
              externalId:{type:"string",enum:ids},
              fitLevel:{type:"string",enum:["Strong","Moderate","Stretch"]},
              scores:{
                type:"object",
                additionalProperties:false,
                required:["requirementMatch","evidenceStrength","readiness"],
                properties:{
                  requirementMatch:{type:"number",minimum:0,maximum:100},
                  evidenceStrength:{type:"number",minimum:0,maximum:100},
                  readiness:{type:"number",minimum:0,maximum:100}
                }
              },
              summary:{type:"string"},
              criticalGaps:stringArray,
              recurringGapTags:stringArray
            }
          }
        }
      }
    };

    const instructions=[
      "You are Deep Nexivra Career Agent's discovery triage engine.",
      "Use only the supplied job-listing snippets and candidate evidence.",
      "Do not predict hiring outcomes.",
      "Strong/Moderate/Stretch describes evidence fit only.",
      "Do not treat keyword overlap alone as evidence.",
      "Scores are Deep Nexivra internal preparation/evidence scores, not employer ATS scores.",
      "Because provider descriptions may be snippets, be conservative; do not assume missing details.",
      "recurringGapTags should be short normalized capabilities that the listing requests and candidate evidence lacks.",
      "Keep summaries concise."
    ].join("\n");

    const aiResponse=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer " + openAIKey()
      },
      body:JSON.stringify({
        model:process.env.OPENAI_CAREER_MODEL || "gpt-5.6-sol",
        reasoning:{effort:"high"},
        instructions,
        input:[
          "JOB LISTINGS:",
          JSON.stringify(listings),
          "",
          "CANDIDATE EXPERIENCE:",
          JSON.stringify(experience).slice(0,20000),
          "",
          "CANDIDATE EVIDENCE:",
          JSON.stringify(evidence).slice(0,28000)
        ].join("\n"),
        text:{format:{type:"json_schema",name:"deep_nexivra_job_discovery_triage",strict:true,schema}},
        max_output_tokens:10000,
        store:false
      })
    });
    const aiData=await aiResponse.json();
    if(!aiResponse.ok){
      return res.status(aiResponse.status).json({ok:false,message:aiData && aiData.error && aiData.error.message ? aiData.error.message : "Discovery triage failed"});
    }

    let outputText=aiData.output_text || "";
    if(!outputText && Array.isArray(aiData.output)){
      aiData.output.forEach(function(item){
        (item.content || []).forEach(function(content){
          if(content.type==="output_text" && content.text) outputText+=content.text;
        });
      });
    }
    const triage=JSON.parse(outputText);
    const map=new Map((triage.jobs || []).map(function(item){return [item.externalId,item];}));

    const jobs=listings.map(function(job){
      const triageItem=map.get(job.externalId || job.title) || {
        fitLevel:"Stretch",
        scores:{requirementMatch:0,evidenceStrength:0,readiness:0},
        summary:"Insufficient triage data returned.",
        criticalGaps:[],
        recurringGapTags:[]
      };
      triageItem.scores.requirementMatch=clamp(triageItem.scores.requirementMatch);
      triageItem.scores.evidenceStrength=clamp(triageItem.scores.evidenceStrength);
      triageItem.scores.readiness=clamp(triageItem.scores.readiness);
      return Object.assign({},job,triageItem,{
        source:"Adzuna discovery",
        jobDescription:job.description
      });
    });

    return res.status(200).json({ok:true,result:{provider:"Adzuna",jobs}});
  } catch(error) {
    return res.status(500).json({ok:false,message:error && error.message ? error.message : "Unable to search jobs"});
  }
}
