// Task §4.5 — schedule the animated draw-in.
//
// Design decision (resolving an Open Question): pace by a NORMALIZED pen speed
// (arc length ÷ target speed), not by the captured `t`. So the answer always
// draws in at a consistent, plausible speed regardless of how fast the user
// happened to write during onboarding. (Captured `t` is still used — for
// velocity-synthesized width, §4.4 — just not for playback pacing.)

import type { Scene, DrawItem } from './replay'

export type TimedItem =
  | { kind: 'stroke'; item: Extract<DrawItem, { kind: 'stroke' }>; startMs: number; endMs: number }
  | { kind: 'font'; item: Extract<DrawItem, { kind: 'font' }>; startMs: number; endMs: number }

export interface Timeline {
  items: TimedItem[]
  totalMs: number
}

export interface TimelineOpts {
  penSpeedPxPerMs: number
  itemGapMs: number
  minStrokeMs: number
  fontMs: number
}

export function defaultTimelineOpts(emPx: number): TimelineOpts {
  return {
    penSpeedPxPerMs: emPx * 0.015,
    itemGapMs: 55,
    minStrokeMs: 90,
    fontMs: 140,
  }
}

export function buildTimeline(scene: Scene, opts: TimelineOpts): Timeline {
  const items: TimedItem[] = []
  let cursor = 0
  for (const item of scene.items) {
    if (item.kind === 'stroke') {
      const dur = Math.max(opts.minStrokeMs, item.stroke.length / opts.penSpeedPxPerMs)
      items.push({ kind: 'stroke', item, startMs: cursor, endMs: cursor + dur })
      cursor += dur + opts.itemGapMs
    } else {
      items.push({ kind: 'font', item, startMs: cursor, endMs: cursor + opts.fontMs })
      cursor += opts.fontMs + opts.itemGapMs
    }
  }
  return { items, totalMs: Math.max(0, cursor - opts.itemGapMs) }
}
