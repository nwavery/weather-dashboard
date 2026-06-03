// Keep an always-on display (TV / kiosk) from sleeping or showing a screensaver.
//
// Two layers, because TV browsers vary:
//   1. Screen Wake Lock API — the standard way; must be re-acquired whenever the
//      page becomes visible again (the lock is dropped while hidden).
//   2. A muted, hidden <video> fed by a canvas MediaStream — many TVs suppress
//      the screensaver while "media" is playing. No asset needed, so nothing to
//      ship/transcode; harmless where it's not required.
//
// Everything is best-effort and wrapped in try/catch — if an API is missing the
// app keeps working and we fall back to the next layer (or the OS setting).

let wakeLock = null;
let video = null;
let canvas = null;
let drawTimer = null;
let started = false;

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => {
        wakeLock = null;
      });
    }
  } catch {
    wakeLock = null; // unsupported, or blocked until a user gesture (e.g. fullscreen)
  }
}

function startVideoLoop() {
  if (video) {
    video.play?.().catch(() => {});
    return;
  }
  try {
    canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    let flip = false;
    const draw = () => {
      if (!ctx) return;
      flip = !flip;
      ctx.fillStyle = flip ? '#000001' : '#000002';
      ctx.fillRect(0, 0, 2, 2); // change a pixel so the stream keeps emitting frames
    };
    draw();
    const stream = canvas.captureStream ? canvas.captureStream(2) : null;
    if (!stream) return;

    video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.className = 'keep-awake';
    video.style.cssText =
      'position:fixed;left:-2px;bottom:-2px;width:2px;height:2px;opacity:0;pointer-events:none;';
    video.srcObject = stream;
    document.body.appendChild(video);
    video.play().catch(() => {});
    drawTimer = window.setInterval(draw, 1000);
  } catch {
    /* ignore — wake lock or the OS setting will have to carry it */
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    acquireWakeLock();
    video?.play?.().catch(() => {});
  }
}

export function startKeepAwake() {
  if (started) return;
  started = true;
  acquireWakeLock();
  startVideoLoop();
  document.addEventListener('visibilitychange', onVisibility);
  // Entering fullscreen is a user gesture — a good moment to (re)acquire the lock.
  document.addEventListener('fullscreenchange', acquireWakeLock);
  document.addEventListener('webkitfullscreenchange', acquireWakeLock);
}

export function stopKeepAwake() {
  started = false;
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('fullscreenchange', acquireWakeLock);
  document.removeEventListener('webkitfullscreenchange', acquireWakeLock);
  try {
    wakeLock?.release?.();
  } catch {
    /* ignore */
  }
  wakeLock = null;
  if (drawTimer) {
    clearInterval(drawTimer);
    drawTimer = null;
  }
  if (video) {
    try {
      video.pause();
      video.srcObject = null;
      video.remove();
    } catch {
      /* ignore */
    }
    video = null;
  }
  canvas = null;
}
