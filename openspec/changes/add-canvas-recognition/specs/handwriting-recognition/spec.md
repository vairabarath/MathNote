## ADDED Requirements

### Requirement: Segmentation gates the recognizer
The system SHALL validate stroke/gap **segmentation** on adversarial single-line arithmetic BEFORE any recognition method (matcher or classifier) is built around it. Segmentation of a single-line handwritten expression into an ordered sequence of glyph groups SHALL produce boundaries that match the intended glyphs at or above the boundary-accuracy threshold established by the segmentation-spike gate (tasks §1) — measured on a hand-labelled adversarial set, not on a single friendly example.

#### Scenario: A two-stroke glyph is grouped as one
- **WHEN** the user writes a `5` as two separate strokes within one expression
- **THEN** segmentation groups both strokes into a single glyph group, not two

#### Scenario: Adjacent / touching digits are separated correctly
- **WHEN** the expression contains multi-digit operands whose digits touch or nearly touch (e.g. `47`)
- **THEN** segmentation places a boundary between the touching digits so each digit is its own group

#### Scenario: The adversarial set meets the threshold
- **WHEN** the segmentation-spike cases (`2+2`, `47*3`, `5+18`, plus a touching-digits case and a two-stroke-`5` case) are segmented
- **THEN** boundary accuracy across the set meets the spike-established threshold, and a naive pass on `2+2` alone does NOT satisfy this requirement

### Requirement: Supported input envelope, and refusal of the unsupported
The segmentation gate (tasks §1) established that naive gap-segmentation separates spaced/single-digit glyphs correctly but CANNOT separate touching/adjacent multi-digit numbers. The shipped recognizer (Option 1) SHALL therefore support **single-digit operands and spaced glyphs** via template-matching against the user's captured `0–9`, and SHALL **detect input outside that envelope** — an ink cluster that looks like touching/adjacent multi-digit it cannot confidently segment into single glyphs — and return an explicit `unreadable` result (with a reason) rather than a token sequence. It SHALL NOT emit a confident-but-wrong reading of unsupported input. The multi-digit classifier is a named future upgrade behind the same interface.

#### Scenario: A single-digit spaced expression is recognized
- **WHEN** the user writes single-digit operands with clear gaps (e.g. `2+2`)
- **THEN** the recognizer returns the token sequence for that expression

#### Scenario: Touching multi-digit is refused, not guessed
- **WHEN** the ink contains touching/adjacent digits the recognizer cannot confidently segment into single glyphs (e.g. a crammed `15`)
- **THEN** the recognizer returns `unreadable` with a reason (e.g. "space out multi-digit numbers"), and does NOT return a confident wrong token sequence

#### Scenario: The classifier upgrade is a drop-in
- **WHEN** the multi-digit classifier is later added
- **THEN** it replaces the recognizer behind the same `ink → result` interface with no change to the canvas loop or solver

### Requirement: Swappable recognizer interface
The system SHALL expose recognition as a single interface mapping ink (ordered strokes) to a token sequence (`0–9`, `+ - × ÷`, `=`). The canvas loop and the solver SHALL depend only on this interface, so the recognition method chosen by the gate can be replaced without changing anything downstream (Requirements R2).

#### Scenario: Recognizer is replaceable without touching the loop
- **WHEN** the recognition method is swapped (e.g. template-matcher → classifier)
- **THEN** the canvas loop and solver require no change because both depend only on the `ink → tokens` interface

### Requirement: Recognition is on-device and private
Production recognition SHALL run on-device with no network request; the glyph library and ink SHALL NOT leave the device (NFR-3). A cloud vision model MAY be used ONLY for offline validation, never as the shipped recognizer.

#### Scenario: Recognition performs no network request
- **WHEN** an expression is recognized in the shipped product
- **THEN** no ink or glyph data is transmitted off-device and recognition completes offline

### Requirement: Own-variance is evaluated, not assumed
Because a user's hand varies more than the few captured samples, the chosen recognizer SHALL be evaluated against the user's natural variation — on ink other than the exact captured strokes — not only on the samples it was built from.

#### Scenario: Recognizer is tested on fresh ink
- **WHEN** the recognizer is evaluated
- **THEN** it is measured on freshly written digits (not the stored capture samples), and own-variance failures count against it
