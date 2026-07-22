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
import { MagicLoopDemo } from './demo/MagicLoopDemo'
import { WarpSpike } from './spike/WarpSpike'
import { SegmentationSpike } from './recognition/SegmentationSpike'
import { getLibrary, clearLibrary } from './glyph/storage'
import { isOnboardingComplete, type Library } from './glyph/library'

type Route = 'home' | 'review' | 'spike' | 'segspike'

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

  if (route === 'segspike') {
    return (
      <div>
        <BackBar onBack={() => setRoute('home')} label="← back to app" />
        <SegmentationSpike />
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
    <div>
      <MagicLoopDemo library={library} onNeedCapture={() => setRoute('review')} />
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
        <button style={linkBtn} onClick={() => setRoute('review')}>
          Review / edit my handwriting
        </button>
        <button style={linkBtn} onClick={() => setRoute('spike')}>
          Warp spike (dev)
        </button>
        <button style={linkBtn} onClick={() => setRoute('segspike')}>
          Segmentation spike (dev)
        </button>
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

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: 14,
  padding: 0,
}
