import { useMemo } from 'react';

// Per-world ambient particle layers for fictional cities (set via `effect` in
// the city registry). Pure CSS animations over useMemo-randomized particles,
// the same idiom as RainLayer/SnowLayer. Rendered above the weather animation,
// below the text scrim.

// Rising, gently swaying bubbles (underwater worlds)
function Bubbles() {
  const bubbles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: 3 + Math.random() * 94,
      size: 6 + Math.random() * 13,
      duration: 6 + Math.random() * 8,
      delay: -(Math.random() * 14),
      sway: 6 + Math.random() * 12,
      opacity: 0.5 + Math.random() * 0.4,
    })),
    []
  );
  return (
    <>
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="fx-bubble"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            '--fx-duration': `${b.duration}s`,
            '--fx-delay': `${b.delay}s`,
            '--fx-sway': `${b.sway}px`,
            '--fx-opacity': b.opacity,
          }}
        />
      ))}
    </>
  );
}

// Glowing embers rising on hot updrafts (volcanic worlds)
function Embers() {
  const embers = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: 2 + Math.random() * 96,
      size: 3 + Math.random() * 4,
      duration: 5 + Math.random() * 4,
      delay: -(Math.random() * 9),
      drift: -18 + Math.random() * 36,
    })),
    []
  );
  return (
    <>
      {embers.map((e) => (
        <div
          key={e.id}
          className="fx-ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            '--fx-duration': `${e.duration}s`,
            '--fx-delay': `${e.delay}s`,
            '--fx-drift': `${e.drift}px`,
          }}
        />
      ))}
    </>
  );
}

// Mt. Doom mid-eruption: a pulsing lava glow plus a dense, fast ember column
function Eruption() {
  const embers = useMemo(() =>
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: 32 + Math.random() * 36,
      size: 2.5 + Math.random() * 4.5,
      duration: 2.2 + Math.random() * 2.6,
      delay: -(Math.random() * 5),
      drift: -34 + Math.random() * 68,
    })),
    []
  );
  return (
    <>
      <div className="fx-eruption-glow" />
      {embers.map((e) => (
        <div
          key={e.id}
          className="fx-ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            '--fx-duration': `${e.duration}s`,
            '--fx-delay': `${e.delay}s`,
            '--fx-drift': `${e.drift}px`,
          }}
        />
      ))}
    </>
  );
}

// Bioluminescent wood-sprites drifting slowly down (Pandora)
function Spores() {
  const spores = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: 4 + Math.random() * 92,
      size: 7 + Math.random() * 7,
      duration: 12 + Math.random() * 10,
      delay: -(Math.random() * 22),
      sway: 14 + Math.random() * 18,
    })),
    []
  );
  return (
    <>
      {spores.map((s) => (
        <div
          key={s.id}
          className="fx-spore"
          style={{
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            '--fx-duration': `${s.duration}s`,
            '--fx-delay': `${s.delay}s`,
            '--fx-sway': `${s.sway}px`,
          }}
        />
      ))}
    </>
  );
}

// Endless skylane traffic (Coruscant): light streaks in alternating directions
function Traffic() {
  const ships = useMemo(() => {
    const lanes = [16, 26, 37, 49, 60];
    const out = [];
    lanes.forEach((top, lane) => {
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        out.push({
          id: `${lane}-${i}`,
          top: top + Math.random() * 4,
          reverse: lane % 2 === 1,
          duration: 4 + Math.random() * 5,
          delay: -(Math.random() * 9),
          width: 9 + Math.random() * 9,
        });
      }
    });
    return out;
  }, []);
  return (
    <>
      {ships.map((s) => (
        <div
          key={s.id}
          className={`fx-ship${s.reverse ? ' fx-ship--rev' : ''}`}
          style={{
            top: `${s.top}%`,
            width: `${s.width}px`,
            '--fx-duration': `${s.duration}s`,
            '--fx-delay': `${s.delay}s`,
          }}
        />
      ))}
    </>
  );
}

// Golden pollen motes drifting on the breeze (The Shire — weed: Very High)
function Pollen() {
  const motes = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      top: 25 + Math.random() * 62,
      size: 2.5 + Math.random() * 2.2,
      duration: 8 + Math.random() * 8,
      delay: -(Math.random() * 16),
      bob: 8 + Math.random() * 14,
    })),
    []
  );
  return (
    <>
      {motes.map((m) => (
        <div
          key={m.id}
          className="fx-mote"
          style={{
            top: `${m.top}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            '--fx-duration': `${m.duration}s`,
            '--fx-delay': `${m.delay}s`,
            '--fx-bob': `${m.bob}px`,
          }}
        />
      ))}
    </>
  );
}

// Twinkling golden magic (Hogwarts)
function Sparkles() {
  const sparks = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: 4 + Math.random() * 92,
      top: 4 + Math.random() * 58,
      size: 3.5 + Math.random() * 3.5,
      duration: 2 + Math.random() * 2.5,
      delay: -(Math.random() * 4.5),
    })),
    []
  );
  return (
    <>
      {sparks.map((s) => (
        <div
          key={s.id}
          className="fx-spark"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            '--fx-duration': `${s.duration}s`,
            '--fx-delay': `${s.delay}s`,
          }}
        />
      ))}
    </>
  );
}

// Wind-blown sand: hazy bands plus fast horizontal grains (Arrakis)
function Sand() {
  const grains = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      top: 8 + Math.random() * 84,
      width: 12 + Math.random() * 12,
      duration: 1.3 + Math.random() * 1.4,
      delay: -(Math.random() * 2.7),
      opacity: 0.45 + Math.random() * 0.35,
    })),
    []
  );
  return (
    <>
      <div className="fx-sand-haze fx-sand-haze--1" />
      <div className="fx-sand-haze fx-sand-haze--2" />
      {grains.map((g) => (
        <div
          key={g.id}
          className="fx-grain"
          style={{
            top: `${g.top}%`,
            width: `${g.width}px`,
            '--fx-duration': `${g.duration}s`,
            '--fx-delay': `${g.delay}s`,
            '--fx-opacity': g.opacity,
          }}
        />
      ))}
    </>
  );
}

// Smoky haze (real cards when AQI is hazardous): slow gray-amber drift
function Smoke() {
  return (
    <>
      <div className="fx-smoke-band fx-smoke-band--1" />
      <div className="fx-smoke-band fx-smoke-band--2" />
    </>
  );
}

// Tumbling autumn leaves (Hundred Acre Wood's rather blustery day)
function Leaves() {
  const palette = ['#c9803a', '#a8642a', '#d9a04e', '#b8753c'];
  const leaves = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      top: 10 + Math.random() * 75,
      size: 9 + Math.random() * 5,
      duration: 5 + Math.random() * 4,
      delay: -(Math.random() * 9),
      bob: 16 + Math.random() * 26,
      color: palette[i % palette.length],
    })),
    []
  );
  return (
    <>
      {leaves.map((l) => (
        <div
          key={l.id}
          className="fx-leaf"
          style={{
            top: `${l.top}%`,
            width: `${l.size}px`,
            height: `${l.size}px`,
            background: l.color,
            '--fx-duration': `${l.duration}s`,
            '--fx-delay': `${l.delay}s`,
            '--fx-bob': `${l.bob}px`,
          }}
        />
      ))}
    </>
  );
}

const EFFECTS = {
  bubbles: Bubbles,
  embers: Embers,
  spores: Spores,
  traffic: Traffic,
  pollen: Pollen,
  sparkles: Sparkles,
  sand: Sand,
  leaves: Leaves,
  smoke: Smoke,
  eruption: Eruption,
};

export function WorldEffects({ kind }) {
  const Effect = EFFECTS[kind];
  if (!Effect) return null;
  return (
    <div className="world-effects-wrap" aria-hidden="true">
      <Effect />
    </div>
  );
}
