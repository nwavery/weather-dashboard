import { useEffect, useRef } from 'react';
import { STARS, NAMED, CON_LINES } from '../data/starCatalog.js';
import { lstDegrees, altAz, projectDome, starTint } from '../lib/skymap.js';

// The page background: the real night sky currently above `latitude/longitude`,
// drawn as a dim zenith-centered dome (planisphere) behind the cards. North is
// up; the horizon circle extends past the viewport so the screen sits "inside"
// the dome. Redraws once a minute — the sky wheels with the Earth.
const REDRAW_MS = 60 * 1000;

export function SkyMapBackground({ latitude, longitude }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const lst = lstDegrees(new Date(), longitude);
      const cx = w / 2;
      const cy = h / 2;
      // Dome radius: past the corners so the whole screen is sky (horizon
      // just off-screen), but close enough that cardinal letters can appear.
      const R = Math.hypot(w, h) / 2 + 24;

      const place = (ra, dec) => {
        const { alt, az } = altAz(ra, dec, latitude, lst);
        if (alt <= 0) return null;
        const p = projectDome(alt, az, cx, cy, R);
        if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) return null;
        return p;
      };

      // Constellation lines (very faint)
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(140, 175, 235, 0.11)';
      for (const line of CON_LINES) {
        let started = false;
        ctx.beginPath();
        for (const [ra, dec] of line) {
          const p = place(ra, dec);
          if (!p) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          started = true;
        }
        ctx.stroke();
      }

      // Stars, brightness/size/tint from magnitude and B-V color
      for (const [ra, dec, mag10, bv10] of STARS) {
        const p = place(ra, dec);
        if (!p) continue;
        const mag = mag10 / 10;
        const radius = Math.max(0.35, 2.1 - mag * 0.36);
        const alpha = Math.max(0.1, Math.min(0.62, 0.66 - mag * 0.1));
        const [r, g, b] = starTint(bv10);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (mag <= 1.2) {
          // soft glow on the handful of brightest
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.18})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Names for the brightest stars
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(190, 210, 245, 0.3)';
      ctx.textBaseline = 'middle';
      for (const [ra, dec, name] of NAMED) {
        const p = place(ra, dec);
        if (p) ctx.fillText(name, p.x + 6, p.y);
      }

      // Cardinal letters where the horizon circle is on-screen
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(170, 195, 235, 0.28)';
      ctx.textAlign = 'center';
      const margin = 14;
      for (const [az, label] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
        const p = projectDome(2, az, cx, cy, R); // just above the horizon
        const x = Math.max(margin, Math.min(w - margin, p.x));
        const y = Math.max(margin, Math.min(h - margin, p.y));
        ctx.fillText(label, x, y);
      }
      ctx.textAlign = 'start';
    }

    draw();
    const timer = setInterval(draw, REDRAW_MS);
    window.addEventListener('resize', draw);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', draw);
    };
  }, [latitude, longitude]);

  return <canvas ref={canvasRef} className="skymap-canvas" aria-hidden="true" />;
}
