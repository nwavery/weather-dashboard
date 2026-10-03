import { useEffect, useRef } from 'react';
import { STARS, CON_LINES } from '../data/starCatalog.js';
import { lstDegrees, altAz, projectDome, starTint } from '../lib/skymap.js';
import { skyBodies, parallaxAltitude, stepToward } from '../lib/planets.js';

// The page background: the real night sky currently above `latitude/longitude`,
// drawn as a dim zenith-centered dome (planisphere) behind the cards. North is
// up; the horizon circle extends past the viewport so the screen sits "inside"
// the dome. Redraws once a minute — the sky wheels with the Earth.
const REDRAW_MS = 60 * 1000;
const MOON_RADIUS = 6.5; // px — about twice true scale, like the stars' dots

// The Moon as it looks tonight: an earthshine disc with the lit part turned
// toward the Sun's real direction on the map (`angle`, radians) — a right-limb
// semicircle joined to a terminator ellipse, the same construction as the
// card's moon.
function drawPhasedMoon(ctx, x, y, r, illum, angle) {
  const m = 1 - 2 * illum; // > 0 crescent, < 0 gibbous
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 3.2);
  glow.addColorStop(0, `rgba(225,232,255,${0.06 + 0.16 * illum})`);
  glow.addColorStop(1, 'rgba(225,232,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,160,195,0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, r * Math.abs(m), r, 0, Math.PI / 2, -Math.PI / 2, m > 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(248,246,236,0.9)';
  ctx.fill();
  ctx.restore();
}

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

      const now = new Date();
      const lst = lstDegrees(now, longitude);
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

      // Planets: brighter than any star (Venus ~15x Sirius), so they're drawn
      // over the stars with a halo, sized by their real magnitude, and quietly
      // labelled — "what's that bright star?" is the question people ask most.
      const { sun, moon, planets } = skyBodies(now);
      ctx.font = '11px system-ui, sans-serif';
      for (const pl of planets) {
        const p = place(pl.ra, pl.dec);
        if (!p) continue;
        const [r, g, b] = pl.tint;
        const radius = Math.max(1.7, 2.3 - pl.mag * 0.33);
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4);
        halo.addColorStop(0, `rgba(${r},${g},${b},0.32)`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        // Label on the side with room (flip near the right edge).
        const right = p.x < w - 80;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
        ctx.fillText(pl.name, p.x + (right ? 1 : -1) * (radius + 6), p.y + 4);
      }
      ctx.textAlign = 'start';

      // The Moon, at its real place among the stars with tonight's phase. It's
      // near enough that parallax drops it up to ~1° below its geocentric spot.
      const mGeo = altAz(moon.ra, moon.dec, latitude, lst);
      const mAlt = parallaxAltitude(mGeo.alt, moon.hp);
      if (mAlt > 0) {
        const mp = projectDome(mAlt, mGeo.az, cx, cy, R);
        if (mp.x > -20 && mp.x < w + 20 && mp.y > -20 && mp.y < h + 20) {
          // Which way the lit limb faces: a short step from the Moon toward the
          // Sun, measured on the map itself.
          const step = stepToward(moon.ra, moon.dec, sun.ra, sun.dec, 3);
          const sAA = altAz(step.ra, step.dec, latitude, lst);
          const from = projectDome(mGeo.alt, mGeo.az, cx, cy, R);
          const to = projectDome(sAA.alt, sAA.az, cx, cy, R);
          drawPhasedMoon(ctx, mp.x, mp.y, MOON_RADIUS, moon.illum, Math.atan2(to.y - from.y, to.x - from.x));
        }
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
