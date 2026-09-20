export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const graph = body.careerGraph;
  const resume = body.approvedResume;
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const jobAnalysis = body.jobAnalysis && typeof body.jobAnalysis === "object" ? body.jobAnalysis : {};
  const customQuestions = Array.isArray(body.customQuestions)
    ? body.customQuestions.map(function(q) { return String(q || "").trim(); }).filter(Boolean).slice(0, 12)
    : [];

  if (!graph || !Array.isArray(graph.evidenceRecords)) {
    return res.status(400).json({ ok: false, message: "Career Graph is required" });
  }
  if (!resume || !Array.isArray(resume.experiences) || !resume.experiences.length) {
    return res.status(400).json({ ok: false, message: "An approved tailored resume is required" });
  }
  if (jobDescription.length < 200) {
    return res.status(400).json({ ok: false, message: "Target job description is required" });
  }

  const evidence = graph.evidenceRecords.map(function(record, index) {
    return Object.assign({}, record, {
      evidenceId: record.evidenceId || ("E" + String(index + 1).padStart(3, "0"))
    });
  });
  const evidenceIds = evidence.map(function(record) { return record.evidenceId; });

  const evidenceCatalog = evidence.map(function(record) {
    return {
      evidenceId: record.evidenceId,
      category: record.category || "",
      title: record.title || "",
      text: record.text || "",
      sourceSnippet: record.sourceSnippet || "",
      employer: record.employer || "",
      role: record.role || ""
    };
  });

  const sourceArray = {
    type: "array",
    items: { type: "string", enum: evidenceIds }
  };

  const commonQuestions = [
    "Tell us about yourself.",
    "Why are you interested in this role?",
    "Why are you a strong fit for this position?",
    "Describe a relevant achievement or example from your experience."
  ];

  const requestedQuestions = commonQuestions.concat(customQuestions);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["coverLetter","recruiterMessage","whyRole","answers","warnings"],
    properties: {
      coverLetter: {
        type: "object",
        additionalProperties: false,
        required: ["text","sourceEvidenceIds"],
        properties: {
          text: { type: "string" },
          sourceEvidenceIds: sourceArray
        }
      },
      recruiterMessage: {
        type: "object",
        additionalProperties: false,
        required: ["text","sourceEvidenceIds"],
        properties: {
          text: { type: "string" },
          sourceEvidenceIds: sourceArray
        }
      },
      whyRole: {
        type: "object",
        additionalProperties: false,
        required: ["text","sourceEvidenceIds"],
        properties: {
          text: { type: "string" },
          sourceEvidenceIds: sourceArray
        }
      },
      answers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question","answer","sourceEvidenceIds"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
            sourceEvidenceIds: sourceArray
          }
        }
      },
      warnings: {
        type: "array",
        items: { type: "string" }
      }
    }
  };

  const instructions = [
    "You are Deep Nexivra's Application Package Generator.",
    "Create application materials using ONLY the approved resume, target job, job analysis, and source-backed Career Graph evidence.",
    "",
    "TRUTH RULES:",
    "- Never invent or assume employer names, titles, dates, education, certifications, metrics, tools, responsibilities, achievements, legal work authorization, immigration status, salary expectations, availability, relocation willingness, references, or personal preferences.",
    "- Every factual candidate claim should be supportable by one or more evidence IDs.",
    "- If a custom question requires information not contained in the evidence or approved resume, clearly answer: 'User input required:' followed by what the user must provide. Do not fabricate an answer.",
    "- Do not claim direct experience when only transferable experience is supported.",
    "- Do not create company-specific facts unless they appear in the target job description.",
    "",
    "WRITING:",
    "- Cover letter: 300-450 words, professional, concise, no fake address block, start with 'Dear Hiring Team,' unless a named recipient is supplied in the job description.",
    "- Recruiter message: 60-110 words, suitable for LinkedIn or email outreach.",
    "- Why-role answer: 100-180 words, grounded in demonstrated fit and the responsibilities actually present in the job posting.",
    "- Common/custom answers: concise but complete; normally 100-220 words unless a shorter direct answer is clearly better.",
    "- Avoid generic flattery and unsupported adjectives.",
    "- Use evidence IDs only from the supplied catalog.",
    "- sourceEvidenceIds may be empty only when the answer explicitly requires user input and contains no candidate factual claim.",
    "",
    "Return one answer for every requested question in the same order."
  ].join("\n");

  const input = [
    "TARGET JOB DESCRIPTION:",
    jobDescription,
    "",
    "JOB ANALYSIS:",
    JSON.stringify(jobAnalysis).slice(0, 18000),
    "",
    "APPROVED TAILORED RESUME:",
    JSON.stringify(resume).slice(0, 24000),
    "",
    "CAREER EVIDENCE CATALOG:",
    JSON.stringify(evidenceCatalog).slice(0, 32000),
    "",
    "QUESTIONS TO ANSWER IN ORDER:",
    JSON.stringify(requestedQuestions)
  ].join("\n");

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
            name: "deep_nexivra_application_package",
            strict: true,
            schema: schema
          }
        },
        max_output_tokens: 14000,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data && data.error && data.error.message ? data.error.message : "Application package request failed"
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
    const valid = new Set(evidenceIds);

    function sanitizeAsset(asset) {
      asset = asset || { text: "", sourceEvidenceIds: [] };
      asset.sourceEvidenceIds = (asset.sourceEvidenceIds || []).filter(function(id) {
        return valid.has(id);
      });
      return asset;
    }

    result.coverLetter = sanitizeAsset(result.coverLetter);
    result.recruiterMessage = sanitizeAsset(result.recruiterMessage);
    result.whyRole = sanitizeAsset(result.whyRole);
    result.answers = (result.answers || []).map(function(answer, index) {
      const sanitized = sanitizeAsset(answer);
      sanitized.question = requestedQuestions[index] || sanitized.question || "";
      return sanitized;
    }).slice(0, requestedQuestions.length);

    while (result.answers.length < requestedQuestions.length) {
      result.answers.push({
        question: requestedQuestions[result.answers.length],
        answer: "User input required: Deep Nexivra could not produce a grounded answer from the available evidence.",
        sourceEvidenceIds: []
      });
    }

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Unable to generate the application package" });
  }
}
