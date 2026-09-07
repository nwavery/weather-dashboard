// Seeded hash primitives for deterministic, clock-driven randomness.
//
// Everything built on these is a pure function of (seed, integer key), so a
// feature can look random while every viewer sees the same thing at the same
// moment and a reload never rerolls it — the property the fictional worlds'
// weather and scheduled events depend on, and the seasonal leaf gusts too.
//
// The arithmetic here is load-bearing: changing it moves every world's event
// schedule. test/fictionalCities.test.js pins a golden 72-hour table that will
// fail loudly if these are perturbed.

// FNV-1a over a string → uint32 seed.
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Integer-keyed hash → [0,1)
export function rand01(seed, k) {
  let h = (seed ^ Math.imul(k | 0, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
