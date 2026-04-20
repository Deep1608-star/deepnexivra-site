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

// 🔥 Fallback decision logic (VERY IMPORTANT)
function deriveDecision(score) {
  if (score >= 75) return "START";
  if (score >= 50) return "CAUTION";
  return "DO_NOT_START";
}

function deriveConfidence(score) {
  return Math.max(55, Math.min(95, score));
}

function getDecisionConfig(decision) {
  switch (decision) {
    case "START":
      return {
        label: "START",
        bg: "rgba(125,255,207,0.10)",
        border: "rgba(125,255,207,0.35)",
        text: "#7dffcf"
      };
    case "CAUTION":
      return {
        label: "CAUTION",
        bg: "rgba(255,200,87,0.10)",
        border: "rgba(255,200,87,0.35)",
        text: "#ffd166"
      };
    case "DO_NOT_START":
      return {
        label: "DO NOT START",
        bg: "rgba(255,107,107,0.10)",
        border: "rgba(255,107,107,0.35)",
        text: "#ff7b7b"
      };
    default:
      return {
        label: "UNDECIDED",
        bg: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.18)",
        text: "#ffffff"
      };
  }
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

      if (!res.ok || !data.ok) {
        analysisResult.innerHTML = `
          <h3 style="color:white;">Error</h3>
          <p>${data.message || "Something went wrong."}</p>
        `;
        return;
      }

      const result = data.result || {};
      const score = Number(result.viabilityScore || 50);

      // 🔥 FALLBACK SAFE VALUES
      const decision = result.decision || deriveDecision(score);
      const confidence = result.confidence || deriveConfidence(score);

      const config = getDecisionConfig(decision);

      analysisResult.innerHTML = `
        <h3 style="color:white; margin-bottom:14px;">Execution Analysis</h3>

        <!-- DECISION BADGE -->
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px;">
          <div style="
            padding:10px 14px;
            border-radius:999px;
            background:${config.bg};
            border:1px solid ${config.border};
            color:${config.text};
            font-weight:800;
          ">
            ${config.label}
          </div>

          <div style="
            padding:10px 14px;
            border-radius:999px;
            background:rgba(255,255,255,0.04);
            border:1px solid rgba(255,255,255,0.08);
            color:white;
            font-weight:700;
          ">
            Confidence: ${confidence}%
          </div>
        </div>

        <!-- SUMMARY -->
        <div style="
          padding:16px;
          border:1px solid rgba(125,255,207,0.25);
          border-radius:16px;
          background:rgba(125,255,207,0.05);
          margin-bottom:18px;
        ">
          <div style="color:#7dffcf; font-weight:600; margin-bottom:6px;">
            AI DECISION SUMMARY
          </div>
          ${result.verdict || "No summary available"}
        </div>

        <!-- SCORE -->
        <div style="margin-bottom:18px;">
          <div style="font-size:28px; font-weight:800;">${score}/100</div>
          <div style="color:#7dffcf;">${getScoreLabel(score)}</div>
        </div>

        <p><b>Business Summary:</b> ${result.businessSummary || "N/A"}</p>
        <p><b>Market:</b> ${result.marketSummary || "N/A"}</p>
        <p><b>Difficulty:</b> ${result.executionDifficulty || "N/A"}</p>
        <p><b>Risk:</b> ${result.riskLevel || "N/A"}</p>
        <p><b>Time:</b> ${result.timeToLaunch || "N/A"}</p>
        <p><b>Labor:</b> ${result.laborNeeds || "N/A"}</p>
        <p><b>Cost:</b> ${result.estimatedCostRange || "N/A"}</p>
        <p><b>ROI:</b> ${result.roiPotential || "N/A"}</p>

        <h4 style="margin-top:18px;">First 30-Day Plan</h4>
        <ul>${renderList(result.first30DayPlan)}</ul>

        <h4 style="margin-top:18px;">Execution Steps</h4>
        <ul>${renderList(result.basicSteps)}</ul>
      `;
    } catch (err) {
      analysisResult.innerHTML = `
        <h3 style="color:white;">Error</h3>
        <p>${err.message}</p>
      `;
    }
  });
}