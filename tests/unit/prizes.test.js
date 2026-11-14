import { describe, expect, it } from 'vitest'
import { normalizeQty, parsePrizeLines, resolvePrizes } from '../../src/lib/prizes.js'

describe('prizes', () => {
  it('quantity defaults to 1 and is at least 1', () => {
    expect(normalizeQty('')).toBe(1)
    expect(normalizeQty('0')).toBe(1)
    expect(normalizeQty('-3')).toBe(1)
    expect(normalizeQty('2.7')).toBe(2)
    expect(normalizeQty('abc')).toBe(1)
    expect(normalizeQty(5)).toBe(5)
  })

  it('ignores unnamed rows, totals quantities, reports duplicates', () => {
    const r = resolvePrizes([
      { name: ' 에어팟 ', qty: 2 },
      { name: '', qty: 5 },
      { name: '상품권', qty: '3' },
      { name: '상품권', qty: 1 },
    ])
    expect(r.prizes).toEqual([
      { name: '에어팟', qty: 2 },
      { name: '상품권', qty: 3 },
      { name: '상품권', qty: 1 },
    ])
    expect(r.total).toBe(6)
    expect(r.duplicates).toEqual(['상품권'])
  })

  it('parses pasted lines only when the quantity is unambiguous', () => {
    expect(parsePrizeLines('에어팟\t3\n아이폰 15\n키보드 x2\n머그컵 ×4\n텀블러 5개\nbox3\n\n')).toEqual([
      { name: '에어팟', qty: 3 },
      { name: '아이폰 15', qty: 1 },
      { name: '키보드', qty: 2 },
      { name: '머그컵', qty: 4 },
      { name: '텀블러', qty: 5 },
      { name: 'box3', qty: 1 },
    ])
  })
})
