// Tasks §4.3 / §4.4 — per-point stroke half-width.
//
// Rendered strokes are NEVER constant-width vector paths (glyph-replay spec).
// Width comes from captured PRESSURE when present (pen/touch), tapering toward the
// stroke ends. When pressure is absent (mouse — stored as null in §3.1), width is
// SYNTHESIZED from pen velocity using captured `t`: faster segments render
// thinner, like a real pen. Either way the width varies along the stroke.

import type { Point } from '../glyph/types'

/** nib size as a fraction of the rendered em height. */
const NIB = 0.05

function median(xs: number[]): number {
  if (xs.length === 0) return 1
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Taper factor at position `frac` ∈ [0,1] along the stroke (thin at both ends). */
function taper(frac: number): number {
  return Math.min(1, Math.sin(Math.PI * frac) * 1.7 + 0.18)
}

/**
 * Half-widths (px) for each point of a stroke, at rendered em height `emPx`.
 * `hasPressure` is decided per stroke from whether points carry pressure.
 */
export function halfWidths(points: Point[], emPx: number): number[] {
  const n = points.length
  const base = emPx * NIB
  if (n === 0) return []
  if (n === 1) return [base * 0.6]

  const usePressure = points[0].pressure !== null

  if (usePressure) {
    return points.map((p, i) => {
      const frac = i / (n - 1)
      const pr = p.pressure ?? 0.5
      return base * (0.4 + 0.9 * pr) * taper(frac)
    })
  }

  // Velocity synthesis: speed = distance / dt between consecutive points.
  const speeds: number[] = new Array(n)
  for (let i = 1; i < n; i++) {
    const dt = Math.max(points[i].t - points[i - 1].t, 1)
    const dist = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    speeds[i] = dist / dt
  }
  speeds[0] = speeds[1]
  const med = median(speeds.slice(1)) || 1
  return points.map((_, i) => {
    const frac = i / (n - 1)
    // med/(med+speed): 0.5 at typical speed, → 1 when slow, → 0 when fast.
    const velFactor = 0.35 + 0.9 * (med / (med + speeds[i]))
    return base * velFactor * taper(frac)
  })
}
