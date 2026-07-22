// Converts the spec's headline anti-font bound into a measurable check:
// "consecutive identical result digits SHALL differ by at least the minimum
// perceptible variation threshold T" (glyph-replay §Pick-then-warp; T = 1.0%
// residual-after-best-fit-affine, task §1.7).
//
// We render a long run of "9", find consecutive instances that landed on the
// SAME base sample (where the bound is non-trivial — different bases differ
// anyway), and assert each such pair's residual-after-affine ≥ T. This guards the
// argument made in the §1.7 note (distinct seeds + warp.min 1.19% > T) at the
// actual replay level, using real captured-shape samples run through the warp.

import { describe, it, expect } from 'vitest'
import { SAMPLES_9 } from '../spike/samples9'
import { buildGlyph } from '../glyph/normalize'
import { layoutResult, DEFAULT_LAYOUT, type InkInstance } from './layout'
import { warpSample } from '../warp/warp'
import { residualAfterAffine } from '../spike/residual'
import type { CaptureFrame } from '../glyph/types'
import type { Library } from '../glyph/library'

const T = 1.0 // minimum perceptible variation threshold, % of glyph height (§1.7)
const FRAME: CaptureFrame = { baselineY: 115, emHeight: 100 }

function nineLibrary(): Library {
  return { '9': buildGlyph('9', SAMPLES_9, FRAME) }
}

describe('replay variation meets the spec bound (§glyph-replay / §1.7)', () => {
  it('consecutive same-base instances differ by at least T', () => {
    const lib = nineLibrary()
    const glyph = lib['9']
    const { instances } = layoutResult('999999999999', lib, { ...DEFAULT_LAYOUT, seed: 3 })
    const ink = instances.filter((i): i is InkInstance => i.kind === 'ink')

    let sameBasePairs = 0
    for (let i = 1; i < ink.length; i++) {
      if (ink[i].sampleIndex !== ink[i - 1].sampleIndex) continue
      sameBasePairs++
      const a = warpSample(glyph.samples[ink[i - 1].sampleIndex], ink[i - 1].warpSeed)
      const b = warpSample(glyph.samples[ink[i].sampleIndex], ink[i].warpSeed)
      const residualPct = residualAfterAffine(a, b) * 100
      expect(residualPct).toBeGreaterThanOrEqual(T)
    }
    // guard against a vacuous pass: some consecutive pair must share a base
    expect(sameBasePairs).toBeGreaterThan(0)
  })

  it('any two distinct warps of one sample are more than affine apart', () => {
    const glyph = nineLibrary()['9']
    const a = warpSample(glyph.samples[0], 111)
    const b = warpSample(glyph.samples[0], 222)
    // residual after removing the best global affine is non-trivial (not a stamp)
    expect(residualAfterAffine(a, b) * 100).toBeGreaterThanOrEqual(T)
  })
})
