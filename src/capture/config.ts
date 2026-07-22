// Shared capture-surface geometry. Onboarding (§3.2) and single-sample
// re-capture (§3.4) MUST use the same guide so every glyph is normalized against
// one em height — that shared scale is what preserves relative sizes across the
// alphabet (design D7).

import type { CaptureFrame } from '../glyph/types'

export const CAPTURE_W = 340
export const CAPTURE_H = 300
export const CAPTURE_FRAME: CaptureFrame = { baselineY: 210, emHeight: 150 }
