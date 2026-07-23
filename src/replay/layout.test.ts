import { describe, it, expect } from 'vitest'
import { layoutResult, DEFAULT_LAYOUT, type InkInstance } from './layout'
import type { Glyph } from '../glyph/types'
import type { Library } from '../glyph/library'

function glyph(symbol: string, advance = 0.6): Glyph {
  return {
    symbol,
    samples: [
      { strokes: [{ points: [{ x: 0, y: 0, pressure: 0.5, t: 0 }] }] },
      { strokes: [{ points: [{ x: 0, y: 0, pressure: 0.5, t: 0 }] }] },
      { strokes: [{ points: [{ x: 0, y: 0, pressure: 0.5, t: 0 }] }] },
    ],
    metrics: { advance, width: advance - 0.12, top: -0.8, bottom: 0 },
  }
}

function libraryOf(...syms: string[]): Library {
  const lib: Library = {}
  for (const s of syms) lib[s] = glyph(s)
  return lib
}

const OPTS = { ...DEFAULT_LAYOUT, seed: 42 }

describe('layoutResult — pick-then-warp + placement', () => {
  it('assigns each instance a distinct warp seed and an in-range sample pick', () => {
    const lib = libraryOf('9')
    const { instances } = layoutResult('999', lib, OPTS)
    const ink = instances.filter((i): i is InkInstance => i.kind === 'ink')
    expect(ink).toHaveLength(3)
    expect(new Set(ink.map((i) => i.warpSeed)).size).toBe(3) // cycle-breaking
    for (const i of ink) expect(i.sampleIndex).toBeGreaterThanOrEqual(0)
    for (const i of ink) expect(i.sampleIndex).toBeLessThan(3)
  })

  it('spaces glyphs by the advance metric, not a fixed pitch', () => {
    const lib = { a: glyph('a', 0.5), b: glyph('b', 0.9) }
    const { instances } = layoutResult('ab', lib, OPTS)
    const [i0, i1] = instances as InkInstance[]
    // second glyph starts advance*scale to the right of the first
    expect(i1.x - i0.x).toBeCloseTo(lib['a'].metrics.advance * i0.scale, 1)
  })

  it('is deterministic for a given seed', () => {
    const lib = libraryOf('9', '6')
    const a = layoutResult('969', lib, OPTS)
    const b = layoutResult('969', lib, OPTS)
    expect(JSON.stringify(a.instances)).toBe(JSON.stringify(b.instances))
  })
})

describe('layoutResult — D9 block-vs-fallback', () => {
  it('an out-of-alphabet glyph becomes a font instance and is flagged', () => {
    const lib = libraryOf('9')
    const { instances, flaggedForCapture } = layoutResult('9x', lib, OPTS)
    expect(instances.some((i) => i.kind === 'font' && i.symbol === 'x')).toBe(true)
    expect(flaggedForCapture).toEqual(['x'])
  })

  it('a missing ANSWER glyph is recorded as blocked and never font-filled', () => {
    const lib = libraryOf('9') // '6' is missing
    const { instances, blockedMissing, flaggedForCapture } = layoutResult('96', lib, OPTS)
    expect(blockedMissing).toEqual(['6'])
    expect(flaggedForCapture).toEqual([])
    expect(instances.some((i) => i.symbol === '6')).toBe(false)
  })
})
