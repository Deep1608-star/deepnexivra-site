const header = document.querySelector(".header");
const revealElements = document.querySelectorAll(".reveal");
const navLinks = document.getElementById("navLinks");
const menuToggle = document.getElementById("menuToggle");
const cursorGlow = document.querySelector(".cursor-glow");
const magneticButtons = document.querySelectorAll(".magnetic");
const metricNumbers = document.querySelectorAll(".stat-row h4, .metric-card h3");

const ideaInput = document.getElementById("ideaInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisResult = document.getElementById("analysisResult");

if (cursorGlow) {
  window.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  });
}

window.addEventListener("scroll", () => {
  if (header) {
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }
});

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

revealElements.forEach((el) => revealObserver.observe(el));

magneticButtons.forEach((button) => {
  button.addEventListener("mousemove", (e) => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    button.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "translate(0, 0)";
  });
});

function animateValue(element, targetText) {
  const cleaned = targetText.replace(/[^\d]/g, "");
  if (!cleaned) return;

  const target = parseInt(cleaned, 10);
  const hasPercent = targetText.includes("%");
  const hasPlus = targetText.includes("+");

  let current = 0;
  const duration = 1200;
  const stepTime = Math.max(Math.floor(duration / Math.max(target, 1)), 20);

  const timer = setInterval(() => {
    current += Math.ceil(target / 30);

    if (current >= target) {
      current = target;
      clearInterval(timer);
    }

    let output = `${current}`;
    if (hasPlus) output = `+${output}`;
    if (hasPercent) output = `${output}%`;

    element.textContent = output;
  }, stepTime);
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = "true";
        animateValue(entry.target, entry.target.textContent.trim());
      }
    });
  },
  { threshold: 0.35 }
);

metricNumbers.forEach((num) => counterObserver.observe(num));

if (analyzeBtn) {
  analyzeBtn.addEventListener("click", async () => {
    const idea = ideaInput.value.trim();

    if (!idea) {
      analysisResult.style.display = "block";
      analysisResult.innerHTML = "Please enter a business idea first.";
      return;
    }

    analysisResult.style.display = "block";
    analysisResult.innerHTML = "Analyzing idea...";

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idea })
      });

      const data = await response.json();

      if (!data.ok) {
        analysisResult.innerHTML = data.message || "Something went wrong.";
        return;
      }

      const result = data.result;

      analysisResult.innerHTML = `
        <h3 style="margin-bottom: 12px; color: white;">Analysis Result</h3>
        <p><strong>Idea:</strong> ${result.originalIdea}</p>
        <p><strong>Stage:</strong> ${result.stage}</p>
        <p><strong>Market Type:</strong> ${result.marketType}</p>
        <p><strong>Execution Difficulty:</strong> ${result.executionDifficulty}</p>
        <p><strong>Estimated Risk:</strong> ${result.estimatedRisk}</p>
        <p><strong>Next Step:</strong> ${result.nextStep}</p>
      `;
    } catch (error) {
      analysisResult.innerHTML = "Request failed. Please try again.";
    }
  });
}