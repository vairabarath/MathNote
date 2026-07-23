// §2 recognizer — Option 1 branch (single-digit + spaced), behind a swappable
// interface (Requirements R2). Segment (§1) → classify each glyph group as an
// operator (geometry) or a digit (template-match against the user's captured
// 0–9) → return tokens, OR refuse with `unreadable` for input outside the
// supported envelope (touching multi-digit).
//
// HARD RULE (design D8, spec): never emit a confident wrong reading of
// unsupported input — a gorgeously-rendered wrong answer is the worst outcome.
// So low-confidence matches and suspiciously-wide (merged-digit) groups return
// `unreadable`, not a guessed token.
//
// The multi-digit classifier is the NAMED deferred upgrade; it drops in behind
// this same `ink → RecognitionResult` interface with no change to the loop.

import type { Stroke } from '../glyph/types'
import type { Library } from '../glyph/library'
import { segmentBySpatialGaps, strokeBox, type StrokeBox } from './segment'

export type Token = string // '0'–'9', '+', '-', '*', '='

export type RecognitionResult =
  | { ok: true; tokens: Token[] }
  | { ok: false; reason: string }

export type Recognizer = (ink: Stroke[], library: Library) => RecognitionResult

const GRID = 24
/** Max template distance (1 - dilated IoU) still accepted as a confident digit. */
const DIST_MAX = 0.72
/** A single glyph is taller-than-wide (or narrow); a group much wider than tall
 *  is almost certainly two touching digits → refuse. */
const ASPECT_MAX = 1.35

// --- rasterization + distance ------------------------------------------------

function unionBoxOf(strokes: Stroke[]): StrokeBox {
  const boxes = strokes.map(strokeBox)
  const minX = Math.min(...boxes.map((b) => b.minX))
  const maxX = Math.max(...boxes.map((b) => b.maxX))
  const minY = Math.min(...boxes.map((b) => b.minY))
  const maxY = Math.max(...boxes.map((b) => b.maxY))
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/** Rasterize strokes into a GRID×GRID occupancy bitmap, scaled to fit while
 *  PRESERVING aspect ratio (so a narrow "1" stays narrow) and centered. */
export function rasterize(strokes: Stroke[]): Uint8Array {
  const g = new Uint8Array(GRID * GRID)
  const box = unionBoxOf(strokes)
  const size = Math.max(box.w, box.h) || 1
  const offX = (size - box.w) / 2
  const offY = (size - box.h) / 2
  const put = (x: number, y: number) => {
    const gx = Math.floor(((x - box.minX + offX) / size) * (GRID - 1))
    const gy = Math.floor(((y - box.minY + offY) / size) * (GRID - 1))
    if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) g[gy * GRID + gx] = 1
  }
  for (const s of strokes) {
    const pts = s.points
    if (pts.length === 1) put(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (size / GRID)))
      for (let k = 0; k <= steps; k++) put(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps)
    }
  }
  return g
}

/** Dilate occupancy by one cell (tolerate small position differences). */
function dilate(g: Uint8Array): Uint8Array {
  const out = new Uint8Array(GRID * GRID)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!g[y * GRID + x]) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) out[ny * GRID + nx] = 1
        }
      }
    }
  }
  return out
}

/** Distance = 1 − IoU on dilated bitmaps (0 = identical, 1 = disjoint). */
export function gridDistance(a: Uint8Array, b: Uint8Array): number {
  const da = dilate(a)
  const db = dilate(b)
  let inter = 0
  let uni = 0
  for (let i = 0; i < da.length; i++) {
    const x = da[i]
    const y = db[i]
    if (x || y) uni++
    if (x && y) inter++
  }
  return uni === 0 ? 1 : 1 - inter / uni
}

// --- operator geometry -------------------------------------------------------

function isHorizontal(b: StrokeBox): boolean {
  return b.w > b.h * 2.5
}
function isVertical(b: StrokeBox): boolean {
  return b.h > b.w * 2.5
}

/** Try to read a glyph group as an operator by stroke geometry. */
function matchOperator(strokes: Stroke[]): Token | null {
  const boxes = strokes.map(strokeBox)
  if (strokes.length === 1) {
    if (isHorizontal(boxes[0])) return '-'
    return null
  }
  if (strokes.length === 2) {
    const [a, b] = boxes
    // '=' : two horizontal strokes stacked
    if (isHorizontal(a) && isHorizontal(b)) return '='
    // '+' : one horizontal + one vertical, crossing
    const hv = (isHorizontal(a) && isVertical(b)) || (isVertical(a) && isHorizontal(b))
    if (hv) return '+'
    // NOTE: '×' and '÷' are deliberately NOT detected in the MVP (deferred with
    // multi-digit). An unhandled operator falls through to digit-match and is
    // REFUSED (D8), never misread — which is the correct behaviour for now.
  }
  return null
}

// --- digit template match ----------------------------------------------------

interface DigitMatch {
  digit: string
  distance: number
}

/** Best-matching captured digit for a glyph group (min over all 3 samples). */
function matchDigit(strokes: Stroke[], library: Library): DigitMatch | null {
  const cand = rasterize(strokes)
  let best: DigitMatch | null = null
  for (const digit of '0123456789') {
    const glyph = library[digit]
    if (!glyph) continue
    for (const sample of glyph.samples) {
      const d = gridDistance(cand, rasterize(sample.strokes))
      if (best === null || d < best.distance) best = { digit, distance: d }
    }
  }
  return best
}

// --- top-level recognizer ----------------------------------------------------

/**
 * Structural detector for the `=` commit trigger (§3.2), independent of digit
 * recognition so it fires even when a digit is unreadable. Returns the stroke
 * indices of the trailing `=` group and of the left-hand-side, or null.
 */
export function findTrailingEquals(
  ink: Stroke[],
): { equals: number[]; lhs: number[] } | null {
  const { groups } = segmentBySpatialGaps(ink)
  if (groups.length < 2) return null // need an LHS plus the '='
  const last = groups[groups.length - 1]
  if (matchOperator(last.map((i) => ink[i])) === '=') {
    return { equals: last, lhs: groups.slice(0, -1).flat() }
  }
  return null
}

export const recognizeExpression: Recognizer = (ink, library) => {
  if (ink.length === 0) return { ok: false, reason: 'Write an expression first' }

  const { groups } = segmentBySpatialGaps(ink)
  const tokens: Token[] = []

  for (const groupStrokeIdxs of groups) {
    const strokes = groupStrokeIdxs.map((i) => ink[i])

    const op = matchOperator(strokes)
    if (op) {
      tokens.push(op)
      continue
    }

    // Refuse suspiciously-wide groups: almost certainly touching multi-digit,
    // which this branch cannot segment (§1.7). Refuse, never guess (D8).
    const box = unionBoxOf(strokes)
    if (box.h > 0 && box.w / box.h > ASPECT_MAX) {
      return { ok: false, reason: 'Space out multi-digit numbers — I can only read one digit at a time for now' }
    }

    const m = matchDigit(strokes, library)
    if (!m || m.distance > DIST_MAX) {
      return { ok: false, reason: "I couldn't read one of those glyphs — try writing it more clearly" }
    }
    tokens.push(m.digit)
  }

  if (tokens.length === 0) return { ok: false, reason: 'Nothing to read' }
  return { ok: true, tokens }
}
