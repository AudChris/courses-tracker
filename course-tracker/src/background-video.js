(() => {
  const videoA = document.getElementById('bgVideoA');
  const videoB = document.getElementById('bgVideoB');
  if (!videoA || !videoB) return;

  const background = videoA.closest('.bg');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    videoA.removeAttribute('autoplay');
    videoA.pause();
    videoB.pause();
    try {
      videoA.currentTime = 0;
    } catch {
      // Metadata might not be available before the poster is shown.
    }
    background?.classList.add('has-video');
    return;
  }

  const fadeDuration = 0.9;
  let current = videoA;
  let next = videoB;
  let swapping = false;
  let cleanupTimer;

  [videoA, videoB].forEach((video) => {
    video.addEventListener('playing', () => {
      background?.classList.add('has-video');
    });
    video.addEventListener('error', () => {
      if (videoA.paused && videoB.paused) {
        background?.classList.remove('has-video');
      }
    });
  });

  const play = (video) => {
    const playback = video.play();
    if (playback?.catch) playback.catch(() => {});
  };

  const tick = () => {
    if (swapping || !current.duration) return;
    if (current.duration - current.currentTime > fadeDuration) return;

    swapping = true;
    const outgoing = current;
    next.currentTime = 0;
    play(next);
    next.classList.add('is-active');
    outgoing.classList.remove('is-active');
    current = next;
    next = outgoing;
    cleanupTimer = window.setTimeout(() => {
      outgoing.pause();
      outgoing.currentTime = 0;
      swapping = false;
    }, fadeDuration * 1000 + 100);
  };

  videoA.addEventListener('timeupdate', tick);
  videoB.addEventListener('timeupdate', tick);
  window.addEventListener('pagehide', () => window.clearTimeout(cleanupTimer), { once: true });
  play(videoA);
})();
