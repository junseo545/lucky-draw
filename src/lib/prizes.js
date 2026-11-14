export const MAX_PRIZE_QTY = 9999

/** Clamp a quantity input to an integer in [1, MAX_PRIZE_QTY]; default 1. */
export function normalizeQty(raw) {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_PRIZE_QTY, Math.max(1, Math.floor(n)))
}

/**
 * Validate the prize rows from the setup form. Rows without a name are
 * ignored. Duplicate names are reported because they would put two identical
 * segments on the wheel.
 */
export function resolvePrizes(rows) {
  const prizes = []
  const counts = new Map()
  for (const row of rows) {
    const name = String(row.name ?? '').replace(/\s+/g, ' ').trim()
    if (!name) continue
    prizes.push({ name, qty: normalizeQty(row.qty) })
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const duplicates = [...counts].filter(([, c]) => c > 1).map(([n]) => n)
  const total = prizes.reduce((sum, p) => sum + p.qty, 0)
  return { prizes, total, duplicates }
}

/**
 * Parse prize lines pasted from a spreadsheet or a list.
 * The quantity is read only when it is unambiguous: a separate tab cell
 * ("에어팟\t3") or an explicit marker ("에어팟 x3", "에어팟 ×3", "에어팟 3개").
 * "아이폰 15" stays one name with quantity 1.
 */
export function parsePrizeLines(text) {
  const rows = []
  for (const rawLine of String(text ?? '').split(/\r\n|\r|\n/)) {
    if (!rawLine.trim()) continue
    let name = rawLine
    let qty = 1
    const cells = rawLine.split('\t').map((c) => c.trim()).filter(Boolean)
    if (cells.length >= 2 && /^\d+$/.test(cells[cells.length - 1])) {
      qty = Number(cells.pop())
      name = cells.join(' ')
    } else {
      const m = rawLine.match(/^(.*?)(?:\s+[xX*]\s*(\d+)|\s*×\s*(\d+)|\s*(\d+)\s*개)\s*$/)
      if (m && m[1].trim()) {
        name = m[1]
        qty = Number(m[2] ?? m[3] ?? m[4])
      }
    }
    name = name.replace(/\s+/g, ' ').trim()
    if (name) rows.push({ name, qty: normalizeQty(qty) })
  }
  return rows
}
