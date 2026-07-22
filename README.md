# Math Canvas (MathNote)

A browser-based canvas where you **handwrite a math expression** and the app **recognises it, solves it deterministically, and writes the answer back in your own handwriting** — functional parity with Apple Math Notes, built entirely on free/open tooling ($0 running cost).

The defining experience is not "solve my math." It is: *the answer appears as if I wrote it myself.*

- Full vision & requirements: [`MathCanvas-Requirements.md`](./MathCanvas-Requirements.md)
- The work is planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) — spec-driven development. Plans live in `openspec/`.

## Current status

No application code yet. The first change is **fully planned and validated**, ready to implement:

**`add-glyph-capture-replay`** — capture the user's handwriting for the answer alphabet (`0–9 . -`) and replay solved answers as animated ink in their own hand. Recognition is deliberately excluded (proven later); the MVP loop is proven with **typed input** to isolate the two real risks: capture and replay-realism.

See `openspec/changes/add-glyph-capture-replay/`:
- `proposal.md` — why, what changes, scope
- `design.md` — the technical decisions and their rationale (D1–D9)
- `specs/glyph-capture/spec.md`, `specs/glyph-replay/spec.md` — the requirements
- `tasks.md` — the implementation checklist. **Start at §1 (the warp-validation spike) — it is a gate the rest of the build depends on.**

## For the person implementing this

### 1. Install OpenSpec

OpenSpec is a CLI. Install it globally with npm (Node 18+):

```bash
npm install -g @fission-ai/openspec
# verify
openspec --version
```

### 2. Get the repo

```bash
git clone https://github.com/vairabarath/MathNote.git
cd MathNote
openspec list          # should show the active change: add-glyph-capture-replay
```

### 3. Start a Claude Code session

Open Claude Code in the project directory, then tell it:

> I'm implementing the OpenSpec change `add-glyph-capture-replay`. Read `openspec/changes/add-glyph-capture-replay/` — the proposal, design, and both specs — then run `/opsx:apply add-glyph-capture-replay` and start with §1 of `tasks.md`, the warp-validation spike. **Do not build the rest of the engine until the §1 gate passes** (the warp must read as one hand, beat a handwriting font in a blind test, and pass a second person's eye).

That's it — Claude will load the plan and work through the tasks, checking them off as it goes.

### Key things to know before you start

- **§1 is a hard gate.** The whole product rests on whether synthetic stroke variation reads as human. §1 validates that in an afternoon (warp only, hand-fed samples, no solver, no UI) *before* anything is built around it. If it fails, revise the warp model (design D3) — don't push forward.
- **No recognition in the MVP.** Input is typed on purpose, so a failure is diagnosable (replay vs misread). Recognition comes in a later phase.
- **The solve engine is a separate capability.** For the demo, if it doesn't exist yet, hand-feed the result string (typed `12*8` → hand-fed `96` → replay). That still fully exercises the two things under test.
- **`v1 variation is a generic warp seeded from 3 personal samples**, *not* personal-variance learning — that's a named later upgrade. This is documented so it isn't mistaken for a bug.

### OpenSpec workflow cheat-sheet

| Command | What it does |
|---|---|
| `openspec list` | Show active changes |
| `openspec show add-glyph-capture-replay` | View the change |
| `openspec validate add-glyph-capture-replay` | Check artifacts are well-formed |
| `/opsx:apply <change>` | (in Claude) Implement the tasks |
| `/opsx:update <change>` | (in Claude) Revise the plan without writing code |
| `/opsx:archive <change>` | (in Claude) After implementation, fold specs into `openspec/specs/` |
