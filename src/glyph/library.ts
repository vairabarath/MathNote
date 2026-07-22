// Library-level queries over the captured glyph set. Notably the answer-alphabet
// completeness check that backs the D9 hard gate: a missing answer glyph blocks
// the render and routes to capture — it is NEVER font-filled (that is reserved
// for out-of-alphabet tokens, see glyph-replay §4.6).

import { ANSWER_ALPHABET, SAMPLES_PER_GLYPH, type Glyph } from './types'

export type Library = Record<string, Glyph>

/** A glyph counts as captured only when it has the full set of samples. */
export function isGlyphComplete(glyph: Glyph | undefined): boolean {
  return !!glyph && glyph.samples.length >= SAMPLES_PER_GLYPH
}

/** Answer-alphabet symbols not yet fully captured, in canonical order. */
export function missingAnswerGlyphs(library: Library): string[] {
  return ANSWER_ALPHABET.filter((sym) => !isGlyphComplete(library[sym]))
}

/** Onboarding is complete when every answer-alphabet glyph is captured. */
export function isOnboardingComplete(library: Library): boolean {
  return missingAnswerGlyphs(library).length === 0
}

/**
 * Which glyphs of a result string cannot be rendered from captured ink, split by
 * the D9 boundary:
 *   - `blocking`: answer-alphabet glyphs that are uncaptured → HARD gate, route
 *     to capture (no font fallback).
 *   - `fallback`: out-of-alphabet glyphs → eligible for handwriting-font fallback
 *     (§4.6). (Whitespace is ignored.)
 */
export function classifyResultCoverage(
  result: string,
  library: Library,
): { blocking: string[]; fallback: string[] } {
  const answerSet = new Set<string>(ANSWER_ALPHABET)
  const blocking = new Set<string>()
  const fallback = new Set<string>()
  for (const ch of result) {
    if (ch.trim() === '') continue
    if (isGlyphComplete(library[ch])) continue
    if (answerSet.has(ch)) blocking.add(ch)
    else fallback.add(ch)
  }
  return { blocking: [...blocking], fallback: [...fallback] }
}
