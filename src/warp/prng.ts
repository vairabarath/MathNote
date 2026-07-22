// Small seedable PRNG (mulberry32). We avoid Math.random() in the warp so that:
//   1. a given (sample, seed) pair always produces the SAME warped output —
//      required for the residual metric (§1.7) to compare like with like, and
//      for a blind test to be reproducible / shareable;
//   2. each rendered instance can be handed its own distinct seed, which is what
//      breaks the visible repetition cycle in "999999999" (design D2).

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Uniform in [-mag, +mag). */
  signed(mag: number): number
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    signed: (mag) => (next() * 2 - 1) * mag,
  }
}
