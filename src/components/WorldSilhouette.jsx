// A single iconic silhouette that drifts across the world's scene — life on the
// horizon. Pure CSS-animated SVG, rendered above the sky/effects but below the
// text scrim. Ground-dwellers trundle along the bottom; fliers wheel up high.

const SHAPES = {
  // Jawa sandcrawler trundling along the dunes
  sandcrawler: {
    band: 'ground',
    viewBox: '0 0 120 70',
    body: (
      <g>
        <path d="M14 54 L106 54 L96 22 L40 22 L24 38 L14 38 Z" />
        <rect x="40" y="28" width="6" height="6" opacity="0.5" />
        <rect x="54" y="28" width="6" height="6" opacity="0.5" />
        <rect x="68" y="28" width="6" height="6" opacity="0.5" />
        <rect x="10" y="54" width="100" height="9" rx="4" />
        <circle cx="22" cy="63" r="5" /><circle cx="42" cy="63" r="5" />
        <circle cx="62" cy="63" r="5" /><circle cx="82" cy="63" r="5" /><circle cx="100" cy="63" r="5" />
      </g>
    )
  },
  // AT-AT walker striding across the snow
  walker: {
    band: 'ground',
    viewBox: '0 0 130 90',
    body: (
      <g>
        <path d="M30 30 L96 30 L104 44 L96 52 L30 52 Z" />
        <path d="M96 34 L120 30 L120 40 L100 44 Z" />
        <rect x="34" y="52" width="7" height="32" /><rect x="52" y="52" width="7" height="30" />
        <rect x="78" y="52" width="7" height="32" /><rect x="92" y="52" width="7" height="30" />
        <rect x="30" y="82" width="13" height="5" /><rect x="74" y="82" width="13" height="5" />
      </g>
    )
  },
  // Pooh's red balloon drifting (Hundred Acre Wood)
  balloon: {
    band: 'high',
    viewBox: '0 0 60 90',
    body: (
      <g>
        <ellipse cx="30" cy="30" rx="22" ry="26" />
        <path d="M27 55 L33 55 L30 62 Z" />
        <line x1="30" y1="62" x2="30" y2="88" stroke="currentColor" strokeWidth="1.5" />
      </g>
    )
  },
  // Banshee / mountain dragon wheeling over Pandora
  banshee: {
    band: 'mid',
    viewBox: '0 0 130 70',
    body: (
      <g>
        <path d="M65 38 q-34 -30 -60 -6 q24 -6 40 14 q-22 -4 -34 8 q22 -2 38 8 Z" />
        <path d="M65 38 q34 -30 60 -6 q-24 -6 -40 14 q22 -4 34 8 q-22 -2 -38 8 Z" />
        <ellipse cx="65" cy="40" rx="9" ry="20" />
        <path d="M65 20 q4 -12 10 -14 q-2 8 -4 12 Z" />
      </g>
    )
  },
  // Game of Thrones dragon (Winterfell)
  dragon: {
    band: 'mid',
    viewBox: '0 0 140 70',
    body: (
      <g>
        <path d="M70 40 q-40 -34 -66 -8 q26 -4 44 16 q-26 -6 -40 6 q26 0 44 10 Z" />
        <path d="M70 40 q40 -34 66 -8 q-26 -4 -44 16 q26 -6 40 6 q-26 0 -44 10 Z" />
        <path d="M70 36 q-6 -2 -18 -16 q4 12 10 18 Z" />
        <ellipse cx="70" cy="42" rx="8" ry="16" />
        <path d="M70 56 q-2 12 -16 18 q10 -2 18 -10 Z" />
      </g>
    )
  },
  // Long-necked dinosaur (Jurassic Park)
  dino: {
    band: 'ground',
    viewBox: '0 0 150 100',
    body: (
      <g>
        <path d="M40 92 q-6 -36 14 -52 q14 -12 40 -16 q10 -2 18 -14 q4 8 -2 16 q-18 12 -34 18 q-20 8 -22 50 Z" />
        <path d="M40 92 q24 -10 48 -6 q-2 8 0 12 q-28 -4 -48 -2 Z" />
        <ellipse cx="116" cy="12" rx="10" ry="6" />
      </g>
    )
  },
  // Witch on a broomstick crossing the moon (Halloween Town)
  witch: {
    band: 'mid',
    viewBox: '0 0 150 80',
    body: (
      <g>
        {/* broomstick */}
        <rect x="18" y="50" width="86" height="3" rx="1.5" transform="rotate(-8 60 51)" />
        {/* bristles */}
        <path d="M104 40 l24 4 l-26 6 l24 8 l-28 4 Z" />
        {/* witch body hunched forward */}
        <path d="M58 50 q4 -16 16 -18 q10 -1 14 6 q-2 8 -10 10 q-10 3 -20 2 Z" />
        {/* pointed hat */}
        <path d="M70 32 l22 -22 l6 16 Z" />
        <ellipse cx="84" cy="30" rx="16" ry="3" />
        {/* trailing cape */}
        <path d="M58 50 q-16 2 -26 12 q14 -2 22 0 Z" />
      </g>
    )
  }
};

export function WorldSilhouette({ kind }) {
  const shape = SHAPES[kind];
  if (!shape) return null;
  return (
    <div className={`world-silhouette world-silhouette--${shape.band}`} aria-hidden="true">
      <svg className="silhouette-svg" viewBox={shape.viewBox} fill="currentColor" preserveAspectRatio="xMidYMid meet">
        {shape.body}
      </svg>
    </div>
  );
}
