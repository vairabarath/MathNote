import { describe, it, expect } from 'vitest'
import { solve, formatResult } from './solve'

describe('demo solve (arithmetic → answer-alphabet string)', () => {
  it('the flagship case: 12*8 → 96', () => {
    expect(solve('12*8')).toEqual({ ok: true, result: '96' })
  })

  it('produces decimals and negatives within the answer alphabet', () => {
    expect(solve('100/8')).toEqual({ ok: true, result: '12.5' })
    expect(solve('-7/2')).toEqual({ ok: true, result: '-3.5' })
  })

  it('rejects non-numeric / non-finite results', () => {
    expect(solve('1/0').ok).toBe(false)
    expect(solve('nope(').ok).toBe(false)
    expect(solve('').ok).toBe(false)
  })

  it('formatResult trims trailing zeros', () => {
    expect(formatResult(12.5)).toBe('12.5')
    expect(formatResult(96)).toBe('96')
    expect(formatResult(-3.5)).toBe('-3.5')
  })
})
