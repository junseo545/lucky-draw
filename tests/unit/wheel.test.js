import { describe, expect, it } from 'vitest'
import {
  BLANK_ID,
  EDGE_MARGIN,
  buildSegments,
  mod,
  planSpin,
  rotationToShow,
  segmentIndexAt,
  segmentWidth,
  spinEase,
} from '../../src/lib/wheel.js'

describe('buildSegments', () => {
  it('one segment per prize type with stock, plus one blank at the end', () => {
    const segs = buildSegments(
      [
        { id: 'g1', name: 'A', left: 2 },
        { id: 'g2', name: 'B', left: 0 },
        { id: 'g3', name: 'C', left: 1 },
      ],
      '다음 기회에',
    )
    expect(segs.map((s) => s.id)).toEqual(['g1', 'g3', BLANK_ID])
    expect(segs[2]).toMatchObject({ kind: 'blank', name: '다음 기회에' })
  })
})

describe('segmentIndexAt', () => {
  it('maps rotations to the segment under the 12 o-clock pointer', () => {
    // 4 segments of 90 degrees. Rotation 0: frame angle 0 is under the pointer.
    expect(segmentIndexAt(0, 4)).toBe(0)
    // Rotating clockwise by 10 brings frame angle 350 (segment 3) under the pointer.
    expect(segmentIndexAt(10, 4)).toBe(3)
    expect(segmentIndexAt(-10, 4)).toBe(0)
    expect(segmentIndexAt(-100, 4)).toBe(1)
    expect(segmentIndexAt(3600 - 135, 4)).toBe(1)
  })

  it('rotationToShow puts the requested frame angle under the pointer', () => {
    for (let i = 0; i < 1000; i += 1) {
      const frame = (i * 37.3) % 360
      const from = (i * 91.7) % 720
      const r = rotationToShow(frame, from, 5)
      expect(r).toBeGreaterThanOrEqual(from + 5 * 360)
      expect(r).toBeLessThan(from + 6 * 360)
      expect(mod(-r, 360)).toBeCloseTo(frame, 6)
    }
  })
})

describe('planSpin', () => {
  it('lands inside the chosen segment, away from its edges', () => {
    for (const count of [2, 3, 4, 7, 12, 31]) {
      const w = segmentWidth(count)
      let from = 0
      for (let i = 0; i < 2000; i += 1) {
        const plan = planSpin({ fromRotation: from, count })
        expect(segmentIndexAt(plan.targetRotation, count)).toBe(plan.index)
        const within = mod(-plan.targetRotation, 360) - plan.index * w
        expect(within).toBeGreaterThanOrEqual(EDGE_MARGIN * w - 1e-6)
        expect(within).toBeLessThanOrEqual((1 - EDGE_MARGIN) * w + 1e-6)
        expect(plan.targetRotation).toBeGreaterThan(from)
        expect(plan.duration).toBeGreaterThanOrEqual(4000)
        expect(plan.duration).toBeLessThanOrEqual(6000)
        from = mod(plan.targetRotation, 360)
      }
    }
  })

  it('reduced motion spins for 1 second', () => {
    const plan = planSpin({ fromRotation: 0, count: 4, reducedMotion: true })
    expect(plan.duration).toBe(1000)
    expect(segmentIndexAt(plan.targetRotation, 4)).toBe(plan.index)
  })

  it('fairness: 4 segments, 10,000 headless draws, each lands 22-28%', () => {
    const N = 10000
    const counts = [0, 0, 0, 0]
    let from = 0
    for (let i = 0; i < N; i += 1) {
      const plan = planSpin({ fromRotation: from, count: 4 })
      // Judge by where the wheel stops, the same way the screen does.
      counts[segmentIndexAt(plan.targetRotation, 4)] += 1
      from = mod(plan.targetRotation, 360)
    }
    for (const c of counts) {
      expect(c / N).toBeGreaterThanOrEqual(0.22)
      expect(c / N).toBeLessThanOrEqual(0.28)
    }
  })
})

describe('spinEase', () => {
  it('is monotonic from 0 to 1 and stops smoothly', () => {
    let prev = 0
    for (let i = 1; i <= 100; i += 1) {
      const v = spinEase(i / 100)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
    expect(spinEase(0)).toBe(0)
    expect(spinEase(1)).toBe(1)
    // Velocity near the end is far lower than at the start.
    const vStart = spinEase(0.01) - spinEase(0)
    const vEnd = spinEase(1) - spinEase(0.99)
    expect(vEnd).toBeLessThan(vStart / 100)
  })
})
