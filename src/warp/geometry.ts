// Pure geometry helpers used by the warp and the residual metric.
// No React, no canvas — just numbers, so this ports straight into the engine.

export interface Vec {
  x: number
  y: number
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export function bbox(pts: Vec[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/** BBox over several point lists (e.g. all strokes of a glyph). */
export function bboxOf(groups: Vec[][]): BBox {
  return bbox(groups.flat())
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Total polyline length. */
export function arcLength(pts: Vec[]): number {
  let sum = 0
  for (let i = 1; i < pts.length; i++) sum += dist(pts[i - 1], pts[i])
  return sum
}

/**
 * Resample a polyline into `n` points spaced evenly by arc length.
 * Uniform spacing is what makes a displacement field along the stroke behave
 * predictably (an amplitude in "fraction of stroke length" means the same thing
 * everywhere). Endpoints are preserved exactly.
 */
export function resampleByArcLength(pts: Vec[], n: number): Vec[] {
  if (pts.length === 0) return []
  if (pts.length === 1 || n <= 1) return [pts[0]]

  const total = arcLength(pts)
  if (total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }))

  const step = total / (n - 1)
  const out: Vec[] = [{ ...pts[0] }]
  for (let i = 1; i < n - 1; i++) {
    out.push(pointAtDistance(pts, i * step))
  }
  out.push({ ...pts[pts.length - 1] })
  return out
}

/** Point at absolute arc-length distance `d` along the polyline. */
function pointAtDistance(pts: Vec[], d: number): Vec {
  if (d <= 0) return { ...pts[0] }
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const segLen = dist(pts[i - 1], pts[i])
    if (acc + segLen >= d) {
      const f = segLen === 0 ? 0 : (d - acc) / segLen
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
      }
    }
    acc += segLen
  }
  return { ...pts[pts.length - 1] }
}

/**
 * Unit tangents at each resampled point (central differences).
 * With these, the unit normal is (-ty, tx).
 */
export function tangents(pts: Vec[]): Vec[] {
  const n = pts.length
  const out: Vec[] = []
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(n - 1, i + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    out.push({ x: tx, y: ty })
  }
  return out
}

export function normal(t: Vec): Vec {
  return { x: -t.y, y: t.x }
}

// --- Best-fit affine alignment, for the residual metric (§1.7 / D3a) ---------
//
// To decide whether two warps differ by MORE than a global transform, we first
// remove the best global transform, then measure what's left. We fit a full
// affine map A·p + b (least squares) taking `src` onto `dst`, apply it, and the
// leftover per-point distance is the "non-trivial residual after best-fit affine
// alignment" the spec asks for. (Affine, not just similarity, is the strict
// reading of design D3a's "any global rotation/scale/translation" — an affine
// superset — so the residual we report is conservative: what NO global linear
// map can explain.)

export interface Affine {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** Least-squares affine mapping src[i] -> dst[i]. Requires equal-length lists. */
export function fitAffine(src: Vec[], dst: Vec[]): Affine {
  const n = Math.min(src.length, dst.length)
  // Solve for [a b e] and [c d f] independently via normal equations on
  // basis [x, y, 1]. Sxx etc. are the 3x3 Gram matrix entries.
  let Sxx = 0
  let Sxy = 0
  let Sx = 0
  let Syy = 0
  let Sy = 0
  let S1 = 0
  let Tx_x = 0
  let Tx_y = 0
  let Tx_1 = 0
  let Ty_x = 0
  let Ty_y = 0
  let Ty_1 = 0
  for (let i = 0; i < n; i++) {
    const { x, y } = src[i]
    Sxx += x * x
    Sxy += x * y
    Sx += x
    Syy += y * y
    Sy += y
    S1 += 1
    Tx_x += dst[i].x * x
    Tx_y += dst[i].x * y
    Tx_1 += dst[i].x
    Ty_x += dst[i].y * x
    Ty_y += dst[i].y * y
    Ty_1 += dst[i].y
  }
  const G: number[][] = [
    [Sxx, Sxy, Sx],
    [Sxy, Syy, Sy],
    [Sx, Sy, S1],
  ]
  const [a, b, e] = solve3(G, [Tx_x, Tx_y, Tx_1])
  const [c, d, f] = solve3(G, [Ty_x, Ty_y, Ty_1])
  return { a, b, c, d, e, f }
}

export function applyAffine(m: Affine, p: Vec): Vec {
  return { x: m.a * p.x + m.b * p.y + m.e, y: m.c * p.x + m.d * p.y + m.f }
}

/** Solve a 3x3 linear system by Gaussian elimination with partial pivoting. */
function solve3(A: number[][], rhs: number[]): [number, number, number] {
  const M = [
    [A[0][0], A[0][1], A[0][2], rhs[0]],
    [A[1][0], A[1][1], A[1][2], rhs[1]],
    [A[2][0], A[2][1], A[2][2], rhs[2]],
  ]
  for (let col = 0; col < 3; col++) {
    let piv = col
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    }
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const d = M[col][col] || 1e-12
    for (let c = col; c < 4; c++) M[col][c] /= d
    for (let r = 0; r < 3; r++) {
      if (r === col) continue
      const factor = M[r][col]
      for (let c = col; c < 4; c++) M[r][c] -= factor * M[col][c]
    }
  }
  return [M[0][3], M[1][3], M[2][3]]
}
