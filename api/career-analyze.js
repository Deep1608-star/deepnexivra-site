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
  const resume = body.resume;
  const jobDescription = body.jobDescription;
  const evidenceVault = Array.isArray(body.evidenceVault) ? body.evidenceVault : [];
  const careerGraph = body.careerGraph && typeof body.careerGraph === "object" ? body.careerGraph : null;
  const analysisMode = body.analysisMode === "tailored-resume" ? "tailored-resume" : "candidate-fit";
  const referenceRequirements = Array.isArray(body.referenceRequirements)
    ? body.referenceRequirements.slice(0, 20).map(function(item) {
        return {
          requirement: String(item && item.requirement || "").trim(),
          originalStatus: String(item && item.status || "").trim(),
          originalEvidence: String(item && item.evidence || "").trim()
        };
      }).filter(function(item) { return item.requirement; })
    : [];

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
    analysisMode === "tailored-resume"
      ? "TAILORED RESUME MODE: score requirementMatch from what the generated resume itself explicitly communicates. Use the Career Graph and Evidence Vault only to verify truth; do not count hidden evidence that is absent from the resume as a matched requirement."
      : "CANDIDATE FIT MODE: resume, verified evidence, and Career Graph may all contribute to supported requirement coverage.",
    "Use transferable when related capability exists but the exact requirement is not proven.",
    "Use gap when support is missing or too weak.",
    "Do not pretend to know an employer's internal ATS score. ATS Readability is Deep Nexivra's own text-level assessment.",
    referenceRequirements.length
      ? "CANONICAL REQUIREMENT MODE: evaluate exactly the supplied reference requirements. Do not replace them, merge them away, or introduce a different requirement set. Return one requirement result for each reference requirement in the same order."
      : "Identify 8-14 high-value requirements when the posting supports that many.",
    "Treat keyword presence as insufficient by itself for direct evidence.",
    "Use the Career Graph to find stronger source-backed relationships across roles, tools, achievements, education, and projects, but never treat graph structure as permission to add a claim that is not supported by candidate evidence.",
    "In evidence, paraphrase the actual supporting candidate fact.",
    "Return 18-30 high-value ATS search terms from the job posting. Prefer concrete tools, hard skills, certifications, qualifications, domain terms, named responsibilities, and genuinely meaningful soft skills.",
    "For every keyword classify category as hard_skill, tool, certification, qualification, responsibility, soft_skill, or domain.",
    "For every keyword classify importance as high, medium, or low based on whether it is a must-have, repeated core responsibility, preferred requirement, or incidental phrase.",
    "Provide 0-4 common aliases or equivalent spellings only when they genuinely refer to the same concept.",
    "Do not use generic filler terms such as team, work, role, candidate, company, opportunity, environment, responsibilities, or experience as keywords.",
    "The server will calculate frequency, weighted points, and exact resume presence deterministically after extraction.",
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
    "CANONICAL REFERENCE REQUIREMENTS:",
    referenceRequirements.length ? JSON.stringify(referenceRequirements) : "No canonical requirement list supplied; identify the important requirements from the posting.",
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
          required: ["keyword","present","category","importance","aliases"],
          properties: {
            keyword: { type: "string" },
            present: { type: "boolean" },
            category: {
              type: "string",
              enum: ["hard_skill","tool","certification","qualification","responsibility","soft_skill","domain"]
            },
            importance: { type: "string", enum: ["high","medium","low"] },
            aliases: { type: "array", items: { type: "string" }, maxItems: 4 }
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

  function normalizeScanText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’\']/g, "")
      .replace(/[^a-z0-9+#.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function phraseCount(text, phrase) {
    const hay = " " + normalizeScanText(text) + " ";
    const needle = normalizeScanText(phrase);
    if (!needle) return 0;
    const token = " " + needle + " ";
    let count = 0;
    let from = 0;
    while (true) {
      const index = hay.indexOf(token, from);
      if (index < 0) break;
      count += 1;
      from = index + token.length - 1;
    }
    return count;
  }

  function termPresent(text, keyword, aliases) {
    const terms = [keyword].concat(Array.isArray(aliases) ? aliases : []).filter(Boolean);
    return terms.some(function(term) { return phraseCount(text, term) > 0; });
  }

  function keywordRawWeight(item) {
    const categoryBase = {
      hard_skill: 1.55, tool: 1.55, certification: 1.6, qualification: 1.45,
      responsibility: 1.25, domain: 1.15, soft_skill: 0.8
    };
    const importanceBase = { high: 1.45, medium: 1, low: 0.72 };
    const frequencyBoost = 1 + Math.min(Math.max((item.frequency || 1) - 1, 0), 5) * 0.2;
    return (categoryBase[item.category] || 1) * (importanceBase[item.importance] || 1) * frequencyBoost;
  }

  function enrichKeywordModel(items) {
    const seen = new Set();
    const cleaned = (Array.isArray(items) ? items : []).map(function(item) {
      const keyword = String(item && item.keyword || "").trim();
      const key = normalizeScanText(keyword);
      if (!keyword || !key || seen.has(key)) return null;
      seen.add(key);
      const aliases = (Array.isArray(item.aliases) ? item.aliases : [])
        .map(function(value) { return String(value || "").trim(); })
        .filter(Boolean)
        .slice(0, 4);
      let frequency = phraseCount(jobDescription, keyword);
      aliases.forEach(function(alias) { frequency = Math.max(frequency, phraseCount(jobDescription, alias)); });
      frequency = Math.max(1, frequency);
      return {
        keyword: keyword, category: item.category || "domain", importance: item.importance || "medium",
        aliases: aliases, frequency: frequency, present: termPresent(resume, keyword, aliases),
        excluded: false, rawWeight: 0, points: 0
      };
    }).filter(Boolean).slice(0, 30);

    cleaned.forEach(function(item) { item.rawWeight = keywordRawWeight(item); });
    const total = cleaned.reduce(function(sum,item) { return sum + item.rawWeight; }, 0) || 1;
    cleaned.forEach(function(item) {
      item.points = Math.max(0.5, Math.round((item.rawWeight / total) * 1000) / 10);
      delete item.rawWeight;
    });
    return cleaned;
  }

  function keywordScore(items) {
    const active = (items || []).filter(function(item) { return !item.excluded; });
    const total = active.reduce(function(sum,item) { return sum + Number(item.points || 0); }, 0);
    if (!total) return 0;
    const earned = active.reduce(function(sum,item) { return sum + (item.present ? Number(item.points || 0) : 0); }, 0);
    return Math.max(0, Math.min(100, Math.round((earned / total) * 100)));
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openAIKey()
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
    result.keywords = enrichKeywordModel(result.keywords);
    result.keywordStats = {
      score: keywordScore(result.keywords),
      matched: result.keywords.filter(function(item) { return item.present; }).length,
      missing: result.keywords.filter(function(item) { return !item.present; }).length,
      total: result.keywords.length,
      model: "weighted-keyword-v1"
    };

    if (referenceRequirements.length) {
      const normalizeRequirement = function(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      };
      const returned = Array.isArray(result.requirements) ? result.requirements : [];
      result.requirements = referenceRequirements.map(function(ref) {
        const refKey = normalizeRequirement(ref.requirement);
        const match = returned.find(function(item) {
          const itemKey = normalizeRequirement(item && item.requirement);
          return itemKey === refKey ||
            (itemKey && refKey && (itemKey.includes(refKey) || refKey.includes(itemKey)));
        });
        if (!match) {
          return {
            requirement: ref.requirement,
            status: "gap",
            evidence: "No explicit support for this canonical requirement was found in the scored resume."
          };
        }
        return {
          requirement: ref.requirement,
          status: match.status === "direct" || match.status === "transferable" ? match.status : "gap",
          evidence: String(match.evidence || "")
        };
      });
    }

    const clamp = function(n) {
      return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    };

    let requirementItems = Array.isArray(result.requirements) ? result.requirements : [];

    if (referenceRequirements.length) {
      const normalizeRequirement = function(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      };
      const returned = requirementItems.slice();

      requirementItems = referenceRequirements.map(function(reference, index) {
        const key = normalizeRequirement(reference.requirement);
        let matched = returned.find(function(item) {
          return normalizeRequirement(item && item.requirement) === key;
        });

        if (!matched && returned[index]) matched = returned[index];

        const status = matched && (
          matched.status === "direct" ||
          matched.status === "transferable" ||
          matched.status === "gap"
        ) ? matched.status : "gap";

        return {
          requirement: reference.requirement,
          status: status,
          evidence: matched && matched.evidence
            ? String(matched.evidence)
            : "No clear support was identified in this resume version."
        };
      });

      result.requirements = requirementItems;
    }

    if (result.keywordStats && result.keywordStats.total) {
      result.scores.requirementMatch = clamp(result.keywordStats.score);
    } else if (requirementItems.length) {
      const coveragePoints = requirementItems.reduce(function(total, item) {
        if (item.status === "direct") return total + 100;
        if (item.status === "transferable") return total + 55;
        return total;
      }, 0);
      result.scores.requirementMatch = clamp(coveragePoints / requirementItems.length);
    } else {
      result.scores.requirementMatch = clamp(result.scores.requirementMatch);
    }
    result.scores.evidenceStrength = clamp(result.scores.evidenceStrength);
    result.scores.atsReadability = clamp(result.scores.atsReadability);
    result.scores.recruiterQuality = clamp(result.scores.recruiterQuality);
    result.scores.readiness = clamp(result.scores.readiness);

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Career analysis failed" });
  }
}
