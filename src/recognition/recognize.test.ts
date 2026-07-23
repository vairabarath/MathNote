import { describe, it, expect } from 'vitest'
import { recognizeExpression, rasterize, gridDistance } from './recognize'
import type { Glyph, Stroke } from '../glyph/types'
import type { Library } from '../glyph/library'

// --- ink builders (canvas-ish coords) ---------------------------------------
function vstroke(x: number, y0 = 0, y1 = 40): Stroke {
  return { points: [{ x, y: y0, pressure: 0.5, t: 0 }, { x, y: y1, pressure: 0.5, t: 10 }] }
}
function hstroke(x0: number, x1: number, y: number): Stroke {
  return { points: [{ x: x0, y, pressure: 0.5, t: 0 }, { x: x1, y, pressure: 0.5, t: 10 }] }
}
function loop(cx: number, cy = 20, r = 16): Stroke {
  const pts = []
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), pressure: 0.5, t: i })
  }
  return { points: pts }
}
function glyph(symbol: string, strokes: Stroke[]): Glyph {
  const s = { strokes }
  return { symbol, samples: [s, s, s], metrics: { advance: 0.6, width: 0.5, top: -0.8, bottom: 0 } }
}
// library where "1" is a vertical bar and "0" is a loop
function lib(): Library {
  return { '1': glyph('1', [vstroke(0)]), '0': glyph('0', [loop(0)]) }
}

describe('rasterize/gridDistance', () => {
  it('a shape matches itself (distance ~0) and differs from another', () => {
    const one = rasterize([vstroke(0)])
    const zero = rasterize([loop(0)])
    expect(gridDistance(one, one)).toBeCloseTo(0, 5)
    expect(gridDistance(one, zero)).toBeGreaterThan(0.4)
  })
})

describe('recognizeExpression — operators by geometry', () => {
  it('reads "1 + 1" (spaced) as digit, plus, digit', () => {
    const ink = [
      vstroke(0), // "1"
      hstroke(30, 50, 20), // "+" horizontal
      vstroke(40, 0, 40), // "+" vertical (crosses horizontal near x=40)
      vstroke(80), // "1"
    ]
    const r = recognizeExpression(ink, lib())
    expect(r).toEqual({ ok: true, tokens: ['1', '+', '1'] })
  })

  it('reads two stacked horizontal strokes as "="', () => {
    const ink = [hstroke(0, 20, 10), hstroke(0, 20, 20), vstroke(60)]
    const r = recognizeExpression(ink, lib())
    expect(r.ok && r.tokens[0]).toBe('=')
  })
})

describe('recognizeExpression — digit template match', () => {
  it('matches a lone vertical bar to "1" and a loop to "0"', () => {
    expect(recognizeExpression([vstroke(0)], lib())).toEqual({ ok: true, tokens: ['1'] })
    expect(recognizeExpression([loop(0)], lib())).toEqual({ ok: true, tokens: ['0'] })
  })
})

describe('recognizeExpression — refuse, do not guess (D8 seam)', () => {
  it('refuses a wide touching-multi-digit blob rather than guessing', () => {
    // two loops crammed together (gap < threshold) → one wide group → refuse
    const ink = [loop(0, 20, 16), loop(30, 20, 16)]
    const r = recognizeExpression(ink, lib())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/multi-digit/i)
  })

  it('refuses a glyph that matches no template well', () => {
    // a big X-ish scribble unlike "1" or "0" templates, single group, ~square
    const scribble: Stroke = {
      points: [
        { x: 0, y: 0, pressure: 0.5, t: 0 },
        { x: 20, y: 20, pressure: 0.5, t: 5 },
        { x: 0, y: 20, pressure: 0.5, t: 10 },
        { x: 20, y: 0, pressure: 0.5, t: 15 },
      ],
    }
    const r = recognizeExpression([scribble], lib())
    // either matched poorly (distance) — must not be a confident wrong digit with 2 templates
    expect(r.ok).toBe(false)
  })
})
