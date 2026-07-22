## Why

Math Canvas's defining promise is not "solve my math" — it is *the answer appears as if I wrote it myself* (Requirements §1). That single property is what separates it from a calculator with OCR, and it is the project's highest-risk, most-differentiating component (R1). Everything else in the loop is either off-the-shelf (deterministic solve via math.js/SymPy) or an accepted known gap (native-grade inking latency). This change builds and — critically — *validates* the handwriting-replay engine in isolation, before any other loop component depends on it.

We deliberately prove the magic loop with **typed input** first (FR-5). Recognition is the project's weakest, swappable component (R2), and bundling it into the first demo would fuse two independent risks: if `12 × 8 = 96 in my hand` fails, we could not tell whether *replay* failed or the *8 was misread*. Typed input removes recognition from the room so the only things under test are the two things that actually decide the vision: (A) first-run glyph capture and (B) whether replayed ink reads as *mine* rather than as a font.

## What Changes

- **New: onboarding glyph capture.** First-run flow captures the user's **answer alphabet** — the closed output set `0–9 . -` (~12 glyphs), **3 samples each** — framed as the product's opening hook ("write these so I can learn your hand"), not as setup. This is distinct from the open-ended *input* alphabet, which this change does not touch.
- **New: a captured-glyph data model.** Ordered multi-stroke glyphs, per-point `{x, y, pressure, t}`, normalized to an em-box with **baseline + advance metrics**. Full timing is retained (not optional) because the render is animated. Stored locally, per-user, private (IndexedDB).
- **New: the replay engine.** Renders a result string as ink via **pick-then-warp**: pick one of 3 captured samples at random, then apply a **structured warp** (low-frequency, size-scaled, in the stroke's tangent/normal frame — *not* independent per-point jitter). Places glyphs using baseline drift + neighbour-relative sizing. Derives stroke width from pressure (velocity-synthesized on mouse). **Animates the draw-in** stroke-by-stroke at plausible pen speed.
- **New: a warp-validation spike as an explicit build gate.** Before the rest of the engine is built, a warp-only spike (hand-fed 3 samples, render a long repeated string, eyeball it) must confirm the warp reads as *one hand* and not as *damage*. The load-bearing assumption gets tested before anything is built around it.
- **Out of scope (explicit):** handwriting *recognition* (ink → expression) is deferred to Phase 1.5; the deterministic *solve* engine is a separate capability. This change consumes a result string from those and can be validated with hand-fed results.

## Capabilities

### New Capabilities
- `glyph-capture`: First-run capture of the answer alphabet into a persisted, per-user glyph library — the captured-glyph data model, sample count, stroke/pressure/timing fidelity, normalization + metrics, mouse fallback, and re-capture.
- `glyph-replay`: Rendering a result string as animated ink in the user's hand — pick-then-warp variation, the structured warp model, neighbour-relative placement, pressure/velocity width, animated draw-in, and font fallback for uncaptured glyphs.

### Modified Capabilities
- None. This is the project's first capability set; `openspec/specs/` is empty.

## Impact

- **New dependencies:** none required beyond the existing free stack (Pointer Events, Canvas/SVG, IndexedDB). A free handwriting web font is used only as the uncaptured-glyph fallback.
- **Interface boundaries established:** replay consumes a *result token sequence* from a separately-specced deterministic solve engine; capture produces the glyph library that replay reads. Recognition is a future producer of result-adjacent ink and is not wired here.
- **Honest-framing constraint baked in:** v1 variation = a *generic* structured warp seeded from 3 *personal* anchor shapes. Learning the user's *personal* variation manifold (interpolation across samples) is a named Phase 1.5+ upgrade, explicitly out of v1 scope, so a future reader does not mistake "variation looks slightly generic" for "the engine failed."
- **Gate on the roadmap:** the MVP magic-loop demo and all later phases (recognition swap-in, variables, graphing) depend on this engine reading as convincingly hand-written; the warp spike gates that judgement early.
