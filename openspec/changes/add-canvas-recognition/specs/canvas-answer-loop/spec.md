## ADDED Requirements

### Requirement: Writing `=` triggers evaluation
The system SHALL treat a handwritten `=` on the canvas as the commit trigger: it evaluates the expression written to the left of the `=` and renders the answer. Until a `=` is written, the system SHALL NOT render an answer.

#### Scenario: The equals sign commits the expression
- **WHEN** the user has written `2+2` and then writes `=`
- **THEN** the system recognizes and evaluates `2+2` and proceeds to render its answer
- **AND** before the `=` is written, no answer is rendered

### Requirement: The answer is rendered inline after the `=`
The system SHALL render the solved answer as ink positioned immediately to the right of the `=`, on the same baseline as the written expression, drawn in the user's captured hand via the replay engine.

#### Scenario: The answer appears after the equals sign
- **WHEN** the user writes `2+2=` on the canvas
- **THEN** the answer is drawn starting just to the right of the `=`, seated on the expression's baseline
- **AND** the answer ink is the user's own handwriting (captured-glyph replay), not a font

### Requirement: Deterministic solve, never an LLM
The loop SHALL compute the result with a deterministic engine (math.js for arithmetic); no language/vision model SHALL compute the answer. Recognition produces the expression; solving is deterministic; replay renders it.

#### Scenario: The result is computed deterministically
- **WHEN** a recognized expression is evaluated
- **THEN** the result comes from the deterministic solver, not from a model that pattern-matches text

### Requirement: The answer-alphabet capture gate still applies
When a required answer glyph (`0–9 . -`) is not captured, the system SHALL block and route to capture rather than font-faking the answer glyph (the D9 gate from `glyph-capture` holds inside the canvas loop). Font fallback remains for out-of-alphabet tokens only.

#### Scenario: A missing answer glyph routes to capture
- **WHEN** rendering the inline answer requires an answer-alphabet glyph the user has not captured
- **THEN** the system routes to capture for that glyph and does NOT substitute a font glyph

### Requirement: Recognition uncertainty is surfaced, never silently wrong
Because the product's promise is correctness, a **gorgeously-rendered wrong answer is the worst outcome** — it reintroduces confident-wrongness at the input end, the very thing the deterministic-solve rule forbids at the compute end. When recognition returns `unreadable` (e.g. touching multi-digit outside the supported envelope) or is low-confidence, the system SHALL surface that (show what it read / a "try spacing multi-digit numbers" hint) and SHALL NOT render an answer for input it could not confidently read.

#### Scenario: Touching multi-digit is not answered with a beautiful wrong number
- **WHEN** the written expression contains touching multi-digit the recognizer returns `unreadable` for
- **THEN** the system shows the seam ("space out multi-digit numbers"), and does NOT draw a confidently-wrong answer in the user's hand

### Requirement: The recognized reading is confirmed before the answer commits
Because no recognizer is perfect — it can confidently misread one digit for a similar one (e.g. `5`→`3`) — the system SHALL surface the recognized expression to the user and SHALL draw the answer only once the reading is confirmed correct. A misread MUST be a correctable "redo", never a silently-committed wrong answer. (The refusal seam handles "matched nothing"; this handles "matched the wrong thing".)

#### Scenario: A misread is caught before it becomes a wrong answer
- **WHEN** the recognizer reads `7+5` as `7+3`
- **THEN** the system shows "I read this as 7 + 3 — is that right?" and draws nothing
- **AND** the user can reject it and redo, so no wrong answer is ever drawn in their hand

#### Scenario: A correct reading proceeds to the answer
- **WHEN** the recognized expression shown for confirmation is correct
- **THEN** on confirmation the answer is drawn inline in the user's hand

### Requirement: The supported input envelope is legible to the user
The system SHALL communicate the current supported envelope (single-digit operands, spaced) up front, so the boundary is known rather than discovered by getting a wrong answer.

#### Scenario: The envelope is shown before failure
- **WHEN** the user is on the canvas
- **THEN** the supported envelope (single-digit, spaced) is indicated (hint/affordance), not left to be discovered via a misread
