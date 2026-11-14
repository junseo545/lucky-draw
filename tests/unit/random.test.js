import { describe, expect, it } from 'vitest'
import { randomBetween, randomFloat, randomInt, randomPick } from '../../src/lib/random.js'

describe('random', () => {
  it('randomInt stays in range and hits every value', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i += 1) {
      const v = randomInt(7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(7)
      seen.add(v)
    }
    expect(seen.size).toBe(7)
  })

  it('randomInt rejects bad bounds', () => {
    expect(() => randomInt(0)).toThrow()
    expect(() => randomInt(1.5)).toThrow()
  })

  it('randomFloat and randomBetween stay in range', () => {
    for (let i = 0; i < 2000; i += 1) {
      const f = randomFloat()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const b = randomBetween(0.12, 0.88)
      expect(b).toBeGreaterThanOrEqual(0.12)
      expect(b).toBeLessThan(0.88)
    }
  })

  it('randomPick returns a member', () => {
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 100; i += 1) expect(items).toContain(randomPick(items))
    expect(() => randomPick([])).toThrow()
  })
})
