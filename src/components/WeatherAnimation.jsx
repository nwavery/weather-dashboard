import { useEffect, useRef, useMemo } from 'react';

// ─── Sky gradient helper ────────────────────────────────────────────────────────
// Returns CSS gradient strings for (dawn/day/dusk/night) × weather condition
export function getSkyGradient(animation, timePhase) {
  const gradients = {
    clear: {
      dawn:  'linear-gradient(to bottom, #0f0520 0%, #7d1f0e 18%, #c94414 32%, #e8722a 48%, #f5a623 65%, #2e78c7 85%, #4facde 100%)',
      day:   'linear-gradient(to bottom, #0b3d6e 0%, #1565a8 22%, #2980c9 50%, #5ab4e8 78%, #82cef5 100%)',
      dusk:  'linear-gradient(to bottom, #07061a 0%, #3a0d3a 18%, #8b1a1a 36%, #cc3b1a 52%, #e8831a 68%, #f2c96e 85%, #c8a04e 100%)',
      night: 'linear-gradient(to bottom, #010205 0%, #030812 28%, #050f25 55%, #071535 78%, #0a1a42 100%)',
    },
    rain: {
      dawn:  'linear-gradient(to bottom, #0f0f20 0%, #1c1c35 30%, #2a3040 55%, #354050 78%, #3e4e5e 100%)',
      day:   'linear-gradient(to bottom, #0f1820 0%, #18283a 28%, #223648 55%, #2a4058 78%, #2e4a62 100%)',
      dusk:  'linear-gradient(to bottom, #080810 0%, #12121e 30%, #1c1c2e 58%, #25253a 80%, #2e2e48 100%)',
      night: 'linear-gradient(to bottom, #020306 0%, #060910 30%, #090e18 60%, #0d1220 85%, #101626 100%)',
    },
    snow: {
      dawn:  'linear-gradient(to bottom, #12121e 0%, #1e2030 30%, #2e3448 58%, #404858 80%, #525e70 100%)',
      day:   'linear-gradient(to bottom, #182030 0%, #243248 28%, #354862 55%, #4a607a 78%, #5e7a92 100%)',
      dusk:  'linear-gradient(to bottom, #0a0a15 0%, #14142a 30%, #20203e 58%, #2c2c52 80%, #383860 100%)',
      night: 'linear-gradient(to bottom, #04040a 0%, #08081a 35%, #0c0c22 65%, #10102e 88%, #141438 100%)',
    },
    cloudy: {
      dawn:  'linear-gradient(to bottom, #0f0f20 0%, #1e1e30 35%, #2c2c42 65%, #3a3a52 88%, #484862 100%)',
      day:   'linear-gradient(to bottom, #1a202e 0%, #28303e 30%, #343c4c 60%, #404858 85%, #4c5464 100%)',
      dusk:  'linear-gradient(to bottom, #080812 0%, #141420 35%, #202032 65%, #2c2c42 88%, #383852 100%)',
      night: 'linear-gradient(to bottom, #020204 0%, #060610 35%, #0a0a18 65%, #0e0e20 88%, #121228 100%)',
    },
    thunder: {
      dawn:  'linear-gradient(to bottom, #060810 0%, #0e1020 35%, #181a2a 65%, #222235 88%, #2c2c42 100%)',
      day:   'linear-gradient(to bottom, #080e18 0%, #101820 35%, #181e2e 60%, #20263a 82%, #283044 100%)',
      dusk:  'linear-gradient(to bottom, #040408 0%, #0a0a14 35%, #121220 65%, #1a1a2c 88%, #222238 100%)',
      night: 'linear-gradient(to bottom, #010102 0%, #030308 35%, #050510 65%, #08081a 88%, #0a0a22 100%)',
    },
    fog: {
      dawn:  'linear-gradient(to bottom, #1e1e2e 0%, #2c2c3e 35%, #3a3a4c 65%, #484858 88%, #565666 100%)',
      day:   'linear-gradient(to bottom, #2a2a3c 0%, #383848 35%, #464658 65%, #545468 88%, #626278 100%)',
      dusk:  'linear-gradient(to bottom, #12121e 0%, #1e1e2e 35%, #2a2a3e 65%, #36364c 88%, #42425a 100%)',
      night: 'linear-gradient(to bottom, #080810 0%, #0e0e1c 35%, #141428 65%, #1a1a32 88%, #20203c 100%)',
    },
  };

  const typeKey =
    animation === 'thunder' ? 'thunder' :
    animation === 'rain'    ? 'rain' :
    animation === 'snow'    ? 'snow' :
    animation === 'fog'     ? 'fog' :
    animation === 'cloudy'  ? 'cloudy' : 'clear';

  return (gradients[typeKey] || gradients.clear)[timePhase] || gradients.clear.night;
}

// Continuous clear-sky gradient keyed on the sun's actual altitude (degrees), so
// the sky blends smoothly through the day instead of snapping between the four
// dawn/day/dusk/night presets above. Each anchor lists five top→bottom stop
// colours (at 0/25/50/75/100%); we linearly interpolate between the two anchors
// bracketing the current altitude. Used only for clear skies — cloudy/precip
// skies keep their muted discrete gradients.
const SKY_ANCHORS = [
  { alt: -8, stops: [[1, 2, 5], [4, 13, 28], [7, 21, 53], [10, 26, 66], [12, 32, 80]] },        // night
  { alt: 0,  stops: [[11, 10, 37], [58, 13, 58], [139, 26, 26], [232, 115, 26], [242, 201, 110]] }, // horizon twilight
  { alt: 6,  stops: [[14, 74, 134], [31, 106, 168], [106, 143, 184], [240, 168, 90], [255, 214, 132]] }, // golden hour
  { alt: 35, stops: [[11, 61, 110], [21, 101, 168], [41, 128, 201], [90, 180, 232], [130, 206, 245]] },  // full day
];
const SKY_POS = [0, 25, 50, 75, 100];

export function clearSkyGradient(altitude) {
  const loEnd = SKY_ANCHORS[0];
  const hiEnd = SKY_ANCHORS[SKY_ANCHORS.length - 1];
  const a = Math.max(loEnd.alt, Math.min(hiEnd.alt, altitude));
  let lo = loEnd;
  let hi = hiEnd;
  for (let i = 0; i < SKY_ANCHORS.length - 1; i++) {
    if (a >= SKY_ANCHORS[i].alt && a <= SKY_ANCHORS[i + 1].alt) {
      lo = SKY_ANCHORS[i];
      hi = SKY_ANCHORS[i + 1];
      break;
    }
  }
  const t = hi.alt === lo.alt ? 0 : (a - lo.alt) / (hi.alt - lo.alt);
  const stops = SKY_POS.map((pos, i) => {
    const c = lo.stops[i].map((lv, k) => Math.round(lv + (hi.stops[i][k] - lv) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${pos}%`;
  });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

const DEG = Math.PI / 180;

// Signed horizontal wind for the animations: positive blows toward screen-right
// (east). Gusts nudge the effective strength up so blustery skies animate more
// energetically. `wind` is { speed, dir, gust } in mph / meteorological degrees.
function horizontalWind(wind) {
  if (!wind) return 0;
  const strength = Math.max(wind.speed || 0, (wind.gust || 0) * 0.7);
  return -Math.sin((wind.dir || 0) * DEG) * strength;
}

// Precipitation intensity 0..1 from the WMO code (a sprinkle vs a downpour),
// falling back to the measured mm when the code is unfamiliar.
function precipRate(code, precipMm) {
  const byCode = {
    51: 0.25, 53: 0.4, 55: 0.55, 56: 0.3, 57: 0.5,
    61: 0.4, 63: 0.6, 65: 0.9, 66: 0.5, 67: 0.8,
    71: 0.35, 73: 0.6, 75: 0.9, 77: 0.4,
    80: 0.45, 81: 0.7, 82: 1, 85: 0.5, 86: 0.85,
    95: 0.85, 96: 0.92, 99: 1,
  };
  const r = byCode[code];
  if (r != null) return r;
  const mm = typeof precipMm === 'number' ? precipMm : 0;
  return mm <= 0 ? 0.5 : Math.min(1, mm / 4);
}

// ─── Moon phase ─────────────────────────────────────────────────────────────────
// Synodic-month phase in [0,1): 0 = new, 0.5 = full. Anchored to the new moon of
// 2000-01-06 18:14 UTC. Good to within a few hours — plenty for a pretty moon.
export function moonPhase(date = new Date()) {
  const SYNODIC = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
  let p = (((date.getTime() - ref) / 86400000) % SYNODIC) / SYNODIC;
  if (p < 0) p += 1;
  return p;
}

export function moonPhaseName(phase) {
  if (phase < 0.02 || phase > 0.98) return 'New Moon';
  if (phase < 0.23) return 'Waxing Crescent';
  if (phase < 0.27) return 'First Quarter';
  if (phase < 0.48) return 'Waxing Gibbous';
  if (phase < 0.52) return 'Full Moon';
  if (phase < 0.73) return 'Waning Gibbous';
  if (phase < 0.77) return 'Last Quarter';
  return 'Waning Crescent';
}

export function moonEmoji(phase) {
  const e = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  return e[Math.round(phase * 8) % 8];
}

// ─── Meteor showers ─────────────────────────────────────────────────────────────
// Major annual showers (active window + peak), matched by MM-DD. A ?meteor=NAME
// query param forces one on (handy for demos/tests out of season); ?meteor=off
// forces none.
const METEOR_SHOWERS = [
  { name: 'Quadrantids',   from: '01-01', to: '01-05', peak: '01-03' },
  { name: 'Lyrids',        from: '04-16', to: '04-25', peak: '04-22' },
  { name: 'Eta Aquariids', from: '04-19', to: '05-12', peak: '05-06' },
  { name: 'Perseids',      from: '07-17', to: '08-24', peak: '08-12' },
  { name: 'Orionids',      from: '10-02', to: '11-07', peak: '10-21' },
  { name: 'Leonids',       from: '11-06', to: '11-30', peak: '11-17' },
  { name: 'Geminids',      from: '12-04', to: '12-17', peak: '12-14' },
  { name: 'Ursids',        from: '12-17', to: '12-26', peak: '12-22' },
];

export function currentMeteorShower(date = new Date()) {
  if (typeof window !== 'undefined') {
    const o = new URLSearchParams(window.location.search).get('meteor');
    if (o) {
      const q = o.toLowerCase();
      if (q === 'off' || q === 'none' || q === '0') return null;
      const f = METEOR_SHOWERS.find((s) => s.name.toLowerCase().startsWith(q));
      if (f) return { name: f.name, peak: true };
    }
  }
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  for (const s of METEOR_SHOWERS) {
    if (mmdd >= s.from && mmdd <= s.to) return { name: s.name, peak: mmdd === s.peak };
  }
  return null;
}

// ─── Moon renderer ──────────────────────────────────────────────────────────────
// Phase-accurate moon: a right-limb semicircle joined to a terminator ellipse,
// mirrored for the waning half. `phase` is the value from moonPhase().
function drawMoon(ctx, cx, cy, r, phase) {
  const f = (1 - Math.cos(2 * Math.PI * phase)) / 2; // illuminated fraction 0..1
  const m = 1 - 2 * f;                                // cos(2π·phase): >0 ⇒ crescent
  const tr = r * Math.abs(m);                         // terminator half-width
  const waning = phase > 0.5;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(cx, cy);

  // Soft halo that brightens with illumination
  const glow = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 2.8);
  glow.addColorStop(0, `rgba(222,230,255,${0.05 + 0.2 * f})`);
  glow.addColorStop(1, 'rgba(222,230,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Faint full disc (earthshine) so the dark limb still reads
  ctx.fillStyle = 'rgba(150,160,195,0.1)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Lit portion
  if (waning) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, tr, r, 0, Math.PI / 2, -Math.PI / 2, m > 0);
  ctx.closePath();
  const fill = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
  fill.addColorStop(0, 'rgba(255,253,246,0.98)');
  fill.addColorStop(1, 'rgba(212,221,238,0.9)');
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.restore();
}

// ─── Star canvas (for clear/night skies) ───────────────────────────────────────
function StarCanvas({ dimmed = false, meteorActive = false, meteorPeak = false, moon = true }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const STAR_COUNT = 120;
    const TINY_COUNT = 80;
    // Meteor showers crank up the shooting-star rate (peak nights fastest)
    const SHOOT_INTERVAL = meteorActive ? (meteorPeak ? 1100 : 1700) : 4500;
    // The phase-accurate (Earth) moon is drawn on real-city night skies —
    // through cloud/overcast too. It's suppressed for fictional worlds that
    // have their own sky body (e.g. Coruscant's moon) so we don't stack two
    // moons. `dimmed` (cloudy nights) only fades the stars, not the moon.
    const showMoon = moon;
    const starDim = dimmed ? 0.4 : 1;
    const phase = moonPhase();

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Bright twinkling stars
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.85,
      r: 0.4 + Math.random() * 2,
      alpha: 0.5 + Math.random() * 0.5,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.3 + Math.random() * 2,
      warm: Math.random() < 0.15, // warm-tinted
      cool: Math.random() > 0.85, // blue-tinted
    }));

    // Tiny background stars
    const tiny = Array.from({ length: TINY_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.8,
      r: 0.15 + Math.random() * 0.5,
      alpha: 0.15 + Math.random() * 0.3,
    }));

    let shooter = null;
    let lastShoot = -SHOOT_INTERVAL * 0.5;
    let nextGap = SHOOT_INTERVAL * (0.6 + Math.random() * 0.8);

    function spawnShooter(now) {
      const sx = 0.05 + Math.random() * 0.65;
      const sy = 0.02 + Math.random() * 0.25;
      const angle = 0.35 + Math.random() * 0.25;
      const length = 0.18 + Math.random() * 0.14;
      shooter = { sx, sy, angle, length, startedAt: now, duration: 900 + Math.random() * 400 };
    }

    let startTime = null;

    function draw(now) {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Tiny background stars
      for (const s of tiny) {
        ctx.globalAlpha = s.alpha * starDim;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bright twinkling stars
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(elapsed * 0.001 * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.alpha * (0.55 + 0.45 * twinkle) * starDim;
        ctx.globalAlpha = alpha;
        const r = s.warm ? 255 : s.cool ? 200 : 255;
        const g = s.warm ? 235 : s.cool ? 215 : 255;
        const b = s.warm ? 200 : s.cool ? 255 : 255;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
        // Cross-flare for the biggest stars
        if (s.r > 1.5) {
          ctx.globalAlpha = alpha * 0.25;
          ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
          ctx.lineWidth = 0.5;
          const fl = s.r * 3.5;
          ctx.beginPath();
          ctx.moveTo(s.x * w - fl, s.y * h);
          ctx.lineTo(s.x * w + fl, s.y * h);
          ctx.moveTo(s.x * w, s.y * h - fl);
          ctx.lineTo(s.x * w, s.y * h + fl);
          ctx.stroke();
        }
      }

      // Moon (phase-accurate, upper-right)
      if (showMoon) {
        ctx.globalAlpha = 1;
        const mr = Math.max(11, Math.min(w * 0.05, 30));
        drawMoon(ctx, w * 0.8, h * 0.15, mr, phase);
      }

      // Shooting star
      if (!shooter && now - lastShoot > nextGap) {
        spawnShooter(now);
        lastShoot = now;
        nextGap = SHOOT_INTERVAL * (0.6 + Math.random() * 0.8);
      }
      if (shooter) {
        const age = now - shooter.startedAt;
        const progress = age / shooter.duration;
        if (progress >= 1) {
          shooter = null;
        } else {
          const ex = (shooter.sx + progress * shooter.length * Math.cos(shooter.angle)) * w;
          const ey = (shooter.sy + progress * shooter.length * Math.sin(shooter.angle)) * h;
          const tailLen = Math.min(progress, 0.4) * shooter.length;
          const tx = (shooter.sx + (progress - tailLen) * shooter.length * Math.cos(shooter.angle)) * w;
          const ty = (shooter.sy + (progress - tailLen) * shooter.length * Math.sin(shooter.angle)) * h;

          const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          const grad = ctx.createLinearGradient(tx, ty, ex, ey);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.5, `rgba(220,235,255,${0.5 * fadeOut})`);
          grad.addColorStop(1, `rgba(255,255,255,${0.95 * fadeOut})`);

          ctx.globalAlpha = fadeOut * starDim;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // Head glow
          const hg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6);
          hg.addColorStop(0, `rgba(255,255,255,${0.9 * fadeOut})`);
          hg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(ex, ey, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [dimmed, meteorActive, meteorPeak, moon]);

  return (
    <canvas
      ref={canvasRef}
      className="sky-canvas"
      aria-hidden="true"
    />
  );
}

// ─── Sun glow (clear-day) ───────────────────────────────────────────────────────
// `pos` ({ x, y } percentages) places the sun along its real arc — low in the
// east at dawn, overhead at noon, low in the west at dusk. Without it (fictional
// worlds / missing coords) the sun-body falls back to phase-based CSS positions.
function SunGlow({ timePhase, twin = false, pos = null }) {
  const isMorning = timePhase === 'dawn';
  const isDusk = timePhase === 'dusk';
  const bodyStyle = pos ? { left: `${pos.x}%`, top: `${pos.y}%`, bottom: 'auto' } : undefined;
  return (
    <div className="sun-glow-wrap" aria-hidden="true">
      <div className="sun-body" style={bodyStyle}>
        <div className={`sun-orb ${isMorning ? 'sun-orb--dawn' : ''} ${isDusk ? 'sun-orb--dusk' : ''}`} />
        <div className="sun-rays">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="sun-ray" style={{ '--ray-i': i }} />
          ))}
        </div>
        {/* Tatooine's second sun — nested in the sun-body so the binary pair
            arcs across the sky together (offset by CSS). */}
        {twin ? <div className="sun-orb sun-orb--twin" /> : null}
      </div>
    </div>
  );
}

// ─── Cloud layers (parallax drift) ─────────────────────────────────────────────
// `cover` (0–100, the live cloud_cover %) sets how many clouds, how opaque, how
// big, and how far down the sky they spread — so a few wisps (partly cloudy)
// build into a full, moody deck at overcast. `windX` (signed mph) sets drift
// direction and speed. Coverage ramps with cov² so light cover stays sparse
// while heavy cover fills in dramatically.
function CloudLayers({ cover = 60, windX = 0 }) {
  const cov = Math.max(0, Math.min(100, Number(cover) || 0)) / 100;
  const dir = windX < 0 ? -1 : 1;
  // Faster drift with stronger wind (down to ~1/3 the calm duration).
  const windFactor = Math.max(0.28, 1 - Math.abs(windX) / 55);
  const count = Math.max(3, Math.round(3 + cov * cov * 15)); // ~3 wisps → ~18 (overcast deck)
  const clouds = useMemo(() => {
    const bottom = 52 + cov * 26; // overcast spreads the deck further down the sky
    // Scatter over a jittered grid so the deck covers the sky evenly — tying
    // both axes to the index would march them in a diagonal line.
    const cols = Math.max(3, Math.ceil(Math.sqrt(count * 1.8)));
    const rows = Math.max(1, Math.ceil(count / cols));
    return Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        id: i,
        left: ((col + 0.5 + (Math.random() * 0.8 - 0.4)) / cols) * 124 - 12,
        top: -8 + ((row + 0.5 + (Math.random() * 0.8 - 0.4)) / rows) * (bottom + 8),
        scale: 0.6 + Math.random() * 0.9 + cov * 0.45, // bigger, overlapping when overcast
        opacity: 0.1 + cov * cov * 0.42 + Math.random() * 0.08,
        duration: (24 + Math.random() * 40) * windFactor,
        delay: -(Math.random() * 45),
        layer: i % 3,
      };
    });
  }, [cov, count, windFactor]);

  return (
    <div className="cloud-layer-wrap" aria-hidden="true">
      {clouds.map((c) => (
        <div
          key={c.id}
          className={`cloud-shape cloud-layer-${c.layer}`}
          style={{
            top: `${c.top}%`,
            '--cloud-scale': c.scale,
            '--cloud-opacity': c.opacity,
            '--cloud-duration': `${c.duration}s`,
            '--cloud-delay': `${c.delay}s`,
            '--cloud-dir': dir,
            '--cloud-left': `${c.left}%`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Rain particles ─────────────────────────────────────────────────────────────
// `rate` (0..1) scales how many/how fast/how heavy the streaks are — a drizzle
// vs a downpour. `windX` (signed mph) leans the whole curtain: because each
// streak falls along its own rotation, a steeper lean also drifts it sideways.
function RainLayer({ rate = 0.5, windX = 0, hasThunder = false }) {
  const count = Math.round(22 + rate * 68); // ~22 (drizzle) → ~90 (downpour)
  const angle = Math.max(-42, Math.min(42, windX * 1.15)); // lean degrees, signed
  const drops = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 125 - 12,
      delay: Math.random() * 1.8,
      duration: 0.72 - rate * 0.28 + Math.random() * 0.22, // heavier rain falls faster
      height: 16 + rate * 26 + Math.random() * 12,
      opacity: 0.3 + rate * 0.35 + Math.random() * 0.3,
    }));
  }, [count, rate]);

  const splashes = useMemo(() =>
    Array.from({ length: Math.floor(drops.length / 4) }, (_, i) => ({
      id: i,
      left: 2 + Math.random() * 96,
      delay: Math.random() * 1.8,
      duration: 0.32 + Math.random() * 0.22,
    })),
    [drops.length]
  );

  return (
    <div className="rain-layer-wrap" aria-hidden="true" style={{ '--rain-angle': `${angle}deg` }}>
      {hasThunder && <div className="lightning-flash" />}
      {drops.map((d) => (
        <div
          key={d.id}
          className="rain-streak"
          style={{
            left: `${d.left}%`,
            '--rain-delay': `${d.delay}s`,
            '--rain-duration': `${d.duration}s`,
            '--rain-height': `${d.height}px`,
            '--rain-opacity': d.opacity,
          }}
        />
      ))}
      {splashes.map((s) => (
        <div
          key={s.id}
          className="rain-splash"
          style={{
            left: `${s.left}%`,
            '--splash-delay': `${s.delay}s`,
            '--splash-duration': `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Snow particles ─────────────────────────────────────────────────────────────
// `rate` (0..1) scales the flake count; `windX` (signed mph) blows the flakes
// sideways and quickens their fall when it's gusty.
function SnowLayer({ rate = 0.5, windX = 0 }) {
  const count = Math.round(30 + rate * 70); // ~30 (flurries) → ~100 (heavy)
  const windFactor = Math.max(0.55, 1 - Math.abs(windX) / 45); // faster fall in wind
  const flakes = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 125 - 12,
      size: 2.5 + Math.random() * 5.5,
      delay: Math.random() * 6,
      duration: (4 + Math.random() * 6) * windFactor,
      drift: windX * 1.8 + (-12 + Math.random() * 24), // blown along the wind
      opacity: 0.55 + Math.random() * 0.45,
    })),
    [count, windX, windFactor]
  );

  return (
    <div className="snow-layer-wrap" aria-hidden="true">
      {flakes.map((f) => (
        <div
          key={f.id}
          className="snow-flake-new"
          style={{
            left: `${f.left}%`,
            '--flake-size': `${f.size}px`,
            '--flake-delay': `${f.delay}s`,
            '--flake-duration': `${f.duration}s`,
            '--flake-drift': `${f.drift}px`,
            '--flake-opacity': f.opacity,
          }}
        />
      ))}
    </div>
  );
}

// ─── Aurora layer (high-latitude clear nights) ─────────────────────────────────
// Three blurred, slowly-swaying curtains in screen blend; CSS does all the work.
function AuroraLayer() {
  return (
    <div className="aurora-layer-wrap" aria-hidden="true">
      <div className="aurora-band aurora-band--1" />
      <div className="aurora-band aurora-band--2" />
      <div className="aurora-band aurora-band--3" />
    </div>
  );
}

// ─── Fog layer ──────────────────────────────────────────────────────────────────
function FogLayer() {
  return (
    <div className="fog-layer-wrap" aria-hidden="true">
      <div className="fog-band fog-band--1" />
      <div className="fog-band fog-band--2" />
      <div className="fog-band fog-band--3" />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export function WeatherAnimation({
  type,
  timePhase = 'night',
  night,
  weatherCode,
  twinSuns,
  aurora = false,
  wind = null,
  cloudCover = 0,
  precip = 0,
  sunPos = null,
  hasSkyBody = false,
}) {
  const isThunder = weatherCode === 95 || weatherCode === 96 || weatherCode === 99;
  const isFog = weatherCode === 45 || weatherCode === 48;
  // Whether to render the night sky (stars + moon) vs the sun glow. Driven by
  // the sun being below the horizon, so the moon shows through twilight; falls
  // back to the gradient phase when the flag isn't supplied.
  const isNight = night ?? timePhase === 'night';
  const windX = horizontalWind(wind);
  const rate = precipRate(weatherCode, precip);

  if (isFog || type === 'fog') {
    return (
      <div className="sky-anim-wrap" aria-hidden="true">
        <CloudLayers cover={Math.max(cloudCover, 45)} windX={windX} />
        <FogLayer />
      </div>
    );
  }

  if (isThunder || type === 'thunder') {
    return (
      <div className="sky-anim-wrap" aria-hidden="true">
        <CloudLayers cover={Math.max(cloudCover, 88)} windX={windX} />
        <RainLayer rate={Math.max(rate, 0.8)} windX={windX} hasThunder={true} />
      </div>
    );
  }

  if (type === 'rain') {
    return (
      <div className="sky-anim-wrap" aria-hidden="true">
        <CloudLayers cover={Math.max(cloudCover, 70)} windX={windX} />
        <RainLayer rate={rate} windX={windX} hasThunder={false} />
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div className="sky-anim-wrap" aria-hidden="true">
        <CloudLayers cover={Math.max(cloudCover, 65)} windX={windX} />
        <SnowLayer rate={rate} windX={windX} />
      </div>
    );
  }

  if (type === 'cloudy') {
    // Use the real cloud cover so partly-cloudy reads lighter than overcast;
    // CloudLayers keeps a small floor so a cloudy code never looks empty.
    const cover = Math.max(Number(cloudCover) || 0, 25);
    if (isNight) {
      return (
        <div className="sky-anim-wrap" aria-hidden="true">
          <StarCanvas dimmed={true} moon={!hasSkyBody} />
          <CloudLayers cover={cover} windX={windX} />
        </div>
      );
    }
    // Daytime: the sun is hidden, but show it veiled — a soft bright patch at
    // its real position, behind the drifting deck — so overcast isn't lifeless.
    return (
      <div className="sky-anim-wrap" aria-hidden="true">
        {sunPos ? (
          <div className="veiled-sun" style={{ left: `${sunPos.x}%`, top: `${sunPos.y}%` }} aria-hidden="true" />
        ) : null}
        <CloudLayers cover={cover} windX={windX} />
      </div>
    );
  }

  // Clear sky (type === null or undefined). A few wisps appear once the live
  // cloud cover is non-trivial, so "mainly clear" reads differently from "clear".
  const wisps = cloudCover > 15 ? <CloudLayers cover={cloudCover} windX={windX} /> : null;
  if (isNight) {
    const shower = currentMeteorShower();
    return (
      <div className="sky-anim-wrap" aria-hidden="true">
        {aurora ? <AuroraLayer /> : null}
        <StarCanvas dimmed={false} meteorActive={!!shower} meteorPeak={!!shower?.peak} moon={!hasSkyBody} />
        {wisps}
      </div>
    );
  }

  // Dawn / day / dusk: sun glow following the real solar arc + optional rays.
  // Suppressed for worlds with their own sky body (e.g. Arrakis's dust-sun) so
  // we don't stack the real sun on top of theirs. Twin-sun worlds (Mos Eisley)
  // have no sky body, so their two suns still render here.
  return (
    <div className="sky-anim-wrap" aria-hidden="true">
      {hasSkyBody ? null : <SunGlow timePhase={timePhase} twin={twinSuns} pos={sunPos} />}
      {wisps}
    </div>
  );
}
