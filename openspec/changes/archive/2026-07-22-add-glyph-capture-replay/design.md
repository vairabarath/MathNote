## Context

This is the first capability built for Math Canvas. Per the Requirements doc, handwriting synthesis is the highest-risk requirement (R1) and the true differentiator (§8). Apple's Math Notes does not maintain a durable global model of the user; it generates answer glyphs that look convincingly like the ink present *in the current note*, on-device, per-note (§8). That validates a glyph-capture-and-replay approach (their Approach A) — arguably the same design philosophy, implemented by literally reusing the user's strokes.

Two exploration decisions frame this design:
1. **Prove the loop with typed input, not recognition.** Recognition (R2) is the weakest, swappable component. Fusing it into the first demo would make a failure un-diagnosable (replay vs misread). So the first build isolates capture (A) and replay-realism (B) as the only variables under test.
2. **The input alphabet and the output alphabet are different sizes.** What a user *writes* is open-ended; what appears as an *answer* is a tiny closed set. For the arithmetic MVP that set is `0–9 . -`. "Mandatory onboarding" is therefore ~12 glyphs, not the whole symbol set — light enough to be the product's hook rather than a chore.

## Goals / Non-Goals

**Goals:**
- Capture the answer alphabet (`0–9 . -`), 3 samples per glyph, in a sub-~30s first-run flow framed as the opening hook.
- Persist a per-user, local-only, private glyph library with a data model rich enough to render at any size and to animate.
- Render a result string as ink that reads as *the user's hand* — specifically avoiding both the "font" tell (rigid repetition) and the "damage" tell (unstructured jitter).
- Animate the draw-in stroke-by-stroke, which is both delight and *risk insurance* for replay quality (see Decisions).
- Gate the whole build on an early warp-only validation spike.

**Non-Goals:**
- **Recognition (ink → expression).** Deferred to Phase 1.5.
- **The deterministic solve engine.** Separate capability; replay consumes its result string.
- **Learning the user's personal variation manifold.** v1 uses a *generic* warp seeded from personal anchors; manifold-learning via sample interpolation is a Phase 1.5+ upgrade.
- **The open input-symbol set** (variables, functions, operators). Only the closed answer alphabet is captured here.
- **Passive harvesting** of glyphs from written input — impossible without recognition, so out of v1; it is the named growth path once 1.5 lands.

## Decisions

### D1 — Prove the loop with typed input; recognition is out
One demo, one variable. Typed `12*8` → deterministic solve → answer rendered in captured ink. If it fails, the failure is unambiguously in capture or replay. *Alternative considered:* Groq-vision recognition first (Requirements §9 MVP). Rejected — it contaminates the experiment and leans the flagship demo on the component we plan to throw away.

### D2 — N=3 samples, pick-then-warp, NOT blend
Per answer instance: **pick** one of the 3 captured samples at random, then **warp** it. Three distinct seeds break the visible repetition cycle ("999999999" no longer shows one stamp); the warp multiplies each seed into a continuum.

*Alternative considered — interpolate/blend across samples (manifold generation).* Rejected for v1 on two costs: (a) **correspondence** — blending two strokes needs point-to-point correspondence (resample by arc length), doable but real; (b) **structural matching** — if a "5" is two strokes in one sample and one stroke in another, the samples are not correspondable at all, breaking interpolation. Pick-then-warp sidesteps both: each sample stands alone, so variable stroke counts across samples are fine.

**Honest-framing note (must survive into the code and comments):** because v1 picks-then-warps rather than interpolating, the variation is a *generic* structured prior seeded from 3 *personal* anchor shapes — it is **not** generating along the user's personal variation manifold. The v1 win is *cycle-breaking + three anchor shapes*, not personal-variance. Personal-variance learning is a named 1.5+ upgrade. This is documented so a future reader does not see "variation looks slightly generic," conclude the engine failed, and rebuild it — when manifold-learning was simply never in v1 scope.

### D3 — The warp model (hypothesis, to be validated by D6)
Variation must read as *the same hand wandering*, which means it must be **low-frequency along the stroke** (adjacent points move together), **scaled to glyph size**, and expressed in the stroke's **tangent/normal frame**:
- small normal-direction bows (curves relax/tighten),
- slight arc-length rescale (stretch/squish along the path),
- tiny endpoint overshoot/undershoot (fast pen-lift),
- a mild global slant/size jitter as *one* component among several — never the only one.

Two failure modes bracket this: **affine-only jitter** (a tilted stamp is still a stamp) and **independent per-point perturbation** (white noise reads as palsied/damaged). The target sits between them. **This is an asserted hypothesis** — the entire product rests on it — so it is gated, not assumed (D6).

### D4 — Full timing is core to the data model
The render is animated (D5), so per-point `t` is not optional. It also drives velocity→width synthesis for mouse input (no pressure). Store `{x, y, pressure, t}` per point, ordered strokes, from capture onward. Cheap to keep, expensive to have discarded.

### D5 — Animate the draw-in
The answer is *drawn in* stroke-by-stroke at plausible pen speed, not statically revealed. Beyond delight, this is **risk insurance for the weakest asset**: static ink is judged as a finished artifact — the eye scrutinizes whether the shape is really the user's hand. Ink drawn in at pen speed is judged as a *process* — the motion carries the credibility and the eye forgives shape imperfections it would catch when static. Since the warp model is the hard part, anything that lowers the quality bar it must clear is strategic, not cosmetic.

### D6 — Warp-validation spike as a build gate, with a judge that is hard to fool
Before building capture UX, persistence, placement, animation, or the typed→solve→replay loop, run a **warp-only spike**: hand-feed 3 samples of a single glyph (e.g. "9"), implement *only* the warp, render a long repeated string ("999999999"), and evaluate it. Needs no solver, no answer alphabet, no capture flow, no typed pipeline — an afternoon. **The rest of the build is gated on this reading as one hand, not as damage.**

The weak link in this gate is *who judges*. "Eyeball it" by the person who built the warp is a primed judge — they want it to pass. So the gate does not rest on a solo subjective call. It is hardened three ways, all still within the afternoon:

1. **Blind control set.** Render the same string three ways in randomized, unlabeled order: (a) the structured warp, (b) a handwriting web font, (c) rigid affine-jittered stamps. The builder must identify which is which *and* judge the warp best. If the warp is **indistinguishable from the font**, the bar is not cleared — the whole thesis is that we beat a font.
2. **A second pair of eyes.** Show the unlabeled set to one person who is not the builder and has not heard the warp theory. The solo-builder eye does not count alone.
3. **The spike also produces a number.** It derives the **minimum perceptible variation threshold** (D3a below) that the `glyph-replay` variation scenarios use as their acceptance bound — so the gate outputs a measurable artifact, not only a yes/no.

**PASS requires all three:** reads as one hand, beats the font in the blind pick, and the second person agrees. Otherwise revise the warp model (D3) and repeat before anything is built around it. *Alternative considered:* build the engine end-to-end then judge the whole. Rejected — it buries the load-bearing risk under weeks of dependent work.

### D3a — Variation must be measurable, not merely "different"
The anti-font requirements ("instances differ", "not a rigid stamp") are the ones encoding the entire thesis, so they must be checkable, not aspirational. Two warps could differ by an imperceptible epsilon and pass a naive "differ" check while looking identical. The spike (D6), which is already discovering warp parameter ranges, is exactly where the **minimum perceptible variation threshold** is learned — the smallest inter-instance difference that still reads as "different but same hand." That threshold feeds back into the `glyph-replay` scenarios as the real acceptance bound. "Differs by more than affine" is made concrete as *non-trivial per-point residual after best-fit affine alignment*, above the threshold.

### D9 — Incomplete answer alphabet is a hard gate, not a graceful degrade
The whole premise is that onboarding capture is mandatory and framed as the hook. Therefore, if a required **answer-alphabet** glyph (`0–9 . -`) is uncaptured, the system **blocks the render and routes to capture** — it does *not* silently fall back to a font. Font fallback exists **only** for *out-of-alphabet* tokens (symbolic results in Phase 1.5+). *Alternative considered:* graceful font-fallback for any missing glyph. Rejected for the answer alphabet — it would quietly break the "as if I wrote it myself" promise on the exact glyphs onboarding exists to guarantee. This resolves the block-vs-degrade fork the specs must not leave open.

### D7 — Normalization with baseline + advance metrics
Store each glyph in a normalized em-box plus **baseline** and **advance** metrics. This is what makes a *sequence* (`96`) read as a written number rather than glyphs bobbing at random heights/spacing. Placement (baseline drift, neighbour-relative sizing, spacing) is expressed against these metrics.

### D8 — Local-first, private glyph library
The glyph library is personal data (NFR-3): IndexedDB, on-device, per-user, never shared by default. No network dependency for capture or replay.

## Risks / Trade-offs

- **The warp model may not read as human (R1, the load-bearing risk).** → D6 gates the entire build on an afternoon-long spike before any dependent work exists.
- **v1 variation looks "slightly generic" and is mistaken for failure.** → D2's honest-framing note documents that personal-variance is deliberately deferred; cycle-breaking + 3 anchors is the intended v1 win.
- **N=3 pushes onboarding toward ~30s, straining the "10-second hook" framing.** → Accepted; reframe as "write it three times so I really get your style," which reads as the app *studying* you. In the typed MVP, onboarding is the *only* glyph source (no harvest without recognition), so sample count is the whole ballgame for MVP variation quality — worth the seconds.
- **Mouse input has no pressure (NFR-4).** → Synthesize width from velocity using captured `t`; degrade gracefully rather than rejecting mouse capture.
- **Multi-stroke glyphs captured with inconsistent stroke counts.** → Pick-then-warp (D2) treats each sample independently, so this never has to be reconciled in v1.

## Migration Plan

Greenfield — no migration. Rollback is deletion of the change; nothing depends on it yet. The warp spike (D6) is the first checkpoint; a failed reading returns to design (revise D3) rather than proceeding.

## Open Questions

- Exact warp parameter ranges (bow amplitude, arc-length rescale %, overshoot magnitude) — to be tuned empirically during the D6 spike, not pre-baked.
- Whether "." and "-" need special metric handling (baseline position of a low dot, mid-height dash) or fall out of D7 naturally.
- Draw-in pacing: replay captured `t` verbatim, or normalize to a consistent target pen speed? Likely normalize, TBD in the spike.
