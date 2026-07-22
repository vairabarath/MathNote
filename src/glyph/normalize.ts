// Task §2.2 — normalize captured ink into a baseline-relative em-box and compute
// baseline + advance metrics (design D7).
//
// Why baseline-relative + a SHARED em height (not per-glyph bbox scaling):
// a sequence like "96" must read as a written number, which means glyphs keep
// their real relative sizes and vertical positions. If each glyph were scaled to
// fill its own box, a "." would balloon to full height and a "-" would float
// wrong. Scaling every glyph by the same capture-guide em height, and measuring y
// from the shared baseline, makes "." small-and-low and "-" mid-height fall out
// naturally (design Open Question resolved) — no special-casing per symbol.

import type { Sample, Point, CaptureFrame, GlyphMetrics, Glyph } from './types'

/** Default right side bearing added to ink width to get advance (em). */
const SIDE_BEARING = 0.12

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function sampleBounds(sample: Sample): Bounds {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const stroke of sample.strokes) {
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Normalize one raw sample into baseline-relative em coordinates:
 *   x' = (x - inkLeft) / emHeight     (left edge → 0)
 *   y' = (y - baselineY) / emHeight   (baseline → 0, y-down)
 * Pressure and timing are carried through untouched — normalization is spatial
 * only, so animated draw-in and velocity-width still have their `t`.
 */
export function normalizeSample(raw: Sample, frame: CaptureFrame): Sample {
  const b = sampleBounds(raw)
  const s = 1 / frame.emHeight
  const inkLeft = b.minX
  const strokes = raw.strokes.map((stroke) => ({
    points: stroke.points.map(
      (p): Point => ({
        x: (p.x - inkLeft) * s,
        y: (p.y - frame.baselineY) * s,
        pressure: p.pressure,
        t: p.t,
      }),
    ),
  }))
  return { strokes }
}

/** Per-sample metrics (all in em), assuming the sample is already normalized. */
function metricsOf(sample: Sample): GlyphMetrics {
  const b = sampleBounds(sample)
  const width = b.maxX - b.minX
  return {
    width,
    top: b.minY, // most-negative (highest above baseline)
    bottom: b.maxY, // most-positive (lowest / descender)
    advance: width + SIDE_BEARING,
  }
}

function averageMetrics(all: GlyphMetrics[]): GlyphMetrics {
  const n = all.length || 1
  const sum = all.reduce(
    (acc, m) => ({
      advance: acc.advance + m.advance,
      width: acc.width + m.width,
      top: acc.top + m.top,
      bottom: acc.bottom + m.bottom,
    }),
    { advance: 0, width: 0, top: 0, bottom: 0 },
  )
  return {
    advance: sum.advance / n,
    width: sum.width / n,
    top: sum.top / n,
    bottom: sum.bottom / n,
  }
}

/**
 * Build a persisted Glyph from raw captured samples and the capture guide they
 * were drawn against. Samples are normalized; metrics are averaged across them so
 * placement is stable regardless of which sample pick-then-warp later selects.
 */
export function buildGlyph(
  symbol: string,
  rawSamples: Sample[],
  frame: CaptureFrame,
): Glyph {
  const samples = rawSamples.map((s) => normalizeSample(s, frame))
  const metrics = averageMetrics(samples.map(metricsOf))
  return { symbol, samples, metrics }
}
