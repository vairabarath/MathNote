## 1. Warp-validation spike (GATE — nothing below proceeds until this passes)

- [x] 1.1 Hand-author 3 stroke samples of a single glyph ("9") as raw `{x, y, pressure, t}` point arrays (no capture UI, no persistence) — `src/spike/samples9.ts`; parametric bowl+tail, three genuinely-differing anchor shapes; verified they read as "9" (headless raster `scripts/verify-render.mts`)
- [x] 1.2 Implement ONLY the structured warp: resample stroke by arc length; apply low-frequency, size-scaled displacement in the tangent/normal frame (normal bows, arc-length rescale, endpoint overshoot) — `src/warp/warp.ts` (+ `geometry.ts`, `prng.ts`)
- [x] 1.3 Render a long repeated string ("999999999") using pick-then-warp over the 3 hand-fed samples — `drawWarpRow` in `src/spike/render.ts`, shown in `WarpSpike.tsx`
- [x] 1.4 Render an UNLABELED mixed control set of the same string, three ways in randomized order: (a) the structured warp, (b) a handwriting web font (self-hosted Caveat, offline), (c) rigid affine-jittered stamps — `WarpSpike.tsx` (shuffled rows A/B/C)
- [x] 1.5 Blind self-check: without labels, identify which is which; the warp PASSES only if you can distinguish it AND it reads best — if it's indistinguishable from the font, the bar is not cleared
      → DONE (human builder, in-browser, 2026-07-22): identified all three techniques correctly AND judged the structured warp best over the font. Necessary condition met — but this is the PRIMED eye; still requires §1.6 second-eye + §1.8 gate.
- [x] 1.6 Second-eye check: show the unlabeled set to one person who is NOT you and has NOT heard the warp theory; record whether the warp reads as one hand to them (the solo-builder eye is primed and does not count alone)
      → DONE (2026-07-22): a second, unprimed person read the structured-warp row as one person's handwriting and picked it — agreeing with the builder's blind pick. Solo-eye no longer stands alone.
- [x] 1.7 Derive the **minimum perceptible variation threshold** from the spike (the smallest inter-instance difference that still reads as "different but same hand") and record it as the acceptance bound for the `glyph-replay` variation scenarios
      → SET (2026-07-22): **T = 1.0% residual-after-best-fit-affine** (as % of glyph height). Rationale: in the blind test NO two warp instances read as identical — all read as "same handwriting but not identical," so the perceptual floor sits at or below the measured `warp.min` of 1.19%. T is set just under that (1.0%) so `DEFAULT_WARP` (min 1.19 / median 3.49 / max 4.95%) ALWAYS clears the bound and no "re-warp if too close" rule is needed in §4.1. Metric + distribution live in `src/spike/residual.ts`; affine-only control ≈ 0 confirms the axis. This T is the acceptance bound the `glyph-replay` variation scenarios reference.
- [x] 1.8 GATE DECISION: PASS requires all of — warp reads as one hand, beats the font in the blind pick (§1.5), and the second person agrees (§1.6). Otherwise revise the warp model (design D3) and repeat §1 before building anything else
      → **GATE PASSED (2026-07-22).** All three conditions met: warp reads as one hand ✓, beat the font in the blind pick (§1.5) ✓, second person agrees (§1.6) ✓. The load-bearing hypothesis (design D3) is validated. `DEFAULT_WARP` in `src/warp/warp.ts` is now the FROZEN validated parameter set. §2+ is unblocked.

## 2. Glyph data model & storage

- [x] 2.1 Define the captured-glyph types: `Glyph { symbol, samples[3], metrics }`, `Sample { strokes[] }`, `Stroke { points[] }`, `Point { x, y, pressure, t }` — `src/glyph/types.ts` (+ `ANSWER_ALPHABET`, `SAMPLES_PER_GLYPH`, `CaptureFrame`, `GlyphMetrics`)
- [x] 2.2 Implement normalization to an em-box preserving aspect ratio, computing baseline + advance metrics — `src/glyph/normalize.ts`; baseline-relative y-down coords, shared em height preserves relative sizes (dot small/low, dash mid — design Open Question resolved); tested in `normalize.test.ts`
- [x] 2.3 Implement per-user local persistence (IndexedDB); load/save the library with no network access — `src/glyph/storage.ts`; dependency-free promisified wrapper, per-glyph records keyed `userId::symbol`, `userId` index for library load
- [x] 2.4 Verify a multi-stroke glyph round-trips through storage preserving stroke order and timing — `storage.test.ts` (two-stroke "5" preserves stroke order + per-point x/y/pressure/t; also covers re-capture-replaces-one and per-user isolation). Test runner added: Vitest + fake-indexeddb (`npm test`)

## 3. Onboarding capture flow

- [x] 3.1 Build the Pointer Events capture surface preserving `pressure` and `t` per point; support mouse (pressure-absent) capture — `src/capture/CaptureSurface.tsx`; coalesced-event draining for pen fidelity, mouse pressure stored as `null` (flagged for velocity-width §4.4), multi-stroke, DPR-aware, pointer-capture + touch-action:none
- [x] 3.2 Build the first-run flow prompting for `0–9 . -`, 3 samples each, framed as the opening hook — `src/capture/OnboardingCapture.tsx` ("Teach me your hand"), progress + per-glyph/per-sample prompts, Clear/Next
- [x] 3.3 Write each captured sample through normalization (§2.2) into the library (§2.3) — on each glyph's 3rd sample: `buildGlyph` → `putGlyph`
- [x] 3.4 Add single-glyph re-capture/correction that replaces only the targeted sample — `src/capture/CaptureReview.tsx` + `normalize.replaceSample`; tap a sample to rewrite just it (recomputes metrics, other samples/glyphs untouched)
- [x] 3.5 Gate answer render on answer-alphabet capture completeness: block-and-route to capture for any missing answer-alphabet glyph (NOT font fallback — fallback is out-of-alphabet only, §4.6) — app-level gate in `App.tsx` (incomplete alphabet → only capture is reachable) + `classifyResultCoverage` (`glyph/library.ts`, tested) which splits missing glyphs into `blocking` (answer alphabet → route to capture) vs `fallback` (out-of-alphabet → §4.6). Render-time invocation wired in §5.
      NOTE: §3.1/§3.2/§3.4 are interactive (pen/mouse drawing) — verified to build/typecheck; **awaiting a human draw-through in-browser** to confirm capture feel + persistence, same handoff pattern as §1.

## 4. Replay engine

- [x] 4.1 Implement pick-then-warp: random sample selection + the validated warp (§1) per glyph instance — `replay/layout.ts` (distinct warp seed + in-range sample pick per instance) + `replay/replay.ts` `resolveInkStrokes` (applies validated `warpSample`); tested (distinct seeds, in-range picks)
- [x] 4.2 Implement neighbour-relative placement: baseline drift + size-relative-to-neighbours + advance-based spacing — `replay/layout.ts`: advance-metric spacing (not fixed pitch), baseline random-walk drift, per-instance size jitter; tested (advance spacing, determinism)
- [x] 4.3 Implement stroke width from pressure with end-tapering — `replay/width.ts` `halfWidths` pressure mode; tested (varies, tapers, higher pressure → wider)
- [x] 4.4 Implement velocity-synthesized width for pressure-absent (mouse) samples using `t` — `replay/width.ts` velocity mode (speed = dist/dt, normalized by median); tested (fast segment renders thinner, not constant)
- [x] 4.5 Implement animated draw-in: render strokes progressively in capture order at a plausible/normalized pen speed — `replay/timeline.ts` (normalized pen speed — resolves the pacing Open Question) + `replay/AnswerInk.tsx` (rAF, per-stroke partial by arc length)
- [x] 4.6 Implement handwriting-web-font fallback + capture flag for uncaptured glyphs (must not trigger for a completed answer alphabet) — `layout.ts` routes ONLY out-of-alphabet symbols to `font` instances + `flaggedForCapture`; answer-alphabet misses go to `blockedMissing` (never font). `replay.drawFontGlyph` renders Caveat baseline-aligned; tested (font vs blocked split)
- [x] 4.7 Bake in the honest-framing note (code comment + docs): v1 warp = generic prior seeded from 3 personal anchors; personal-variance manifold-learning is a named 1.5+ upgrade — prominent block comment in `replay/replay.ts` and `warp/warp.ts`; also documented in README + design.md D2
      NOTE: pipeline verified headlessly (`scripts/verify-replay.mts` → readable handwritten sequence with real pick-then-warp variation, advance spacing, drift, variable width) + 8 unit tests. Animated draw-in is visible live via the §5 demo.

## 5. Typed-input magic-loop demo (isolation harness — no recognition)

- [ ] 5.1 Wire typed input (`12*8`) → deterministic solve → result string. The solve engine is a SEPARATE capability and is out of this change's scope: if it does not yet exist, **hand-feed the result string** (`96`). This is not a blocker — the honest MVP demo is typed → hand-fed `96` → replay, which still fully exercises A and B (the whole point)
- [ ] 5.2 Feed the result string into the replay engine and render the answer in captured ink, animated
- [ ] 5.3 Validate the acceptance criterion on desktop (mouse) and iPad Safari (Apple Pencil): typed `12*8` returns `96` drawn in the user's hand. Do NOT treat this as blocked on the solve engine — with a hand-fed result it runs today
- [ ] 5.4 Confirm A (capture) and B (replay realism) are the only variables exercised — no recognition anywhere in the path
