// ─────────────────────────────────────────────────────────────────────────────
// §1 WARP-VALIDATION SPIKE — the build gate (design D6)
// ─────────────────────────────────────────────────────────────────────────────
//
// This page renders "999999999" three ways in a randomized, UNLABELED order:
//   (a) the structured warp   (b) a handwriting web font   (c) affine-jittered stamps
// and runs a COMMIT-THEN-REVEAL blind protocol: you must assign each row a
// technique AND pick which row reads best as one hand BEFORE revealing — so
// "can you tell them apart" becomes a recorded result, not a vibe.
//
// The builder's eye is PRIMED and does not count alone (D6). This tool cannot,
// by itself, pass the gate. The honest terminal state of §1 is: harness built,
// metric computed, blind self-check recorded → then HAND OFF for the second eye
// (§1.6) and the final gate decision (§1.8). See the handoff panel at the bottom.

import '@fontsource/caveat/400.css'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SAMPLES_9 } from './samples9'
import { drawWarpRow, drawStampRow, drawFontRow, type StringLayout } from './render'
import { computeSpikeMetrics } from './residual'

type Technique = 'warp' | 'font' | 'stamp'
const TECHS: Technique[] = ['warp', 'font', 'stamp']
const LABELS: Record<Technique, string> = {
  warp: 'Structured warp (ours)',
  font: 'Handwriting web font',
  stamp: 'Affine-jittered stamp',
}
const ROW_NAMES = ['A', 'B', 'C']

const COUNT = 9
const EM = 96
const ADVANCE = EM * 0.72
const START_X = 34
const CANVAS_H = EM + 70
const CANVAS_W = START_X * 2 + COUNT * ADVANCE

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function layout(centerY: number): StringLayout {
  return { count: COUNT, emHeight: EM, centerY, startX: START_X, advance: ADVANCE }
}

function drawRow(canvas: HTMLCanvasElement, tech: Technique, seed: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = CANVAS_W * dpr
  canvas.height = CANVAS_H * dpr
  canvas.style.width = `${CANVAS_W}px`
  canvas.style.height = `${CANVAS_H}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  const lay = layout(CANVAS_H / 2)
  if (tech === 'warp') drawWarpRow(ctx, SAMPLES_9, lay, seed)
  else if (tech === 'stamp') drawStampRow(ctx, SAMPLES_9[0], lay, seed)
  else drawFontRow(ctx, '9', lay)
}

export function WarpSpike() {
  const [order, setOrder] = useState<Technique[]>(() => shuffle(TECHS))
  const [seed, setSeed] = useState(1)
  const [fontReady, setFontReady] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [guesses, setGuesses] = useState<(Technique | '')[]>(['', '', ''])
  const [bestRow, setBestRow] = useState<number | null>(null)

  const canvasRefs = [
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
  ]

  const metrics = useMemo(() => computeSpikeMetrics(SAMPLES_9[0]), [])

  // Load the handwriting font before drawing so the font control isn't blank.
  useEffect(() => {
    let alive = true
    document.fonts.load(`${EM}px "Caveat"`).then(() => {
      if (alive) setFontReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    order.forEach((tech, row) => {
      const c = canvasRefs[row].current
      if (c) drawRow(c, tech, seed * 100000 + row)
    })
    // fontReady included so the font row repaints once the font arrives
  }, [order, seed, fontReady]) // eslint-disable-line react-hooks/exhaustive-deps

  function reshuffle() {
    setOrder(shuffle(TECHS))
    setSeed((s) => s + 1)
    setRevealed(false)
    setGuesses(['', '', ''])
    setBestRow(null)
  }

  const allGuessed = guesses.every((g) => g !== '') && bestRow !== null
  const identifiedAll = order.every((tech, row) => guesses[row] === tech)
  const warpBest = bestRow !== null && order[bestRow] === 'warp'

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>
          §1 Warp-Validation Spike <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— the build gate</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 760, lineHeight: 1.5 }}>
          Same string, three techniques, unlabeled and shuffled. Decide which row is which and
          which reads best as <em>one hand</em> — <strong>before</strong> you reveal. The whole
          product rests on the warp beating a font here; if you can't tell it from the font, the
          bar is not cleared.
        </p>
      </header>

      {!fontReady && (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading handwriting font…</p>
      )}

      {order.map((_, row) => (
        <section key={row} style={cardStyle}>
          <div style={rowHeadStyle}>
            <strong style={{ fontSize: 15 }}>Row {ROW_NAMES[row]}</strong>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={ctrlLabel}>
                I think this is:
                <select
                  value={guesses[row]}
                  disabled={revealed}
                  onChange={(e) => {
                    const next = [...guesses]
                    next[row] = e.target.value as Technique
                    setGuesses(next)
                  }}
                  style={selectStyle}
                >
                  <option value="">— pick —</option>
                  {TECHS.map((t) => (
                    <option key={t} value={t}>
                      {LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label style={ctrlLabel}>
                <input
                  type="radio"
                  name="bestRow"
                  checked={bestRow === row}
                  disabled={revealed}
                  onChange={() => setBestRow(row)}
                />
                reads best as one hand
              </label>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <canvas ref={canvasRefs[row]} style={{ display: 'block' }} />
          </div>
          {revealed && (
            <div style={revealStyle(guesses[row] === order[row])}>
              Actually: <strong>{LABELS[order[row]]}</strong>
              {guesses[row] === order[row] ? '  ✓ you got it' : `  ✗ you guessed ${guesses[row] ? LABELS[guesses[row] as Technique] : '—'}`}
              {order[row] === 'warp' && bestRow === row && '  · and you judged it best'}
            </div>
          )}
        </section>
      ))}

      <div style={{ display: 'flex', gap: 12, margin: '16px 0 28px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setRevealed(true)}
          disabled={!allGuessed || revealed}
          style={primaryBtn(!allGuessed || revealed)}
        >
          Lock in &amp; reveal
        </button>
        <button onClick={reshuffle} style={secondaryBtn}>
          Reshuffle &amp; new seed
        </button>
        {!allGuessed && !revealed && (
          <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Assign all three rows and pick a "best" to enable reveal.
          </span>
        )}
      </div>

      {revealed && (
        <section style={{ ...cardStyle, background: identifiedAll && warpBest ? '#eef7ee' : '#fdf3ec' }}>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Blind self-check (§1.5) — recorded</h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
            <li>Identified all three techniques: <strong>{identifiedAll ? 'yes' : 'no'}</strong></li>
            <li>Judged the structured warp best: <strong>{warpBest ? 'yes' : 'no'}</strong></li>
          </ul>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
            {identifiedAll && warpBest
              ? 'Necessary conditions met for the builder’s blind pick — but this is the PRIMED eye and does not pass the gate alone. Proceed to the second-eye check (§1.6).'
              : 'The warp did not clearly win the blind pick. Per D6 this points back to revising the warp model (design D3) before building anything else — do not proceed on this result.'}
          </p>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>
          Measurable variation (§1.7 / D3a)
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Per-point RMS residual after best-fit affine alignment, on <em>same-base</em> pairs
          (base fixed, only the warp seed varies), as % of glyph height. The affine-only control
          reads ≈0 by construction — that contrast is the metric calibrating itself.
        </p>
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {['', 'min', 'median', 'mean', 'max'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>Structured warp</strong></td>
              <td style={tdNum}>{metrics.warp.min.toFixed(2)}%</td>
              <td style={tdNum}>{metrics.warp.median.toFixed(2)}%</td>
              <td style={tdNum}>{metrics.warp.mean.toFixed(2)}%</td>
              <td style={tdNum}>{metrics.warp.max.toFixed(2)}%</td>
            </tr>
            <tr>
              <td style={tdStyle}>Affine-only (control)</td>
              <td style={tdNum}>{metrics.affineOnly.min.toFixed(2)}%</td>
              <td style={tdNum}>{metrics.affineOnly.median.toFixed(2)}%</td>
              <td style={tdNum}>{metrics.affineOnly.mean.toFixed(2)}%</td>
              <td style={tdNum}>{metrics.affineOnly.max.toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
          The <strong>minimum perceptible variation threshold</strong> is the smallest residual
          that still reads as "different but same hand." The metric gives the axis; a human sets
          the point on it during the blind test. Record the chosen value in tasks.md §1.7.
        </p>
      </section>

      <section style={{ ...cardStyle, borderLeft: '4px solid var(--accent)' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Gate hand-off (§1.6 + §1.8)</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          The builder’s eye is primed and cannot certify this gate. To close §1:
        </p>
        <ol style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          <li>Run the blind self-check above yourself and record it (§1.5).</li>
          <li><strong>§1.6:</strong> show this shuffled page to one person who is not the builder and
            has not heard the warp theory; ask which row is which and which reads as one hand.</li>
          <li><strong>§1.7:</strong> record the minimum perceptible variation threshold in tasks.md.</li>
          <li><strong>§1.8 GATE:</strong> PASS requires all of — warp reads as one hand, beats the
            font in the blind pick, and the second person agrees. Otherwise revise the warp model
            (design D3) and repeat §1 before building §2+.</li>
        </ol>
      </section>
    </div>
  )
}

// --- inline styles -----------------------------------------------------------
const cardStyle: CSSProperties = {
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: 16,
  marginBottom: 14,
}
const rowHeadStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
  flexWrap: 'wrap',
  gap: 8,
}
const ctrlLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: 'var(--muted)',
}
const selectStyle: CSSProperties = { fontSize: 13, padding: '3px 6px' }
const thStyle: CSSProperties = {
  textAlign: 'right',
  padding: '4px 14px',
  borderBottom: '1px solid var(--line)',
  color: 'var(--muted)',
  fontWeight: 500,
}
const tdStyle: CSSProperties = { textAlign: 'left', padding: '4px 14px' }
const tdNum: CSSProperties = { textAlign: 'right', padding: '4px 14px', fontVariantNumeric: 'tabular-nums' }

function revealStyle(correct: boolean): CSSProperties {
  return {
    marginTop: 8,
    fontSize: 13,
    color: correct ? '#1c6b2e' : '#9a4a12',
  }
}
function primaryBtn(disabled: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    fontSize: 14,
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#b7c4d6' : 'var(--accent)',
    color: '#fff',
    cursor: disabled ? 'default' : 'pointer',
  }
}
const secondaryBtn: CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
}
