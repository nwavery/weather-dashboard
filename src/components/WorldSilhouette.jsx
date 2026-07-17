// A single iconic silhouette that drifts across the world's scene — life on the
// horizon. Pure CSS-animated SVG, rendered above the sky/effects but below the
// text scrim. Ground-dwellers trundle along the bottom; fliers wheel up high.
//
// Drawing rules (from the 2026-07 silhouette review): every shape must
// unambiguously face RIGHT (all bands travel left→right); no feature thinner
// than ~5 viewBox units (finer detail vanishes at the 64-150px render size);
// joints overlap 2-3u (never abut — abutting edges shimmer while animating);
// no per-element opacity (the group alpha lives on .silhouette-svg in CSS);
// and each shape should fill ~90%+ of its viewBox so siblings render at the
// same apparent scale.

const SHAPES = {
  // Jawa sandcrawler — tall trapezoid hull whose raked, overhanging prow leads
  // right, riding one solid tread slab.
  sandcrawler: {
    band: 'ground',
    viewBox: '0 0 130 80',
    body: (
      <g>
        <path d="M8 66 L12 3 L128 3 L128 14 L93 49 L89 66 Z" />
        <rect x="2" y="60" width="104" height="18" rx="8" />
      </g>
    )
  },
  // AT-AT walker — towering stance: boxy hull on four near-vertical column
  // legs (total height ≈ hull length), head leading right at hull level.
  walker: {
    band: 'ground',
    viewBox: '0 0 132 100',
    body: (
      <g>
        {/* hull */}
        <path d="M8 8 L16 2 L86 2 L96 8 L96 34 L88 40 L14 40 L8 34 Z" />
        {/* neck from the upper-front shoulder */}
        <path d="M87 9 L106 13 L106 23 L87 19 Z" />
        {/* faceted command head + chin-gun mass */}
        <path d="M102 7 L125 7 L131 13 L131 22 L125 27 L102 27 Z" />
        <path d="M118 23 L127 24 L130 33 L121 33 Z" />
        {/* four vertical column legs, roots buried in the hull */}
        <rect x="10" y="37" width="9" height="57" />
        <rect x="30" y="37" width="9" height="57" />
        <rect x="56" y="37" width="9" height="57" />
        <rect x="80" y="37" width="9" height="57" />
        {/* flared foot pads */}
        <path d="M9 91 L20 91 L23 100 L6 100 Z" />
        <path d="M29 91 L40 91 L43 100 L26 100 Z" />
        <path d="M55 91 L66 91 L69 100 L52 100 Z" />
        <path d="M79 91 L90 91 L93 100 L76 100 Z" />
      </g>
    )
  },
  // Pooh's red balloon (Hundred Acre Wood) — teardrop leaning into the drift,
  // chunky knot, thick string trailing down-left.
  balloon: {
    band: 'high',
    viewBox: '0 0 80 100',
    body: (
      <g>
        <path d="M40 64 C26 56 18 42 18 26 C18 10 31 1 48 1 C65 1 79 12 79 28 C79 46 56 58 40 64 Z" />
        <circle cx="41" cy="66" r="7" />
        <path d="M41 70 C38 82 27 90 11 95" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </g>
    )
  },
  // Ikran (banshee) gliding right — long snout + backswept crest, a large
  // raked forewing and smaller hindwing (the four-wing read), single rudder
  // tail trailing left.
  banshee: {
    band: 'mid',
    viewBox: '0 0 150 80',
    body: (
      <g>
        {/* head+crest+body+tail, snout leading right */}
        <path d="M149 40 C144 35 138 31 131 28 C123 22 113 18 104 16 C100 15 99 18 102 20 C110 24 116 28 120 33 C111 38 101 45 93 49 C81 53 66 53 56 56 C50 58 50 64 54 68 C66 73 84 73 98 69 C108 66 119 57 128 50 C136 46 143 43 148 43 Z" />
        {/* raked forewing */}
        <path d="M72.0 62 L93.5 57 C87.0 44 72.0 22 60.0 6 C57.0 2 52.5 3 54.0 8 C55.0 14 55.0 18 54.0 22 C60.0 26 59.0 32 54.5 37 C62.0 42 66.0 50 69.0 56 Z" />
        {/* smaller raked hindwing */}
        <path d="M53.0 64 L65.0 60 C58.0 50 48.0 36 38.0 22 C35.0 18 31.5 19 33.5 23 C35.0 30 35.0 34 33.5 39 C40.0 44 44.5 51 49.0 58 Z" />
        {/* tail shaft + rudder fin */}
        <path d="M58 55 C46 60 32 63 18 64 L20 72 C36 71 48 68 60 67 Z" />
        <ellipse cx="14" cy="64" rx="5.5" ry="16" transform="rotate(-14 14 64)" />
      </g>
    )
  },
  // Game of Thrones dragon gliding right — a dominant scalloped bat wing,
  // thick neck to an open-jawed head, long tail ending in a spade tip.
  dragon: {
    band: 'mid',
    viewBox: '0 0 200 120',
    body: (
      <g>
        {/* spade tail → body → neck → open-wedge jaw */}
        <path d="M2 88 L20 76 L24 84 C40 80 56 76 74 74 C96 68 116 68 138 71 C151 64 157 52 158 42 C160 30 168 24 178 23 L198 28 L180 39 L191 50 L164 51 C153 58 147 68 144 80 C139 98 120 106 97 103 C74 99 58 96 44 94 C34 93 28 92 24 91 L20 100 Z" />
        {/* huge raised bat wing, scalloped trailing edge */}
        <path d="M118 84 C127 62 134 44 137 30 C142 20 147 12 152 4 Q126 28 114 28 Q104 54 82 50 Q78 70 64 80 Z" />
        {/* tucked hind legs */}
        <path d="M92 94 Q79 101 66 112 Q62 117 69 116 Q83 110 98 100 Z" />
        <path d="M122 97 Q110 104 100 114 Q97 119 104 118 Q116 112 128 103 Z" />
      </g>
    )
  },
  // Brachiosaurus (Jurassic Park) — thick up-swept neck to a tiny crested
  // head; near/far leg pairs; giraffe-sloped back; lifted tail.
  dino: {
    band: 'ground',
    viewBox: '0 0 148 100',
    body: (
      <g>
        {/* tail, tip lifted clear of the ground */}
        <path d="M52 50 Q26 52 8 63 L4 70 Q26 70 52 74 Z" />
        {/* neck — a thick round stroke tapers naturally up into the head */}
        <path fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" d="M102 50 Q126 36 127 16" />
        {/* body, shoulders higher than hips */}
        <ellipse cx="75" cy="56" rx="37" ry="19" transform="rotate(-7 75 56)" />
        {/* near/far leg pairs */}
        <rect x="40" y="56" width="13" height="43" rx="3" />
        <rect x="61" y="60" width="10" height="36" rx="3" />
        <rect x="79" y="55" width="10" height="41" rx="3" />
        <rect x="96" y="47" width="14" height="52" rx="3" />
        {/* tiny head with the domed nasal crest */}
        <ellipse cx="133" cy="16" rx="8" ry="5.5" />
        <ellipse cx="129" cy="8.5" rx="6" ry="5.5" />
      </g>
    )
  },
  // Witch on a broomstick (Halloween Town) — the witch dominates: pointed hat
  // capping the head, hooked nose leading right, boot below the stick, cape
  // streaming back, solid triangle bristle fan trailing left.
  witch: {
    band: 'mid',
    viewBox: '0 0 150 110',
    body: (
      <g>
        {/* broomstick leading right + solid bristle fan */}
        <path d="M55 86 L148 78 L148 86 L55 94 Z" />
        <path d="M66 90 L2 72 L2 108 Z" />
        {/* cape streaming back */}
        <path d="M84 48 L38 54 L50 66 L82 76 Z" />
        {/* hunched cloaked body + arm to the stick + leg/boot */}
        <path d="M102 46 C86 44 70 54 67 70 C65 80 66 90 70 95 L96 95 C102 85 103 64 102 46 Z" />
        <path d="M90 50 L99 47 L127 80 L119 88 Z" />
        <path d="M82 82 L94 82 L99 98 L114 98 L116 107 L90 108 Z" />
        {/* head with hooked nose, capped by the hat */}
        <ellipse cx="106" cy="39" rx="10" ry="10" />
        <path d="M110 35 L131 45 L110 48 Z" />
        <path d="M84 27 L122 31 L122 38 L84 34 Z" />
        <path d="M91 0 L87 33 L120 35 Z" />
      </g>
    )
  },
  // Gandalf's cart arriving in the Shire — pony leading right, two-wheel cart
  // stacked with fireworks, a tall-hatted driver holding the reins.
  cart: {
    band: 'ground',
    viewBox: '0 0 170 100',
    body: (
      <g>
        {/* cart: big wheel, bed, shaft to the pony */}
        <circle cx="42" cy="72" r="26" />
        <rect x="4" y="54" width="94" height="17" rx="3" />
        <rect x="90" y="58" width="34" height="9" rx="3" />
        {/* fireworks load: leaning rocket + crates */}
        <path d="M12 32 L1 8 L9 4 L20 28 Z" />
        <rect x="6" y="30" width="26" height="28" rx="2" />
        <rect x="9" y="15" width="20" height="18" rx="2" />
        {/* Gandalf: torso, head, hat brim + cone, arm to the reins */}
        <path d="M58 68 C57 50 62 38 70 34 L82 34 C86 42 86 54 84 68 Z" />
        <circle cx="74" cy="26" r="8" />
        <ellipse cx="75" cy="19" rx="16" ry="5" />
        <path d="M62 21 L88 21 L82 0 Z" />
        <path d="M76 38 L98 54 L94 62 L73 47 Z" />
        {/* pony: body, tail, neck+head leading right, ear, legs */}
        <ellipse cx="130" cy="60" rx="28" ry="15" />
        <path d="M106 49 C94 55 88 66 90 80 L98 82 C97 70 103 60 112 56 Z" />
        <path d="M132 66 C134 52 138 42 144 30 L146 20 L152 17 L168 27 L170 33 L166 39 L154 37 C152 48 150 56 149 66 Z" />
        <path d="M146 20 L153 17 L149 6 Z" />
        <path d="M105 60 L102 97 L110 97 L115 62 Z" />
        <path d="M116 62 L114 97 L122 97 L126 64 Z" />
        <path d="M135 62 L139 97 L147 97 L145 62 Z" />
        <path d="M148 56 L158 97 L166 97 L156 56 Z" />
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
