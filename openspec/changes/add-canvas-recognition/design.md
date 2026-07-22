## Context

`add-glyph-capture-replay` validated the differentiator: replayed ink reads as the user's hand (warp gate passed). It proved the loop with *typed* input to keep recognition — the weakest, swappable component (R2) — out of the room. This change adds the recognition half so the interaction becomes the real Math Notes one: handwrite an expression, write `=`, get the answer inline.

The central constraint, learned from the last change: **the load-bearing risk gets gated before anything is built around it.** For replay that was the warp (D6). For recognition it is **segmentation + layout parsing** (Requirements thread C) — not the recognizer method. This design is organized so the method is chosen *by* the gate outcome, never before it.

## Goals / Non-Goals

**Goals:**
- Gate the change on a **segmentation spike** that proves/breaks "gap-segmentation finds correct glyph boundaries on single-line arithmetic in the user's hand," on adversarial input, with a hardened judge.
- Establish a **swappable recognizer interface** (`ink → tokens`) so the gate can pick a method without anything downstream depending on it.
- Build the **canvas answer loop**: `=` trigger → recognize → solve (math.js) → replay the answer inline after the `=`.
- Keep everything **free / offline / private** (NFR-3). No cloud recognizer in production.

**Non-Goals:**
- **2D structure** — fractions, exponents, roots, matrices. Single-line arithmetic only.
- **The open input-symbol set** beyond `0–9` and the arithmetic operators `+ - × ÷ =`.
- **Committing to a recognition method up front.** Template-match vs classifier vs scope-down is a gate *output*, not an input.
- **Cloud recognition as production.** Groq vision is validate-only.
- **Re-validating replay.** Replay is the prior change; this consumes it (see D-dep).

## Decisions

### D1 — Gate on a segmentation spike, mirroring the warp spike (D6)
Before any recognizer, matcher, `=` trigger, or loop is built: implement **only** stroke/gap segmentation and test whether it finds the right glyph boundaries. This is an afternoon, needs no matcher/classifier/solver, and de-risks the one assumption the whole recognizer rests on. *Alternative considered:* build a template-matcher end-to-end then judge accuracy. Rejected — it buries the segmentation risk under a matcher and makes failures un-diagnosable (bad boundary vs bad match), the exact mistake D1-of-the-last-change avoided.

### D2 — The spike tests ADVERSARIAL input, not the friendly case
The inputs are chosen to break naive gap-segmentation on purpose: `2+2` (baseline sanity), `47*3` (multi-digit operands + operator spacing), `5+18` (mixed widths), and MANDATORY stressors — at least one with **touching digits** (no clean gap) and one with a **two-stroke `5`** (naively two glyphs). A spike that only draws `2+2` passes regardless and proves nothing. *This is the point:* segmentation's hard cases are where the decision actually lives.

### D3 — Hardened judge, like D6
Whether segmentation "works" is not a solo eyeball by the builder on a cherry-picked example. Harden it: (a) run the full adversarial set and record per-case pass/fail on boundary correctness against a hand-labeled ground truth (objective, not vibes); (b) a second person sanity-checks the rendered boundaries; (c) report a boundary-accuracy number, not a yes/no. PASS requires the adversarial cases — not just `2+2` — to segment correctly.

### D4 — The gate decision selects scope/method (the fork is an OUTPUT)
- **Segmentation holds on the adversarial set →** template-matching against the user's captured `0–9` samples is the free/offline/private on-brand recognizer; take it.
- **Segmentation breaks →** the real decision surfaces: **scope down** to clean, well-spaced single-line input (constrain the UX so segmentation is trivial) **or** build a **client-side ML classifier** (TF.js/ONNX on MNIST + operators) whose model is more robust to own-variance. Groq vision remains validate-only, never production.

This is why no method is pre-committed: which of these is correct is *unknown until the spike runs*.

### D5 — Swappable recognizer interface (R2)
Define `Recognizer: (ink: Stroke[]) → Token[]` (tokens = digits, operators, `=`). The canvas loop and solver depend only on this interface. Whatever wins D4 implements it; a later upgrade (classifier, or eventually 2D parsing) drops in without touching the loop. This is the concrete form of Requirements R2 ("recognition is swappable").

### D6 — Own-variance is a first-class recognition risk, not a footnote
Replay's whole premise was that a hand varies more than a few stored shapes. The same is true for recognition: matching new ink against only 3 captured samples per glyph will miss the user's natural variants. The spike must note this explicitly, and the template-match branch (if chosen) must be evaluated for own-variance robustness — not just on the same strokes that were captured. If own-variance sinks template-matching even when segmentation holds, that escalates toward the classifier branch.

### D7 — The `=` trigger and inline placement reuse existing machinery
Detect a `=` glyph (two roughly-horizontal parallel strokes) as the commit trigger. On trigger: segment+recognize the ink left of the `=`, solve with math.js, and render the answer starting at the `=`'s right edge on the `=`'s baseline — the replay engine already renders at an arbitrary x/baseline, so inline placement is a positioning input, not new rendering. Answer ink uses the same captured-glyph replay (the answer is in the user's hand, matching the image).

### D-dep — Replay end-to-end is still unproven
`add-glyph-capture-replay` §5.3 (the human draw-through of capture→replay on real Pencil input) has not run. Recognition sits on top of replay; a broken replay would masquerade as a recognition problem. So the loop's acceptance depends on that run being closed first — noted as a sequencing risk, not re-scoped here.

## Risks / Trade-offs

- **Segmentation is genuinely the deepest risk (thread C).** → D1–D3 gate it on adversarial input before anything is built; a break routes to D4's explicit fork rather than pushing forward.
- **Template-matching looks tractable on the demo image, fragile on real input.** → D2's adversarial cases and D6's own-variance check are designed to expose exactly this before commitment.
- **Own-variance (3 samples < real hand variance).** → D6 makes it a gated evaluation criterion; escalation path to the classifier is pre-named.
- **Recognition failure blamed on replay (or vice-versa).** → D-dep: close replay §5.3 first; keep the recognizer interface (D5) isolated so failures localize.
- **Scope creep toward 2D math.** → Non-Goals fix single-line arithmetic; 2D is a later change.

## Migration Plan

Additive to the existing app; no data migration (reuses the capture library and replay engine). Rollback = delete the change; the capture/replay app keeps working. The segmentation spike (D1) is the first checkpoint; a failed reading returns to the D4 fork decision rather than proceeding to build a recognizer.

## Open Questions

- Segmentation approach to trial first in the spike: pure spatial gaps, vs stroke-grouping by temporal + spatial proximity (pen-down order helps group a two-stroke `5`). To be tried empirically in the spike, not pre-baked.
- `=` detection: geometric (two horizontal strokes) vs treated as just another recognized token. Likely geometric for the trigger, TBD in the spike.
- Boundary-accuracy threshold that counts as "holds" in D3 — set from the spike, analogous to the warp's minimum-perceptible-variation threshold.
- Whether operators need their own captured templates (like the answer alphabet) or small built-in shapes suffice — depends on the D4 branch.
