export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Method not allowed"
    });
  }

  const { idea, location, budget, timeline } = req.body || {};

  if (!idea || !idea.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Business idea is required"
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: `
You are an execution intelligence analyst for early-stage businesses.

Analyze the user's business idea using practical business reasoning.

Consider:
- market demand
- launch difficulty
- cost realism
- labor needs
- expected timeline
- near-term execution feasibility

Return ONLY valid JSON in this exact shape:

{
  "businessSummary": "",
  "viabilityScore": 0,
  "marketSummary": "",
  "executionDifficulty": "",
  "riskLevel": "",
  "timeToLaunch": "",
  "laborNeeds": "",
  "estimatedCostRange": "",
  "roiPotential": "",
  "verdict": "",
  "first30DayPlan": [
    "",
    "",
    "",
    ""
  ],
  "basicSteps": [
    "",
    "",
    "",
    "",
    ""
  ]
}

Rules:
- viabilityScore must be a number from 1 to 100
- executionDifficulty must be Low, Medium, or High
- riskLevel must be Low, Medium, or High
- be concise, realistic, and practical
- do not include markdown
`
          },
          {
            role: "user",
            content: `
Idea: ${idea}
Location: ${location || "Not provided"}
Budget: ${budget || "Not provided"}
Timeline: ${timeline || "Not provided"}
`
          }
        ]
      })
    });

    const data = await response.json();

    const text =
      data.output?.[0]?.content?.[0]?.text ||
      data.output_text ||
      "";

    if (!text) {
      return res.status(500).json({
        ok: false,
        message: "No AI response received"
      });
    }

    const parsed = JSON.parse(text);

    return res.status(200).json({
      ok: true,
      result: parsed
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "AI request failed"
    });
  }
}