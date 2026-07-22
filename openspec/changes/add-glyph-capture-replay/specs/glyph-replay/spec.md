## ADDED Requirements

### Requirement: Render a result string as ink from the glyph library
The system SHALL render a given result token sequence (e.g. `96`, `-3.5`) as ink by retrieving the corresponding glyphs from the user's captured library. The result is supplied by the deterministic solve engine (or, for validation, hand-fed); the replay engine SHALL NOT compute results itself.

#### Scenario: A solved result is rendered in captured ink
- **WHEN** the replay engine receives the result string "96"
- **THEN** it renders a "9" and a "6" drawn from the user's captured glyphs
- **AND** it does not perform any arithmetic or symbolic computation

### Requirement: Pick-then-warp variation
For each glyph instance, the system SHALL pick one of the glyph's 3 captured samples at random and then apply a warp to it. Consecutive identical result digits SHALL differ from one another by **at least the minimum perceptible variation threshold** established by the warp-validation spike (task §1.7) — a byte-identical or sub-threshold difference does NOT satisfy this requirement.

#### Scenario: A repeated digit varies perceptibly
- **WHEN** the engine renders a string containing the same digit multiple times (e.g. "999")
- **THEN** each rendered instance differs from the others by at least the spike-derived minimum perceptible variation threshold
- **AND** each instance is a warped variant of one of the 3 captured samples

### Requirement: Structured warp model
The warp applied to a sample SHALL be **low-frequency along the stroke** (adjacent points move coherently), **scaled to glyph size**, and expressed in the stroke's **tangent/normal frame** (e.g. normal-direction bows, arc-length rescale, endpoint overshoot). The warp SHALL NOT be independent per-point positional jitter, and SHALL NOT be limited to a whole-glyph affine transform.

#### Scenario: Warp preserves coherence rather than adding noise
- **WHEN** a glyph sample is warped for rendering
- **THEN** neighbouring points along a stroke are displaced coherently, not independently
- **AND** the displacement magnitude scales with the rendered glyph size

#### Scenario: Warp is not a rigid stamp
- **WHEN** the same captured sample is warped twice
- **THEN** the two results differ by more than any global rotation/scale/translation can account for (i.e. the per-point residual after best-fit affine alignment is non-trivial), by at least the spike-derived minimum perceptible variation threshold (task §1.7)

### Requirement: Neighbour-relative placement
The system SHALL place rendered glyphs using the stored baseline and advance metrics, applying per-instance **baseline drift** and **size variation relative to neighbours** with natural spacing, so a rendered multi-glyph result reads as a written number rather than glyphs at fixed positions.

#### Scenario: A rendered number sits on a natural baseline
- **WHEN** the engine renders "96"
- **THEN** the glyphs are seated on a shared baseline with slight per-glyph drift
- **AND** spacing derives from each glyph's advance metric, not a fixed pitch

### Requirement: Stroke width from pressure or velocity
The system SHALL derive stroke width from captured pressure, tapering at stroke ends. When a sample was captured without pressure, the system SHALL synthesize width from pen velocity using captured timing. Rendered strokes SHALL NOT be constant-width vector paths.

#### Scenario: Pressure drives variable width
- **WHEN** a pressure-bearing sample is rendered
- **THEN** the stroke width varies with the captured pressure and tapers toward the stroke ends

#### Scenario: Velocity synthesizes width when pressure is absent
- **WHEN** a mouse-captured (pressure-less) sample is rendered
- **THEN** stroke width is synthesized from velocity so faster segments render thinner
- **AND** the stroke is not rendered at constant width

### Requirement: Animated draw-in
The system SHALL render the answer by drawing it in stroke-by-stroke at a plausible pen speed, using captured timing, rather than revealing it statically.

#### Scenario: The answer is drawn in, not flashed
- **WHEN** an answer is rendered
- **THEN** its strokes appear progressively in capture order at a plausible pen speed
- **AND** the final rendered ink matches the fully-drawn glyph

### Requirement: Font fallback for out-of-alphabet glyphs only
Font fallback SHALL apply **only** to glyphs outside the answer alphabet (`0–9 . -`) — e.g. symbolic result tokens introduced in Phase 1.5+. When such an out-of-alphabet glyph is absent from the user's library, the system SHALL render it via a free handwriting web font and SHALL flag it for capture. Font fallback SHALL NOT be used to cover a missing answer-alphabet glyph; that case is a hard gate handled by capture-completeness (see `glyph-capture`), not a graceful degrade.

#### Scenario: An out-of-alphabet glyph falls back and prompts capture
- **WHEN** a result requires a glyph outside `0–9 . -` that the user has not captured (e.g. a symbolic token)
- **THEN** that glyph renders via the handwriting web-font fallback
- **AND** the system flags it as available for capture

#### Scenario: A missing answer-alphabet glyph never falls back
- **WHEN** an answer using `0–9 . -` cannot be fully rendered because a required answer-alphabet glyph is uncaptured
- **THEN** the system does NOT substitute a font glyph
- **AND** it defers to the capture-completeness gate (block-and-route to capture) instead

#### Scenario: Completed answer alphabet renders entirely from captured ink
- **WHEN** an arithmetic answer using only `0–9 . -` is rendered after onboarding is complete
- **THEN** every glyph renders from the user's captured library with no font fallback
