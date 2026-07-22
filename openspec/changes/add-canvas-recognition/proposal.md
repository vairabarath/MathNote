## Why

The product's felt experience is Apple Math Notes: you **handwrite** `2+2` on a canvas, write `=`, and the answer appears inline right after it, in your own hand. `add-glyph-capture-replay` built and validated the differentiating half of that loop — capture and replay ("the answer looks like I wrote it"). The missing half is turning *handwritten* ink into an expression: **recognition**.

Recognition was deliberately deferred (design D1/R2): the flagship was proven with *typed* input so a wrong `2+2=4` could never be blamed on a misread digit. That worked — replay is validated. But recognition's own load-bearing risk is **not** the choice of matcher/classifier; it is **segmentation + layout parsing** — the Requirements' "thread C, the deepest durable risk." A recognizer that reuses the user's captured glyphs as templates borrows the *assets* but not the *difficulty*: template-matching presupposes you already know where each glyph is, and quietly assumes away touching digits, wide-spaced operators, and multi-stroke glyphs (a two-stroke `5` reading as two glyphs). Committing to a recognition method before proving segmentation would reintroduce exactly the fragile-flagship failure D1 spent credibility avoiding.

So, mirroring the warp-validation spike (D6): **gate this change on a recognition-segmentation spike** before building any recognizer around it. Prove (or break) the load-bearing assumption in an afternoon, on adversarial input, with a hardened judge — *then* the gate outcome, not a menu, decides scope and method.

## What Changes

- **New: a recognition-segmentation spike as an explicit build gate.** Implement ONLY stroke/gap segmentation — no matcher, no classifier, no solver — and run it on adversarial single-line arithmetic (`2+2`, `47*3`, `5+18`) that MUST include a **touching-digits** case and a **two-stroke `5`** case. Judge whether it finds the correct glyph boundaries, hardened against a solo eyeball on the friendly `2+2` (adversarial cases + a second/objective check, per D6). This gate blocks everything below.
- **Gate decision drives scope, not a pre-chosen method.** If segmentation holds → template-matching against the user's captured `0–9` is the genuine free/offline/private on-brand recognizer. If it breaks → the real fork is **scope down to clean, well-spaced single-line only** vs **build a client-side ML classifier** (TF.js/ONNX). No recognition-method commitment before the spike passes.
- **New: a swappable recognizer interface** (Requirements R2): `ink → token sequence`. Whatever wins the gate implements it; nothing downstream depends on the method. Groq vision stays **validate-only, never production** (it violates the offline/private ethos, NFR-3).
- **New: the canvas answer loop.** Detect the `=` trigger on the canvas, recognize the expression to its left, solve it (reuse math.js), and render the answer **inline immediately after the `=`, on the same baseline**, using the existing replay engine (which already draws at an arbitrary x/baseline).
- **Out of scope (explicit):** 2D structure (fractions, exponents, matrices), the open input-symbol set beyond single-line arithmetic operators, and any cloud recognizer as a production path.

## Capabilities

### New Capabilities
- `handwriting-recognition`: Turning a handwritten single-line expression into a token sequence — GATED on the segmentation spike, with a swappable recognizer interface; the spike itself, its adversarial cases, its hardened judge, and the gate decision that selects scope/method.
- `canvas-answer-loop`: The on-canvas Math-Notes interaction — write an expression, the `=` trigger fires, the recognized+solved answer is drawn inline after the `=` in the user's hand via the existing replay engine.

### Modified Capabilities
- None as formal spec deltas: `openspec/specs/` is still empty (the capture/replay specs from `add-glyph-capture-replay` are not yet archived). This change consumes those capabilities but does not change their requirements.

## Impact

- **Depends on:** the capture library (`0–9` templates, per-user, local) and the replay engine (arbitrary-baseline inline rendering) from `add-glyph-capture-replay`. **Note:** replay's end-to-end acceptance (`add-glyph-capture-replay` §5.3, the human draw-through) is still pending — recognition sits on top of replay, so that run should be closed alongside/before the loop is trusted.
- **New dependencies:** none required for the gate. Post-gate, only if the classifier branch is chosen (TF.js/ONNX + a model asset); template-matching adds nothing. Groq path is excluded from production.
- **Interface boundary established:** a swappable `Recognizer` (`ink → tokens`) so the method decided by the gate can be replaced without touching the canvas loop or the solver.
- **Gate on the roadmap:** the entire canvas experience rests on segmentation reading real single-line arithmetic in the user's own hand; the spike gates that judgement before any recognizer is built around it.
