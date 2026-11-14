import { describe, expect, it } from 'vitest'
import {
  beginSpin,
  blanks,
  callRandom,
  canSpin,
  chooseParticipant,
  commitSpin,
  createSession,
  isFinished,
  leftoverPrizes,
  segmentsOf,
  undoLast,
  winners,
} from '../../src/lib/draw.js'
import { BLANK_ID, mod, segmentIndexAt } from '../../src/lib/wheel.js'

function session(overrides = {}) {
  return createSession({
    names: Array.from({ length: 10 }, (_, i) => `사람${i + 1}`),
    prizes: [
      { name: '에어팟', qty: 2 },
      { name: '상품권', qty: 1 },
      { name: '머그컵', qty: 3 },
    ],
    blankLabel: '꽝',
    blankPolicy: 'exclude',
    turnMode: 'random',
    ...overrides,
  })
}

/** Run one full draw for whoever gets called. */
function drawOnce(s) {
  s = callRandom(s)
  s = beginSpin(s)
  return commitSpin(s)
}

describe('session setup', () => {
  it('wheel has one segment per prize type plus the blank', () => {
    const s = session()
    expect(segmentsOf(s).map((x) => x.name)).toEqual(['에어팟', '상품권', '머그컵', '꽝'])
  })

  it('cannot spin without a current participant', () => {
    const s = session()
    expect(canSpin(s)).toBe(false)
    expect(beginSpin(s)).toBe(s)
  })
})

describe('spin and commit', () => {
  it('the recorded result is the segment the wheel stops on', () => {
    let s = session({ blankPolicy: 'keep', names: Array.from({ length: 2000 }, (_, i) => `p${i}`) })
    s = { ...s, prizes: s.prizes.map((p) => ({ ...p, total: 1000, left: 1000 })) }
    for (let i = 0; i < 500; i += 1) {
      s = callRandom(s)
      s = beginSpin(s)
      const p = s.pending
      const shown = p.segments[segmentIndexAt(p.targetRotation, p.segments.length)]
      s = commitSpin(s)
      expect(s.lastResult.segmentId).toBe(shown.id)
      expect(segmentIndexAt(s.rotation, p.segments.length)).toBe(p.index)
    }
  })

  it('a second beginSpin while pending is ignored', () => {
    let s = callRandom(session())
    s = beginSpin(s)
    const again = beginSpin(s)
    expect(again).toBe(s)
    s = commitSpin(s)
    expect(s.log).toHaveLength(1)
    expect(commitSpin(s)).toBe(s)
  })

  it('a prize win decrements stock and removes the winner from the pool', () => {
    let s = session()
    for (let guard = 0; guard < 1000; guard += 1) {
      const next = drawOnce(s)
      if (next.lastResult.kind === 'prize') {
        const won = next.prizes.find((p) => p.id === next.lastResult.prizeId)
        const before = s.prizes.find((p) => p.id === next.lastResult.prizeId)
        expect(won.left).toBe(before.left - 1)
        expect(next.remaining).not.toContain(next.lastResult.participantId)
        return
      }
      s = session()
    }
    throw new Error('no prize won in 1000 tries')
  })

  it('a prize with quantity 1 leaves the wheel once won', () => {
    for (let guard = 0; guard < 2000; guard += 1) {
      const s = drawOnce(session())
      if (s.lastResult.prizeName === '상품권') {
        expect(segmentsOf(s).map((x) => x.name)).toEqual(['에어팟', '머그컵', '꽝'])
        return
      }
    }
    throw new Error('상품권 never won')
  })

  it('blank with policy exclude removes the participant', () => {
    for (let guard = 0; guard < 2000; guard += 1) {
      const s = drawOnce(session({ blankPolicy: 'exclude' }))
      if (s.lastResult.kind === 'blank') {
        expect(s.remaining).not.toContain(s.lastResult.participantId)
        expect(s.prizes.map((p) => p.left)).toEqual([2, 1, 3])
        return
      }
    }
    throw new Error('blank never hit')
  })

  it('blank with policy keep leaves the participant in the pool', () => {
    for (let guard = 0; guard < 2000; guard += 1) {
      const s = drawOnce(session({ blankPolicy: 'keep' }))
      if (s.lastResult.kind === 'blank') {
        expect(s.remaining).toContain(s.lastResult.participantId)
        expect(s.remaining).toHaveLength(10)
        expect(s.lastResult.segmentId).toBe(BLANK_ID)
        return
      }
    }
    throw new Error('blank never hit')
  })
})

describe('who gets a turn', () => {
  it('winners are never called again, at random or by hand', () => {
    let s = session({ blankPolicy: 'keep', names: Array.from({ length: 6 }, (_, i) => `p${i}`) })
    const won = new Set()
    while (!isFinished(s)) {
      s = callRandom(s)
      expect(won.has(s.current)).toBe(false)
      for (const id of won) expect(chooseParticipant(s, id).current).toBe(s.current)
      s = commitSpin(beginSpin(s))
      if (s.lastResult.kind === 'prize') won.add(s.lastResult.participantId)
    }
    expect(winners(s).length).toBe(won.size)
  })

  it('re-calling skips the current person when others are left', () => {
    let s = callRandom(session())
    for (let i = 0; i < 50; i += 1) {
      const prev = s.current
      s = callRandom(s)
      expect(s.current).not.toBe(prev)
    }
  })

  it('manual choice only accepts people in the pool', () => {
    const s = session({ turnMode: 'manual' })
    expect(chooseParticipant(s, 'p3').current).toBe('p3')
    expect(chooseParticipant(s, 'nobody').current).toBeNull()
  })
})

describe('undo', () => {
  it('restores prizes, lists and wheel exactly', () => {
    let s = session()
    s = drawOnce(s)
    s = drawOnce(s)
    s = callRandom(s)
    const before = JSON.parse(JSON.stringify({ ...s, undo: null }))
    s = commitSpin(beginSpin(s))
    expect(s.log).toHaveLength(3)
    const restored = undoLast(s)
    expect(JSON.parse(JSON.stringify(restored))).toEqual({ ...before, undo: null, lastResult: null })
    expect(segmentsOf(restored)).toEqual(segmentsOf(before))
  })

  it('only the last draw can be undone', () => {
    let s = drawOnce(drawOnce(session()))
    s = undoLast(s)
    expect(s.log).toHaveLength(1)
    expect(undoLast(s)).toBe(s)
  })
})

describe('end conditions', () => {
  it('finishes when prizes run out', () => {
    let s = session({ names: Array.from({ length: 50 }, (_, i) => `p${i}`), prizes: [{ name: 'A', qty: 2 }] })
    while (!isFinished(s)) s = drawOnce(s)
    expect(leftoverPrizes(s)).toHaveLength(0)
    expect(winners(s)).toHaveLength(2)
  })

  it('finishes when nobody is left, keeping leftover prizes', () => {
    let s = session({ names: ['a', 'b'], prizes: [{ name: 'A', qty: 5 }] })
    while (!isFinished(s)) s = drawOnce(s)
    expect(s.remaining).toHaveLength(0)
    expect(winners(s).length + blanks(s).length).toBe(2)
    expect(leftoverPrizes(s)[0].left).toBe(5 - winners(s).length)
  })

  it('rotation is normalized after each spin', () => {
    const s = drawOnce(session())
    expect(s.rotation).toBeGreaterThanOrEqual(0)
    expect(s.rotation).toBeLessThan(360)
    expect(s.rotation).toBeCloseTo(mod(s.rotation, 360))
  })
})
