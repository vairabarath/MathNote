// Tasks §5.2–§5.4 — the typed-input magic-loop demo (isolation harness).
//
// The whole path: TYPED expression → deterministic solve (math.js) → result
// string → replay engine draws it in the user's hand, animated. There is NO
// recognition anywhere — input is typed on purpose (design D1) so the only things
// exercised are A (capture) and B (replay realism). If replay looks wrong, it is
// unambiguously capture or replay, never a misread digit.

import { useMemo, useState, type CSSProperties } from 'react'
import type { Library } from '../glyph/library'
import { classifyResultCoverage } from '../glyph/library'
import { solve } from './solve'
import { AnswerInk } from '../replay/AnswerInk'

interface Props {
  library: Library
  onNeedCapture?: () => void
}

export function MagicLoopDemo({ library, onNeedCapture }: Props) {
  const [expr, setExpr] = useState('12*8')
  const [submitted, setSubmitted] = useState<{ expr: string; result: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seed, setSeed] = useState(1)
  const [playKey, setPlayKey] = useState(0)

  // D9 gate: which glyphs of the current result can't be drawn from captured ink.
  const coverage = useMemo(
    () => (submitted ? classifyResultCoverage(submitted.result, library) : null),
    [submitted, library],
  )

  function run() {
    const res = solve(expr)
    if (!res.ok) {
      setError(res.error)
      setSubmitted(null)
      return
    }
    setError(null)
    setSubmitted({ expr: expr.trim(), result: res.result })
    setPlayKey((k) => k + 1)
  }

  const blocked = coverage && coverage.blocking.length > 0

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Type some math</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>
        …and watch the answer appear in your own handwriting. Input is typed on
        purpose — no recognition, so what you’re judging is purely the replay.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
        style={{ display: 'flex', gap: 8, justifyContent: 'center' }}
      >
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="12*8"
          style={inputStyle}
          aria-label="expression"
        />
        <button type="submit" style={primaryBtn}>
          Solve
        </button>
      </form>

      {error && <p style={{ color: '#b3411a', fontSize: 14, marginTop: 12 }}>{error}</p>}

      {submitted && (
        <div style={{ marginTop: 24 }}>
          <div style={{ color: 'var(--muted)', fontSize: 18, marginBottom: 6 }}>
            {submitted.expr} =
          </div>

          {blocked ? (
            <div style={gateBox}>
              <p style={{ margin: '0 0 8px' }}>
                Can’t draw <strong>{coverage!.blocking.join(' ')}</strong> yet — that
                answer glyph isn’t captured. (It’s never font-faked, per the design.)
              </p>
              {onNeedCapture && (
                <button style={primaryBtn} onClick={onNeedCapture}>
                  Capture it
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AnswerInk
                  result={submitted.result}
                  library={library}
                  emPx={120}
                  seed={seed}
                  playKey={playKey}
                />
              </div>
              {coverage && coverage.fallback.length > 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                  {coverage.fallback.join(' ')} drawn via font fallback (out of the
                  answer alphabet) — flagged for capture.
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <button style={secondaryBtn} onClick={() => setPlayKey((k) => k + 1)}>
                  Replay
                </button>
                <button style={secondaryBtn} onClick={() => { setSeed((s) => s + 1); setPlayKey((k) => k + 1) }}>
                  New handwriting
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle: CSSProperties = {
  fontSize: 18,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  width: 220,
  fontFamily: 'ui-monospace, Consolas, monospace',
}
const primaryBtn: CSSProperties = {
  padding: '9px 20px',
  fontSize: 15,
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
}
const secondaryBtn: CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
}
const gateBox: CSSProperties = {
  background: '#fdf3ec',
  border: '1px solid #f0d0b8',
  borderRadius: 10,
  padding: 16,
  fontSize: 14,
}
