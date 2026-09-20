export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const graph = body.careerGraph;
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const jobAnalysis = body.jobAnalysis && typeof body.jobAnalysis === "object" ? body.jobAnalysis : {};

  if (!graph || !Array.isArray(graph.experience) || !Array.isArray(graph.evidenceRecords)) {
    return res.status(400).json({ ok: false, message: "A structured Career Graph is required" });
  }
  if (jobDescription.length < 200) {
    return res.status(400).json({ ok: false, message: "A complete target job description is required" });
  }

  const roles = graph.experience.map(function(role, index) {
    return Object.assign({}, role, {
      roleId: role.roleId || ("R" + String(index + 1).padStart(3, "0"))
    });
  });

  const evidence = graph.evidenceRecords.map(function(record, index) {
    return Object.assign({}, record, {
      evidenceId: record.evidenceId || ("E" + String(index + 1).padStart(3, "0"))
    });
  });

  if (!roles.length || !evidence.length) {
    return res.status(400).json({ ok: false, message: "Career Graph does not contain enough role/evidence data" });
  }

  const roleIds = roles.map(function(role) { return role.roleId; });
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

  const roleCatalog = roles.map(function(role) {
    return {
      roleId: role.roleId,
      employer: role.employer || "",
      title: role.title || "",
      location: role.location || "",
      startDate: role.startDate || "",
      endDate: role.endDate || "",
      isCurrent: !!role.isCurrent,
      responsibilities: role.responsibilities || [],
      achievements: role.achievements || [],
      tools: role.tools || [],
      skills: role.skills || [],
      metrics: role.metrics || []
    };
  });

  const stringArray = { type: "array", items: { type: "string" } };
  const evidenceIdArray = {
    type: "array",
    minItems: 1,
    items: { type: "string", enum: evidenceIds }
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "documentTitle","targetRole","professionalSummary","coreSkills",
      "experiences","warnings","quality"
    ],
    properties: {
      documentTitle: { type: "string" },
      targetRole: { type: "string" },
      professionalSummary: {
        type: "object",
        additionalProperties: false,
        required: ["text","sourceEvidenceIds"],
        properties: {
          text: { type: "string" },
          sourceEvidenceIds: evidenceIdArray
        }
      },
      coreSkills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name","sourceEvidenceIds","reason"],
          properties: {
            name: { type: "string" },
            sourceEvidenceIds: evidenceIdArray,
            reason: { type: "string" }
          }
        }
      },
      experiences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["roleId","bullets"],
          properties: {
            roleId: { type: "string", enum: roleIds },
            bullets: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["bulletId","text","sourceEvidenceIds","confidence","priority","rationale"],
                properties: {
                  bulletId: { type: "string" },
                  text: { type: "string" },
                  sourceEvidenceIds: evidenceIdArray,
                  confidence: { type: "number", minimum: 0, maximum: 100 },
                  priority: { type: "number", minimum: 0, maximum: 100 },
                  rationale: { type: "string" }
                }
              }
            }
          }
        }
      },
      warnings: stringArray,
      quality: {
        type: "object",
        additionalProperties: false,
        required: ["groundingCoverage","atsSafety","jobAlignment","notes"],
        properties: {
          groundingCoverage: { type: "number", minimum: 0, maximum: 100 },
          atsSafety: { type: "number", minimum: 0, maximum: 100 },
          jobAlignment: { type: "number", minimum: 0, maximum: 100 },
          notes: stringArray
        }
      }
    }
  };

  const instructions = [
    "You are Deep Nexivra Resume Studio Pro.",
    "Create the strongest truthful, ATS-safe resume content for the target job using ONLY the structured Career Graph and evidence catalog.",
    "",
    "NON-NEGOTIABLE GROUNDING RULES:",
    "- Never invent or alter employer names, job titles, dates, locations, education, certifications, metrics, tools, responsibilities, scope, or outcomes.",
    "- Never add a skill or claim merely because it appears in the job description.",
    "- Every generated summary, skill, and experience bullet must cite one or more supplied evidence IDs.",
    "- Experience bullets must be supported by evidence belonging to that same role/employer. Do not borrow achievements from another employer.",
    "- Transferable skills may be framed as transferable but must never be represented as direct experience with an unsupported tool, domain, certification, or responsibility.",
    "- If a target requirement is unsupported, leave it out and include it in warnings when important.",
    "",
    "WRITING RULES:",
    "- Use concise professional English.",
    "- Prefer action + context + scope + outcome when all parts are supported.",
    "- Preserve explicit metrics exactly; never create approximate numbers.",
    "- Avoid keyword stuffing, empty adjectives, first-person pronouns, tables, icons, graphics, ratings, and unsupported superlatives.",
    "- Do not repeat the same evidence across many bullets.",
    "- Generally produce 2-5 bullets for the most relevant roles; fewer for low-relevance roles.",
    "- priority is a 0-100 job-relevance score used for one-page compression. Score importance to the target role, not writing quality.",
    "- It is acceptable to omit a role from the tailored experience output when it adds little job value, but never change a role's metadata.",
    "- Core skills should be job-relevant and source-supported.",
    "- The professional summary should be 2-4 concise sentences and source-supported.",
    "",
    "TARGETING:",
    "- Use the supplied job analysis to prioritize must-have responsibilities and proven transferable strengths.",
    "- Optimize relevance for a human recruiter and text-based ATS retrieval separately from visual design.",
    "- Do not claim knowledge of an employer's internal ATS score.",
    "",
    "Return structured data only."
  ].join("\n");

  const input = [
    "TARGET JOB DESCRIPTION:",
    jobDescription,
    "",
    "PREVIOUS JOB ANALYSIS:",
    JSON.stringify(jobAnalysis).slice(0, 18000),
    "",
    "ROLE CATALOG (metadata is immutable):",
    JSON.stringify(roleCatalog),
    "",
    "EVIDENCE CATALOG (all generated claims must cite IDs from here):",
    JSON.stringify(evidenceCatalog)
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
            name: "deep_nexivra_tailored_resume",
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
        message: data && data.error && data.error.message ? data.error.message : "Tailored resume request failed"
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
    const evidenceMap = new Map(evidence.map(function(item) { return [item.evidenceId, item]; }));
    const roleMap = new Map(roles.map(function(item) { return [item.roleId, item]; }));

    function norm(value) {
      return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }

    function evidenceMatchesRole(record, role) {
      if (!record || !role) return false;
      const recEmployer = norm(record.employer);
      const recRole = norm(record.role);
      const roleEmployer = norm(role.employer);
      const roleTitle = norm(role.title);

      if (recEmployer && roleEmployer && recEmployer === roleEmployer) {
        if (!recRole || !roleTitle) return true;
        return recRole === roleTitle || recRole.includes(roleTitle) || roleTitle.includes(recRole);
      }
      if (!recEmployer && recRole && roleTitle) {
        return recRole === roleTitle || recRole.includes(roleTitle) || roleTitle.includes(recRole);
      }
      return false;
    }

    let proposedBullets = 0;
    let retainedBullets = 0;

    result.experiences = (result.experiences || []).map(function(exp) {
      const role = roleMap.get(exp.roleId);
      if (!role) return null;
      const bullets = (exp.bullets || []).map(function(bullet, index) {
        proposedBullets++;
        const ids = (bullet.sourceEvidenceIds || []).filter(function(id) {
          const record = evidenceMap.get(id);
          return evidenceMatchesRole(record, role);
        });
        if (!ids.length) return null;
        retainedBullets++;
        return Object.assign({}, bullet, {
          bulletId: bullet.bulletId || (exp.roleId + "-B" + String(index + 1).padStart(2, "0")),
          sourceEvidenceIds: ids,
          confidence: Math.max(0, Math.min(100, Math.round(Number(bullet.confidence) || 0))),
          priority: Math.max(0, Math.min(100, Math.round(Number(bullet.priority) || 0)))
        });
      }).filter(Boolean);
      if (!bullets.length) return null;
      return { roleId: exp.roleId, bullets: bullets };
    }).filter(Boolean);

    const validIdSet = new Set(evidenceIds);
    result.professionalSummary.sourceEvidenceIds = (result.professionalSummary.sourceEvidenceIds || []).filter(function(id) {
      return validIdSet.has(id);
    });
    result.coreSkills = (result.coreSkills || []).map(function(skill) {
      return Object.assign({}, skill, {
        sourceEvidenceIds: (skill.sourceEvidenceIds || []).filter(function(id) { return validIdSet.has(id); })
      });
    }).filter(function(skill) {
      return skill.name && skill.sourceEvidenceIds.length;
    });

    if (!result.professionalSummary.sourceEvidenceIds.length) {
      result.professionalSummary.text = "";
    }

    const groundingCoverage = proposedBullets
      ? Math.round((retainedBullets / proposedBullets) * 100)
      : 0;

    result.quality.groundingCoverage = groundingCoverage;
    result.quality.atsSafety = Math.max(0, Math.min(100, Math.round(Number(result.quality.atsSafety) || 0)));
    result.quality.jobAlignment = Math.max(0, Math.min(100, Math.round(Number(result.quality.jobAlignment) || 0)));
    result.targetRole = jobAnalysis.role || result.targetRole || "Target Role";
    result.documentTitle = result.targetRole + " — Tailored Resume";

    if (retainedBullets === 0) {
      return res.status(422).json({
        ok: false,
        message: "No role-specific evidence-grounded bullets could be generated for this target job"
      });
    }

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unable to generate the tailored resume"
    });
  }
}
