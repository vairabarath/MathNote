// Shared ink primitives + the captured-glyph data model for Math Canvas.
//
// Point/Stroke/Sample are the irreducible foundation the §1 warp operates on.
// The captured-glyph model (Glyph, GlyphMetrics, normalization) is §2 and
// EXTENDS these — the validated warp never had to be re-ported.

/** A single captured pen sample. `pressure` is null when the device (e.g. mouse)
 *  does not report it; `t` is milliseconds relative to the start of the sample. */
export interface Point {
  x: number
  y: number
  /** 0..1, or null when the input device reports no pressure (mouse). */
  pressure: number | null
  /** Milliseconds since the first point of the containing sample. */
  t: number
}

/** One pen-down → pen-up trace. Points are in capture order. */
export interface Stroke {
  points: Point[]
}

/** One handwritten instance of a glyph: an ordered list of strokes. */
export interface Sample {
  strokes: Stroke[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Captured-glyph model (§2)
// ─────────────────────────────────────────────────────────────────────────────

/** The onboarding answer alphabet — the closed OUTPUT set (design §2 / D9).
 *  Distinct from the open input-symbol set, which this change does not capture. */
export const ANSWER_ALPHABET = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-',
] as const
export type AnswerGlyph = (typeof ANSWER_ALPHABET)[number]

/** Samples captured per glyph (design D2 — exactly 3). */
export const SAMPLES_PER_GLYPH = 3

/** The capture guide a sample was drawn against, in capture-surface pixels.
 *  Shared across all glyphs in a session so normalization preserves RELATIVE
 *  sizes (a "." stays small, "-" stays mid-height, digits fill the body). */
export interface CaptureFrame {
  /** y of the writing baseline in capture pixels. */
  baselineY: number
  /** height of one em in capture pixels (the guide band height). */
  emHeight: number
}

/**
 * Placement metrics for a normalized glyph, in em units (1 em = the shared
 * capture guide height). Coordinates in a normalized Sample are BASELINE-RELATIVE
 * and y-DOWN (same axis as canvas — no flips at render time): y = 0 is the
 * baseline, points above it are negative, descenders positive. Left edge is x = 0.
 */
export interface GlyphMetrics {
  /** cursor advance to the next glyph (em) = ink width + right side bearing. */
  advance: number
  /** ink width (em). */
  width: number
  /** highest ink point relative to baseline (em, ≤ 0). */
  top: number
  /** lowest ink point relative to baseline (em, ≥ 0 for descenders). */
  bottom: number
}

/** A captured glyph: its symbol, its (normalized) samples, and placement metrics.
 *  `samples` holds SAMPLES_PER_GLYPH instances; pick-then-warp (D2) selects among
 *  them at render time. */
export interface Glyph {
  symbol: string
  samples: Sample[]
  metrics: GlyphMetrics
}
