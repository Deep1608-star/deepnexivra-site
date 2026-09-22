function openAIKey() {
  return String(process.env.OPENAI_API_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const graph = body.careerGraph;
  const claims = Array.isArray(body.claims) ? body.claims.slice(0, 60) : [];

  if (!graph || !Array.isArray(graph.evidenceRecords) || !Array.isArray(graph.experience)) {
    return res.status(400).json({ ok: false, message: "Career Graph is required" });
  }
  if (!claims.length) {
    return res.status(400).json({ ok: false, message: "No accepted claims were supplied for validation" });
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

  const roleMap = new Map(roles.map(function(role) { return [role.roleId, role]; }));
  const evidenceMap = new Map(evidence.map(function(record) { return [record.evidenceId, record]; }));

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

  const prevalidated = claims.map(function(claim) {
    const role = claim.roleId ? roleMap.get(claim.roleId) : null;
    const validEvidence = (claim.sourceEvidenceIds || []).map(function(id) {
      return evidenceMap.get(id);
    }).filter(Boolean).filter(function(record) {
      return role ? evidenceMatchesRole(record, role) : true;
    });

    return {
      claimId: String(claim.claimId || ""),
      claimLabel: String(claim.claimLabel || claim.claimId || "Claim"),
      text: String(claim.text || "").trim(),
      roleId: String(claim.roleId || ""),
      evidence: validEvidence.map(function(record) {
        return {
          evidenceId: record.evidenceId,
          text: record.text || "",
          sourceSnippet: record.sourceSnippet || "",
          employer: record.employer || "",
          role: record.role || ""
        };
      })
    };
  });

  const noEvidenceFindings = prevalidated.filter(function(item) {
    return !item.text || !item.evidence.length;
  }).map(function(item) {
    return {
      claimId: item.claimId,
      claimLabel: item.claimLabel,
      status: "unsupported",
      confidence: 100,
      explanation: item.text
        ? "No valid cited evidence remains for this claim after role/evidence validation."
        : "The claim is empty.",
      suggestedText: ""
    };
  });

  const aiClaims = prevalidated.filter(function(item) {
    return item.text && item.evidence.length;
  });

  if (!aiClaims.length) {
    return res.status(200).json({
      ok: true,
      result: {
        status: "blocked",
        checkedAt: new Date().toISOString(),
        summary: "Accepted content contains unsupported claims or missing evidence links.",
        findings: noEvidenceFindings
      }
    });
  }

  const claimIds = aiClaims.map(function(item) { return item.claimId; });

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["findings"],
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claimId","claimLabel","status","confidence","explanation","suggestedText"],
          properties: {
            claimId: { type: "string", enum: claimIds },
            claimLabel: { type: "string" },
            status: { type: "string", enum: ["supported","overstated","unsupported"] },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            explanation: { type: "string" },
            suggestedText: { type: "string" }
          }
        }
      }
    }
  };

  const instructions = [
    "You are Deep Nexivra's claim integrity validator.",
    "Evaluate each edited resume claim ONLY against its supplied source evidence.",
    "",
    "CLASSIFICATION:",
    "- supported: every material factual assertion is supported by the evidence; normal concise paraphrase is acceptable.",
    "- overstated: the underlying experience is real, but the wording increases scope, ownership, seniority, certainty, metric, impact, tool proficiency, or responsibility beyond the evidence.",
    "- unsupported: one or more material claims have no support in the supplied evidence, or the wording contradicts the evidence.",
    "",
    "RULES:",
    "- Do not use world knowledge or assumptions to fill gaps.",
    "- Do not infer management from coordination, proficiency from exposure, ownership from participation, or quantified impact from unquantified work.",
    "- Exact metrics must be explicitly present in evidence.",
    "- Job titles, employers, dates, credentials, certifications, tools, and domains cannot be invented.",
    "- For overstated or unsupported claims, suggestedText should be a conservative correction that remains useful while staying within the evidence. If no safe correction exists, return an empty suggestedText.",
    "- For supported claims, suggestedText should be empty.",
    "- Keep explanations concise."
  ].join("\n");

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
        input: JSON.stringify(aiClaims),
        text: {
          format: {
            type: "json_schema",
            name: "deep_nexivra_claim_validation",
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
        message: data && data.error && data.error.message ? data.error.message : "Claim validation failed"
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

    const parsed = JSON.parse(outputText);
    const resultMap = new Map((parsed.findings || []).map(function(item) {
      item.confidence = Math.max(0, Math.min(100, Math.round(Number(item.confidence) || 0)));
      return [item.claimId, item];
    }));

    const findings = [];
    aiClaims.forEach(function(claim) {
      const item = resultMap.get(claim.claimId);
      if (item) findings.push(item);
      else {
        findings.push({
          claimId: claim.claimId,
          claimLabel: claim.claimLabel,
          status: "unsupported",
          confidence: 50,
          explanation: "The validator did not return a determination for this claim.",
          suggestedText: ""
        });
      }
    });
    findings.push.apply(findings, noEvidenceFindings);

    const blocked = findings.some(function(item) {
      return item.status === "overstated" || item.status === "unsupported";
    });

    return res.status(200).json({
      ok: true,
      result: {
        status: blocked ? "blocked" : "valid",
        checkedAt: new Date().toISOString(),
        summary: blocked
          ? "Some accepted claims exceed or lack their cited evidence. Correct them and validate again before export."
          : "All accepted claims are supported by their cited evidence.",
        findings: findings
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Unable to validate edited resume claims" });
  }
}
