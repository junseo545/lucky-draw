import { describe, expect, it } from 'vitest'
import { BOM, resultRows, toCsv } from '../../src/lib/csv.js'
import { createStore } from '../../src/lib/storage.js'

describe('csv', () => {
  it('starts with a UTF-8 BOM and uses CRLF', () => {
    const csv = toCsv(resultRows([{ seq: 1, name: '김민수', prizeName: '에어팟 프로', kind: 'prize' }]))
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toBe(`${BOM}순서,이름,결과,구분\r\n1,김민수,에어팟 프로,당첨\r\n`)
    const bytes = new TextEncoder().encode(csv)
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('quotes commas and quotes, neutralizes formulas', () => {
    expect(toCsv([['a,b', 'say "hi"', '=1+1']])).toBe(`${BOM}"a,b","say ""hi""",'=1+1\r\n`)
  })
})

describe('storage', () => {
  function memoryStorage() {
    const m = new Map()
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    }
  }

  it('round-trips JSON', () => {
    const mem = memoryStorage()
    const store = createStore(() => mem)
    expect(store.available).toBe(true)
    store.save({ a: 1 })
    expect(store.load()).toEqual({ a: 1 })
  })

  it('never throws when storage access throws', () => {
    const store = createStore(() => {
      throw new Error('SecurityError')
    })
    expect(store.available).toBe(false)
    expect(store.load()).toBeNull()
    expect(store.save({ a: 1 })).toBe(false)
    expect(() => store.clear()).not.toThrow()
  })

  it('never throws when writes fail', () => {
    const store = createStore(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }))
    expect(store.available).toBe(false)
    expect(store.save({ a: 1 })).toBe(false)
  })

  it('ignores corrupt data', () => {
    const mem = memoryStorage()
    mem.setItem('k', '{not json')
    expect(createStore(() => mem, 'k').load()).toBeNull()
  })
})
