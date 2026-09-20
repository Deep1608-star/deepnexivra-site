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
    "",
    "PRIMARY RULE: truth preservation. Never invent experience, metrics, education, certifications, job titles, employers, technologies, responsibilities, dates, or achievements.",
    "A requirement is direct only when explicit supporting evidence exists in the resume or verified evidence vault.",
    "Use transferable when related capability exists but the exact requirement is not proven.",
    "Use gap when support is missing or too weak.",
    "",
    "Do not pretend to know an employer's internal ATS score. ATS Readability is Deep Nexivra's own text-level assessment.",
    "",
    "Return ONLY valid JSON with this exact top-level shape:",
    "{",
    "  \"role\": \"string\",",
    "  \"summary\": \"string\",",
    "  \"scores\": {",
    "    \"requirementMatch\": 0,",
    "    \"evidenceStrength\": 0,",
    "    \"atsReadability\": 0,",
    "    \"recruiterQuality\": 0,",
    "    \"readiness\": 0",
    "  },",
    "  \"requirements\": [{\"requirement\":\"string\",\"status\":\"direct | transferable | gap\",\"evidence\":\"string\"}],",
    "  \"keywords\": [{\"keyword\":\"string\",\"present\":true}],",
    "  \"atsIssues\": [{\"level\":\"good | warn\",\"text\":\"string\"}],",
    "  \"strengths\": [\"string\"],",
    "  \"rewrites\": [{\"title\":\"string\",\"suggestion\":\"string\"}],",
    "  \"nextActions\": [\"string\"],",
    "  \"interviewQuestions\": [{\"question\":\"string\",\"why\":\"string\"}]",
    "}",
    "",
    "SCORING:",
    "- requirementMatch: coverage of important job requirements based on supported evidence.",
    "- evidenceStrength: specificity, measurable proof, context, actions, tools, scope, and outcomes.",
    "- atsReadability: standard headings, text structure, wording clarity, and likely parseability; never claim certainty about an employer ATS.",
    "- recruiterQuality: relevance, clarity, credibility, seniority alignment, specificity, and impact.",
    "- readiness: weighted synthesis of the four dimensions with must-have gaps penalized.",
    "",
    "ANALYSIS RULES:",
    "- Identify 8-14 high-value requirements when the posting supports that many.",
    "- Treat keyword presence as insufficient by itself for direct evidence.",
    "- In evidence, paraphrase the actual supporting candidate fact.",
    "- Return 10-18 high-value role terms, tools, competencies, certifications, or domain phrases.",
    "- present=true only when candidate material genuinely contains or clearly supports the concept.",
    "- Give 4-8 rewrite recommendations.",
    "- When evidence is missing, make the recommendation conditional instead of inventing content.",
    "- Generate 6-10 interview questions based on key responsibilities, gaps, and claims likely to be tested.",
    "- Keep the result concise enough for a dashboard."
  ].join("\n");

  const input = [
    "TARGET JOB DESCRIPTION:",
    jobDescription,
    "",
    "CANDIDATE RESUME:",
    resume,
    "",
    "VERIFIED EVIDENCE VAULT:",
    vaultText || "No additional verified evidence supplied."
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
        max_output_tokens: 9000
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

    outputText = outputText.trim();
    if (outputText.startsWith("~~~json")) outputText = outputText.slice(7);
    if (outputText.startsWith("~~~")) outputText = outputText.slice(3);
    if (outputText.endsWith("~~~")) outputText = outputText.slice(0, -3);
    if (outputText.startsWith("```json")) outputText = outputText.slice(7);
    if (outputText.startsWith("```")) outputText = outputText.slice(3);
    if (outputText.endsWith("```")) outputText = outputText.slice(0, -3);
    outputText = outputText.trim();

    const result = JSON.parse(outputText);
    const clamp = function(n) {
      return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    };

    if (!result.scores) result.scores = {};
    result.scores.requirementMatch = clamp(result.scores.requirementMatch);
    result.scores.evidenceStrength = clamp(result.scores.evidenceStrength);
    result.scores.atsReadability = clamp(result.scores.atsReadability);
    result.scores.recruiterQuality = clamp(result.scores.recruiterQuality);
    result.scores.readiness = clamp(result.scores.readiness);

    return res.status(200).json({ ok: true, result: result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Career analysis failed"
    });
  }
}
