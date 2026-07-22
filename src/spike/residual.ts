// Task §1.7 / design D3a — make "variation" MEASURABLE, not just "different".
//
// The anti-font requirement is that two renders of the SAME glyph differ by more
// than any global transform can explain. So we measure the "non-trivial per-point
// residual after best-fit affine alignment": warp one base sample twice, fit the
// best affine mapping one onto the other, and measure what distance is LEFT OVER.
// Affine-only jitter → residual ≈ 0 (a stamp). A real warp → residual > 0.
//
// CRITICAL (per review): the metric only means something on SAME-BASE pairs.
// Pick-then-warp picks among 3 different base 9s; if we compared two *rendered*
// instances, half the pairs would be different base shapes and the residual would
// conflate base-shape difference with warp difference. So every comparison here
// holds the base sample FIXED and varies ONLY the warp seed.
//
// The number this produces is the raw material for the "minimum perceptible
// variation threshold": a human decides, in the blind test, the smallest value
// that still reads as "different but same hand". The metric supplies the axis;
// the human sets the point on it.

import type { Sample } from '../glyph/types'
import { bboxOf, fitAffine, applyAffine, type Vec } from '../warp/geometry'
import { warpSample, RESAMPLE_N, DEFAULT_WARP, AFFINE_ONLY, type WarpParams } from '../warp/warp'

/** Per-point RMS residual after best-fit affine, as a fraction of glyph height.
 *  a and b MUST be warps of the same base (identical stroke/point structure). */
export function residualAfterAffine(a: Sample, b: Sample): number {
  const em = bboxOf(a.strokes.map((s) => s.points)).height || 1
  let sumSq = 0
  let count = 0
  const nStrokes = Math.min(a.strokes.length, b.strokes.length)
  for (let s = 0; s < nStrokes; s++) {
    const src: Vec[] = a.strokes[s].points
    const dst: Vec[] = b.strokes[s].points
    const n = Math.min(src.length, dst.length)
    if (n < 3) continue
    const m = fitAffine(src.slice(0, n), dst.slice(0, n))
    for (let i = 0; i < n; i++) {
      const p = applyAffine(m, src[i])
      const dx = p.x - dst[i].x
      const dy = p.y - dst[i].y
      sumSq += dx * dx + dy * dy
      count++
    }
  }
  if (count === 0) return 0
  return Math.sqrt(sumSq / count) / em
}

export interface VariationStats {
  min: number
  median: number
  mean: number
  max: number
  pairs: number
}

function summarize(values: number[]): VariationStats {
  const sorted = [...values].sort((x, y) => x - y)
  const n = sorted.length
  const median = n === 0 ? 0 : sorted[Math.floor(n / 2)]
  const mean = n === 0 ? 0 : values.reduce((a, b) => a + b, 0) / n
  return {
    min: sorted[0] ?? 0,
    median,
    mean,
    max: sorted[n - 1] ?? 0,
    pairs: n,
  }
}

/** Warp `base` with many seeds, compare consecutive pairs, summarize the
 *  residual distribution (expressed as % of glyph height). */
export function variationStats(
  base: Sample,
  params: WarpParams,
  nWarps: number,
  seedBase: number,
): VariationStats {
  const warps: Sample[] = []
  for (let i = 0; i < nWarps; i++) {
    warps.push(warpSample(base, seedBase + i * 1013904223, params))
  }
  const residuals: number[] = []
  for (let i = 1; i < warps.length; i++) {
    residuals.push(residualAfterAffine(warps[i - 1], warps[i]) * 100)
  }
  return summarize(residuals)
}

export interface SpikeMetrics {
  warp: VariationStats
  affineOnly: VariationStats
  resampleN: number
}

/** The metric block shown in the spike UI: warp vs affine-only control. */
export function computeSpikeMetrics(base: Sample, seedBase = 12345): SpikeMetrics {
  return {
    warp: variationStats(base, DEFAULT_WARP, 24, seedBase),
    affineOnly: variationStats(base, AFFINE_ONLY, 24, seedBase),
    resampleN: RESAMPLE_N,
  }
}
