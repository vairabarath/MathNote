import { describe, it, expect } from 'vitest'
import { normalizeSample, buildGlyph } from './normalize'
import type { Sample, CaptureFrame } from './types'

// Shared capture guide: baseline at y=200 px, em = 100 px.
const FRAME: CaptureFrame = { baselineY: 200, emHeight: 100 }

function sample(points: [number, number][]): Sample {
  return {
    strokes: [
      { points: points.map(([x, y], i) => ({ x, y, pressure: 0.5, t: i * 10 })) },
    ],
  }
}

describe('normalizeSample', () => {
  it('maps the baseline to y=0 and left edge to x=0 (baseline-relative, y-down)', () => {
    // a box sitting on the baseline: x 120..170, y 120 (top) .. 200 (baseline)
    const n = normalizeSample(sample([[120, 120], [170, 200]]), FRAME)
    const pts = n.strokes[0].points
    expect(pts[0].x).toBeCloseTo(0) // left edge → 0
    expect(pts[0].y).toBeCloseTo(-0.8) // 80px above baseline / 100 em → -0.8
    expect(pts[1].y).toBeCloseTo(0) // on the baseline → 0
  })

  it('preserves aspect ratio (x and y scaled by the same factor)', () => {
    const n = normalizeSample(sample([[100, 200], [200, 100]]), FRAME)
    const pts = n.strokes[0].points
    const dx = pts[1].x - pts[0].x
    const dy = pts[1].y - pts[0].y
    expect(Math.abs(dx)).toBeCloseTo(Math.abs(dy)) // 100px square stays square
  })

  it('carries pressure and timing through untouched', () => {
    const raw = sample([[120, 150], [140, 180]])
    raw.strokes[0].points[1].pressure = 0.83
    const n = normalizeSample(raw, FRAME)
    expect(n.strokes[0].points[1].pressure).toBe(0.83)
    expect(n.strokes[0].points[1].t).toBe(10)
  })
})

describe('buildGlyph metrics (relative sizes preserved via shared em height)', () => {
  // A full-height digit drawn baseline-up to ~0.8em, width 0.5em.
  const digitRaw = sample([[100, 120], [150, 120], [150, 200], [100, 200]])
  // A dot: tiny, sitting right on the baseline.
  const dotRaw = sample([[100, 192], [108, 192], [108, 200], [100, 200]])
  // A dash: mid-height, above the baseline, no part near it.
  const dashRaw = sample([[100, 150], [140, 150], [140, 158], [100, 158]])

  it('a digit is much taller than a dot under the same frame', () => {
    const digit = buildGlyph('8', [digitRaw], FRAME)
    const dot = buildGlyph('.', [dotRaw], FRAME)
    const digitH = digit.metrics.bottom - digit.metrics.top
    const dotH = dot.metrics.bottom - dot.metrics.top
    expect(digitH).toBeGreaterThan(0.7)
    expect(dotH).toBeLessThan(0.15)
  })

  it('a dot sits at the baseline; a dash floats above it', () => {
    const dot = buildGlyph('.', [dotRaw], FRAME)
    const dash = buildGlyph('-', [dashRaw], FRAME)
    // dot's lowest point is ~ on the baseline (bottom ≈ 0)
    expect(dot.metrics.bottom).toBeCloseTo(0, 1)
    // dash is entirely above the baseline → both top and bottom are negative
    expect(dash.metrics.top).toBeLessThan(0)
    expect(dash.metrics.bottom).toBeLessThan(0)
  })

  it('advance = ink width + a side bearing', () => {
    const digit = buildGlyph('8', [digitRaw], FRAME)
    expect(digit.metrics.advance).toBeCloseTo(digit.metrics.width + 0.12)
  })
})
