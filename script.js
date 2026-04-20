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

function getScoreLabel(score) {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Moderate";
  return "Weak";
}

function renderList(items) {
  return (items || []).map(item => `<li>${item}</li>`).join("");
}

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
      const score = Number(result.viabilityScore || 0);

      analysisResult.innerHTML = `
        <h3 style="color:white; margin-bottom:14px;">Execution Analysis</h3>

        <div style="display:grid; gap:12px; margin-bottom:18px;">
          <div style="padding:14px 16px; border:1px solid rgba(255,255,255,0.08); border-radius:14px; background:rgba(255,255,255,0.03);">
            <div style="font-size:13px; color:#9aa8c7; margin-bottom:6px;">Viability Score</div>
            <div style="font-size:28px; font-weight:800; color:white;">${score}/100</div>
            <div style="color:#7dffcf; font-weight:600;">${getScoreLabel(score)}</div>
          </div>
        </div>

        <p><b>Business Summary:</b> ${result.businessSummary || "N/A"}</p>
        <p><b>Market:</b> ${result.marketSummary || "N/A"}</p>
        <p><b>Difficulty:</b> ${result.executionDifficulty || "N/A"}</p>
        <p><b>Risk:</b> ${result.riskLevel || "N/A"}</p>
        <p><b>Time to Launch:</b> ${result.timeToLaunch || "N/A"}</p>
        <p><b>Labor Needed:</b> ${result.laborNeeds || "N/A"}</p>
        <p><b>Cost:</b> ${result.estimatedCostRange || "N/A"}</p>
        <p><b>ROI Potential:</b> ${result.roiPotential || "N/A"}</p>
        <p><b>Verdict:</b> ${result.verdict || "N/A"}</p>

        <h4 style="margin-top:18px; color:white;">First 30-Day Plan</h4>
        <ul style="padding-left:20px; margin-top:8px;">
          ${renderList(result.first30DayPlan)}
        </ul>

        <h4 style="margin-top:18px; color:white;">Execution Steps</h4>
        <ul style="padding-left:20px; margin-top:8px;">
          ${renderList(result.basicSteps)}
        </ul>
      `;
    } catch (err) {
      analysisResult.innerHTML = "Something went wrong";
    }
  });
}