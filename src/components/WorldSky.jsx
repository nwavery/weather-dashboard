import { useEffect, useRef } from 'react';

// A world's signature sky object, drawn on a canvas behind the weather layer:
// Pandora's gas giant Polyphemus, Arrakis's swollen dust-sun, Coruscant's moon.
// Pure deterministic draws (a slow drift keeps it from feeling like wallpaper).

function drawGasGiant(ctx, w, h, t) {
  // Polyphemus: a huge banded blue-teal planet, low and to the right.
  const cx = w * 0.74;
  const cy = h * 0.30;
  const r = Math.min(w, h) * 0.42;

  ctx.save();
  // soft atmosphere halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.5);
  halo.addColorStop(0, 'rgba(90,180,200,0.22)');
  halo.addColorStop(1, 'rgba(90,180,200,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // planet disc, clipped, with horizontal bands
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#235f72';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  const bands = ['#3aa0a0', '#1c4f63', '#4cb8ac', '#27708a', '#155067', '#54c2b0', '#1f5e74'];
  for (let i = 0; i < bands.length; i++) {
    const by = cy - r + ((i + 0.5) / bands.length) * r * 2 + Math.sin(t / 6000 + i) * 3;
    const bh = (r * 2) / bands.length;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = bands[i];
    ctx.beginPath();
    ctx.ellipse(cx, by, r * 1.2, bh * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // a great storm spot
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#0e3346';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy + r * 0.18, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // terminator shadow on the left limb
  ctx.globalAlpha = 1;
  const shade = ctx.createLinearGradient(cx - r, 0, cx + r * 0.2, 0);
  shade.addColorStop(0, 'rgba(2,8,16,0.66)');
  shade.addColorStop(0.55, 'rgba(2,8,16,0.12)');
  shade.addColorStop(1, 'rgba(2,8,16,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawDustSun(ctx, w, h, t) {
  // Arrakis: an enormous hazy sun swimming in dust.
  const cx = w * 0.5 + Math.sin(t / 14000) * w * 0.02;
  const cy = h * 0.26;
  const r = Math.min(w, h) * 0.3;
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
  glow.addColorStop(0, 'rgba(255,196,120,0.55)');
  glow.addColorStop(0.4, 'rgba(228,140,60,0.32)');
  glow.addColorStop(1, 'rgba(228,140,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  disc.addColorStop(0, 'rgba(255,224,170,0.95)');
  disc.addColorStop(0.7, 'rgba(244,170,86,0.85)');
  disc.addColorStop(1, 'rgba(214,120,48,0.5)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(ctx, w, h, t) {
  const cx = w * 0.78 + Math.sin(t / 18000) * 6;
  const cy = h * 0.2;
  const r = Math.min(w, h) * 0.12;
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.4);
  halo.addColorStop(0, 'rgba(220,228,255,0.28)');
  halo.addColorStop(1, 'rgba(220,228,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  disc.addColorStop(0, 'rgba(245,248,255,0.96)');
  disc.addColorStop(1, 'rgba(190,200,225,0.85)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // a couple craters
  ctx.fillStyle = 'rgba(150,160,190,0.4)';
  ctx.beginPath(); ctx.arc(cx + r * 0.3, cy - r * 0.1, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - r * 0.2, cy + r * 0.35, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHarvestMoon(ctx, w, h, t) {
  // Halloween Town: a huge low orange harvest moon for a witch to cross.
  const cx = w * 0.72;
  const cy = h * 0.26 + Math.sin(t / 22000) * 4;
  const r = Math.min(w, h) * 0.22;
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.6);
  halo.addColorStop(0, 'rgba(255,170,70,0.34)');
  halo.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  const disc = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.2, cx, cy, r);
  disc.addColorStop(0, 'rgba(255,214,138,0.98)');
  disc.addColorStop(0.6, 'rgba(248,168,74,0.96)');
  disc.addColorStop(1, 'rgba(214,120,40,0.92)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // faint maria for texture
  ctx.fillStyle = 'rgba(190,110,40,0.35)';
  for (const [dx, dy, rr] of [[-0.25, -0.1, 0.16], [0.28, 0.2, 0.12], [0.05, -0.35, 0.1], [-0.1, 0.32, 0.13]]) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const RENDERERS = { gasgiant: drawGasGiant, dustsun: drawDustSun, moon: drawMoon, harvestmoon: drawHarvestMoon };

export function WorldSky({ kind }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const render = RENDERERS[kind];
    const canvas = canvasRef.current;
    if (!render || !canvas) return undefined;
    const ctx = canvas.getContext('2d');

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.offsetWidth * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function frame(now) {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      render(ctx, w, h, now);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [kind]);

  return <canvas ref={canvasRef} className="world-sky-canvas" aria-hidden="true" />;
}
