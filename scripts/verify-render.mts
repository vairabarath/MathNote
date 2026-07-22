// Headless verification of the spike RENDERER (not a judge of the warp).
// Draws the 3 raw base "9"s, a pick-then-warp row, and an affine-stamp row to a
// PNG so the base ink can be eyeballed for "does this read as a 9 at all".
import { createCanvas } from 'canvas'
import { writeFileSync } from 'node:fs'
import { SAMPLES_9 } from '../src/spike/samples9.ts'
import { drawSample, drawWarpRow, drawStampRow, type StringLayout } from '../src/spike/render.ts'

const W = 720
const rowH = 170
const H = rowH * 3 + 20
const canvas = createCanvas(W, H)
// node-canvas ctx is runtime-compatible with CanvasRenderingContext2D
const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
ctx.fillStyle = '#ffffff'
ctx.fillRect(0, 0, W, H)

const EM = 96
// Row 1: the three raw base samples, side by side (no warp)
let x = 40
const baseY1 = rowH - 30
for (const s of SAMPLES_9) {
  const adv = drawSample(ctx, s, { x, baselineY: baseY1, emHeight: EM })
  x += adv + 40
}

// Row 2: pick-then-warp "99999"
const lay2: StringLayout = { count: 6, emHeight: EM, centerY: rowH * 2 - 55, startX: 40, advance: EM * 0.72 }
drawWarpRow(ctx, SAMPLES_9, lay2, 4242)

// Row 3: affine-only stamp "99999"
const lay3: StringLayout = { count: 6, emHeight: EM, centerY: rowH * 3 - 55, startX: 40, advance: EM * 0.72 }
drawStampRow(ctx, SAMPLES_9[0], lay3, 7373)

const out = process.argv[2] ?? '/tmp/verify-render.png'
writeFileSync(out, canvas.toBuffer('image/png'))
console.log('wrote', out)
