import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  putGlyph,
  getGlyph,
  getLibrary,
  clearLibrary,
  _resetConnectionForTests,
} from './storage'
import type { Glyph, Sample } from './types'

/** A two-stroke "5": a top hook, then the bowl — distinct per-point timing so we
 *  can prove order + timing survive the round-trip. */
function twoStrokeFive(): Glyph {
  const strokeA: Sample['strokes'][number] = {
    points: [
      { x: 0.5, y: -0.8, pressure: 0.4, t: 0 },
      { x: 0.0, y: -0.8, pressure: 0.6, t: 40 },
      { x: 0.0, y: -0.4, pressure: 0.5, t: 90 },
    ],
  }
  const strokeB: Sample['strokes'][number] = {
    points: [
      { x: 0.0, y: -0.4, pressure: 0.3, t: 150 },
      { x: 0.5, y: -0.2, pressure: 0.7, t: 210 },
      { x: 0.2, y: 0.0, pressure: 0.2, t: 260 },
    ],
  }
  const sample: Sample = { strokes: [strokeA, strokeB] }
  return {
    symbol: '5',
    samples: [sample, sample, sample],
    metrics: { advance: 0.62, width: 0.5, top: -0.8, bottom: 0 },
  }
}

beforeEach(async () => {
  _resetConnectionForTests()
  await clearLibrary()
})

describe('glyph library persistence (§2.3 / §2.4)', () => {
  it('round-trips a multi-stroke glyph preserving stroke order and timing', async () => {
    const original = twoStrokeFive()
    await putGlyph(original)
    const loaded = await getGlyph('5')

    expect(loaded).toBeDefined()
    const strokes = loaded!.samples[0].strokes
    expect(strokes).toHaveLength(2)

    // stroke ORDER preserved: first stroke starts before the second
    expect(strokes[0].points[0].t).toBe(0)
    expect(strokes[1].points[0].t).toBe(150)

    // every point's x, y, pressure, t preserved exactly
    expect(strokes[0].points).toEqual(original.samples[0].strokes[0].points)
    expect(strokes[1].points).toEqual(original.samples[0].strokes[1].points)
  })

  it('loads the whole library as a symbol→glyph map', async () => {
    await putGlyph(twoStrokeFive())
    const lib = await getLibrary()
    expect(Object.keys(lib)).toEqual(['5'])
    expect(lib['5'].metrics.advance).toBeCloseTo(0.62)
  })

  it('re-capturing one glyph replaces only that record (§3.4 foundation)', async () => {
    const g = twoStrokeFive()
    await putGlyph(g)
    const edited: Glyph = { ...g, metrics: { ...g.metrics, advance: 0.9 } }
    await putGlyph(edited)
    const loaded = await getGlyph('5')
    expect(loaded!.metrics.advance).toBeCloseTo(0.9)
    // still a single record for that symbol
    expect(Object.keys(await getLibrary())).toEqual(['5'])
  })

  it('is scoped per user — one user cannot see another’s glyphs', async () => {
    await putGlyph(twoStrokeFive(), 'alice')
    expect(await getGlyph('5', 'bob')).toBeUndefined()
    expect(Object.keys(await getLibrary('bob'))).toEqual([])
    expect(Object.keys(await getLibrary('alice'))).toEqual(['5'])
  })
})
