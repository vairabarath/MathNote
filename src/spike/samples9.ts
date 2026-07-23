// Task §1.1 — three hand-authored samples of the glyph "9".
//
// These stand in for real captured ink during the spike. They are LOAD-BEARING:
// if the base shapes look fake, the blind test is meaningless (you can't tell a
// failed warp from bad source ink). So they are authored as smooth parametric
// curves — a bowl (loop) flowing into a tail — sampled to points, NOT dots
// placed by eye. The three genuinely DIFFER (loop roundness, slant, tail, sweep)
// the way one person's three 9s differ: that variety is the "3 anchor shapes"
// that pick-then-warp (design D2) multiplies into a continuum.
//
// Coordinate space is arbitrary (y-down); the renderer normalizes + scales.

import type { Sample, Point } from '../glyph/types'

interface NineConfig {
  cx: number
  cy: number // loop center
  rx: number
  ry: number // loop radii
  startDeg: number // where the pen starts on the loop
  sweepDeg: number // how far it travels around (negative = counterclockwise)
  slant: number // shear applied to the whole glyph (italic lean)
  tailDx: number // horizontal offset of the tail end from the loop-exit
  tailDy: number // tail length downward
  tailBow: number // sideways bow of the tail
  n: number // point count
}

function shear(x: number, y: number, slant: number, cy: number): number {
  // lean the glyph: higher points (smaller y) shift right for a natural italic
  return x + (cy - y) * slant
}

function buildNine(cfg: NineConfig): Sample {
  const pts: { x: number; y: number }[] = []

  // Split the point budget between the loop and the tail.
  const nLoop = Math.round(cfg.n * 0.68)
  const nTail = cfg.n - nLoop

  // --- Loop (bowl) ---
  let exitX = 0
  let exitY = 0
  let exitAngle = 0
  for (let i = 0; i < nLoop; i++) {
    const u = i / (nLoop - 1)
    const deg = cfg.startDeg + cfg.sweepDeg * u
    const th = (deg * Math.PI) / 180
    const x = cfg.cx + cfg.rx * Math.cos(th)
    const y = cfg.cy + cfg.ry * Math.sin(th)
    pts.push({ x, y })
    if (i === nLoop - 1) {
      exitX = x
      exitY = y
      exitAngle = th
    }
  }

  // --- Tail: a quadratic bezier from the loop exit, descending with a bow ---
  const startX = exitX
  const startY = exitY
  const endX = exitX + cfg.tailDx
  const endY = exitY + cfg.tailDy
  // control point offset sideways from the chord midpoint to make the tail curve
  const midX = (startX + endX) / 2 + cfg.tailBow
  const midY = (startY + endY) / 2
  for (let i = 1; i <= nTail; i++) {
    const u = i / nTail
    const mt = 1 - u
    const x = mt * mt * startX + 2 * mt * u * midX + u * u * endX
    const y = mt * mt * startY + 2 * mt * u * midY + u * u * endY
    pts.push({ x, y })
  }
  void exitAngle

  // Apply slant, then attach pressure + timing.
  const total = pts.length
  const points: Point[] = pts.map((p, i) => {
    const frac = i / (total - 1)
    // pressure: light on pen-down, heavier through the body, tapering at lift
    const pressure = 0.32 + 0.46 * Math.sin(Math.PI * frac)
    // timing: roughly constant pen speed → dt proportional to spacing, plus a
    // gentle slow-down into the tail. ~4.2ms per point average.
    const t = frac * 260 + 40 * frac * frac
    return {
      x: shear(p.x, p.y, cfg.slant, cfg.cy),
      y: p.y,
      pressure,
      t,
    }
  })

  return { strokes: [{ points }] }
}

// Three distinct anchor shapes. All read as "9" but differ as a person's would.
// The loop is traced counterclockwise from the upper-right and EXITS at the
// lower-right (~+55°), so the tail descends from the bottom of the bowl — that
// exit point is what makes it a "9" and not an "a"/"q".
export const SAMPLES_9: Sample[] = [
  // A — round, upright, straight-ish tail
  buildNine({
    cx: 50, cy: 42, rx: 25, ry: 28,
    startDeg: 25, sweepDeg: -330,
    slant: 0.05, tailDx: 1, tailDy: 60, tailBow: -5, n: 60,
  }),
  // B — narrower loop, more slant, longer hooked tail
  buildNine({
    cx: 52, cy: 40, rx: 21, ry: 30,
    startDeg: 22, sweepDeg: -325,
    slant: 0.14, tailDx: -7, tailDy: 72, tailBow: 9, n: 62,
  }),
  // C — fatter loop, near-upright, tail curving the other way
  buildNine({
    cx: 48, cy: 44, rx: 28, ry: 27,
    startDeg: 28, sweepDeg: -336,
    slant: 0.02, tailDx: 6, tailDy: 56, tailBow: -7, n: 58,
  }),
]
