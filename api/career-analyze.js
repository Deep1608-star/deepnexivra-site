export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const resume = body.resume;
  const jobDescription = body.jobDescription;
  const evidenceVault = Array.isArray(body.evidenceVault) ? body.evidenceVault : [];

  if (!resume || !jobDescription) {
    return res.status(400).json({ ok: false, message: "Resume and job description are required" });
  }

  if (resume.length > 30000 || jobDescription.length > 30000) {
    return res.status(413).json({ ok: false, message: "Input too large" });
  }

  const vaultText = evidenceVault.slice(0, 30).map(function(e, i) {
    return (i + 1) + ". [" + (e.category || "Evidence") + "] " + (e.title || "") + ": " + (e.text || "");
  }).join("\n");

  const instructions = [
    "You are Deep Nexivra Career Intelligence Engine, an evidence-first resume and job analysis system.",
    "PRIMARY RULE: truth preservation. Never invent experience, metrics, education, certifications, job titles, employers, technologies, responsibilities, dates, or achievements.",
    "A requirement is direct only when explicit supporting evidence exists in the resume or verified evidence vault.",
    "Use transferable when related capability exists but the exact requirement is not proven.",
    "Use gap when support is missing or too weak.",
    "Do not pretend to know an employer's internal ATS score. ATS Readability is Deep Nexivra's own text-level assessment.",
    "Identify 8-14 high-value requirements when the posting supports that many.",
    "Treat keyword presence as insufficient by itself for direct evidence.",
    "Use the Career Graph to find stronger source-backed relationships across roles, tools, achievements, education, and projects, but never treat graph structure as permission to add a claim that is not supported by candidate evidence.",
    "In evidence, paraphrase the actual supporting candidate fact.",
    "Return 10-18 high-value role terms, tools, competencies, certifications, or domain phrases.",
    "present=true only when candidate material genuinely contains or clearly supports the concept.",
    "Give 4-8 rewrite recommendations. When evidence is missing, make the recommendation conditional instead of inventing content.",
    "Generate 6-10 interview questions based on key responsibilities, gaps, and claims likely to be tested.",
    "Score requirementMatch from supported job requirement coverage.",
    "Score evidenceStrength from specificity, measurable proof, context, actions, tools, scope, and outcomes.",
    "Score atsReadability from standard headings, text structure, wording clarity, and likely parseability, without claiming knowledge of an employer's ATS.",
    "Score recruiterQuality from relevance, clarity, credibility, seniority alignment, specificity, and impact.",
    "Score readiness as a weighted synthesis with important must-have gaps penalized.",
    "Keep all dashboard strings concise."
  ].join("\n");

  const graphText = careerGraph
    ? JSON.stringify({
        profile: careerGraph.profile || {},
        experience: careerGraph.experience || [],
        education: careerGraph.education || [],
        certifications: careerGraph.certifications || [],
        projects: careerGraph.projects || [],
        skills: careerGraph.skills || [],
        evidenceRecords: (careerGraph.evidenceRecords || []).slice(0, 60)
      }).slice(0, 30000)
    : "No structured Career Graph supplied.";

  const input = [
    "TARGET JOB DESCRIPTION:",
    jobDescription,
    "",
    "CANDIDATE RESUME:",
    resume,
    "",
    "VERIFIED EVIDENCE VAULT:",
    vaultText || "No additional verified evidence supplied.",
    "",
    "STRUCTURED CAREER GRAPH:",
    graphText
  ].join("\n");

  const stringArray = {
    type: "array",
    items: { type: "string" }
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "role","summary","scores","requirements","keywords","atsIssues",
      "strengths","rewrites","nextActions","interviewQuestions"
    ],
    properties: {
      role: { type: "string" },
      summary: { type: "string" },
      scores: {
        type: "object",
        additionalProperties: false,
        required: ["requirementMatch","evidenceStrength","atsReadability","recruiterQuality","readiness"],
        properties: {
          requirementMatch: { type: "number", minimum: 0, maximum: 100 },
          evidenceStrength: { type: "number", minimum: 0, maximum: 100 },
          atsReadability: { type: "number", minimum: 0, maximum: 100 },
          recruiterQuality: { type: "number", minimum: 0, maximum: 100 },
          readiness: { type: "number", minimum: 0, maximum: 100 }
        }
      },
      requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["requirement","status","evidence"],
          properties: {
            requirement: { type: "string" },
            status: { type: "string", enum: ["direct","transferable","gap"] },
            evidence: { type: "string" }
          }
        }
      },
      keywords: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["keyword","present"],
          properties: {
            keyword: { type: "string" },
            present: { type: "boolean" }
          }
        }
      },
      atsIssues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["level","text"],
          properties: {
            level: { type: "string", enum: ["good","warn"] },
            text: { type: "string" }
          }
        }
      },
      strengths: stringArray,
      rewrites: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title","suggestion"],
          properties: {
            title: { type: "string" },
            suggestion: { type: "string" }
          }
        }
      },
      nextActions: stringArray,
      interviewQuestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question","why"],
          properties: {
            question: { type: "string" },
            why: { type: "string" }
          }
        }
      }
    }
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CAREER_MODEL || "gpt-5.6-sol",
        reasoning: { effort: "high" },
        instructions: instructions,
        input: input,
        text: {
          format: {
            type: "json_schema",
            name: "deep_nexivra_career_analysis",
            strict: true,
            schema: schema
          }
        },
        max_output_tokens: 9000,
        store: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data && data.error && data.error.message ? data.error.message : "OpenAI request failed"
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
    const clamp = function(n) {
      return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    };

    result.scores.requirementMatch = clamp(result.scores.requirementMatch);
    result.scores.evidenceStrength = clamp(result.scores.evidenceStrength);
    result.scores.atsReadability = clamp(result.scores.atsReadability);
    result.scores.recruiterQuality = clamp(result.scores.recruiterQuality);
    result.scores.readiness = clamp(result.scores.readiness);

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Career analysis failed" });
  }
}
