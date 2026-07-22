# glyph-capture Specification

## Purpose
TBD - created by archiving change add-glyph-capture-replay. Update Purpose after archive.
## Requirements
### Requirement: Answer-alphabet onboarding capture
The system SHALL, on first run, capture the user's handwriting for the closed answer alphabet — the glyphs `0 1 2 3 4 5 6 7 8 9 . -` — collecting **exactly 3 samples per glyph**, and SHALL frame this as the product's opening interaction ("write these so I can learn your hand") rather than as configuration. The system SHALL NOT require capture of the open input-symbol set (variables, functions, operators) in this flow.

#### Scenario: First-run capture completes the answer alphabet
- **WHEN** a new user opens the app for the first time
- **THEN** the system prompts them to write each of the 12 answer-alphabet glyphs 3 times
- **AND** on completion the glyph library contains 3 samples for every glyph in `0–9 . -`

#### Scenario: Capture is required before replay can render an answer
- **WHEN** a user attempts to trigger an answer render before onboarding capture of the answer alphabet is complete
- **THEN** the system blocks the render and routes them to complete capture for the missing answer-alphabet glyphs first
- **AND** it does NOT substitute a font glyph for the missing answer-alphabet glyph (font fallback is reserved for out-of-alphabet tokens per `glyph-replay`)

### Requirement: Captured-glyph data model fidelity
The system SHALL store each captured sample as an **ordered list of strokes**, each stroke an ordered list of points, each point recording at minimum `{x, y, pressure, t}`. Multi-stroke glyphs SHALL be supported, preserving stroke order and inter-stroke timing. Per-point timing (`t`) SHALL be retained even though the initial render target is available statically, because replay is animated and mouse width is timing-derived.

#### Scenario: A multi-stroke glyph preserves stroke order and timing
- **WHEN** a user writes a "5" as two separate strokes
- **THEN** the stored sample contains two ordered strokes with their pen-down/pen-up timing preserved
- **AND** each point retains its `x`, `y`, `pressure`, and `t` values

#### Scenario: Timing is retained on capture
- **WHEN** any glyph sample is captured
- **THEN** every stored point carries a timestamp `t` relative to the sample's start

### Requirement: Normalization with baseline and advance metrics
The system SHALL store each glyph in a normalized em-box form and SHALL record **baseline** and **advance** metrics for each glyph, sufficient to place it in a sequence at arbitrary size while preserving aspect ratio.

#### Scenario: Normalized glyph renders as part of a number
- **WHEN** the replay engine requests two glyphs to render the result "96"
- **THEN** each glyph is retrieved in normalized form with baseline and advance metrics
- **AND** the metrics are sufficient to seat both glyphs on a shared baseline with natural advance spacing

### Requirement: Mouse and pressure-absent capture
The system SHALL accept capture from input devices that do not report pressure (e.g. mouse), degrading gracefully rather than rejecting the input. When pressure is absent, the system SHALL still record `x`, `y`, and `t` so that stroke width can be synthesized from velocity at replay time.

#### Scenario: Mouse capture succeeds without pressure data
- **WHEN** a user captures a glyph with a mouse that reports no pressure
- **THEN** the sample is stored with `x`, `y`, and `t` per point
- **AND** the missing pressure is flagged so replay synthesizes width from velocity

### Requirement: Per-user local-only glyph library
The system SHALL persist the glyph library on-device (IndexedDB), scoped per user, and SHALL NOT transmit or share it by default. The library SHALL survive across sessions.

#### Scenario: Library persists across sessions
- **WHEN** a user completes onboarding capture and later reopens the app
- **THEN** their captured glyph library is loaded from local storage without any network request
- **AND** no glyph data leaves the device

### Requirement: Sample re-capture and correction
The system SHALL allow a user to re-capture any glyph sample, replacing it in the library, so a poorly written sample can be corrected without redoing the whole alphabet.

#### Scenario: Re-capturing one glyph replaces only that sample
- **WHEN** a user chooses to re-write one of their samples of "7"
- **THEN** the system replaces that single sample in the library
- **AND** leaves the other glyphs and samples unchanged

