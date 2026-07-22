import { describe, it, expect } from 'vitest'
import { halfWidths } from './width'
import type { Point } from '../glyph/types'

function line(
  coords: [number, number][],
  pressure: (i: number) => number | null,
  t: (i: number) => number,
): Point[] {
  return coords.map(([x, y], i) => ({ x, y, pressure: pressure(i), t: t(i) }))
}

const EMPX = 100

describe('halfWidths — pressure mode (§4.3)', () => {
  const pts = line(
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    (i) => [0.2, 0.5, 0.9, 0.5, 0.2][i],
    (i) => i * 10,
  )
  const w = halfWidths(pts, EMPX)

  it('is not constant width', () => {
    expect(new Set(w.map((x) => x.toFixed(3))).size).toBeGreaterThan(1)
  })

  it('tapers thinner at both ends than the middle', () => {
    expect(w[0]).toBeLessThan(w[2])
    expect(w[w.length - 1]).toBeLessThan(w[2])
  })

  it('a higher-pressure middle is wider than a lower-pressure middle', () => {
    const low = halfWidths(line([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], () => 0.3, (i) => i * 10), EMPX)
    expect(w[2]).toBeGreaterThan(low[2])
  })
})

describe('halfWidths — velocity synthesis (§4.4, pressure absent)', () => {
  // Equal spacing. Compare indices 1 and 3 — symmetric positions (equal taper),
  // so the only difference is speed: segment→1 is FAST (dt=5), segment→3 SLOW
  // (dt=100). The fast one must render thinner.
  const pts = line(
    [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]],
    () => null,
    (i) => [0, 5, 50, 150, 200][i],
  )
  const w = halfWidths(pts, EMPX)

  it('is not constant width', () => {
    expect(new Set(w.map((x) => x.toFixed(3))).size).toBeGreaterThan(1)
  })

  it('the fast segment renders thinner than a slow one (equal taper positions)', () => {
    expect(w[1]).toBeLessThan(w[3])
  })
})
