// Canvas rendering for the spike: variable-width ink, pick-then-warp strings,
// and the two controls (affine-only stamp, handwriting font).
//
// Placement is deliberately UNIFORM (fixed baseline, fixed advance) across every
// row. Neighbour-relative placement (baseline drift, size-relative spacing) is
// task §4.2 and is intentionally OUT of the §1 isolation: the spike must test the
// warp and nothing else, so the only thing that can differ between the warp row
// and the stamp row is the warp.

import type { Sample } from '../glyph/types'
import { bboxOf } from '../warp/geometry'
import { warpSample, AFFINE_ONLY, type WarpParams } from '../warp/warp'

export interface PlacedGlyph {
  /** canvas x of the glyph's left edge */
  x: number
  /** canvas y of the shared baseline (glyph bbox bottom sits here) */
  baselineY: number
  /** target glyph height in px */
  emHeight: number
}

const INK = '#16324f'

/** Half-width (px) at a point, from pressure, tapered toward stroke ends. */
function halfWidth(
  pressure: number | null,
  frac: number,
  emHeight: number,
): number {
  const base = emHeight * 0.05 // nib size relative to glyph height
  const p = pressure ?? 0.5
  const taper = Math.min(1, Math.sin(Math.PI * frac) * 1.6 + 0.15) // thin at ends
  return base * (0.45 + 0.9 * p) * taper
}

/** Map a sample into canvas space: scale bbox to emHeight, seat bbox bottom on
 *  the baseline, left edge at place.x. Returns the advance (scaled width). */
function toCanvas(
  sample: Sample,
  place: PlacedGlyph,
): { strokes: { x: number; y: number; pressure: number | null; frac: number }[][]; advance: number } {
  const gb = bboxOf(sample.strokes.map((s) => s.points))
  const scale = place.emHeight / (gb.height || 1)
  const strokes = sample.strokes.map((stroke) => {
    const n = stroke.points.length
    return stroke.points.map((pt, i) => ({
      x: place.x + (pt.x - gb.minX) * scale,
      y: place.baselineY - (gb.maxY - pt.y) * scale,
      pressure: pt.pressure,
      frac: n <= 1 ? 0 : i / (n - 1),
    }))
  })
  return { strokes, advance: gb.width * scale }
}

/** Draw one sample as variable-width ink (overlapping discs + connecting quads
 *  → smooth round-joined ribbon). */
export function drawSample(
  ctx: CanvasRenderingContext2D,
  sample: Sample,
  place: PlacedGlyph,
  color: string = INK,
): number {
  const { strokes, advance } = toCanvas(sample, place)
  ctx.fillStyle = color
  for (const pts of strokes) {
    if (pts.length === 0) continue
    // discs at each point
    for (const p of pts) {
      const hw = halfWidth(p.pressure, p.frac, place.emHeight)
      ctx.beginPath()
      ctx.arc(p.x, p.y, hw, 0, Math.PI * 2)
      ctx.fill()
    }
    // quads between consecutive discs to fill the gaps smoothly
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const ha = halfWidth(a.pressure, a.frac, place.emHeight)
      const hb = halfWidth(b.pressure, b.frac, place.emHeight)
      let nx = -(b.y - a.y)
      let ny = b.x - a.x
      const len = Math.hypot(nx, ny) || 1
      nx /= len
      ny /= len
      ctx.beginPath()
      ctx.moveTo(a.x + nx * ha, a.y + ny * ha)
      ctx.lineTo(b.x + nx * hb, b.y + ny * hb)
      ctx.lineTo(b.x - nx * hb, b.y - ny * hb)
      ctx.lineTo(a.x - nx * ha, a.y - ny * ha)
      ctx.closePath()
      ctx.fill()
    }
  }
  return advance
}

export interface StringLayout {
  count: number
  /** target VISUAL height (px) of each glyph — matched across all three rows */
  emHeight: number
  /** vertical center of the glyph band — all rows are centered here, so no row
   *  gets a height/seating advantage that could skew the blind pick */
  centerY: number
  startX: number
  advance: number // fixed per-glyph advance
}

/** Row (a): pick-then-warp. Each instance picks one of the base samples and
 *  applies a distinct warp seed → cycle broken, three anchors multiplied. */
export function drawWarpRow(
  ctx: CanvasRenderingContext2D,
  bases: Sample[],
  layout: StringLayout,
  seedBase: number,
  params?: WarpParams,
): void {
  const baselineY = layout.centerY + layout.emHeight / 2
  for (let i = 0; i < layout.count; i++) {
    const seed = seedBase + i * 1013904223
    const base = bases[Math.abs(seed) % bases.length]
    const warped = warpSample(base, seed, params)
    drawSample(ctx, warped, {
      x: layout.startX + i * layout.advance,
      baselineY,
      emHeight: layout.emHeight,
    })
  }
}

/** Row (c): rigid affine-jittered stamp. ONE fixed base sample, only a global
 *  affine per instance — the "a tilted stamp is still a stamp" failure mode we
 *  must beat. By construction its post-affine residual ≈ 0 (calibration check). */
export function drawStampRow(
  ctx: CanvasRenderingContext2D,
  base: Sample,
  layout: StringLayout,
  seedBase: number,
): void {
  const baselineY = layout.centerY + layout.emHeight / 2
  for (let i = 0; i < layout.count; i++) {
    const seed = seedBase + i * 2654435761
    const jittered = warpSample(base, seed, AFFINE_ONLY)
    drawSample(ctx, jittered, {
      x: layout.startX + i * layout.advance,
      baselineY,
      emHeight: layout.emHeight,
    })
  }
}

/** Row (b): handwriting web font (self-hosted Caveat), a fair-fight control.
 *  Scaled + centered by the glyph's MEASURED bounding box so its visual height
 *  and vertical center match the ink rows exactly — the font must win (or not)
 *  on shape, never because it happened to be bigger or seated differently. */
export function drawFontRow(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  layout: StringLayout,
): void {
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'

  // Probe the glyph's real ascent/descent, then pick a font size whose visual
  // height (ascent + descent) equals the target emHeight.
  const probePx = 100
  ctx.font = `${probePx}px "Caveat", cursive`
  const pm = ctx.measureText(glyph)
  const visH = pm.actualBoundingBoxAscent + pm.actualBoundingBoxDescent || probePx
  const fontPx = probePx * (layout.emHeight / visH)

  ctx.font = `${fontPx}px "Caveat", cursive`
  const m = ctx.measureText(glyph)
  const asc = m.actualBoundingBoxAscent
  const desc = m.actualBoundingBoxDescent
  // Seat so the glyph's visual center lands on layout.centerY.
  const baselineY = layout.centerY + (asc - desc) / 2

  for (let i = 0; i < layout.count; i++) {
    const cx = layout.startX + i * layout.advance + layout.advance / 2
    ctx.fillText(glyph, cx, baselineY)
  }
}
