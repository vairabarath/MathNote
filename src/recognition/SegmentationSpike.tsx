// §1 SEGMENTATION-SPIKE GATE (design D1–D4). The recognition equivalent of the
// warp spike: implement ONLY segmentation, run it on adversarial single-line
// arithmetic, and judge boundary correctness objectively — BEFORE any recognizer
// is built. The gate outcome (§1.7) decides scope/method; nothing is committed
// before it.
//
// The objective score is a stroke→glyph PARTITION match (not a group count —
// count lets an over-split and an over-merge cancel into a right number over
// wrong boundaries). Ground truth = you label which strokes belong to which
// glyph. The gap threshold is FIXED a priori (segment.ts) and must not be tuned
// per case. Expect the wall: touching digits merging is a SUCCESSFUL finding that
// resolves the fork, not a failure to paper over.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CaptureSurface } from '../capture/CaptureSurface'
import {
  segmentBySpatialGaps,
  strokeBox,
  partitionsEqual,
  misgroupedPairs,
  type SegmentResult,
} from './segment'
import type { CaptureFrame, Stroke } from '../glyph/types'

const W = 680
const H = 240
const FRAME: CaptureFrame = { baselineY: 170, emHeight: 120 }
const GROUP_COLORS = ['#2f6feb', '#e07b39', '#2e9e5b', '#b3411a', '#7a3fb0', '#0e8a8a', '#c0392b']

const ADVERSARIAL = [
  { label: '2+2', hint: 'baseline sanity' },
  { label: '47*3', hint: 'multi-digit operands + operator spacing' },
  { label: '5+18', hint: 'mixed widths' },
  { label: 'touching digits', hint: 'e.g. two digits written close, ~no gap (the wall)' },
  { label: 'two-stroke 5', hint: 'write 5 as a top bar + a bowl (2 strokes, 1 glyph)' },
]

export function SegmentationSpike() {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [captureKey, setCaptureKey] = useState(0)
  const [truthText, setTruthText] = useState('')
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState<SegmentResult | null>(null)
  const analysisRef = useRef<HTMLCanvasElement>(null)

  const truth = parseTruth(truthText)
  const truthValid = truth !== null && truth.length === strokes.length && strokes.length > 0
  const exactMatch = truthValid && result ? partitionsEqual(result.assignment, truth!) : null
  const badPairs = truthValid && result ? misgroupedPairs(result.assignment, truth!) : []

  useEffect(() => {
    drawAnalysis(analysisRef.current, strokes, result)
  }, [strokes, result])

  function reset() {
    setStrokes([])
    setResult(null)
    setTruthText('')
    setExpr('')
    setCaptureKey((k) => k + 1)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>
          §1 Segmentation Spike <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— the recognition gate</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, maxWidth: 680 }}>
          Only segmentation is implemented — no matcher, no classifier, no solver. Write a
          single-line expression, label which strokes belong to which glyph, and Segment. The
          score is a <strong>partition match</strong> (not a group count). Run the adversarial set;
          a break on touching digits is the <em>finding</em>, not a bug.
        </p>
      </header>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          1. Write the expression (multi-stroke ok):
        </div>
        <div style={{ overflowX: 'auto' }}>
          <CaptureSurface
            key={captureKey}
            width={W}
            height={H}
            frame={FRAME}
            onStrokesChange={(s) => {
              setStrokes(s)
              setResult(null)
            }}
          />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Strokes captured: <strong>{strokes.length}</strong> (numbered in draw order below)
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          2. Ground truth — glyph id per stroke, in draw order (space/comma separated). E.g. a
          two-stroke 5 then “+” then 2 → <code>0 0 1 2</code>:
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={truthText}
            onChange={(e) => setTruthText(e.target.value)}
            placeholder={`${strokes.length} numbers, e.g. ${Array.from({ length: strokes.length }, (_, i) => i).join(' ')}`}
            style={{ ...inputStyle, width: 300 }}
          />
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="intended expression (e.g. 2+2) — for the record"
            style={{ ...inputStyle, width: 260 }}
          />
        </div>
        {truthText && !truthValid && (
          <div style={{ fontSize: 12, color: '#b3411a', marginTop: 6 }}>
            Need exactly {strokes.length} glyph-ids (one per stroke). Got {truth?.length ?? 0}.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          style={primaryBtn(strokes.length === 0)}
          disabled={strokes.length === 0}
          onClick={() => setResult(segmentBySpatialGaps(strokes))}
        >
          Segment
        </button>
        <button style={secondaryBtn} onClick={reset}>
          Clear
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          3. Detected groups (colored) + boundary boxes; stroke numbers in draw order:
        </div>
        <div style={{ overflowX: 'auto' }}>
          <canvas ref={analysisRef} style={{ display: 'block', background: '#fff', border: '1px solid var(--line)', borderRadius: 8 }} />
        </div>
        {result && (
          <div style={{ marginTop: 10, fontSize: 14 }}>
            <div>
              Detected <strong>{result.groups.length}</strong> glyph groups
              {truthValid && (
                <span style={{ color: 'var(--muted)' }}> · intended {new Set(truth!).size} (count is a glance only)</span>
              )}
            </div>
            {exactMatch !== null && (
              <div
                style={{
                  marginTop: 6,
                  fontWeight: 600,
                  color: exactMatch ? '#1c6b2e' : '#b3411a',
                }}
              >
                Partition match: {exactMatch ? 'EXACT ✓' : 'WRONG ✗'}
                {!exactMatch && (
                  <span style={{ fontWeight: 400, color: 'var(--muted)' }}>
                    {' '}— mis-grouped stroke pairs: {badPairs.map(([i, j]) => `(${i},${j})`).join(' ')}
                  </span>
                )}
              </div>
            )}
            {!truthValid && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Label the strokes above to get an objective partition score.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, borderLeft: '4px solid var(--accent)' }}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Adversarial set (§1.1) — run each, record the partition result</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
          {ADVERSARIAL.map((c) => (
            <li key={c.label}>
              <strong>{c.label}</strong> <span style={{ color: 'var(--muted)' }}>— {c.hint}</span>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
          §1.5 second eye: have someone else look at the boundary boxes. §1.7 gate: if the
          adversarial set (esp. touching digits) segments correctly → template-match is viable; if
          it breaks → decide scope-down vs classifier. Do NOT tune the gap threshold to pass.
        </p>
      </div>
    </div>
  )
}

function parseTruth(text: string): number[] | null {
  const t = text.trim()
  if (t === '') return null
  const parts = t.split(/[\s,]+/).map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  return parts
}

function drawAnalysis(canvas: HTMLCanvasElement | null, strokes: Stroke[], result: SegmentResult | null) {
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)

  // group boxes (behind ink)
  if (result) {
    result.groupBoxes.forEach((b, gid) => {
      ctx.strokeStyle = GROUP_COLORS[gid % GROUP_COLORS.length]
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(b.minX - 4, b.minY - 4, b.w + 8, b.h + 8)
      ctx.setLineDash([])
    })
  }

  strokes.forEach((s, i) => {
    const gid = result ? result.assignment[i] : -1
    ctx.strokeStyle = gid >= 0 ? GROUP_COLORS[gid % GROUP_COLORS.length] : '#16324f'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    s.points.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()
    // stroke index number at its box's top-left
    const b = strokeBox(s)
    ctx.fillStyle = '#888'
    ctx.font = '11px sans-serif'
    ctx.fillText(String(i), b.minX, b.minY - 6)
  })
}

const cardStyle: CSSProperties = {
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
}
const inputStyle: CSSProperties = {
  fontSize: 15,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  fontFamily: 'ui-monospace, Consolas, monospace',
}
const primaryBtn = (disabled: boolean): CSSProperties => ({
  padding: '9px 20px',
  fontSize: 15,
  borderRadius: 8,
  border: 'none',
  background: disabled ? '#b7c4d6' : 'var(--accent)',
  color: '#fff',
  cursor: disabled ? 'default' : 'pointer',
})
const secondaryBtn: CSSProperties = {
  padding: '9px 20px',
  fontSize: 15,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
}
