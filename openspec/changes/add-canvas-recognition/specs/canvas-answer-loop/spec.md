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
Because the product's promise is correctness, when recognition of the expression is low-confidence or segmentation fails, the system SHALL indicate the uncertainty (e.g. show what it read, allow correction) rather than render a confidently-wrong answer.

#### Scenario: An unreadable expression is not answered confidently
- **WHEN** the written expression cannot be segmented/recognized with sufficient confidence
- **THEN** the system surfaces what it read or that it is unsure, instead of drawing a confidently-wrong answer
