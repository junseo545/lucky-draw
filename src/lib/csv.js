// CSV export for Excel. UTF-8 with a BOM so Korean text opens correctly,
// CRLF line endings, and fields quoted when needed.

export const BOM = '﻿'

function cell(value) {
  let s = String(value ?? '')
  // Keep Excel from evaluating names that look like formulas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(rows) {
  return BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Rows for the results file: every draw in order. */
export function resultRows(log) {
  const header = ['순서', '이름', '결과', '구분']
  return [header, ...log.map((e) => [e.seq, e.name, e.prizeName, e.kind === 'prize' ? '당첨' : '꽝'])]
}

export function resultFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`
  return `럭키드로우_결과_${stamp}.csv`
}
