// Shared ink primitives for Math Canvas.
//
// This is the irreducible foundation the warp operates on. It is intentionally
// minimal: only what the §1 warp-validation spike needs. The richer captured-
// glyph model (Glyph { symbol, samples[3], metrics }, normalization, baseline +
// advance) is task §2.1/§2.2 and will EXTEND these types — it will not rewrite
// them. Keeping Point/Stroke/Sample here means the spike and the real engine
// share one definition, so the validated warp never has to be re-ported.

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

/** One handwritten instance of a glyph: an ordered list of strokes.
 *  (A full `Glyph` groups 3 of these plus metrics — added in §2.) */
export interface Sample {
  strokes: Stroke[]
}
