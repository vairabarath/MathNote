// Tasks §4.1 / §4.2 — sequence layout with pick-then-warp and neighbour-relative
// placement.
//
// Placement uses each glyph's stored advance metric for spacing (NOT a fixed
// pitch), a gentle baseline DRIFT (a random walk, so the line wanders like a hand
// rather than jumping), and per-instance SIZE variation relative to neighbours —
// so "96" reads as a written number, not glyphs stamped at fixed positions.
//
// pick-then-warp (design D2): each glyph instance picks one of its 3 captured
// samples and gets its own warp seed. See warp.ts for the honest-framing note:
// this is a generic structured prior over 3 personal anchors, not personal-
// variance manifold learning (a named Phase 1.5+ upgrade).

import { ANSWER_ALPHABET } from '../glyph/types'
import { makeRng } from '../warp/prng'
import { isGlyphComplete, type Library } from '../glyph/library'

export interface InkInstance {
  kind: 'ink'
  symbol: string
  sampleIndex: number
  warpSeed: number
  x: number // canvas px, left edge
  baselineY: number // canvas px baseline for this instance (with drift)
  scale: number // px per em (with size jitter)
}

export interface FontInstance {
  kind: 'font'
  symbol: string
  x: number
  baselineY: number
  scale: number // px per em
}

export type Instance = InkInstance | FontInstance

export interface LayoutResult {
  instances: Instance[]
  width: number
  height: number
  baselineY: number
  /** out-of-alphabet symbols rendered via font fallback (flagged for capture). */
  flaggedForCapture: string[]
  /** answer-alphabet symbols missing from the library (a gate violation — these
   *  are NEVER font-filled; the caller should have blocked, see §3.5). */
  blockedMissing: string[]
}

export interface LayoutOpts {
  /** target glyph em height in px. */
  emPx: number
  /** deterministic seed (same seed → same layout). */
  seed: number
  marginX: number
  /** max baseline drift as a fraction of em. */
  driftAmp: number
  /** max per-instance size jitter (e.g. 0.05 = ±5%). */
  sizeJitterAmp: number
}

export const DEFAULT_LAYOUT: Omit<LayoutOpts, 'seed'> = {
  emPx: 96,
  marginX: 24,
  driftAmp: 0.05,
  sizeJitterAmp: 0.05,
}

const ANSWER_SET = new Set<string>(ANSWER_ALPHABET)

export function layoutResult(
  result: string,
  library: Library,
  opts: LayoutOpts,
): LayoutResult {
  const { emPx, seed, marginX, driftAmp, sizeJitterAmp } = opts
  const rng = makeRng(seed)
  const baselineY = emPx * 1.25
  const instances: Instance[] = []
  const flaggedForCapture: string[] = []
  const blockedMissing: string[] = []

  let cursorX = marginX
  let driftY = 0 // em units, random walk

  for (let i = 0; i < result.length; i++) {
    const ch = result[i]
    if (ch.trim() === '') {
      cursorX += emPx * 0.32
      continue
    }

    const glyph = library[ch]
    if (!isGlyphComplete(glyph)) {
      if (ANSWER_SET.has(ch)) {
        // D9: never font-fill a missing answer glyph. Leave a gap; caller gates.
        if (!blockedMissing.includes(ch)) blockedMissing.push(ch)
        cursorX += emPx * 0.55
      } else {
        // out-of-alphabet → font fallback (§4.6)
        if (!flaggedForCapture.includes(ch)) flaggedForCapture.push(ch)
        instances.push({ kind: 'font', symbol: ch, x: cursorX, baselineY, scale: emPx })
        cursorX += emPx * 0.62
      }
      continue
    }

    // ink instance
    const sizeJit = 1 + rng.signed(sizeJitterAmp)
    const scale = emPx * sizeJit
    const warpSeed = (seed ^ Math.imul(i + 1, 2654435761)) >>> 0
    const sampleIndex = warpSeed % glyph.samples.length

    driftY += rng.signed(driftAmp * 0.4)
    if (driftY > driftAmp) driftY = driftAmp
    if (driftY < -driftAmp) driftY = -driftAmp

    instances.push({
      kind: 'ink',
      symbol: ch,
      sampleIndex,
      warpSeed,
      x: cursorX,
      baselineY: baselineY + driftY * emPx,
      scale,
    })
    cursorX += glyph.metrics.advance * scale
  }

  return {
    instances,
    width: cursorX + marginX,
    height: baselineY + emPx * 0.6,
    baselineY,
    flaggedForCapture,
    blockedMissing,
  }
}
