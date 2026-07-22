// ─────────────────────────────────────────────────────────────────────────────
// THE STRUCTURED WARP  (design D3 — the load-bearing hypothesis of Math Canvas)
// ─────────────────────────────────────────────────────────────────────────────
//
// The entire product rests on one claim: synthetic stroke variation can read as
// "the same hand wandering" rather than as a font (rigid repetition) or as
// damage (white noise). The warp is that claim made executable, and §1 exists to
// validate it BEFORE anything is built around it.
//
// The variation must be:
//   • LOW-FREQUENCY along the stroke — adjacent points move together, not
//     independently. (Independent per-point jitter is the "damage" failure mode.)
//   • SCALED TO GLYPH SIZE — a wobble is a fixed fraction of the glyph, so it
//     looks the same at any render size.
//   • EXPRESSED IN THE TANGENT/NORMAL FRAME — bows push sideways off the path
//     (normal), stretch/squish run along it (tangent). This is what makes a curve
//     "relax or tighten" like a real re-drawing instead of smearing.
//   • A MILD GLOBAL AFFINE is ONE component among several — never the only one.
//     (Affine-only is the "tilted stamp is still a stamp" failure mode.)
//
// HONEST-FRAMING NOTE (design D2 — must survive into the code, task §4.7):
//   v1 is PICK-THEN-WARP, not interpolation. Each rendered instance is one of 3
//   captured samples with this generic structured warp applied. That means the
//   variation is a GENERIC structured prior seeded from 3 PERSONAL anchor shapes
//   — it is NOT generating along the user's personal variation manifold. The v1
//   win is cycle-breaking + three anchor shapes, not learned personal variance.
//   Manifold-learning (sample interpolation) is a NAMED Phase 1.5+ upgrade,
//   deliberately out of v1 scope. If a future reader finds the variation "looks
//   slightly generic," that is the design working as specified — not a bug to
//   rebuild around.
//
// Parameter ranges below are the design's Open Questions: seeded with plausible
// defaults, tuned empirically in the §1 spike, then frozen as the validated set.

import type { Sample, Stroke, Point } from '../glyph/types'
import { makeRng, type Rng } from './prng'
import {
  bboxOf,
  resampleByArcLength,
  tangents,
  normal,
  type Vec,
} from './geometry'

/** Fixed resample density per stroke. Constant so that two warps of the SAME
 *  base sample share point-to-point correspondence — the residual metric (§1.7)
 *  depends on this. */
export const RESAMPLE_N = 64

export interface WarpParams {
  /** Peak normal-direction bow, as a fraction of glyph size. */
  normalBowAmp: number
  /** Number of low-frequency bow components summed together. */
  normalBowWaves: number
  /** Lowest/highest spatial frequency of a bow, in cycles across the stroke.
   *  Kept LOW — this is the whole "coherent, not noisy" property. */
  bowFreqMin: number
  bowFreqMax: number
  /** Peak along-tangent stretch/squish, as a fraction of glyph size. */
  arcRescaleAmp: number
  /** Peak endpoint over/undershoot (fast pen-lift), as a fraction of glyph size. */
  overshootAmp: number
  /** Max global slant (rotation-ish shear) in degrees. */
  slantDeg: number
  /** Max anisotropic size jitter, as a fraction (e.g. 0.04 = ±4%). */
  sizeJitter: number
}

/** FROZEN validated parameter set — passed the §1 warp-validation gate on
 *  2026-07-22 (design D6): read as one hand to two independent viewers and beat a
 *  handwriting font in a blind pick. Measured inter-instance variation with these
 *  values is min 1.19% / median 3.49% / max 4.95% residual-after-affine, all above
 *  the perceptual threshold T = 1.0% (task §1.7). Do not retune casually — a change
 *  here re-opens the load-bearing hypothesis and should re-run §1. */
export const DEFAULT_WARP: WarpParams = {
  normalBowAmp: 0.03,
  normalBowWaves: 2,
  bowFreqMin: 0.5,
  bowFreqMax: 2.0,
  arcRescaleAmp: 0.045,
  overshootAmp: 0.025,
  slantDeg: 3,
  sizeJitter: 0.04,
}

/** A "sizeless" warp — used only by the affine-jitter control (row c). */
export const AFFINE_ONLY: WarpParams = {
  normalBowAmp: 0,
  normalBowWaves: 0,
  bowFreqMin: 0.5,
  bowFreqMax: 2.0,
  arcRescaleAmp: 0,
  overshootAmp: 0,
  slantDeg: 4,
  sizeJitter: 0.05,
}

interface Wave {
  freq: number
  phase: number
  amp: number
}

/** Build `count` low-frequency sinusoidal components with the given peak. */
function buildWaves(
  rng: Rng,
  count: number,
  freqMin: number,
  freqMax: number,
  peak: number,
): Wave[] {
  if (count <= 0 || peak === 0) return []
  const waves: Wave[] = []
  // Split the peak amplitude across components so their sum stays ~= peak.
  const share = peak / count
  for (let i = 0; i < count; i++) {
    waves.push({
      freq: rng.range(freqMin, freqMax),
      phase: rng.range(0, Math.PI * 2),
      amp: share * rng.range(0.6, 1.0),
    })
  }
  return waves
}

function sampleWaves(waves: Wave[], s: number): number {
  let v = 0
  for (const w of waves) v += w.amp * Math.sin(2 * Math.PI * w.freq * s + w.phase)
  return v
}

/** smoothstep, for ramping the endpoint overshoot in near the stroke ends. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Warp one Sample. Returns a new Sample (same stroke count, same order,
 * pressure/t carried through). Deterministic in `seed`: same (sample, seed,
 * params) → same output, which the residual metric and blind reproducibility
 * both rely on.
 */
export function warpSample(
  sample: Sample,
  seed: number,
  params: WarpParams = DEFAULT_WARP,
): Sample {
  const rng = makeRng(seed)

  // Glyph size drives every amplitude, so the warp is proportional at any render
  // size. Use the diagonal of the whole-glyph bbox (all strokes together).
  const gb = bboxOf(sample.strokes.map((s) => s.points))
  const glyphSize = Math.hypot(gb.width, gb.height) || 1
  const cx = gb.minX + gb.width / 2
  const cy = gb.minY + gb.height / 2

  // --- Global affine: ONE component among several (never alone). --------------
  const theta = (rng.signed(params.slantDeg) * Math.PI) / 180
  const sx = 1 + rng.signed(params.sizeJitter)
  const sy = 1 + rng.signed(params.sizeJitter)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const applyGlobal = (p: Vec): Vec => {
    // scale (anisotropic) then rotate, about the glyph centroid
    const dx = (p.x - cx) * sx
    const dy = (p.y - cy) * sy
    return {
      x: cx + dx * cosT - dy * sinT,
      y: cy + dx * sinT + dy * cosT,
    }
  }

  const strokes: Stroke[] = sample.strokes.map((stroke) => {
    const src = stroke.points
    if (src.length < 2) {
      return { points: src.map((p) => ({ ...applyGlobal(p), pressure: p.pressure, t: p.t })) }
    }

    // Resample to fixed N by arc length → uniform spacing for the field.
    const resampled = resampleByArcLength(src, RESAMPLE_N)
    const tans = tangents(resampled)

    // Independent low-frequency fields for this stroke.
    const bow = buildWaves(
      rng,
      params.normalBowWaves,
      params.bowFreqMin,
      params.bowFreqMax,
      glyphSize * params.normalBowAmp,
    )
    const stretch = buildWaves(
      rng,
      1,
      params.bowFreqMin,
      params.bowFreqMax,
      glyphSize * params.arcRescaleAmp,
    )
    // Over/undershoot at each end (sign random — fast pen-lift can go either way).
    const startOver = rng.signed(glyphSize * params.overshootAmp)
    const endOver = rng.signed(glyphSize * params.overshootAmp)

    const warpedPts: Point[] = resampled.map((p, i) => {
      const s = i / (RESAMPLE_N - 1)
      const T = tans[i]
      const Nn = normal(T)

      const bowDisp = sampleWaves(bow, s)
      let tanDisp = sampleWaves(stretch, s)
      // ramp overshoot in over the last/first ~12% of the stroke
      tanDisp += endOver * smoothstep(0.88, 1.0, s)
      tanDisp -= startOver * smoothstep(0.12, 0.0, s)

      const moved: Vec = {
        x: p.x + Nn.x * bowDisp + T.x * tanDisp,
        y: p.y + Nn.y * bowDisp + T.y * tanDisp,
      }
      const g = applyGlobal(moved)

      // Carry pressure/t by mapping resample index back onto the source timeline.
      const srcFrac = i / (RESAMPLE_N - 1)
      const srcIdx = Math.min(src.length - 1, Math.round(srcFrac * (src.length - 1)))
      return { x: g.x, y: g.y, pressure: src[srcIdx].pressure, t: src[srcIdx].t }
    })

    return { points: warpedPts }
  })

  return { strokes }
}
