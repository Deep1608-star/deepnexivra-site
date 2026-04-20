const navLinks = document.getElementById("navLinks");
const menuToggle = document.getElementById("menuToggle");

const ideaInput = document.getElementById("ideaInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisResult = document.getElementById("analysisResult");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    if (navLinks) navLinks.classList.remove("open");
  });
});

if (analyzeBtn && ideaInput && analysisResult) {
  analyzeBtn.addEventListener("click", async () => {
    const locationInput = document.getElementById("locationInput");
    const budgetInput = document.getElementById("budgetInput");
    const timelineInput = document.getElementById("timelineInput");

    const idea = ideaInput.value.trim();
    const location = locationInput ? locationInput.value.trim() : "";
    const budget = budgetInput ? budgetInput.value.trim() : "";
    const timeline = timelineInput ? timelineInput.value.trim() : "";

    if (!idea) {
      analysisResult.style.display = "block";
      analysisResult.innerHTML = "Please enter a business idea first.";
      return;
    }

    analysisResult.style.display = "block";
    analysisResult.innerHTML = "Analyzing...";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idea,
          location,
          budget,
          timeline
        })
      });

      const data = await res.json();

      if (!data.ok) {
        analysisResult.innerHTML = data.message || "Error analyzing idea";
        return;
      }

      const result = data.result || {};

      analysisResult.innerHTML = `
        <h3 style="color:white; margin-bottom:12px;">Execution Analysis</h3>
        <p><b>Market:</b> ${result.marketSummary || "N/A"}</p>
        <p><b>Difficulty:</b> ${result.executionDifficulty || "N/A"}</p>
        <p><b>Risk:</b> ${result.riskLevel || "N/A"}</p>
        <p><b>Time to Launch:</b> ${result.timeToLaunch || "N/A"}</p>
        <p><b>Labor Needed:</b> ${result.laborNeeds || "N/A"}</p>
        <p><b>Cost:</b> ${result.estimatedCostRange || "N/A"}</p>
        <p><b>ROI Potential:</b> ${result.roiPotential || "N/A"}</p>
        <p><b>Verdict:</b> ${result.verdict || "N/A"}</p>
        <h4 style="margin-top:12px;">Execution Steps:</h4>
        <ul style="padding-left:20px;">
          ${(result.basicSteps || []).map(step => `<li>${step}</li>`).join("")}
        </ul>
      `;
    } catch (err) {
      analysisResult.innerHTML = "Something went wrong";
    }
  });
}