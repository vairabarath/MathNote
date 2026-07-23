import { describe, it, expect } from 'vitest'
import {
  isOnboardingComplete,
  missingAnswerGlyphs,
  classifyResultCoverage,
  type Library,
} from './library'
import { ANSWER_ALPHABET, SAMPLES_PER_GLYPH, type Glyph } from './types'

function stubGlyph(symbol: string, sampleCount = SAMPLES_PER_GLYPH): Glyph {
  return {
    symbol,
    samples: Array.from({ length: sampleCount }, () => ({ strokes: [] })),
    metrics: { advance: 0.6, width: 0.5, top: -0.8, bottom: 0 },
  }
}

function fullLibrary(): Library {
  const lib: Library = {}
  for (const s of ANSWER_ALPHABET) lib[s] = stubGlyph(s)
  return lib
}

describe('answer-alphabet completeness (§3.5 / D9)', () => {
  it('a full library reports complete with nothing missing', () => {
    const lib = fullLibrary()
    expect(isOnboardingComplete(lib)).toBe(true)
    expect(missingAnswerGlyphs(lib)).toEqual([])
  })

  it('an empty library is missing every answer glyph', () => {
    expect(isOnboardingComplete({})).toBe(false)
    expect(missingAnswerGlyphs({})).toEqual([...ANSWER_ALPHABET])
  })

  it('a glyph with too few samples does not count as captured', () => {
    const lib = fullLibrary()
    lib['7'] = stubGlyph('7', SAMPLES_PER_GLYPH - 1)
    expect(missingAnswerGlyphs(lib)).toEqual(['7'])
    expect(isOnboardingComplete(lib)).toBe(false)
  })
})

describe('classifyResultCoverage — the D9 block-vs-fallback split', () => {
  it('a missing ANSWER glyph is blocking, never fallback', () => {
    const lib = fullLibrary()
    delete lib['6']
    const { blocking, fallback } = classifyResultCoverage('96', lib)
    expect(blocking).toEqual(['6'])
    expect(fallback).toEqual([])
  })

  it('an out-of-alphabet glyph is fallback, not blocking', () => {
    const { blocking, fallback } = classifyResultCoverage('x', fullLibrary())
    expect(blocking).toEqual([])
    expect(fallback).toEqual(['x'])
  })

  it('a fully-captured answer string needs neither', () => {
    const { blocking, fallback } = classifyResultCoverage('-3.5', fullLibrary())
    expect(blocking).toEqual([])
    expect(fallback).toEqual([])
  })
})
