# Math Canvas — Requirements Document

**Version:** 0.2 (free-stack committed)
**Author:** Barath
**Status:** Draft — open decisions flagged inline
**Reference baseline:** Apple *Math Notes* (Calculator, Notes, Freeform — iPadOS 18/26)
**Hard constraint:** Build entirely on free/open tooling ($0 running cost)

---

## 1. Vision

Math Canvas is a browser-based canvas where a user **writes or draws a mathematical expression by hand** (stylus, touch, or mouse), and the app **recognises it, solves it, and writes the answer back inline in the user's own handwriting**. Target: functional parity with Apple Math Notes for arithmetic, algebra, variable reuse, live recomputation, and 2D/3D graphing — running entirely on the web, at zero cost.

The defining experience is not "solve my math." It is: *the answer appears as if I wrote it myself.* That single property is what makes it feel like Math Notes rather than a calculator with OCR.

---

## 2. Assumptions & Open Decisions

| # | Decision | Committed assumption | Why it matters |
|---|----------|---------------------|----------------|
| A1 | Platform | Web, mobile-web + desktop, **stylus-first** (Apple Pencil in Safari, S-Pen, mouse fallback) | Determines input pipeline and latency budget |
| A2 | Ownership | Personal / portfolio first, possible InkYank product later | Governs licensing tolerance — here, forces $0 |
| A3 | Cost | **Free/open only** — no paid SDKs or APIs | Removes MyScript/Mathpix from v1; shapes recognition |
| A4 | Solve engine | **math.js (fast path) + SymPy/Pyodide (symbolic)** | Deterministic, offline, free |
| A5 | Handwriting output | **Glyph-capture-and-replay** | Realistic free path to "your handwriting"; see §8 |
| A6 | LLM | **Groq free tier — language layer only, never computation** | See §7 |
| A7 | Recognition | Free client-side classifier (durable) + Groq vision (prototype only) | The one component where free is genuinely worse; see §6 |

---

## 3. Parity Target vs Apple Math Notes

| Capability | Math Notes behaviour | Math Canvas target | Phase |
|-----------|----------------------|--------------------|-------|
| Handwrite an expression | Recognises handwritten math | Yes | MVP |
| Solve on `=` | Writes result when you write `=` | Yes | MVP |
| **Result in user's handwriting** | Renders answer in a matching hand | Yes (glyph-replay) | MVP |
| Typed input | Type expressions too | Yes | MVP |
| Variable declaration | `a = 3`, reuse `a` later | Yes | P2 |
| Live recompute | Edit a value → dependents update | Yes | P2 |
| Common symbols & scientific ops | `√ π ^ sin log` etc. | Yes | P2 |
| Units | `5 cm + 2 inch`, conversions | Yes (math.js) | P2 |
| 2D graphing | Insert graph from `y = f(x)` | Yes | P3 |
| Pan / zoom / tap-coordinates | Two-finger pan, pinch, touch-to-read | Yes | P3 |
| Multiple/overlaid graphs | Combine on one grid | Yes | P3 |
| 3D graphing | `z = f(x, y)` surfaces, rotate | Yes | P3 |
| Recolor / resize / recenter graph | Graph editing controls | Yes | P3 |
| Notes persistence | Save notes | Yes | P2 |

---

## 4. Functional Requirements

### 4.1 Canvas & Input
- FR-1: Capture strokes via the **Pointer Events API**, preserving `pressure`, `tiltX/tiltY`, and timestamp per point.
- FR-2: Palm/touch rejection — accept `pointerType === "pen"` when a pen is present; treat touch as gesture. Set `touch-action: none`.
- FR-3: Render ink at ≤ one frame of perceived latency; use `getPredictedEvents()` where supported.
- FR-4: Tools: pen, stroke-level eraser, lasso-select, undo/redo, clear.
- FR-5: Typed-input mode as an alternative to writing.

### 4.2 Handwriting Recognition (ink → expression)
- FR-6: Convert strokes into a **structured expression** (LaTeX/MathML), preserving fractions, exponents, roots.
- FR-7: Support at minimum: digits, `+ − × ÷ / = ( ) . ,`, powers, roots, fractions, common variables, `π`, and `sin cos tan log ln`.
- FR-8: Recognition is **incremental** — re-recognise as strokes are added.
- FR-9: Expose **confidence** and allow single-glyph correction without redrawing.

### 4.3 Solve Engine (expression → answer) — deterministic, never an LLM
- FR-10: Evaluate arithmetic exactly and numerically.
- FR-11: Symbolic capability: simplify, solve, expand/factor, differentiate/integrate, matrices.
- FR-12: Trigger evaluation on trailing `=` (Math Notes' core gesture) and on demand.
- FR-13: Return a **structured expression** for the handwriting renderer.
- FR-14: **All computation is deterministic.** No result is ever produced by a language model. (Rationale in §7.)

### 4.4 Handwriting Synthesis (answer → ink in the user's style)
- FR-15: Maintain a per-user **glyph library** of captured stroke trajectories (`0–9`, operators, common variables, symbols).
- FR-16: Populate it via short **onboarding capture** or **passive harvesting** of confirmed glyphs the user already wrote.
- FR-17: Render answers by **replaying the user's strokes** with per-instance variation (affine jitter, baseline drift, natural spacing).
- FR-18: Fall back to a free handwriting web font for uncaptured glyphs; prompt to capture.
- FR-19: Results are tinted/distinguishable-on-demand yet feel handwritten (match Apple's affordance).

### 4.5 Variables & Live Recompute
- FR-20: Detect assignments (`a = 3`) into a note-scoped symbol table.
- FR-21: Referencing expressions recompute automatically when a variable changes.
- FR-22: Dependency graph propagates edits in correct order.

### 4.6 Graphing
- FR-23: 2D from `y = f(x)`; left-of-`=` maps to y-axis.
- FR-24: 2D interactions: pan, pinch-zoom, touch-to-read coordinates, recenter, equalise axes, resize, recolor.
- FR-25: Overlay multiple equations; per-equation visibility toggle.
- FR-26: 3D from `z = f(x, y)`; drag to rotate.

### 4.7 Notes & Persistence
- FR-27: A note holds ink, expressions, results, variables, graphs.
- FR-28: Local-first persistence (IndexedDB); export to PDF/PNG. Cloud sync deferred.

---

## 5. Non-Functional Requirements

- NFR-1 **Recognition accuracy:** ≥ 95% glyph-level on clean single-line arithmetic (MVP corpus); tracked with a labelled eval set.
- NFR-2 **Latency:** ink render < 16 ms/frame; recognition feedback < 300 ms after a stroke settles; solve < 500 ms (SymPy pre-warmed).
- NFR-3 **Privacy:** client-side recognition keeps ink on-device. Any LLM call is opt-in and user-triggered. The glyph library is personal data — local only, never shared by default.
- NFR-4 **Device support:** Safari/iPad (Apple Pencil), Chrome/Edge desktop (mouse), Android Chrome (S-Pen/touch). Degrade gracefully where pressure/tilt is absent.
- NFR-5 **Bundle/load:** SymPy-via-Pyodide is multi-MB; lazy-load behind a warm-up state.

---

## 6. Committed Free Stack

Every component has a genuinely free option. The only place "free" is materially worse than paid is **recognition** — called out honestly below.

| Layer | Choice (free/open) | Notes |
|-------|-------------------|-------|
| Canvas & input | Pointer Events + Canvas/SVG, React or vanilla | Pure code |
| **Solve — fast path** | **math.js** (Apache-2.0) | Arithmetic, variables, units, trig, matrices |
| **Solve — symbolic** | **SymPy via Pyodide** (WASM) | Solve/factor/calculus; matches or exceeds Apple's symbolic scope; offline |
| Handwriting answer | **Glyph-capture-and-replay** (own code) + Google handwriting font fallback | The differentiator; costs only effort |
| Graphing 2D | **function-plot** or **JSXGraph** (MIT) | Pan/zoom/coordinate-read built in |
| Graphing 3D | **Plotly** or **three.js** | Surfaces, rotation |
| LLM (optional) | **Groq free tier** (~30 RPM / 1,000 RPD) | Language layer only; key proxied via serverless fn |
| Hosting | **Cloudflare Pages / Vercel / Netlify** free | Static + one free serverless fn for the Groq proxy |

### math.js capability (confirmed scope for the scientific-calculator surface)
- **Variables:** stateful `math.parser()` remembers assignments across evaluations; or per-call `scope` objects; supports function definitions `f(x) = x^2`. Maps directly onto declare-and-reuse + live recompute.
- **Units:** large built-in unit system + physical constants, with arithmetic and conversion (`5 cm + 2 inch`, `20 km/h to m/s`). A standout strength.
- **Trigonometry:** full set — `sin cos tan`, inverses (`asin acos atan atan2`), reciprocals (`sec csc cot`), hyperbolics (`sinh cosh tanh`). Radians by default; composes with units so `sin(45 deg)` works.
- **Ceiling:** strong at *evaluation*, limited at heavy *symbolic* work — won't reliably solve arbitrary equations for x, do symbolic integration, or factor polynomials (only light `simplify`/`derivative`/`rationalize`). This is exactly why SymPy is paired in for the symbolic layer.

### Recognition — the one honest catch
Free is genuinely weaker here; MyScript/Mathpix are better but excluded by the $0 constraint. Free options, ranked:
1. **Durable free path — client-side symbol classifier** (TensorFlow.js / ONNX) trained on MNIST digits + an open symbol set (HASYv2 / CROHME / Detexify). Free, private, offline — mirrors Apple's on-device philosophy. The hard part isn't the classifier; it's **layout parsing** (baselines, exponents, fraction bars). Tractable for single-line arithmetic and simple algebra; full 2D structure is where difficulty rises.
2. **Prototype shortcut — Groq free vision model** (Llama 4 Scout) on a rasterised image → LaTeX. Wireable in a day to prove the loop. **Not** a production recognizer: vision LLMs drop exponents and invent digits, which is fatal for a math tool. Validate with it, then replace with option 1.

---

## 7. AI / LLM Layer — computation is deterministic, language is Groq

The critical architectural rule: **the LLM never computes a result.** LLMs do math by pattern-matching text, so they are sometimes confidently wrong — unacceptable for a tool whose promise is correctness. Apple's Math Notes does not use an LLM to solve either; it runs a deterministic engine. Math Canvas follows suit.

Groq's free tier is the right tool for **language jobs around** the verified result:
- **Step-by-step explanations** ("show me how"): the deterministic engine computes the answer, then the LLM narrates the already-correct steps. The model is never trusted for correctness — only exposition. Groq's low latency makes this feel instant.
- **Natural-language / word problems:** LLM parses "a train leaves at 3pm..." into a formal expression → deterministic solver computes it. LLM as translator, not calculator.
- **Tutoring chat** over the canvas.

Operational rules:
- LLM calls are **user-triggered** (e.g. an "explain" tap), never automatic per stroke — otherwise the 1,000/day cap is hit fast.
- The API key is **proxied through a serverless function**, never exposed client-side.
- Groq runs open-source models only (Llama, Qwen, Gemma, etc.); no proprietary models. Fine for these language tasks.

---

## 8. The Hard Part: Answering in the User's Own Handwriting

The requirement you stressed twice deserves an honest treatment grounded in what Apple actually does — not what it appears to do.

### What Apple actually built
Apple does **more than a font but less than a perfect clone**, deliberately. Their own materials describe an **on-device model that recreates handwriting in a style similar to your own** and writes the answer "in your handwriting." But the revealing mechanism, per Apple's own product/engineering leads: **recognition does not persist from note to note** — it is refined dynamically and is **contextual**, matching the handwriting *present in the current note* rather than maintaining a durable global model of you. They explicitly wanted it to "feel personal and not like a font." Hands-on observers confirm it is an approximation — it *kind of* matches, apparently choosing from a small style space, refined on-device.

The lineage: Math Notes builds on Scribble (recognition) and **Smart Script**, which *smooths your actual strokes* while keeping your style and learns continually. Distinction worth holding: Smart Script **refines your own strokes**; Math Notes **generates new glyphs** (the answer) in a matching style.

### Why this is good news for a free web build
Apple did **not** solve durable per-user handwriting synthesis. They solved a narrower, more achievable problem: *generate answer glyphs that look convincingly like the ink right next to them, on-device, per-note.* The bar is "feels personal in-context," not "indistinguishable clone." That directly validates glyph-capture-and-replay — arguably the **same design philosophy** (match what's local; make it feel like yours), just implemented by literally reusing the user's strokes instead of a learned emulation model.

- **Approach A — Glyph capture & replay (v1).** Record the user's strokes per glyph; replay with per-instance variation. Convincing because the output *is* their ink. Free, offline, private, achievable in weeks. Limits: fixed glyph set, no cursive connections, needs a capture step.
- **Approach B — Generative sequence model (R&D track).** A mixture-density LSTM (Graves 2013) generating pen trajectories, style-primed from user samples. Powerful but trained on text, not math symbols — needs augmentation/retraining and model serving. Pursue only after A, only if the fixed-glyph feel isn't good enough.
- **Approach C — Diffusion style transfer.** SOTA quality but heavy, image-space, weak on math symbols. Overkill for v1.

**Verdict:** Ship A. It matches Apple's *philosophy* and is fully free.

---

## 9. Phased Roadmap

**MVP (prove the magic loop):** Pointer-event inking → **Groq vision recognition (prototype)** → SymPy/math.js solve on `=` → **answer via glyph-replay in the user's hand**. Goal: see `12 × 8 =` return in your own handwriting within days, at $0.

**Phase 1.5 (durable recognition):** Replace the vision-LLM shortcut with the **client-side classifier + layout parser**. Now fully offline and private.

**Phase 2 (algebra, units & notes):** Variables + live recompute; scientific functions, units, symbols; note persistence + export; recognition-correction UX.

**Phase 3 (graphing):** 2D (pan/zoom/coordinate-read/overlay/recolor), then 3D surfaces.

**Optional layers:** Groq explanation + word-problem parsing (§7); generative handwriting synthesis (Approach B).

---

## 10. Acceptance Criteria (Definition of Done)

- **MVP:** A user handwrites `12 × 8 =` and the correct result appears **in their own handwriting** within the latency budget — iPad Safari with Apple Pencil and desktop with a mouse.
- **Phase 2:** Declaring `a = 3` then writing `a² =` yields `9`; editing `a` to `5` updates dependents automatically; `5 cm + 2 inch` and `sin(45 deg)` evaluate correctly.
- **Phase 3:** `y = x²` graphs, pans/zooms; overlaying `y = 2x` on the same grid works with pointer interaction.

---

## 11. Risks

- **R1 — Handwriting synthesis underwhelms.** Highest-risk requirement. *Mitigation:* Approach A first; validate "feels like my writing" with real users before investing in B.
- **R2 — Free recognition accuracy on messy input.** The genuine weak point of the $0 constraint. *Mitigation:* keep the recognition interface swappable; if it ever blocks progress, recognition is the single line item worth eventually spending on (e.g. Mathpix free credits).
- **R3 — Web inking latency vs native.** *Mitigation:* predicted events, off-main-thread rendering, keep ink layer separate from React re-renders.
- **R4 — SymPy WASM cold-start.** *Mitigation:* pre-warm on load; route trivial arithmetic through math.js.
- **R5 — Groq daily cap.** *Mitigation:* user-triggered LLM calls only; cache; the app is fully functional with the LLM layer off.

---

## 12. Reality Check vs Apple

Recognition and solving on the free web are tractable — a WASM CAS (SymPy) plus math.js fully cover computation, and a client-side classifier covers recognition for the common cases. The honest gaps are **inking latency** (Apple's Pencil + native pipeline is hard to match in a browser) and the **polish of live stroke-refinement** (Smart Script). Framed correctly, a free web Math Canvas can feel *most of the way* to Math Notes; the last 10% — buttery Pencil feel, adaptive live refinement — is where native's structural advantages show, and is worth scoping as a known gap rather than a v1 failure.

---

*Open items to confirm: A1–A7 (§2). Natural next spec targets: the glyph-replay renderer, the SymPy/math.js integration boundary, or the client-side recognition classifier + layout parser.*
