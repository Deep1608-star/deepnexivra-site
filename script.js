const core = document.querySelector('.core');
if (core && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 8;
    const y = (event.clientY / window.innerHeight - 0.5) * -8;
    core.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  }, { passive: true });
}
