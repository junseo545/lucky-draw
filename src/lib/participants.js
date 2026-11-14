export const MAX_RANGE_SIZE = 10000

/**
 * Split pasted text into names: one per line, trimmed, blank lines dropped.
 * Handles CRLF / CR line endings from Excel and Windows clipboards. Runs of
 * whitespace inside a line (including tabs between spreadsheet cells) become
 * a single space, so one row is always one participant.
 */
export function parseNames(text) {
  if (!text) return []
  return text
    .split(/\r\n|\r|\n/)
    .map((s) => s.replace(/[\s 　​﻿]+/g, ' ').trim())
    .filter((s) => s.length > 0)
}

/**
 * Make every name unique. The first occurrence keeps its name, later ones
 * get " (2)", " (3)" ... skipping any suffix that is already taken.
 * @returns {{ names: string[], renamed: { from: string, to: string }[] }}
 */
export function dedupeNames(list) {
  const taken = new Set(list)
  const seen = new Set()
  const nextSuffix = new Map()
  const names = []
  const renamed = []
  for (const name of list) {
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
      continue
    }
    let k = nextSuffix.get(name) ?? 2
    let candidate = `${name} (${k})`
    while (taken.has(candidate) || seen.has(candidate)) {
      k += 1
      candidate = `${name} (${k})`
    }
    nextSuffix.set(name, k + 1)
    seen.add(candidate)
    taken.add(candidate)
    names.push(candidate)
    renamed.push({ from: name, to: candidate })
  }
  return { names, renamed }
}

/**
 * Participants from a number range, inclusive on both ends.
 * @returns {{ names: string[], error: string | null }}
 */
export function rangeNames(startRaw, endRaw) {
  const start = toInt(startRaw)
  const end = toInt(endRaw)
  if (start === null || end === null) {
    return { names: [], error: '시작 번호와 끝 번호를 정수로 입력하세요.' }
  }
  if (start > end) {
    return { names: [], error: '시작 번호가 끝 번호보다 큽니다.' }
  }
  const count = end - start + 1
  if (count > MAX_RANGE_SIZE) {
    return { names: [], error: `한 번에 최대 ${MAX_RANGE_SIZE.toLocaleString('ko-KR')}명까지 만들 수 있습니다.` }
  }
  const names = []
  for (let n = start; n <= end; n += 1) names.push(String(n))
  return { names, error: null }
}

function toInt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!/^-?\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * Resolve the participant list from the setup form.
 * @returns {{ names: string[], renamed: {from:string,to:string}[], error: string | null }}
 */
export function resolveParticipants(setup) {
  if (setup.inputMode === 'range') {
    const { names, error } = rangeNames(setup.rangeStart, setup.rangeEnd)
    return { names, renamed: [], error }
  }
  const { names, renamed } = dedupeNames(parseNames(setup.namesText))
  return { names, renamed, error: null }
}
