function openAIKey() {
  return String(process.env.OPENAI_API_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  if (!openAIKey()) {
    return res.status(503).json({ ok: false, message: "OPENAI_API_KEY is not configured for this Vercel environment" });
  }

  const body = req.body || {};
  const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
  const sourceFile = body.sourceFile && typeof body.sourceFile === "object" ? body.sourceFile : {};

  if (resumeText.length < 120) {
    return res.status(400).json({ ok: false, message: "Resume text is too short to structure reliably" });
  }

  if (resumeText.length > 50000) {
    return res.status(413).json({ ok: false, message: "Resume text exceeds the 50,000 character ingestion limit" });
  }

  const stringArray = { type: "array", items: { type: "string" } };

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "profile","experience","education","certifications","projects",
      "skills","evidenceRecords","warnings","resumeQuality"
    ],
    properties: {
      profile: {
        type: "object",
        additionalProperties: false,
        required: ["fullName","professionalHeadline","email","phone","location","links"],
        properties: {
          fullName: { type: "string" },
          professionalHeadline: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" },
          links: stringArray
        }
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "employer","title","location","startDate","endDate","isCurrent",
            "summary","responsibilities","achievements","tools","skills","metrics"
          ],
          properties: {
            employer: { type: "string" },
            title: { type: "string" },
            location: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            isCurrent: { type: "boolean" },
            summary: { type: "string" },
            responsibilities: stringArray,
            achievements: stringArray,
            tools: stringArray,
            skills: stringArray,
            metrics: stringArray
          }
        }
      },
      education: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["institution","credential","field","location","startDate","endDate","details"],
          properties: {
            institution: { type: "string" },
            credential: { type: "string" },
            field: { type: "string" },
            location: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            details: stringArray
          }
        }
      },
      certifications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name","issuer","date","credentialId"],
          properties: {
            name: { type: "string" },
            issuer: { type: "string" },
            date: { type: "string" },
            credentialId: { type: "string" }
          }
        }
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name","description","role","tools","skills","outcomes"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            role: { type: "string" },
            tools: stringArray,
            skills: stringArray,
            outcomes: stringArray
          }
        }
      },
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name","category","confidence","sourceSnippet"],
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            sourceSnippet: { type: "string" }
          }
        }
      },
      evidenceRecords: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["category","title","text","sourceSnippet","employer","role"],
          properties: {
            category: {
              type: "string",
              enum: ["Achievement","Responsibility","Skill","Tool","Certification","Project","Metric","Education"]
            },
            title: { type: "string" },
            text: { type: "string" },
            sourceSnippet: { type: "string" },
            employer: { type: "string" },
            role: { type: "string" }
          }
        }
      },
      warnings: stringArray,
      resumeQuality: {
        type: "object",
        additionalProperties: false,
        required: ["parseConfidence","chronologyConfidence","evidenceDensity","notes"],
        properties: {
          parseConfidence: { type: "number", minimum: 0, maximum: 100 },
          chronologyConfidence: { type: "number", minimum: 0, maximum: 100 },
          evidenceDensity: { type: "number", minimum: 0, maximum: 100 },
          notes: stringArray
        }
      }
    }
  };

  const instructions = [
    "You are the Deep Nexivra Resume Intelligence Engine.",
    "Convert resume text into a structured career evidence graph.",
    "",
    "NON-NEGOTIABLE TRUTH RULES:",
    "- Never invent or infer an employer, job title, date, degree, certification, skill, tool, metric, responsibility, project, location, contact detail, or achievement that is not supported by the supplied resume text.",
    "- If a field is not supported, return an empty string or empty array.",
    "- Do not upgrade vague language into a stronger claim.",
    "- Do not convert general exposure into proficiency.",
    "- Do not infer a certification from a skill, a degree from coursework, or management authority from coordination work.",
    "- Preserve chronology exactly when dates are present. If chronology is ambiguous, add a warning.",
    "",
    "SOURCE TRACEABILITY:",
    "- Every evidenceRecords item must be grounded in the resume.",
    "- sourceSnippet must be a short exact excerpt from the supplied resume text that supports the record. Keep it under 180 characters.",
    "- Skill sourceSnippet must also be an exact supporting excerpt.",
    "- Do not create evidence records for unsupported interpretations.",
    "",
    "STRUCTURING:",
    "- Experience should represent distinct positions or clearly distinct internal roles.",
    "- responsibilities are recurring duties; achievements are outcomes or improvements.",
    "- metrics contain only explicitly stated numbers, percentages, volumes, money, time, counts, or measurable scope.",
    "- tools are named systems, platforms, instruments, applications, methods, or technologies explicitly present.",
    "- skills can include domain, operational, analytical, technical, project, communication, or leadership skills only when supported.",
    "- Keep duplicate skills and evidence records to a minimum.",
    "- professionalHeadline should be conservative and based on the resume; otherwise return an empty string.",
    "",
    "QUALITY SCORES:",
    "- parseConfidence estimates how confidently the supplied text can be structured.",
    "- chronologyConfidence estimates clarity of role and education dates.",
    "- evidenceDensity estimates how much of the resume contains concrete, reusable evidence rather than generic claims.",
    "- These are Deep Nexivra internal diagnostics, not employer scores.",
    "",
    "Return concise structured data only."
  ].join("\n");

  const sourceDescription = [
    "SOURCE FILE:",
    "Name: " + (sourceFile.name || "Unknown"),
    "Type: " + (sourceFile.type || "Unknown"),
    "",
    "RESUME TEXT:",
    resumeText
  ].join("\n");

  try {
    async function callResumeModel(model, effort, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(function() { controller.abort(); }, timeoutMs);
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + openAIKey()
          },
          body: JSON.stringify({
            model: model,
            reasoning: { effort: effort },
            instructions: instructions,
            input: sourceDescription,
            text: {
              format: {
                type: "json_schema",
                name: "deep_nexivra_resume_graph",
                strict: true,
                schema: schema
              }
            },
            max_output_tokens: 8000,
            store: false
          })
        });
        const data = await response.json();
        return { response: response, data: data };
      } finally {
        clearTimeout(timer);
      }
    }

    let attempt;
    try {
      attempt = await callResumeModel(
        process.env.OPENAI_INGEST_MODEL || "gpt-5.6-terra",
        "medium",
        90000
      );
    } catch (error) {
      if (error && error.name !== "AbortError") throw error;
      attempt = await callResumeModel(
        process.env.OPENAI_INGEST_FALLBACK_MODEL || "gpt-5.6-luna",
        "low",
        70000
      );
    }

    const response = attempt.response;
    const data = attempt.data;

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data && data.error && data.error.message ? data.error.message : "Resume intelligence request failed"
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

    result.resumeQuality.parseConfidence = clamp(result.resumeQuality.parseConfidence);
    result.resumeQuality.chronologyConfidence = clamp(result.resumeQuality.chronologyConfidence);
    result.resumeQuality.evidenceDensity = clamp(result.resumeQuality.evidenceDensity);
    result.skills = (result.skills || []).map(function(skill) {
      skill.confidence = clamp(skill.confidence);
      return skill;
    });

    result.evidenceRecords = (result.evidenceRecords || []).map(function(record, index) {
      return Object.assign({}, record, {
        evidenceId: "E" + String(index + 1).padStart(3, "0")
      });
    });

    result.experience = (result.experience || []).map(function(role, index) {
      return Object.assign({}, role, {
        roleId: "R" + String(index + 1).padStart(3, "0")
      });
    });

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    const timeout = error && error.name === "AbortError";
    return res.status(timeout ? 504 : 500).json({
      ok: false,
      message: timeout
        ? "Career Graph generation timed out. Please try again; the faster fallback model will be used automatically."
        : "Unable to structure this resume into a Career Graph"
    });
  }
}
