// §4 replay engine core — resolve a result string into drawable ink and render it.
//
// ─── HONEST-FRAMING NOTE (design D2, task §4.7) ──────────────────────────────
// v1 replay is PICK-THEN-WARP: each glyph instance is one of the user's 3 captured
// samples with the validated structured warp (§1) applied. The variation is
// therefore a GENERIC structured prior seeded from 3 PERSONAL anchor shapes — it
// is NOT generated along the user's personal variation manifold. The v1 win is
// cycle-breaking + three anchors, not learned personal variance. Learning the
// personal manifold (interpolating across samples) is a NAMED Phase 1.5+ upgrade,
// deliberately out of scope here. If future variation looks "slightly generic,"
// that is the design working as specified — see warp.ts and design.md D2.
// ─────────────────────────────────────────────────────────────────────────────

import type { Library } from '../glyph/library'
import { warpSample, DEFAULT_WARP, type WarpParams } from '../warp/warp'
import { halfWidths } from './width'
import { layoutResult, type LayoutOpts, type InkInstance } from './layout'

const INK = '#16324f'

export interface WidePoint {
  x: number
  y: number
  hw: number
}

export interface ResolvedStroke {
  symbol: string
  points: WidePoint[]
  /** cumulative arc length at each point (cumLen[0] = 0). */
  cumLen: number[]
  length: number
}

export interface FontGlyph {
  symbol: string
  x: number
  baselineY: number
  scale: number
}

export type DrawItem =
  | { kind: 'stroke'; stroke: ResolvedStroke }
  | { kind: 'font'; glyph: FontGlyph }

export interface Scene {
  items: DrawItem[]
  width: number
  height: number
  baselineY: number
  flaggedForCapture: string[]
  blockedMissing: string[]
}

function resolveInkStrokes(inst: InkInstance, library: Library, params: WarpParams): ResolvedStroke[] {
  const glyph = library[inst.symbol]
  const sample = glyph.samples[inst.sampleIndex]
  const warped = warpSample(sample, inst.warpSeed, params)
  return warped.strokes.map((stroke) => {
    const hw = halfWidths(stroke.points, inst.scale)
    const points: WidePoint[] = stroke.points.map((p, i) => ({
      x: inst.x + p.x * inst.scale,
      y: inst.baselineY + p.y * inst.scale,
      hw: hw[i],
    }))
    const cumLen: number[] = [0]
    for (let i = 1; i < points.length; i++) {
      cumLen[i] = cumLen[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    }
    return { symbol: inst.symbol, points, cumLen, length: cumLen[cumLen.length - 1] ?? 0 }
  })
}

/** Resolve a result string into an ordered list of draw items. */
export function resolveScene(
  result: string,
  library: Library,
  opts: LayoutOpts,
  params: WarpParams = DEFAULT_WARP,
): Scene {
  const layout = layoutResult(result, library, opts)
  const items: DrawItem[] = []
  for (const inst of layout.instances) {
    if (inst.kind === 'font') {
      items.push({ kind: 'font', glyph: { symbol: inst.symbol, x: inst.x, baselineY: inst.baselineY, scale: inst.scale } })
    } else {
      for (const stroke of resolveInkStrokes(inst, library, params)) {
        items.push({ kind: 'stroke', stroke })
      }
    }
  }
  return {
    items,
    width: layout.width,
    height: layout.height,
    baselineY: layout.baselineY,
    flaggedForCapture: layout.flaggedForCapture,
    blockedMissing: layout.blockedMissing,
  }
}

/** Interpolate a WidePoint at arc length `len` within a stroke. */
function pointAtLength(stroke: ResolvedStroke, len: number): WidePoint {
  const { points, cumLen } = stroke
  if (len <= 0) return points[0]
  for (let i = 1; i < points.length; i++) {
    if (cumLen[i] >= len) {
      const seg = cumLen[i] - cumLen[i - 1] || 1
      const f = (len - cumLen[i - 1]) / seg
      const a = points[i - 1]
      const b = points[i]
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, hw: a.hw + (b.hw - a.hw) * f }
    }
  }
  return points[points.length - 1]
}

/** Draw a variable-width ribbon up to arc length `lenLimit` (Infinity = full). */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ResolvedStroke,
  lenLimit = Infinity,
  color = INK,
): void {
  const { points, cumLen } = stroke
  if (points.length === 0) return
  ctx.fillStyle = color
  const disc = (p: WidePoint) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.2, p.hw), 0, Math.PI * 2)
    ctx.fill()
  }
  const quad = (a: WidePoint, b: WidePoint) => {
    let nx = -(b.y - a.y)
    let ny = b.x - a.x
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    ctx.beginPath()
    ctx.moveTo(a.x + nx * a.hw, a.y + ny * a.hw)
    ctx.lineTo(b.x + nx * b.hw, b.y + ny * b.hw)
    ctx.lineTo(b.x - nx * b.hw, b.y - ny * b.hw)
    ctx.lineTo(a.x - nx * a.hw, a.y - ny * a.hw)
    ctx.closePath()
    ctx.fill()
  }

  disc(points[0])
  for (let i = 1; i < points.length; i++) {
    if (cumLen[i] <= lenLimit) {
      disc(points[i])
      quad(points[i - 1], points[i])
    } else {
      const end = pointAtLength(stroke, lenLimit)
      disc(end)
      quad(points[i - 1], end)
      break
    }
  }
}

/** Draw an out-of-alphabet glyph via the handwriting web font (§4.6). Scaled +
 *  centered by measured bounding box so it seats like the ink. */
export function drawFontGlyph(ctx: CanvasRenderingContext2D, g: FontGlyph, color = INK): void {
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const probePx = 100
  ctx.font = `${probePx}px "Caveat", cursive`
  const pm = ctx.measureText(g.symbol)
  const visH = pm.actualBoundingBoxAscent + pm.actualBoundingBoxDescent || probePx
  const fontPx = probePx * (g.scale / visH)
  ctx.font = `${fontPx}px "Caveat", cursive`
  // alphabetic baseline → the font baseline sits on the shared baseline, matching
  // the ink glyphs, which are seated baseline-relative.
  ctx.fillText(g.symbol, g.x, g.baselineY)
}

/** Draw the whole scene instantly (no animation) — used for tests/thumbnails. */
export function drawSceneStatic(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const item of scene.items) {
    if (item.kind === 'stroke') drawStroke(ctx, item.stroke)
    else drawFontGlyph(ctx, item.glyph)
  }
}
