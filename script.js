const revealElements = document.querySelectorAll(".reveal");
const navLinks = document.getElementById("navLinks");
const menuToggle = document.getElementById("menuToggle");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  {
    threshold: 0.15,
  }
);

revealElements.forEach((element) => observer.observe(element));

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
  });
});

window.addEventListener("scroll", () => {
  const header = document.querySelector(".header");
  if (window.scrollY > 10) {
    header.style.background = "rgba(5, 8, 22, 0.75)";
  } else {
    header.style.background = "rgba(5, 8, 22, 0.45)";
  }
});