import { describe, it, expect } from 'vitest'
import { segmentBySpatialGaps, partitionsEqual, misgroupedPairs } from './segment'
import type { Stroke } from '../glyph/types'

function stroke(x0: number, x1: number, y0 = 0, y1 = 20): Stroke {
  return {
    points: [
      { x: x0, y: y0, pressure: 0.5, t: 0 },
      { x: x1, y: y1, pressure: 0.5, t: 10 },
    ],
  }
}

describe('partition scoring (the objective metric, not count)', () => {
  it('treats relabelled partitions as equal (equivalence relation)', () => {
    expect(partitionsEqual([0, 0, 1], [1, 1, 0])).toBe(true)
  })

  it('catches over-merge (two glyphs collapsed into one)', () => {
    // truth: strokes 0,1 = glyph A; stroke 2 = glyph B. pred merged all.
    expect(partitionsEqual([0, 0, 0], [0, 0, 1])).toBe(false)
    expect(misgroupedPairs([0, 0, 0], [0, 0, 1])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('catches over-split (one glyph broken into two)', () => {
    expect(partitionsEqual([0, 1], [0, 0])).toBe(false)
  })

  it('count can match while boundaries are wrong — why count is not the metric', () => {
    // over-split glyph0 AND over-merge glyph1+2 → 3 predicted groups = 3 truth
    const pred = [0, 1, 2, 2] // strokes: g0 split into 0/1, strokes 2,3 merged
    const truth = [0, 0, 1, 2] // strokes 0,1 = g0; stroke2 = g1; stroke3 = g2
    const predCount = new Set(pred).size
    const truthCount = new Set(truth).size
    expect(predCount).toBe(truthCount) // counts agree...
    expect(partitionsEqual(pred, truth)).toBe(false) // ...but partition is wrong
  })
})

describe('segmentBySpatialGaps mechanics', () => {
  it('merges strokes whose x-extents overlap (multi-stroke glyph)', () => {
    const r = segmentBySpatialGaps([stroke(0, 20), stroke(5, 25)])
    expect(r.groups).toHaveLength(1)
  })

  it('splits strokes separated by a gap larger than the threshold', () => {
    const r = segmentBySpatialGaps([stroke(0, 20), stroke(40, 60)])
    expect(r.groups).toHaveLength(2)
  })

  it('merges near-touching strokes (the wall: two glyphs, ~zero gap → one group)', () => {
    // gap of 2px < 0.35*20 = 7px threshold → merged, even if intended as two digits
    const r = segmentBySpatialGaps([stroke(0, 20), stroke(22, 42)])
    expect(r.groups).toHaveLength(1)
  })

  it('orders groups left-to-right regardless of draw order', () => {
    const r = segmentBySpatialGaps([stroke(40, 60), stroke(0, 20)])
    // stroke drawn second (leftmost) is group 0
    expect(r.assignment[1]).toBe(0)
    expect(r.assignment[0]).toBe(1)
  })
})
