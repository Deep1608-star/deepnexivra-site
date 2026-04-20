const ideaInput = document.getElementById("ideaInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisResult = document.getElementById("analysisResult");
const navLinks = document.getElementById("navLinks");
const menuToggle = document.getElementById("menuToggle");

const isPaidUser = localStorage.getItem("isPaidUser") === "true";

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

function renderList(items) {
  return (items || []).map(i => `<li>${i}</li>`).join("");
}

if (analyzeBtn) {
  analyzeBtn.addEventListener("click", async () => {
    const idea = ideaInput.value.trim();
    const location = document.getElementById("locationInput").value;
    const budget = document.getElementById("budgetInput").value;
    const timeline = document.getElementById("timelineInput").value;

    if (!idea) {
      analysisResult.style.display = "block";
      analysisResult.innerHTML = "Enter idea first";
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
          timeline,
          isPaid: isPaidUser
        })
      });

      const data = await res.json();
      const r = data.result || {};

      analysisResult.innerHTML = `
        <h2>Execution Analysis</h2>

        <h3>${r.decision || ""} ${r.confidence ? `(${r.confidence}%)` : ""}</h3>

        <p><b>Score:</b> ${r.viabilityScore || "N/A"}</p>
        <p>${r.verdict || ""}</p>

        <p><b>Business:</b> ${r.businessSummary || "N/A"}</p>
        <p><b>Market:</b> ${r.marketSummary || "N/A"}</p>
        <p><b>Difficulty:</b> ${r.executionDifficulty || "N/A"}</p>
        <p><b>Risk:</b> ${r.riskLevel || "N/A"}</p>
        <p><b>Time:</b> ${r.timeToLaunch || "N/A"}</p>
        <p><b>Labor:</b> ${r.laborNeeds || "N/A"}</p>
        <p><b>Cost:</b> ${r.estimatedCostRange || "N/A"}</p>
        <p><b>ROI:</b> ${r.roiPotential || "N/A"}</p>

        ${r.pricingStrategy ? `
          <h3>Pricing Strategy</h3>
          <p>${r.pricingStrategy}</p>

          <h3>Revenue Model</h3>
          <p>${r.revenueModel}</p>

          <h3>First Customers</h3>
          <ul>${renderList(r.firstCustomerPlan)}</ul>

          <h3>Monetization Steps</h3>
          <ul>${renderList(r.monetizationSteps)}</ul>

          <h3>30 Day Plan</h3>
          <ul>${renderList(r.first30DayPlan)}</ul>

          <h3>Execution</h3>
          <ul>${renderList(r.basicSteps)}</ul>
        ` : `
          <div style="
            margin-top:20px;
            padding:20px;
            border-radius:12px;
            background:#111;
            text-align:center;
          ">
            <h3>Unlock Full Plan</h3>
            <p>Get monetization + execution roadmap</p>

            <button onclick="window.location.href='/upgrade.html'" style="
              padding:12px 20px;
              background:#7dffcf;
              border:none;
              border-radius:8px;
              cursor:pointer;
            ">
              Upgrade with PayPal
            </button>
          </div>
        `}
      `;
    } catch (err) {
      analysisResult.innerHTML = "Something went wrong";
    }
  });
}