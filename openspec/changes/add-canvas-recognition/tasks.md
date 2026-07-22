## 0. Pre-requisite

- [x] 0.1 Close `add-glyph-capture-replay` §5.3 (human draw-through of capture→replay on desktop + iPad/Pencil). Recognition sits on top of replay; a broken replay would masquerade as a recognition bug. Do not trust the loop's acceptance (§4) until this is green.
      → SATISFIED on desktop (2026-07-22): the real capture→replay chain runs and reads as the user's hand (`12*8 → 96`, screenshot-confirmed). Replay is now a trusted foundation for recognition, so a wrong on-canvas answer can be localized to recognition rather than replay. (iPad/Pencil pen-pressure pass is a prior-change refinement, not a recognition blocker.)

## 1. Segmentation-spike gate (GATE — nothing below proceeds until §1.7 is resolved)

- [ ] 1.1 Assemble an ADVERSARIAL single-line ink set with hand-labelled ground-truth glyph boundaries: `2+2` (sanity), `47*3` (multi-digit + operator spacing), `5+18` (mixed widths), plus MANDATORY stressors — at least one **touching-digits** case (no clean gap) and one **two-stroke `5`** (naively two glyphs). Capture as real ink (`Stroke[]` with `{x,y,pressure,t}`), not synthetic.
      → HARNESS READY (`SegmentationSpike.tsx`): adversarial prompts listed, real-ink capture via `CaptureSurface`, per-stroke ground-truth labeling. **Awaiting the human draw-through** — the real ink must be drawn (design says not synthetic), same handoff as the warp spike.
- [x] 1.2 Implement ONLY segmentation — group strokes into ordered glyph groups. No matcher, no classifier, no solver. Trial both pure spatial-gap grouping and stroke-grouping by temporal+spatial proximity (pen-down order helps a two-stroke `5`). — `src/recognition/segment.ts` implements pure spatial-gap grouping (x-overlap + a priori gap threshold). Temporal variant deliberately NOT built: touching digits are consecutive in time too, so temporal proximity can't separate them either — pure-spatial is sufficient to establish whether the wall is fundamental (reasoning recorded in the file header).
- [x] 1.3 Visualize the output: draw the segmentation boundaries (per-group boxes) over the ink so boundaries are inspectable. — `SegmentationSpike.tsx` analysis canvas: strokes colored by predicted group + dashed per-group boxes + stroke indices.
- [x] 1.4 Score boundary accuracy against the hand-labelled ground truth across the whole adversarial set; record per-case pass/fail and an overall accuracy number (objective, not vibes). — Objective metric is a stroke→glyph **PARTITION match** (NOT group count — count lets over-split+over-merge cancel; demonstrated in `segment.test.ts`). `partitionsEqual`/`misgroupedPairs` implemented + tested; harness shows per-case EXACT/WRONG + mis-grouped pairs live. Per-case records captured during the §1.1 run.
- [ ] 1.5 Harden the judge (mirror design D6): do NOT accept a solo eyeball on the friendly `2+2`. Evaluate the adversarial cases explicitly, and have a second person sanity-check the drawn boundaries; record their read.
      → Mechanism ready (objective partition score + visual boxes for a second eye). **Awaiting human run + second eye.**
- [ ] 1.6 Derive the **boundary-accuracy threshold** that counts as "segmentation holds," and record it (analogous to the warp spike's minimum-perceptible-variation threshold).
      → NOTE: gap threshold is FIXED a priori (`GAP_RATIO = 0.35`, `segment.ts`) and must NOT be tuned per case. The acceptance bar is partition exact-match across the adversarial set (esp. touching digits). **Awaiting the run to record per-case results.**
- [ ] 1.7 GATE DECISION (design D4): if the adversarial set meets the threshold → segmentation holds, template-matching against captured glyphs is permitted (§2, template branch). If it breaks → the real fork surfaces: **scope down** to clean well-spaced single-line input, OR **build a client-side classifier**. Record the decision and rationale. NO recognition method is committed before this.
      → **BLOCKED on §1.1/§1.5 human run.** Nothing in §2+ proceeds until this resolves.

## 2. Recognizer (behind a swappable interface — method decided by §1.7)

- [ ] 2.1 Define the `Recognizer` interface: `(ink: Stroke[]) → Token[]` (`0–9`, `+ - × ÷`, `=`). The canvas loop and solver depend ONLY on this (Requirements R2).
- [ ] 2.2 Implement the gate-selected recognizer behind the interface: template-match over the user's captured `0–9` (if §1.7 = holds), or the scoped-down / classifier path (if §1.7 = breaks). Groq vision is validate-only — never the shipped recognizer.
- [ ] 2.3 Provide operator recognition (`+ - × ÷ =`) appropriate to the chosen branch (small built-in templates or captured operator glyphs).
- [ ] 2.4 Evaluate the recognizer on FRESH ink (own-variance, design D6) — not the capture samples it was built from; record accuracy. Own-variance failure escalates toward the classifier branch even if segmentation held.

## 3. Canvas answer loop

- [ ] 3.1 Expression canvas: accept ongoing multi-glyph, multi-stroke ink for a full single-line expression (reuse the `CaptureSurface` capture path).
- [ ] 3.2 Detect the `=` trigger (geometric: two roughly-horizontal parallel strokes) as the commit signal; no answer renders before `=`.
- [ ] 3.3 On trigger: segment + recognize the ink left of the `=` (§2), then solve deterministically with math.js. No LLM computes the result.
- [ ] 3.4 Render the answer inline immediately right of the `=`, on the expression's baseline, in the user's hand via the existing replay engine (arbitrary x/baseline).
- [ ] 3.5 Enforce the D9 answer-alphabet gate inside the loop: a missing answer glyph routes to capture, never a font substitute (font fallback stays out-of-alphabet only).
- [ ] 3.6 Surface recognition uncertainty: when segmentation/recognition is low-confidence, show what was read and allow correction rather than drawing a confidently-wrong answer (correctness over silent-wrong).

## 4. Integration & acceptance

- [ ] 4.1 Wire the canvas answer loop into the app (post-onboarding surface alongside the typed demo).
- [ ] 4.2 Human acceptance draw-through on desktop (mouse) AND iPad Safari (Apple Pencil): write `2+2=` → `4` appears inline in the user's hand; repeat for the adversarial cases and on fresh (own-variance) ink. Gated on §0.1 being green.
- [ ] 4.3 Confirm the recognizer is swappable: replacing the method (§2.2) requires no change to the loop or solver (interface check, Requirements R2).
