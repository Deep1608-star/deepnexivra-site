function openAIKey() {
  return String(process.env.OPENAI_API_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function isPrivateIp(address) {
  const value = String(address || "").toLowerCase();
  if (!value) return true;
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;

  const m = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

async function validateRemoteUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP(S) job URLs are supported");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local/private URLs are not allowed");
  }

  const dns = await import("node:dns/promises");
  const records = await dns.lookup(host, {all:true});
  if (!records.length || records.some(function(record) { return isPrivateIp(record.address); })) {
    throw new Error("Private or unresolved job URL is not allowed");
  }
  return url;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPublicJobPage(input) {
  let current = await validateRemoteUrl(input);

  for (let redirect = 0; redirect < 4; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, 10000);
    let response;
    try {
      response = await fetch(current.toString(), {
        method:"GET",
        redirect:"manual",
        signal:controller.signal,
        headers:{
          "User-Agent":"Mozilla/5.0 (compatible; DeepNexivra/1.0; job-intake)",
          "Accept":"text/html,text/plain;q=0.9,*/*;q=0.1"
        }
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = await validateRemoteUrl(new URL(response.headers.get("location"), current).toString());
      continue;
    }

    if (!response.ok) throw new Error("Job page returned HTTP " + response.status);

    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2_000_000) throw new Error("Job page is too large to import");

    const type = response.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) {
      throw new Error("Job URL did not return a supported text page");
    }

    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("Job page is too large to import");
    return {
      finalUrl: current.toString(),
      text: /html/i.test(type) ? stripHtml(text) : text.trim()
    };
  }
  throw new Error("Too many redirects while importing job URL");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ok:false,message:"Method not allowed"});
  }

  const body = req.body || {};
  const url = typeof body.url === "string" ? body.url.trim() : "";
  let jobText = typeof body.jobText === "string" ? body.jobText.trim() : "";
  const graph = body.careerGraph;

  if (!graph || !Array.isArray(graph.evidenceRecords)) {
    return res.status(400).json({ok:false,message:"Career Graph is required"});
  }

  let sourceUrl = "";
  try {
    if (!jobText && url) {
      const fetched = await fetchPublicJobPage(url);
      sourceUrl = fetched.finalUrl;
      jobText = fetched.text;
    }

    if (jobText.length < 200) {
      return res.status(400).json({ok:false,message:"Job posting text is too short. Paste the full posting if the website blocks import."});
    }
    jobText = jobText.slice(0, 45000);

    const evidenceCatalog = (graph.evidenceRecords || []).slice(0,80).map(function(record,index) {
      return {
        evidenceId: record.evidenceId || ("E" + String(index + 1).padStart(3,"0")),
        category: record.category || "",
        title: record.title || "",
        text: record.text || "",
        sourceSnippet: record.sourceSnippet || "",
        employer: record.employer || "",
        role: record.role || ""
      };
    });

    const experience = (graph.experience || []).slice(0,20).map(function(role,index) {
      return {
        roleId: role.roleId || ("R" + String(index + 1).padStart(3,"0")),
        employer: role.employer || "",
        title: role.title || "",
        responsibilities: role.responsibilities || [],
        achievements: role.achievements || [],
        tools: role.tools || [],
        skills: role.skills || [],
        metrics: role.metrics || []
      };
    });

    const stringArray = {type:"array",items:{type:"string"}};
    const schema = {
      type:"object",
      additionalProperties:false,
      required:[
        "title","company","location","employmentType","summary","jobDescription","fitLevel",
        "scores","topRequirements","supportedStrengths","criticalGaps","recurringGapTags","nextActions"
      ],
      properties:{
        title:{type:"string"},
        company:{type:"string"},
        location:{type:"string"},
        employmentType:{type:"string"},
        summary:{type:"string"},
        jobDescription:{type:"string"},
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
        topRequirements:stringArray,
        supportedStrengths:stringArray,
        criticalGaps:stringArray,
        recurringGapTags:stringArray,
        nextActions:stringArray
      }
    };

    const instructions = [
      "You are Deep Nexivra Career Agent's opportunity triage engine.",
      "Extract the job accurately, then compare it against the candidate's source-backed Career Graph.",
      "",
      "FIT LEVEL IS NOT A HIRING PREDICTION:",
      "- Strong: high evidence coverage with no obvious major unsupported must-have.",
      "- Moderate: meaningful evidence exists but important requirements are partial or transferable.",
      "- Stretch: one or more important requirements lack credible evidence.",
      "",
      "RULES:",
      "- Never infer candidate experience that is not in the supplied graph.",
      "- Keyword overlap alone is not evidence.",
      "- requirementMatch measures supported coverage of job requirements.",
      "- evidenceStrength measures how concrete/specific the supporting candidate evidence is.",
      "- readiness is Deep Nexivra's own preparation score, not an employer ATS score or hiring probability.",
      "- recurringGapTags must be short normalized capability labels such as 'Primavera P6', 'SQL', 'people management', or 'regulated manufacturing'.",
      "- Only include a recurringGapTag when the job genuinely asks for it and candidate evidence is missing/weak.",
      "- Preserve the useful job posting text in jobDescription, removing navigation/cookie/legal noise where possible.",
      "- Do not make claims about salary, visa, hiring odds, or company intent unless explicitly present in the job posting.",
      "- Keep dashboard prose concise."
    ].join("\n");

    const input = [
      "JOB PAGE / POSTING:",
      jobText,
      "",
      "CANDIDATE EXPERIENCE GRAPH:",
      JSON.stringify(experience).slice(0,22000),
      "",
      "CANDIDATE EVIDENCE CATALOG:",
      JSON.stringify(evidenceCatalog).slice(0,30000)
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer " + openAIKey()
      },
      body:JSON.stringify({
        model:process.env.OPENAI_CAREER_MODEL || "gpt-5.6-sol",
        reasoning:{effort:"high"},
        instructions,
        input,
        text:{format:{type:"json_schema",name:"deep_nexivra_job_triage",strict:true,schema}},
        max_output_tokens:10000,
        store:false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        ok:false,
        message:data && data.error && data.error.message ? data.error.message : "Job triage request failed"
      });
    }

    let outputText = data.output_text || "";
    if (!outputText && Array.isArray(data.output)) {
      data.output.forEach(function(item) {
        (item.content || []).forEach(function(content) {
          if (content.type === "output_text" && content.text) outputText += content.text;
        });
      });
    }

    const result = JSON.parse(outputText);
    ["requirementMatch","evidenceStrength","readiness"].forEach(function(key) {
      result.scores[key] = Math.max(0,Math.min(100,Math.round(Number(result.scores[key]) || 0)));
    });
    result.sourceUrl = sourceUrl || url || "";

    return res.status(200).json({ok:true,result});
  } catch (error) {
    return res.status(500).json({
      ok:false,
      message:error && error.message ? error.message : "Unable to import and triage this job"
    });
  }
}
