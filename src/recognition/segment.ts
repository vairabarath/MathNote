// §1.2 — naive stroke segmentation (the ONLY thing the spike implements).
//
// Groups strokes of a single-line expression into glyph clusters by horizontal
// (x) proximity: strokes whose x-extents overlap or sit within a gap threshold
// join the same glyph; a larger gap starts a new glyph.
//
// This is the load-bearing assumption under test (Requirements thread C), so two
// discipline rules hold:
//   1. The gap threshold is chosen A PRIORI and never tuned per case — tuning it
//      until the sample cases "look right" would overfit the gate to the examples
//      and make it meaningless.
//   2. We assert nothing about which cases pass. Whether a two-stroke "5" merges
//      or touching digits split is what the spike MEASURES, not what it assumes.
//
// A known structural fact this will surface, not paper over: touching digits have
// ~zero horizontal gap, so no gap threshold can separate them without also
// splitting real single glyphs. Pure-spatial is enough to establish that wall —
// temporal proximity can't rescue it either, since touching digits are also
// consecutive in time — so no second (temporal) variant is built here.

import type { Stroke } from '../glyph/types'

export interface StrokeBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  cx: number
  cy: number
  w: number
  h: number
}

export interface SegmentResult {
  /** stroke index (in draw order) → glyph group id (0-based, left-to-right) */
  assignment: number[]
  /** group id → stroke indices */
  groups: number[][]
  /** group id → bounding box (px) */
  groupBoxes: StrokeBox[]
  gapRatioUsed: number
}

/** Fixed a-priori gap threshold, as a fraction of median stroke height. Chosen
 *  once; DO NOT tune this per test case (see file header). */
export const GAP_RATIO = 0.35

export function strokeBox(s: Stroke): StrokeBox {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of s.points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function unionBox(boxes: StrokeBox[]): StrokeBox {
  const minX = Math.min(...boxes.map((b) => b.minX))
  const maxX = Math.max(...boxes.map((b) => b.maxX))
  const minY = Math.min(...boxes.map((b) => b.minY))
  const maxY = Math.max(...boxes.map((b) => b.maxY))
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

export function segmentBySpatialGaps(strokes: Stroke[], gapRatio = GAP_RATIO): SegmentResult {
  const n = strokes.length
  if (n === 0) return { assignment: [], groups: [], groupBoxes: [], gapRatioUsed: gapRatio }

  const boxes = strokes.map(strokeBox)
  const gap = gapRatio * (median(boxes.map((b) => b.h)) || 1)

  // process strokes left-to-right by their left edge, remembering original index
  const order = boxes.map((b, i) => ({ i, b })).sort((a, b) => a.b.minX - b.b.minX)

  const groups: number[][] = []
  let curIdx: number[] = []
  let curMaxX = -Infinity
  for (const { i, b } of order) {
    if (curIdx.length === 0 || b.minX <= curMaxX + gap) {
      curIdx.push(i)
      curMaxX = Math.max(curMaxX, b.maxX)
    } else {
      groups.push(curIdx)
      curIdx = [i]
      curMaxX = b.maxX
    }
  }
  if (curIdx.length > 0) groups.push(curIdx)

  const assignment = new Array<number>(n).fill(-1)
  groups.forEach((g, gid) => g.forEach((si) => (assignment[si] = gid)))
  const groupBoxes = groups.map((g) => unionBox(g.map((si) => boxes[si])))

  return { assignment, groups, groupBoxes, gapRatioUsed: gap }
}

// --- Partition scoring (the OBJECTIVE metric, §1.4) --------------------------
//
// The score is NOT "detected count vs intended count" — count lets an over-split
// and an over-merge cancel into a right number over wrong boundaries. We compare
// the predicted stroke→glyph PARTITION against the intended one as equivalence
// relations: for every pair of strokes, do both partitions agree on whether they
// share a glyph?

/** Pairs of stroke indices the prediction grouped differently than truth. */
export function misgroupedPairs(pred: number[], truth: number[]): [number, number][] {
  const out: [number, number][] = []
  const n = Math.min(pred.length, truth.length)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const predSame = pred[i] === pred[j]
      const truthSame = truth[i] === truth[j]
      if (predSame !== truthSame) out.push([i, j])
    }
  }
  return out
}

export function partitionsEqual(pred: number[], truth: number[]): boolean {
  return pred.length === truth.length && misgroupedPairs(pred, truth).length === 0
}
