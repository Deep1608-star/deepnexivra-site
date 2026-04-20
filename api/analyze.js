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

Return ONLY valid JSON in this exact shape:

{
  "decision": "START or CAUTION or DO_NOT_START",
  "confidence": 0,
  "businessSummary": "string",
  "viabilityScore": 0,
  "marketSummary": "string",
  "executionDifficulty": "Low or Medium or High",
  "riskLevel": "Low or Medium or High",
  "timeToLaunch": "string",
  "laborNeeds": "string",
  "estimatedCostRange": "string",
  "roiPotential": "string",
  "verdict": "string",
  "pricingStrategy": "string",
  "revenueModel": "string",
  "firstCustomerPlan": ["string", "string", "string", "string"],
  "monetizationSteps": ["string", "string", "string", "string"],
  "first30DayPlan": ["string", "string", "string", "string"],
  "basicSteps": ["string", "string", "string", "string", "string"]
}

Rules:
- decision must be exactly START, CAUTION, or DO_NOT_START
- confidence must be a number from 1 to 100
- viabilityScore must be a number from 1 to 100
- executionDifficulty must be exactly Low, Medium, or High
- riskLevel must be exactly Low, Medium, or High
- be concise, practical, realistic, and money-oriented
- pricingStrategy should explain how to price the service/product
- revenueModel should explain how the business makes money
- firstCustomerPlan should focus on how to get initial customers
- monetizationSteps should focus on turning the idea into revenue quickly
- do not include markdown
- do not include any text before or after the JSON
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

    if (!response.ok) {
      return res.status(500).json({
        ok: false,
        message: data.error?.message || "OpenAI request failed",
        debug: data
      });
    }

    const text =
      data.output?.[0]?.content?.[0]?.text ||
      data.output_text ||
      "";

    if (!text) {
      return res.status(500).json({
        ok: false,
        message: "No AI response text received",
        debug: data
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      return res.status(500).json({
        ok: false,
        message: "AI returned invalid JSON",
        raw: text
      });
    }

    return res.status(200).json({
      ok: true,
      result: parsed
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Server request failed"
    });
  }
}