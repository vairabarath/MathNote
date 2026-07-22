// Demo solve — task §5.1.
//
// SCOPE HONESTY: the full deterministic *solve capability* (variables, units,
// SymPy symbolic) is a SEPARATE capability, out of this change. This change is
// about capture (A) + replay (B); the solver is never what's under test. Here we
// use math.js — the committed free-stack arithmetic evaluator (Requirements §6) —
// purely as the demo's result source. Per task §5.1 you could equally hand-feed
// the result ("96"); the loop exercises A and B either way, with NO recognition
// anywhere in the path.

import { evaluate } from 'mathjs'

export type SolveResult =
  | { ok: true; result: string }
  | { ok: false; error: string }

/** Format a number into a plain answer-alphabet string (0–9 . -). */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n)) return String(n)
  // trim to 4 decimals, drop trailing zeros
  return String(parseFloat(n.toFixed(4)))
}

/** Evaluate a typed arithmetic expression to a plain-number result string. */
export function solve(expression: string): SolveResult {
  const expr = expression.trim()
  if (expr === '') return { ok: false, error: 'Type an expression, e.g. 12*8' }
  let value: unknown
  try {
    value = evaluate(expr)
  } catch {
    return { ok: false, error: `Couldn't evaluate "${expr}"` }
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: 'Result is not a plain number' }
  }
  return { ok: true, result: formatResult(value) }
}
