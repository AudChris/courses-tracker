(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  root.classList.add('anim');
  let started = false;
  let cleaned = false;
  let bootTimer;
  let safetyTimer;

  const clean = () => {
    if (cleaned) return;
    cleaned = true;
    window.clearTimeout(bootTimer);
    window.clearTimeout(safetyTimer);
    document.removeEventListener('animationend', onEnd, true);
    root.classList.remove('anim', 'go');
  };

  const onEnd = (event) => {
    if (event.animationName === 'appEnter') clean();
  };

  const start = () => {
    if (started || cleaned) return;
    started = true;
    window.clearTimeout(bootTimer);
    document.addEventListener('animationend', onEnd, true);
    safetyTimer = window.setTimeout(clean, 2600);
    root.classList.add('go');
  };

  const boot = () => {
    bootTimer = window.setTimeout(start, 900);
    if (document.fonts?.ready) {
      document.fonts.ready.then(start, start);
    } else {
      start();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
