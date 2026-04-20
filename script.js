const analyzeBtn = document.getElementById("analyzeBtn");
const ideaInput = document.getElementById("ideaInput");
const analysisResult = document.getElementById("analysisResult");

analyzeBtn.addEventListener("click", async () => {
  const idea = ideaInput.value.trim();

  if (!idea) {
    alert("Please enter a business idea");
    return;
  }

  analysisResult.innerHTML = "Analyzing...";

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idea })
    });

    const data = await res.json();

    if (!data.ok) {
      analysisResult.innerHTML = "Error analyzing idea";
      return;
    }

    const result = data.result;

    analysisResult.innerHTML = `
      <h3 style="color:white;">Execution Analysis</h3>

      <p><b>Market:</b> ${result.marketSummary}</p>
      <p><b>Difficulty:</b> ${result.executionDifficulty}</p>
      <p><b>Risk:</b> ${result.riskLevel}</p>

      <p><b>Time to Launch:</b> ${result.timeToLaunch}</p>
      <p><b>Labor Needed:</b> ${result.laborNeeds}</p>

      <p><b>Cost:</b> ${result.estimatedCostRange}</p>
      <p><b>ROI Potential:</b> ${result.roiPotential}</p>

      <p><b>Verdict:</b> ${result.verdict}</p>

      <h4 style="margin-top:10px;">Execution Steps:</h4>
      <ul>
        ${(result.basicSteps || []).map(step => `<li>${step}</li>`).join("")}
      </ul>
    `;

  } catch (err) {
    analysisResult.innerHTML = "Something went wrong";
  }
});