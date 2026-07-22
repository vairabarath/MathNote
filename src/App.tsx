// App shell. Routes between first-run onboarding, the handwriting-library review,
// and the (dev) warp spike.
//
// §3.5 hard gate (design D9): the app cannot be used until the answer alphabet is
// fully captured — if onboarding is incomplete, the ONLY reachable screen is
// capture. There is no font-fallback path for a missing answer glyph; font
// fallback is reserved for out-of-alphabet tokens (§4.6). The per-result split is
// `classifyResultCoverage` (glyph/library.ts), consumed by the §5 demo.

import { useEffect, useState, type CSSProperties } from 'react'
import { OnboardingCapture } from './capture/OnboardingCapture'
import { CaptureReview } from './capture/CaptureReview'
import { WarpSpike } from './spike/WarpSpike'
import { getLibrary, clearLibrary } from './glyph/storage'
import { isOnboardingComplete, type Library } from './glyph/library'

type Route = 'home' | 'review' | 'spike'

export function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [route, setRoute] = useState<Route>('home')

  async function reload() {
    setLibrary(await getLibrary())
  }
  useEffect(() => {
    void reload()
  }, [])

  if (route === 'spike') {
    return (
      <div>
        <BackBar onBack={() => setRoute('home')} label="← back to app" />
        <WarpSpike />
      </div>
    )
  }

  if (library === null) {
    return <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading…</p>
  }

  // §3.5 gate: incomplete answer alphabet → capture is the only way forward.
  if (!isOnboardingComplete(library)) {
    return <OnboardingCapture onComplete={reload} />
  }

  if (route === 'review') {
    return (
      <div>
        <BackBar onBack={() => setRoute('home')} label="← home" />
        <CaptureReview onDone={() => setRoute('home')} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Your hand is ready ✍️</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
        The full answer alphabet (0–9 . −) is captured. Answers will be drawn back
        in your handwriting. The typed magic-loop demo lands in §5.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        <button style={primaryBtn} onClick={() => setRoute('review')}>
          Review / edit my handwriting
        </button>
        <button style={secondaryBtn} onClick={() => setRoute('spike')}>
          Open warp spike (dev)
        </button>
      </div>
      <div style={{ marginTop: 24 }}>
        <button
          style={linkBtn}
          onClick={async () => {
            if (confirm('Delete your local handwriting library and re-run onboarding?')) {
              await clearLibrary()
              await reload()
            }
          }}
        >
          Reset my handwriting (dev)
        </button>
      </div>
    </div>
  )
}

function BackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={onBack} style={linkBtn}>
        {label}
      </button>
    </div>
  )
}

const primaryBtn: CSSProperties = {
  padding: '10px 22px',
  fontSize: 15,
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
}
const secondaryBtn: CSSProperties = {
  padding: '10px 22px',
  fontSize: 15,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
}
const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: 14,
  padding: 0,
}
