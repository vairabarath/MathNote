// Task §3.4 — review captured glyphs and re-capture a single sample.
//
// Re-capture replaces ONLY the targeted sample (via normalize.replaceSample →
// storage.putGlyph); the other glyphs and samples are untouched.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CaptureSurface } from './CaptureSurface'
import { CAPTURE_W, CAPTURE_H, CAPTURE_FRAME } from './config'
import { ANSWER_ALPHABET, type Sample, type Stroke } from '../glyph/types'
import { replaceSample } from '../glyph/normalize'
import { getLibrary, putGlyph } from '../glyph/storage'
import type { Library } from '../glyph/library'
import { drawSample } from '../spike/render'

type Mode =
  | { view: 'grid' }
  | { view: 'recapture'; symbol: string; sampleIdx: number }

export function CaptureReview({ onDone }: { onDone?: () => void }) {
  const [library, setLibrary] = useState<Library>({})
  const [mode, setMode] = useState<Mode>({ view: 'grid' })
  const latestStrokesRef = useRef<Stroke[]>([])
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function reload() {
    setLibrary(await getLibrary())
  }
  useEffect(() => {
    void reload()
  }, [])

  async function saveRecapture() {
    if (mode.view !== 'recapture' || !hasInk || busy) return
    setBusy(true)
    try {
      const glyph = library[mode.symbol]
      const raw: Sample = { strokes: latestStrokesRef.current }
      const updated = replaceSample(glyph, mode.sampleIdx, raw, CAPTURE_FRAME)
      await putGlyph(updated)
      await reload()
      latestStrokesRef.current = []
      setHasInk(false)
      setMode({ view: 'grid' })
    } finally {
      setBusy(false)
    }
  }

  if (mode.view === 'recapture') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20 }}>
          Rewrite sample {mode.sampleIdx + 1} of “{display(mode.symbol)}”
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <CaptureSurface
            width={CAPTURE_W}
            height={CAPTURE_H}
            frame={CAPTURE_FRAME}
            onStrokesChange={(s) => {
              latestStrokesRef.current = s
              setHasInk(s.length > 0)
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
          <button style={secondaryBtn} disabled={busy} onClick={() => setMode({ view: 'grid' })}>
            Cancel
          </button>
          <button style={primaryBtn(!hasInk || busy)} disabled={!hasInk || busy} onClick={saveRecapture}>
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Your handwriting library</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Tap any sample to rewrite it — only that one is replaced.
        </p>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {ANSWER_ALPHABET.map((sym) => (
          <div key={sym} style={cardStyle}>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{display(sym)}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {library[sym]?.samples.map((s, i) => (
                <button
                  key={i}
                  title={`Rewrite sample ${i + 1}`}
                  onClick={() => setMode({ view: 'recapture', symbol: sym, sampleIdx: i })}
                  style={sampleBtn}
                >
                  <GlyphPreview sample={s} />
                </button>
              )) ?? <span style={{ color: 'var(--muted)', fontSize: 13 }}>not captured</span>}
            </div>
          </div>
        ))}
      </div>
      {onDone && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button style={primaryBtn(false)} onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}

function GlyphPreview({ sample }: { sample: Sample }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const w = 54
    const h = 64
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = w * dpr
    c.height = h * dpr
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    drawSample(ctx, sample, { x: 12, baselineY: h - 12, emHeight: h - 22 })
  }, [sample])
  return <canvas ref={ref} style={{ display: 'block' }} />
}

function display(sym: string): string {
  return sym === '-' ? '−' : sym
}

const cardStyle: CSSProperties = {
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: 12,
}
const sampleBtn: CSSProperties = {
  padding: 2,
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 8,
  cursor: 'pointer',
}
const primaryBtn = (disabled: boolean): CSSProperties => ({
  padding: '10px 22px',
  fontSize: 15,
  borderRadius: 8,
  border: 'none',
  background: disabled ? '#b7c4d6' : 'var(--accent)',
  color: '#fff',
  cursor: disabled ? 'default' : 'pointer',
})
const secondaryBtn: CSSProperties = {
  padding: '10px 22px',
  fontSize: 15,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
}
