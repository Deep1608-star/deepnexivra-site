export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const { idea, location, budget, timeline, isPaid } = req.body || {};

  if (!idea) {
    return res.status(400).json({
      ok: false,
      message: "Idea required"
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
You are a business execution analyst.

Return ONLY JSON in this exact structure:

{
  "decision": "START or CAUTION or DO_NOT_START",
  "confidence": 0,
  "viabilityScore": 0,
  "verdict": "string",
  "businessSummary": "string",
  "marketSummary": "string",
  "executionDifficulty": "Low or Medium or High",
  "riskLevel": "Low or Medium or High",
  "timeToLaunch": "string",
  "laborNeeds": "string",
  "estimatedCostRange": "string",
  "roiPotential": "string",

  "pricingStrategy": "string",
  "revenueModel": "string",
  "firstCustomerPlan": ["string","string","string"],
  "monetizationSteps": ["string","string","string"],
  "first30DayPlan": ["string","string","string"],
  "basicSteps": ["string","string","string"]
}

If Paid = false → still generate everything but it will be hidden later.
No extra text. JSON only.
`
          },
          {
            role: "user",
            content: `
Idea: ${idea}
Location: ${location || "Not provided"}
Budget: ${budget || "Not provided"}
Timeline: ${timeline || "Not provided"}
Paid: ${isPaid}
`
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.output?.[0]?.content?.[0]?.text || "{}";

    let parsed = JSON.parse(text);

    // 🔒 REMOVE premium fields if NOT paid
    if (!isPaid) {
      delete parsed.pricingStrategy;
      delete parsed.revenueModel;
      delete parsed.firstCustomerPlan;
      delete parsed.monetizationSteps;
      delete parsed.first30DayPlan;
      delete parsed.basicSteps;
    }

    return res.status(200).json({
      ok: true,
      result: parsed
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err.message
    });
  }
}