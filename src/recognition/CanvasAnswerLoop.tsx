// §3 canvas answer loop (Option 1 branch). Write a single-line expression; when
// you write `=`, the LHS is recognized (template-match on your captured glyphs),
// solved deterministically (math.js), and the answer is drawn inline right after
// the `=`, on the same baseline, in your own hand — animated.
//
// Honesty seam (design D8 / §2.5): if the recognizer returns `unreadable`
// (e.g. touching multi-digit), we show a hint and draw NOTHING — never a
// gorgeous wrong answer. The supported envelope is stated up front (§2.6).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CaptureSurface } from '../capture/CaptureSurface'
import type { CaptureFrame, Stroke } from '../glyph/types'
import type { Library } from '../glyph/library'
import { findTrailingEquals, recognizeExpression } from './recognize'
import { segmentBySpatialGaps, strokeBox } from './segment'
import { solve } from '../demo/solve'
import { resolveScene, drawStroke, drawFontGlyph } from '../replay/replay'
import { buildTimeline, defaultTimelineOpts } from '../replay/timeline'
import { DEFAULT_LAYOUT } from '../replay/layout'

const W = 720
const H = 300
const FRAME: CaptureFrame = { baselineY: 200, emHeight: 120 }
const ANSWER_COLOR = '#e07b39' // orange, like the reference image

type Status = { kind: 'idle' } | { kind: 'hint'; text: string } | { kind: 'answer'; expr: string; result: string }

export function CanvasAnswerLoop({ library }: { library: Library }) {
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const answeredRef = useRef(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [captureKey, setCaptureKey] = useState(0)
  const [seed, setSeed] = useState(1)

  const clearOverlay = useCallback(() => {
    const c = overlayRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
  }, [])

  // size the overlay once
  useEffect(() => {
    const c = overlayRef.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = W * dpr
    c.height = H * dpr
    c.style.width = `${W}px`
    c.style.height = `${H}px`
    clearOverlay()
  }, [clearOverlay, captureKey])

  function reset() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    answeredRef.current = false
    setStatus({ kind: 'idle' })
    setSeed((s) => s + 1)
    setCaptureKey((k) => k + 1)
    clearOverlay()
  }

  function animateAnswer(result: string, targetX: number, baselineY: number, emPx: number) {
    const scene = resolveScene(result, library, { ...DEFAULT_LAYOUT, emPx, seed, marginX: 0 })
    if (scene.blockedMissing.length > 0) {
      setStatus({ kind: 'hint', text: `Capture ${scene.blockedMissing.join(' ')} first to draw this answer.` })
      return
    }
    const timeline = buildTimeline(scene, defaultTimelineOpts(emPx))
    const ctx = overlayRef.current!.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const dx = targetX
    const dy = baselineY - scene.baselineY

    let start: number | null = null
    const frame = (now: number) => {
      if (start === null) start = now
      const elapsed = now - start
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(dx, dy)
      for (const t of timeline.items) {
        if (elapsed >= t.endMs) {
          if (t.kind === 'stroke') drawStroke(ctx, t.item.stroke, Infinity, ANSWER_COLOR)
          else drawFontGlyph(ctx, t.item.glyph, ANSWER_COLOR)
        } else if (elapsed > t.startMs && t.kind === 'stroke') {
          const f = (elapsed - t.startMs) / (t.endMs - t.startMs)
          drawStroke(ctx, t.item.stroke, t.item.stroke.length * f, ANSWER_COLOR)
        }
      }
      ctx.restore()
      if (elapsed < timeline.totalMs) rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  function onStrokes(strokes: Stroke[]) {
    if (answeredRef.current) return
    const eq = findTrailingEquals(strokes)
    if (!eq) return
    answeredRef.current = true

    const lhsStrokes = eq.lhs.map((i) => strokes[i])
    const rec = recognizeExpression(lhsStrokes, library)
    if (!rec.ok) {
      setStatus({ kind: 'hint', text: rec.reason })
      return
    }
    const exprStr = rec.tokens.join('')
    const solved = solve(exprStr)
    if (!solved.ok) {
      setStatus({ kind: 'hint', text: `I read "${exprStr}" but couldn't solve it.` })
      return
    }

    // place the answer just right of the '=' , on the LHS baseline
    const eqStrokes = eq.equals.map((i) => strokes[i])
    const eqBoxes = eqStrokes.map(strokeBox)
    const eqMaxX = Math.max(...eqBoxes.map((b) => b.maxX))
    const lhsGroups = segmentBySpatialGaps(lhsStrokes).groupBoxes
    const heights = lhsGroups.map((b) => b.h).sort((a, b) => a - b)
    const bottoms = lhsGroups.map((b) => b.maxY).sort((a, b) => a - b)
    const emPx = heights[Math.floor(heights.length / 2)] || FRAME.emHeight
    const baselineY = bottoms[Math.floor(bottoms.length / 2)] || FRAME.baselineY
    const targetX = eqMaxX + emPx * 0.35

    setStatus({ kind: 'answer', expr: exprStr, result: solved.result })
    animateAnswer(solved.result, targetX, baselineY, emPx)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Handwrite math</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Write a single-line expression and finish with <strong>=</strong> — the answer appears
          after it, in your own hand.
        </p>
      </header>

      <div style={{ position: 'relative', width: W, height: H, maxWidth: '100%' }}>
        <CaptureSurface key={captureKey} width={W} height={H} frame={FRAME} onStrokesChange={onStrokes} />
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        />
      </div>

      <div style={{ minHeight: 26, marginTop: 8 }}>
        {status.kind === 'hint' && (
          <span style={{ color: '#9a4a12', fontSize: 14 }}>✎ {status.text}</span>
        )}
        {status.kind === 'answer' && (
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>
            Read <code>{status.expr}</code> → <strong>{status.result}</strong>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
        <button style={secondaryBtn} onClick={reset}>
          Clear
        </button>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          Supported now: <strong>single digits, spaced</strong> (e.g. <code>2 + 2 =</code>).
          Multi-digit numbers are the next upgrade.
        </span>
      </div>
    </div>
  )
}

const secondaryBtn: CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
}
