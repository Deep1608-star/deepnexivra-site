const header = document.querySelector(".header");
const revealElements = document.querySelectorAll(".reveal");
const navLinks = document.getElementById("navLinks");
const menuToggle = document.getElementById("menuToggle");
const cursorGlow = document.querySelector(".cursor-glow");
const magneticButtons = document.querySelectorAll(".magnetic");

const ideaInput = document.getElementById("ideaInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisResult = document.getElementById("analysisResult");

if (cursorGlow) {
  window.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  });
}

if (header) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

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

if (revealElements.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.08 }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  setTimeout(() => {
    revealElements.forEach((el) => el.classList.add("visible"));
  }, 300);
}

magneticButtons.forEach((button) => {
  button.addEventListener("mousemove", (e) => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    button.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "translate(0, 0)";
  });
});

if (analyzeBtn && ideaInput && analysisResult) {
  analyzeBtn.addEventListener("click", async () => {
    const idea = ideaInput.value.trim();
    const locationInput = document.getElementById("locationInput");
    const budgetInput = document.getElementById("budgetInput");
    const timelineInput = document.getElementById("timelineInput");

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
.reveal {
  opacity: 1 !important;
  transform: none !important;
}