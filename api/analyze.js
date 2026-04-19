export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Method not allowed"
    });
  }

  const { idea } = req.body || {};

  if (!idea || !idea.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Business idea is required"
    });
  }

  return res.status(200).json({
    ok: true,
    message: "Idea analyzed successfully",
    result: {
      originalIdea: idea,
      stage: "Initial concept received",
      marketType: "To be evaluated",
      executionDifficulty: "Medium",
      estimatedRisk: "Moderate",
      nextStep: "Run deeper research"
    }
  });
}