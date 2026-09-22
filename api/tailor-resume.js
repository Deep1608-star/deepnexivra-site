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
  const graph = body.careerGraph;
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const jobAnalysis = body.jobAnalysis && typeof body.jobAnalysis === "object" ? body.jobAnalysis : {};
  const masterResume = typeof body.masterResume === "string" ? body.masterResume.trim().slice(0, 30000) : "";
  const optimizationFeedback = body.optimizationFeedback && typeof body.optimizationFeedback === "object"
    ? body.optimizationFeedback
    : null;

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
      "experiences","optimizationSuggestions","warnings","quality"
    ],
    properties: {
      documentTitle: { type: "string" },
      targetRole: { type: "string" },
      professionalSummary: {
        type: "object",
        additionalProperties: false,
        required: ["text","sourceEvidenceIds","alternatives","improvementTip"],
        properties: {
          text: { type: "string" },
          sourceEvidenceIds: evidenceIdArray,
          alternatives: { type: "array", items: { type: "string" }, maxItems: 2 },
          improvementTip: { type: "string" }
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
                required: ["bulletId","text","sourceEvidenceIds","confidence","priority","rationale","alternatives","improvementTip"],
                properties: {
                  bulletId: { type: "string" },
                  text: { type: "string" },
                  sourceEvidenceIds: evidenceIdArray,
                  confidence: { type: "number", minimum: 0, maximum: 100 },
                  priority: { type: "number", minimum: 0, maximum: 100 },
                  rationale: { type: "string" },
                  alternatives: { type: "array", items: { type: "string" }, maxItems: 2 },
                  improvementTip: { type: "string" }
                }
              }
            }
          }
        }
      },
      optimizationSuggestions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["section","priority","issue","recommendation"],
          properties: {
            section: { type: "string" },
            priority: { type: "string", enum: ["high","medium","low"] },
            issue: { type: "string" },
            recommendation: { type: "string" }
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
    "- For the summary and each bullet, provide up to 2 stronger alternatives that remain fully supported by the SAME cited evidence IDs.",
    "- alternatives must improve clarity, job relevance, ATS retrieval, specificity, action/result structure, or recruiter scanability without adding unsupported facts.",
    "- improvementTip should briefly explain what would make the line stronger (for example: lead with outcome, reduce filler, surface a supported tool, or move the strongest phrase earlier).",
    "- optimizationSuggestions should identify the highest-value resume-level improvements for this target job. Focus on relevance, evidence placement, section order, missing proof, ATS clarity, and recruiter readability.",
    "- Never suggest deception, fake metrics, title inflation, hidden keywords, unsupported credentials, or claims designed only to bypass screening.",
    "",
    "TARGETING:",
    "- Use the supplied job analysis to prioritize must-have responsibilities and proven transferable strengths.",
    "- Optimize relevance for a human recruiter and text-based ATS retrieval separately from visual design.",
    "- Front-load the strongest supported evidence for the target role and prefer wording that a recruiter can understand in a 10-15 second first scan.",
    "- Use important target-job terminology when and only when the evidence genuinely supports that concept.",
    "- Treat the previous job analysis as a coverage checklist: every direct or transferable requirement that has supporting evidence should be represented somewhere in the resume unless doing so would duplicate stronger wording.",
    "- Preserve relevant source-backed duties, projects, tools, certifications, and accomplishments from the original evidence. Do not make the tailored resume less complete than the source when that content helps the target role.",
    "- Prefer the exact terminology used by the job posting when the supplied evidence explicitly supports the same concept. This is wording alignment, not permission to create new experience.",
    "- For supported requirements, make the evidence easy to find in the first scan: summary, core skills, and the most relevant role bullets should carry the strongest target-language coverage.",
    "- When OPTIMIZATION FEEDBACK is supplied, improve the resume specifically against the remaining supported gaps, missing supported terms, weak evidence placement, and recruiter/ATS weaknesses identified there.",
    "- Never try to eliminate a true evidence gap by inventing a claim. If the candidate does not support a requirement, preserve it as a gap rather than forcing the resume toward 100%.",
    "- Do not claim knowledge of an employer's internal ATS score.",
    "",
    "Return structured data only."
  ].join("\n");

  const input = [
    "TARGET JOB DESCRIPTION:",
    jobDescription,
    "",
    "PREVIOUS JOB ANALYSIS:",
    JSON.stringify(jobAnalysis).slice(0, 12000),
    "",
    "OPTIMIZATION FEEDBACK FROM POST-TAILOR RESCAN:",
    optimizationFeedback ? JSON.stringify(optimizationFeedback).slice(0, 12000) : "No post-tailor optimization feedback supplied.",
    "",
    "ORIGINAL RESUME TEXT (preserve relevant supported coverage; do not create claims from text that cannot be tied back to supplied evidence IDs):",
    masterResume || "Original resume text unavailable.",
    "",
    "ROLE CATALOG (metadata is immutable):",
    JSON.stringify(roleCatalog.slice(0, 15)),
    "",
    "EVIDENCE CATALOG (all generated claims must cite IDs from here):",
    JSON.stringify(evidenceCatalog.slice(0, 70))
  ].join("\n");

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

  function tokenize(value) {
    const stop = new Set(["the","and","for","with","that","this","from","your","you","our","are","will","have","has","had","into","their","they","job","role","work","team","years","year","experience","skills","skill","required","preferred","responsibilities","qualifications"]);
    return norm(value).split(" ").filter(function(token) {
      return token.length > 3 && !stop.has(token) && !/^\d+$/.test(token);
    });
  }

  const targetTerms = new Set(tokenize(jobDescription + " " + JSON.stringify(jobAnalysis || {})));

  function relevanceScore(text) {
    const terms = [...new Set(tokenize(text))];
    if (!terms.length || !targetTerms.size) return 35;
    let hits = 0;
    terms.forEach(function(term) { if (targetTerms.has(term)) hits++; });
    return Math.max(20, Math.min(100, Math.round(25 + hits * 12)));
  }

  function safeFallback(reason) {
    const experiences = [];
    const usedEvidence = new Set();

    roles.forEach(function(role) {
      const candidates = evidence.filter(function(record) {
        return evidenceMatchesRole(record, role) && (record.text || record.sourceSnippet);
      }).map(function(record) {
        return {
          record: record,
          priority: relevanceScore((record.title || "") + " " + (record.text || "") + " " + (record.sourceSnippet || ""))
        };
      }).sort(function(a,b) { return b.priority - a.priority; }).slice(0, 8);

      if (!candidates.length) return;

      experiences.push({
        roleId: role.roleId,
        bullets: candidates.map(function(item, index) {
          usedEvidence.add(item.record.evidenceId);
          return {
            bulletId: role.roleId + "-F" + String(index + 1).padStart(2, "0"),
            text: String(item.record.text || item.record.sourceSnippet || "").trim(),
            sourceEvidenceIds: [item.record.evidenceId],
            confidence: 100,
            priority: item.priority,
            rationale: "Direct source-backed evidence retained without semantic rewriting because the AI tailoring fallback was used.",
            alternatives: [],
            improvementTip: "Keep this claim source-backed; improve phrasing only after evidence validation."
          };
        })
      });
    });

    const skillCandidates = evidence.filter(function(record) {
      return (record.category === "Skill" || record.category === "Tool") && (record.title || record.text);
    }).map(function(record) {
      return {
        record: record,
        priority: relevanceScore((record.title || "") + " " + (record.text || ""))
      };
    }).sort(function(a,b) { return b.priority - a.priority; });

    const seenSkills = new Set();
    const coreSkills = [];
    skillCandidates.forEach(function(item) {
      const name = String(item.record.title || item.record.text || "").trim();
      const key = norm(name);
      if (!name || !key || seenSkills.has(key) || coreSkills.length >= 24) return;
      seenSkills.add(key);
      usedEvidence.add(item.record.evidenceId);
      coreSkills.push({
        name: name,
        sourceEvidenceIds: [item.record.evidenceId],
        reason: "Source-backed capability relevant to the target role."
      });
    });

    const summaryCandidates = roles.map(function(role) {
      const roleEvidence = evidence.filter(function(record) {
        return evidenceMatchesRole(record, role) && (record.text || record.sourceSnippet);
      }).sort(function(a,b) {
        return relevanceScore((b.title || "") + " " + (b.text || "")) -
          relevanceScore((a.title || "") + " " + (a.text || ""));
      });
      return {
        role: role,
        evidence: roleEvidence,
        score: roleEvidence.length
          ? relevanceScore((role.title || "") + " " + (role.summary || "") + " " + (roleEvidence[0].text || ""))
          : 0
      };
    }).filter(function(item) { return item.evidence.length; })
      .sort(function(a,b) { return b.score - a.score; });

    let fallbackSummaryText = "";
    let fallbackSummaryEvidence = [];
    if (summaryCandidates.length) {
      const best = summaryCandidates[0];
      fallbackSummaryEvidence = best.evidence.slice(0, 3).map(function(record) { return record.evidenceId; });
      const sourceSummary = String(best.role.summary || "").trim();
      if (sourceSummary) {
        fallbackSummaryText = sourceSummary;
      } else {
        const snippets = best.evidence.slice(0, 2).map(function(record) {
          return String(record.text || record.sourceSnippet || "").trim();
        }).filter(Boolean);
        fallbackSummaryText = snippets.join(" ");
      }
    }

    const priorities = [];
    experiences.forEach(function(exp) {
      exp.bullets.forEach(function(bullet) { priorities.push(bullet.priority); });
    });
    const avgPriority = priorities.length
      ? Math.round(priorities.reduce(function(a,b){ return a+b; },0) / priorities.length)
      : 0;

    return {
      documentTitle: (jobAnalysis.role || "Target Role") + " — Tailored Resume",
      targetRole: jobAnalysis.role || "Target Role",
      professionalSummary: {
        text: fallbackSummaryText,
        sourceEvidenceIds: fallbackSummaryEvidence,
        alternatives: [],
        improvementTip: "Fallback mode preserved a source-backed summary from the uploaded resume evidence."
      },
      coreSkills: coreSkills,
      experiences: experiences,
      optimizationSuggestions: [
        {
          section: "Experience",
          priority: "high",
          issue: "AI rewrite fallback was used.",
          recommendation: "Review the highest-priority source-backed bullets and strengthen wording without adding unsupported facts."
        }
      ],
      warnings: [
        "AI rewrite fallback used: " + reason,
        "Fallback bullets preserve verified source evidence verbatim and can be edited, then revalidated."
      ],
      quality: {
        groundingCoverage: experiences.length ? 100 : 0,
        atsSafety: 92,
        jobAlignment: avgPriority,
        notes: ["Fallback mode preserved a broader set of same-role evidence and source-backed skills instead of compressing the resume."]
      }
    };
  }

  async function callTailorModel(model, effort, timeoutMs) {
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
          input: input,
          text: {
            format: {
              type: "json_schema",
              name: "deep_nexivra_tailored_resume",
              strict: true,
              schema: schema
            }
          },
          max_output_tokens: 10500,
          store: false
        })
      });
      const data = await response.json();
      return { response: response, data: data };
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    let attempt = null;
    const failureReasons = [];

    try {
      attempt = await callTailorModel(
        process.env.OPENAI_TAILOR_MODEL || process.env.OPENAI_CAREER_MODEL || "gpt-5.6-sol",
        "high",
        140000
      );
      if (!attempt.response.ok) {
        failureReasons.push(
          attempt.data && attempt.data.error && attempt.data.error.message
            ? "primary: " + attempt.data.error.message
            : "primary model returned an error"
        );
        attempt = null;
      }
    } catch (error) {
      failureReasons.push(
        error && error.name === "AbortError"
          ? "primary tailoring request timed out"
          : "primary: " + (error && error.message ? error.message : "request failed")
      );
      attempt = null;
    }

    if (!attempt) {
      try {
        const backup = await callTailorModel(
          process.env.OPENAI_TAILOR_FALLBACK_MODEL || "gpt-5.6-terra",
          "medium",
          105000
        );
        if (backup.response.ok) {
          attempt = backup;
        } else {
          failureReasons.push(
            backup.data && backup.data.error && backup.data.error.message
              ? "backup: " + backup.data.error.message
              : "backup model returned an error"
          );
        }
      } catch (fallbackError) {
        failureReasons.push(
          fallbackError && fallbackError.name === "AbortError"
            ? "backup tailoring request timed out"
            : "backup: " + (fallbackError && fallbackError.message ? fallbackError.message : "request failed")
        );
      }
    }

    if (!attempt) {
      const result = safeFallback(failureReasons.join("; ") || "AI tailoring models were unavailable");
      if (!result.experiences.length) {
        return res.status(422).json({ ok: false, message: "No role-specific evidence was available to build a safe fallback resume" });
      }
      return res.status(200).json({
        ok: true,
        result: result,
        fallback: true,
        fallbackReason: failureReasons.join("; ")
      });
    }

    const response = attempt.response;
    const data = attempt.data;

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
          priority: Math.max(0, Math.min(100, Math.round(Number(bullet.priority) || 0))),
          alternatives: (bullet.alternatives || []).map(function(value) { return String(value || "").trim(); }).filter(Boolean).slice(0, 2),
          improvementTip: String(bullet.improvementTip || "").trim()
        });
      }).filter(Boolean);
      if (!bullets.length) return null;
      return { roleId: exp.roleId, bullets: bullets };
    }).filter(Boolean);

    const validIdSet = new Set(evidenceIds);
    result.professionalSummary.alternatives = (result.professionalSummary.alternatives || []).map(function(value) {
      return String(value || "").trim();
    }).filter(Boolean).slice(0, 2);
    result.professionalSummary.improvementTip = String(result.professionalSummary.improvementTip || "").trim();
    result.optimizationSuggestions = (result.optimizationSuggestions || []).slice(0, 8);

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
      const fallback = safeFallback("AI output contained no bullets with valid same-role evidence");
      if (!fallback.experiences.length) {
        return res.status(422).json({
          ok: false,
          message: "No role-specific evidence-grounded bullets could be generated for this target job"
        });
      }
      return res.status(200).json({ ok: true, result: fallback, fallback: true });
    }

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    const reason = error && error.name === "AbortError"
      ? "tailoring request timed out"
      : (error && error.message ? error.message : "tailoring request failed");
    const fallback = safeFallback(reason);
    if (fallback.experiences.length) {
      return res.status(200).json({ ok: true, result: fallback, fallback: true });
    }
    return res.status(500).json({
      ok: false,
      message: "Unable to generate the tailored resume: " + reason
    });
  }
}
