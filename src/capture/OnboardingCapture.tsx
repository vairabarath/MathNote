// Tasks §3.2 / §3.3 — first-run capture of the answer alphabet.
//
// Framed as the product's opening hook ("write these so I can learn your hand"),
// not as configuration. Collects exactly SAMPLES_PER_GLYPH samples for each of
// the 12 answer-alphabet glyphs, normalizes each capture (§2.2) and writes it
// into the local library (§2.3). A glyph can be multi-stroke — the surface
// accumulates strokes until the user hits Next.

import { useRef, useState, type CSSProperties } from 'react'
import { CaptureSurface } from './CaptureSurface'
import {
  ANSWER_ALPHABET,
  SAMPLES_PER_GLYPH,
  type Sample,
  type Stroke,
} from '../glyph/types'
import { buildGlyph } from '../glyph/normalize'
import { putGlyph } from '../glyph/storage'
import { CAPTURE_W as W, CAPTURE_H as H, CAPTURE_FRAME as FRAME } from './config'

export function OnboardingCapture({ onComplete }: { onComplete: () => void }) {
  const [glyphIndex, setGlyphIndex] = useState(0)
  const [sampleIndex, setSampleIndex] = useState(0)
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [captureKey, setCaptureKey] = useState(0)

  const rawSamplesRef = useRef<Sample[]>([]) // samples collected for current glyph
  const latestStrokesRef = useRef<Stroke[]>([])

  const symbol = ANSWER_ALPHABET[glyphIndex]
  const totalGlyphs = ANSWER_ALPHABET.length

  function resetSurface() {
    latestStrokesRef.current = []
    setHasInk(false)
    setCaptureKey((k) => k + 1)
  }

  async function onNext() {
    if (!hasInk || busy) return
    setBusy(true)
    try {
      rawSamplesRef.current = [
        ...rawSamplesRef.current,
        { strokes: latestStrokesRef.current },
      ]

      if (rawSamplesRef.current.length >= SAMPLES_PER_GLYPH) {
        // glyph complete → normalize + persist, then advance
        const glyph = buildGlyph(symbol, rawSamplesRef.current, FRAME)
        await putGlyph(glyph)
        rawSamplesRef.current = []
        if (glyphIndex + 1 >= totalGlyphs) {
          onComplete()
          return
        }
        setGlyphIndex((i) => i + 1)
        setSampleIndex(0)
      } else {
        setSampleIndex((i) => i + 1)
      }
      resetSurface()
    } finally {
      setBusy(false)
    }
  }

  const overallDone = glyphIndex * SAMPLES_PER_GLYPH + sampleIndex
  const overallTotal = totalGlyphs * SAMPLES_PER_GLYPH

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Teach me your hand ✍️</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Write each of these three times, so I really get your style. This is
          exactly how your answers will appear — in your own handwriting.
        </p>
      </header>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 15, color: 'var(--muted)' }}>
          Write this {ordinal(sampleIndex + 1)} time
        </div>
        <div style={{ fontSize: 72, lineHeight: 1, fontWeight: 600, margin: '4px 0' }}>
          {displaySymbol(symbol)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Glyph {glyphIndex + 1}/{totalGlyphs} · sample {sampleIndex + 1}/
          {SAMPLES_PER_GLYPH}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <CaptureSurface
          key={captureKey}
          width={W}
          height={H}
          frame={FRAME}
          onStrokesChange={(s) => {
            latestStrokesRef.current = s
            setHasInk(s.length > 0)
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
        <button onClick={resetSurface} disabled={busy} style={secondaryBtn}>
          Clear
        </button>
        <button onClick={onNext} disabled={!hasInk || busy} style={primaryBtn(!hasInk || busy)}>
          {isLastCapture(glyphIndex, sampleIndex, totalGlyphs) ? 'Finish' : 'Next'}
        </button>
      </div>

      <div style={progressTrackStyle}>
        <div style={{ ...progressFillStyle, width: `${(overallDone / overallTotal) * 100}%` }} />
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        {overallDone} / {overallTotal} captured · draw multiple strokes if you
        like (e.g. a two-stroke 5) — tap Next when the glyph is done
      </p>
    </div>
  )
}

function isLastCapture(gi: number, si: number, total: number): boolean {
  return gi === total - 1 && si === SAMPLES_PER_GLYPH - 1
}

function displaySymbol(sym: string): string {
  if (sym === '-') return '−' // render a clear minus, not a hyphen tick
  return sym
}

function ordinal(n: number): string {
  return n === 1 ? 'first' : n === 2 ? 'second' : 'third'
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
const progressTrackStyle: CSSProperties = {
  height: 6,
  background: '#e2e5ea',
  borderRadius: 3,
  marginTop: 18,
  overflow: 'hidden',
}
const progressFillStyle: CSSProperties = {
  height: '100%',
  background: 'var(--accent)',
  transition: 'width 0.2s',
}
