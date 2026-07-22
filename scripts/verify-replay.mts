// Headless check of the §4 replay PIPELINE (layout + pick-then-warp + width +
// draw). Builds a fake library where several symbols reuse the hand-authored "9"
// samples — this verifies the sequence pipeline, not glyph correctness.
import { createCanvas } from 'canvas'
import { writeFileSync } from 'node:fs'
import { SAMPLES_9 } from '../src/spike/samples9.ts'
import { buildGlyph } from '../src/glyph/normalize.ts'
import { resolveScene, drawSceneStatic } from '../src/replay/replay.ts'
import { DEFAULT_LAYOUT } from '../src/replay/layout.ts'
import type { Library } from '../src/glyph/library.ts'
import type { CaptureFrame } from '../src/glyph/types.ts'

const FRAME: CaptureFrame = { baselineY: 115, emHeight: 100 }
const lib: Library = {}
for (const sym of ['9', '6', '3', '5', '.', '-']) {
  lib[sym] = buildGlyph(sym, SAMPLES_9, FRAME)
}

const result = process.argv[3] ?? '-96.5'
const scene = resolveScene(result, lib, { ...DEFAULT_LAYOUT, emPx: 120, seed: 7 })

const canvas = createCanvas(Math.ceil(scene.width), Math.ceil(scene.height))
const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
ctx.fillStyle = '#fff'
ctx.fillRect(0, 0, scene.width, scene.height)
// baseline guide
ctx.strokeStyle = '#e6c0c0'
ctx.beginPath()
ctx.moveTo(0, scene.baselineY)
ctx.lineTo(scene.width, scene.baselineY)
ctx.stroke()
drawSceneStatic(ctx, scene)

const out = process.argv[2] ?? '/tmp/verify-replay.png'
writeFileSync(out, canvas.toBuffer('image/png'))
console.log('wrote', out, `(${result}, ${scene.items.length} items)`)
