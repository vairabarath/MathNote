// Task §4.5 — the animated answer. Draws a result string in the user's hand,
// stroke-by-stroke at a plausible pen speed, from the captured library.
//
// Consumes a result string only; it performs NO arithmetic (glyph-replay spec).

import { useEffect, useRef, useState } from 'react'
import type { Library } from '../glyph/library'
import { resolveScene, drawStroke, drawFontGlyph, type Scene } from './replay'
import { buildTimeline, defaultTimelineOpts, type Timeline } from './timeline'
import { DEFAULT_LAYOUT } from './layout'

interface Props {
  result: string
  library: Library
  /** target glyph em height (px). */
  emPx?: number
  /** deterministic seed; change it to re-roll the handwriting. */
  seed?: number
  /** set false to render instantly (no draw-in). */
  animate?: boolean
  /** replays the animation whenever this changes. */
  playKey?: number
}

export function AnswerInk({
  result,
  library,
  emPx = DEFAULT_LAYOUT.emPx,
  seed = 1,
  animate = true,
  playKey = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scene, setScene] = useState<Scene | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  // Resolve the scene whenever the result / library / sizing changes.
  useEffect(() => {
    const s = resolveScene(result, library, { ...DEFAULT_LAYOUT, emPx, seed })
    timelineRef.current = buildTimeline(s, defaultTimelineOpts(emPx))
    setScene(s)
  }, [result, library, emPx, seed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !scene) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = scene.width * dpr
    canvas.height = scene.height * dpr
    canvas.style.width = `${scene.width}px`
    canvas.style.height = `${scene.height}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const timeline = timelineRef.current!

    const drawAt = (elapsed: number) => {
      ctx.clearRect(0, 0, scene.width, scene.height)
      for (const t of timeline.items) {
        if (elapsed >= t.endMs) {
          if (t.kind === 'stroke') drawStroke(ctx, t.item.stroke)
          else drawFontGlyph(ctx, t.item.glyph)
        } else if (elapsed > t.startMs) {
          if (t.kind === 'stroke') {
            const f = (elapsed - t.startMs) / (t.endMs - t.startMs)
            drawStroke(ctx, t.item.stroke, t.item.stroke.length * f)
          } else {
            drawFontGlyph(ctx, t.item.glyph)
          }
        }
      }
    }

    if (!animate) {
      drawAt(Infinity)
      return
    }

    startRef.current = null
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      drawAt(elapsed)
      if (elapsed < timeline.totalMs) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [scene, animate, playKey])

  return <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
}
