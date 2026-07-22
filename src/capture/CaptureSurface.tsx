// Task §3.1 — the Pointer Events capture surface.
//
// Captures {x, y, pressure, t} per point across one or more strokes (a glyph can
// be multi-stroke, e.g. "5"). Pen/touch pressure is recorded as-is; MOUSE input
// reports no real pressure, so it is stored as `null` and flagged for velocity-
// synthesized width at replay (glyph-capture spec / NFR-4). Coalesced events are
// drained so fast pen strokes keep their sub-frame points.

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Stroke, CaptureFrame } from '../glyph/types'

interface Props {
  width: number
  height: number
  /** guide: baseline + em height in CSS px (also the CaptureFrame passed on). */
  frame: CaptureFrame
  /** Called whenever the committed stroke set changes (after each pen-up). */
  onStrokesChange: (strokes: Stroke[]) => void
}

const INK = '#16324f'

export function CaptureSurface({ width, height, frame, onStrokesChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<Point[]>([])
  const sampleStartRef = useRef<number | null>(null)
  const drawingRef = useRef(false)

  // Reset when the surface is (re)mounted for a new capture.
  useEffect(() => {
    strokesRef.current = []
    currentRef.current = []
    sampleStartRef.current = null
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function ctx2d(): CanvasRenderingContext2D | null {
    const c = canvasRef.current
    if (!c) return null
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (c.width !== width * dpr) {
      c.width = width * dpr
      c.height = height * dpr
      c.style.width = `${width}px`
      c.style.height = `${height}px`
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return ctx
  }

  function drawStroke(ctx: CanvasRenderingContext2D, pts: Point[]) {
    if (pts.length === 0) return
    ctx.fillStyle = INK
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const p = pts[i]
      const frac = n <= 1 ? 0.5 : i / (n - 1)
      const hw = halfWidth(p.pressure, frac)
      ctx.beginPath()
      ctx.arc(p.x, p.y, hw, 0, Math.PI * 2)
      ctx.fill()
      if (i > 0) {
        const a = pts[i - 1]
        const ha = halfWidth(a.pressure, n <= 1 ? 0.5 : (i - 1) / (n - 1))
        let nx = -(p.y - a.y)
        let ny = p.x - a.x
        const len = Math.hypot(nx, ny) || 1
        nx /= len
        ny /= len
        ctx.beginPath()
        ctx.moveTo(a.x + nx * ha, a.y + ny * ha)
        ctx.lineTo(p.x + nx * hw, p.y + ny * hw)
        ctx.lineTo(p.x - nx * hw, p.y - ny * hw)
        ctx.lineTo(a.x - nx * ha, a.y - ny * ha)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  function redraw() {
    const ctx = ctx2d()
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    // guide: baseline (solid) + top-of-em (dashed)
    ctx.strokeStyle = '#d7dbe0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, frame.baselineY)
    ctx.lineTo(width, frame.baselineY)
    ctx.stroke()
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = '#e8eaee'
    ctx.beginPath()
    ctx.moveTo(0, frame.baselineY - frame.emHeight)
    ctx.lineTo(width, frame.baselineY - frame.emHeight)
    ctx.stroke()
    ctx.setLineDash([])
    for (const s of strokesRef.current) drawStroke(ctx, s.points)
    drawStroke(ctx, currentRef.current)
  }

  function pressureOf(pointerType: string, native: PointerEvent): number | null {
    // Mouse reports 0.5-when-down / 0 — not real pressure. Flag as absent so
    // replay synthesizes width from velocity instead (glyph-replay §4.4).
    if (pointerType === 'mouse') return null
    return native.pressure
  }

  function toLocalNative(native: PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (native.clientX - rect.left) * (width / rect.width),
      y: (native.clientY - rect.top) * (height / rect.height),
    }
  }

  function addPoint(e: ReactPointerEvent, native: PointerEvent) {
    const { x, y } = toLocalNative(native)
    if (sampleStartRef.current === null) sampleStartRef.current = native.timeStamp
    currentRef.current.push({
      x,
      y,
      pressure: pressureOf(e.pointerType, native),
      t: native.timeStamp - sampleStartRef.current,
    })
  }

  function onPointerDown(e: ReactPointerEvent) {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawingRef.current = true
    currentRef.current = []
    addPoint(e, e.nativeEvent)
    redraw()
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drawingRef.current) return
    const native = e.nativeEvent
    const coalesced = native.getCoalescedEvents?.() ?? []
    if (coalesced.length > 0) {
      for (const c of coalesced) addPoint(e, c)
    } else {
      addPoint(e, native)
    }
    redraw()
  }

  function endStroke() {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (currentRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, { points: currentRef.current }]
      currentRef.current = []
      onStrokesChange(strokesRef.current)
    }
    redraw()
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      style={{
        touchAction: 'none',
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 10,
        cursor: 'crosshair',
        display: 'block',
      }}
    />
  )
}

// `frac` = position along stroke; taper toward the ends.
function halfWidth(pressure: number | null, frac: number): number {
  const base = 2.6
  const p = pressure ?? 0.5
  const taper = Math.min(1, Math.sin(Math.PI * frac) * 1.7 + 0.2)
  return base * (0.5 + 0.9 * p) * taper
}
