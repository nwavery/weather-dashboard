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
  // AT-AT walker striding across the snow — long hull, a neck angling down to a
  // boxy head with twin chin guns, and four knee-bent legs mid-stride.
  walker: {
    band: 'ground',
    viewBox: '0 0 150 100',
    body: (
      <g>
        {/* hull with a sloped nose */}
        <path d="M22 30 L94 30 L106 38 L106 42 L94 48 L22 48 Z" />
        {/* neck angling down-forward to the head */}
        <path d="M96 36 L104 34 L120 50 L112 53 Z" />
        {/* command head */}
        <path d="M110 46 L134 47 L138 52 L137 58 L112 59 Z" />
        {/* twin chin guns */}
        <rect x="122" y="59" width="3" height="6" /><rect x="128" y="59" width="3" height="6" />
        {/* four knee-bent legs, splayed mid-stride */}
        <path d="M29 48 L36 48 L33 66 L28 84 L21 84 L26 66 Z" />
        <path d="M47 48 L54 48 L55 66 L53 84 L46 84 L48 66 Z" />
        <path d="M74 48 L81 48 L82 66 L80 84 L73 84 L75 66 Z" />
        <path d="M92 48 L99 48 L104 66 L108 84 L101 84 L97 66 Z" />
        {/* feet */}
        <rect x="19" y="84" width="13" height="5" /><rect x="43" y="84" width="13" height="5" />
        <rect x="70" y="84" width="13" height="5" /><rect x="98" y="84" width="13" height="5" />
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
  // Banshee wheeling over Pandora — overhead: body, crested head, two swept
  // wings, a forked tail.
  banshee: {
    band: 'mid',
    viewBox: '0 0 130 72',
    body: (
      <g>
        <ellipse cx="65" cy="40" rx="7" ry="18" />
        <path d="M65 8 L59 18 L65 24 L71 18 Z" />
        <path d="M62 30 C44 20 24 22 4 34 C22 38 42 40 58 45 C53 40 59 34 62 35 Z" />
        <path d="M68 30 C86 20 106 22 126 34 C108 38 88 40 72 45 C77 40 71 34 68 35 Z" />
        <path d="M62 55 L60 70 L65 65 L70 70 L68 55 Z" />
      </g>
    )
  },
  // Game of Thrones dragon (Winterfell) — side profile, gliding right: an
  // open-jawed head on a long neck, a big raised bat wing, a spade-tipped tail
  // sweeping back, and tucked hind legs.
  dragon: {
    band: 'mid',
    viewBox: '0 0 190 120',
    body: (
      <g>
        {/* belly → neck → open jaw, back down to the back, out to the spade tail */}
        <path d="M14 92 C40 96 70 92 96 84 C112 79 124 69 140 54 L150 60 L176 58 L160 50 L182 45 L149 43 L150 34 L141 41 C120 50 104 58 90 62 C64 70 38 78 22 84 L8 86 Z" />
        {/* raised bat wing, finger-scalloped trailing edge */}
        <path d="M88 60 C66 34 52 20 46 10 Q53 36 61 59 Q69 53 79 63 Q87 56 98 61 Z" />
        {/* tucked hind legs */}
        <path d="M70 84 q-4 12 -12 18 q10 -2 16 -10 Z" />
        <path d="M92 82 q-2 12 -10 17 q10 -2 15 -9 Z" />
      </g>
    )
  },
  // Long-necked dinosaur (Jurassic Park)
  dino: {
    band: 'ground',
    viewBox: '0 0 150 100',
    body: (
      <g>
        {/* tail tapering to the ground */}
        <path d="M46 58 Q20 62 4 82 Q20 72 48 68 Z" />
        {/* long neck — a thick round stroke tapers naturally up into the head */}
        <path fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" d="M104 54 Q127 36 128 15" />
        {/* body */}
        <ellipse cx="72" cy="58" rx="36" ry="21" />
        {/* four sturdy legs */}
        <rect x="46" y="72" width="14" height="27" rx="3" />
        <rect x="64" y="74" width="14" height="25" rx="3" />
        <rect x="84" y="74" width="14" height="25" rx="3" />
        <rect x="98" y="70" width="14" height="29" rx="3" />
        {/* small head with a snout */}
        <ellipse cx="129" cy="13" rx="10" ry="8" />
        <path d="M138 9 q8 1 9 5 q-5 4 -10 2 Z" />
      </g>
    )
  },
  // Witch on a broomstick (Halloween Town) — flying left: bold broomstick with a
  // bristle fan trailing at the back, a hunched figure in a pointed hat, cape
  // streaming behind.
  witch: {
    band: 'mid',
    viewBox: '0 0 170 90',
    body: (
      <g>
        {/* broomstick (handle to the left) + bristle fan at the back */}
        <path d="M6 43 L150 51 L150 56 L6 48 Z" />
        <path d="M120 53 L152 44 L143 54 L152 67 L120 61 Z" />
        {/* cape streaming back */}
        <path d="M64 47 C80 47 94 53 104 64 Q90 57 64 53 Z" />
        {/* hunched body + head */}
        <path d="M52 50 C48 37 57 29 69 30 C79 31 82 40 77 50 C70 55 60 55 52 50 Z" />
        <ellipse cx="70" cy="27" rx="6" ry="6" />
        {/* pointed hat */}
        <path d="M60 28 L96 11 L80 31 Z" />
        <ellipse cx="69" cy="29" rx="14" ry="2.6" />
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
