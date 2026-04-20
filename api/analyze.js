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
You are an execution intelligence system.

Analyze based on:

Idea: ${idea}
Location: ${location}
Budget: ${budget}
Timeline: ${timeline}

Return ONLY JSON:

{
  "marketSummary": "",
  "executionDifficulty": "",
  "riskLevel": "",
  "timeToLaunch": "",
  "laborNeeds": "",
  "estimatedCostRange": "",
  "roiPotential": "",
  "basicSteps": [],
  "verdict": ""
}
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