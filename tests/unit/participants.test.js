import { describe, expect, it } from 'vitest'
import { dedupeNames, parseNames, rangeNames, resolveParticipants } from '../../src/lib/participants.js'

describe('parseNames', () => {
  it('trims, drops blank lines, handles CRLF', () => {
    expect(parseNames('  김민수 \r\n\r\n이영희\n\n  \n박지훈  ')).toEqual(['김민수', '이영희', '박지훈'])
  })

  it('treats a spreadsheet row as one participant', () => {
    expect(parseNames('김민수\t개발팀\n이영희\t디자인팀')).toEqual(['김민수 개발팀', '이영희 디자인팀'])
  })

  it('reads 120 pasted names as 120 participants', () => {
    const text = Array.from({ length: 120 }, (_, i) => `참가자${i + 1}`).join('\n') + '\n\n'
    expect(parseNames(text)).toHaveLength(120)
  })
})

describe('dedupeNames', () => {
  it('numbers repeats as name, name (2), name (3)', () => {
    const { names, renamed } = dedupeNames(['김민수', '이영희', '김민수', '김민수'])
    expect(names).toEqual(['김민수', '이영희', '김민수 (2)', '김민수 (3)'])
    expect(renamed).toEqual([
      { from: '김민수', to: '김민수 (2)' },
      { from: '김민수', to: '김민수 (3)' },
    ])
  })

  it('skips suffixes that already exist in the input', () => {
    const { names } = dedupeNames(['김민수', '김민수 (2)', '김민수'])
    expect(names).toEqual(['김민수', '김민수 (2)', '김민수 (3)'])
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('rangeNames', () => {
  it('1..50 gives 50 participants', () => {
    const { names, error } = rangeNames('1', '50')
    expect(error).toBeNull()
    expect(names).toHaveLength(50)
    expect(names[0]).toBe('1')
    expect(names[49]).toBe('50')
  })

  it('rejects reversed or invalid ranges', () => {
    expect(rangeNames('10', '1').error).not.toBeNull()
    expect(rangeNames('a', '5').error).not.toBeNull()
    expect(rangeNames('1', '').error).not.toBeNull()
    expect(rangeNames('1', '20000').error).not.toBeNull()
  })
})

describe('resolveParticipants', () => {
  it('uses the selected input mode', () => {
    expect(resolveParticipants({ inputMode: 'range', rangeStart: '3', rangeEnd: '5', namesText: 'x' }).names).toEqual(['3', '4', '5'])
    expect(resolveParticipants({ inputMode: 'names', rangeStart: '3', rangeEnd: '5', namesText: 'a\na' }).names).toEqual(['a', 'a (2)'])
  })
})
