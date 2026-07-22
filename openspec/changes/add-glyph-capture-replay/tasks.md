## 1. Warp-validation spike (GATE — nothing below proceeds until this passes)

- [ ] 1.1 Hand-author 3 stroke samples of a single glyph ("9") as raw `{x, y, pressure, t}` point arrays (no capture UI, no persistence)
- [ ] 1.2 Implement ONLY the structured warp: resample stroke by arc length; apply low-frequency, size-scaled displacement in the tangent/normal frame (normal bows, arc-length rescale, endpoint overshoot)
- [ ] 1.3 Render a long repeated string ("999999999") using pick-then-warp over the 3 hand-fed samples
- [ ] 1.4 Render an UNLABELED mixed control set of the same string, three ways in randomized order: (a) the structured warp, (b) a handwriting web font, (c) rigid affine-jittered stamps
- [ ] 1.5 Blind self-check: without labels, identify which is which; the warp PASSES only if you can distinguish it AND it reads best — if it's indistinguishable from the font, the bar is not cleared
- [ ] 1.6 Second-eye check: show the unlabeled set to one person who is NOT you and has NOT heard the warp theory; record whether the warp reads as one hand to them (the solo-builder eye is primed and does not count alone)
- [ ] 1.7 Derive the **minimum perceptible variation threshold** from the spike (the smallest inter-instance difference that still reads as "different but same hand") and record it as the acceptance bound for the `glyph-replay` variation scenarios
- [ ] 1.8 GATE DECISION: PASS requires all of — warp reads as one hand, beats the font in the blind pick (§1.5), and the second person agrees (§1.6). Otherwise revise the warp model (design D3) and repeat §1 before building anything else

## 2. Glyph data model & storage

- [ ] 2.1 Define the captured-glyph types: `Glyph { symbol, samples[3], metrics }`, `Sample { strokes[] }`, `Stroke { points[] }`, `Point { x, y, pressure, t }`
- [ ] 2.2 Implement normalization to an em-box preserving aspect ratio, computing baseline + advance metrics
- [ ] 2.3 Implement per-user local persistence (IndexedDB); load/save the library with no network access
- [ ] 2.4 Verify a multi-stroke glyph round-trips through storage preserving stroke order and timing

## 3. Onboarding capture flow

- [ ] 3.1 Build the Pointer Events capture surface preserving `pressure` and `t` per point; support mouse (pressure-absent) capture
- [ ] 3.2 Build the first-run flow prompting for `0–9 . -`, 3 samples each, framed as the opening hook
- [ ] 3.3 Write each captured sample through normalization (§2.2) into the library (§2.3)
- [ ] 3.4 Add single-glyph re-capture/correction that replaces only the targeted sample
- [ ] 3.5 Gate answer render on answer-alphabet capture completeness: block-and-route to capture for any missing answer-alphabet glyph (NOT font fallback — fallback is out-of-alphabet only, §4.6)

## 4. Replay engine

- [ ] 4.1 Implement pick-then-warp: random sample selection + the validated warp (§1) per glyph instance
- [ ] 4.2 Implement neighbour-relative placement: baseline drift + size-relative-to-neighbours + advance-based spacing
- [ ] 4.3 Implement stroke width from pressure with end-tapering
- [ ] 4.4 Implement velocity-synthesized width for pressure-absent (mouse) samples using `t`
- [ ] 4.5 Implement animated draw-in: render strokes progressively in capture order at a plausible/normalized pen speed
- [ ] 4.6 Implement handwriting-web-font fallback + capture flag for uncaptured glyphs (must not trigger for a completed answer alphabet)
- [ ] 4.7 Bake in the honest-framing note (code comment + docs): v1 warp = generic prior seeded from 3 personal anchors; personal-variance manifold-learning is a named 1.5+ upgrade

## 5. Typed-input magic-loop demo (isolation harness — no recognition)

- [ ] 5.1 Wire typed input (`12*8`) → deterministic solve → result string. The solve engine is a SEPARATE capability and is out of this change's scope: if it does not yet exist, **hand-feed the result string** (`96`). This is not a blocker — the honest MVP demo is typed → hand-fed `96` → replay, which still fully exercises A and B (the whole point)
- [ ] 5.2 Feed the result string into the replay engine and render the answer in captured ink, animated
- [ ] 5.3 Validate the acceptance criterion on desktop (mouse) and iPad Safari (Apple Pencil): typed `12*8` returns `96` drawn in the user's hand. Do NOT treat this as blocked on the solve engine — with a hand-fed result it runs today
- [ ] 5.4 Confirm A (capture) and B (replay realism) are the only variables exercised — no recognition anywhere in the path
