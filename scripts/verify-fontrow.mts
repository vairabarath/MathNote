// Verify the FONT control row (the bar the warp must beat) and check that all
// three rows seat at the same visual height + center. node-canvas can't parse
// .woff/.woff2 glyphs, so this expects a decompressed caveat.ttf path in argv[3]
// (produced via wawoff2). In the BROWSER the woff2 renders natively — this is
// only the headless self-check.
import { createCanvas, registerFont } from 'canvas'
import { writeFileSync } from 'node:fs'
import { drawWarpRow, drawStampRow, drawFontRow, type StringLayout } from '../src/spike/render.ts'
import { SAMPLES_9 } from '../src/spike/samples9.ts'

const outPng = process.argv[2] ?? '/tmp/verify-fontrow.png'
const ttf = process.argv[3]
if (ttf) {
  registerFont(ttf, { family: 'Caveat' })
  console.log('registered', ttf)
}

const W = 720
const rowH = 150
const H = rowH * 3 + 20
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
ctx.fillStyle = '#fff'
ctx.fillRect(0, 0, W, H)

const EM = 96
const rows: Array<'warp' | 'font' | 'stamp'> = ['warp', 'font', 'stamp']
rows.forEach((tech, i) => {
  const centerY = rowH * i + rowH / 2
  // center + half-em guide lines to check equal height/seating
  ctx.strokeStyle = '#e6c0c0'
  for (const gy of [centerY - EM / 2, centerY, centerY + EM / 2]) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }
  const lay: StringLayout = { count: 6, emHeight: EM, centerY, startX: 40, advance: EM * 0.72 }
  if (tech === 'warp') drawWarpRow(ctx, SAMPLES_9, lay, 4242)
  else if (tech === 'stamp') drawStampRow(ctx, SAMPLES_9[0], lay, 7373)
  else drawFontRow(ctx, '9', lay)
  ctx.fillStyle = '#999'
  ctx.font = '13px sans-serif'
  ctx.fillText(tech, W - 70, rowH * i + 22)
})

writeFileSync(outPng, canvas.toBuffer('image/png'))
console.log('wrote', outPng)
