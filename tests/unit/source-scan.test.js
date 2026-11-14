// Static checks from the acceptance list: no insecure RNG and no emoji in the code.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', '..')
const scanned = ['src', 'tests', 'e2e', 'index.html', 'public', 'vite.config.js', 'playwright.config.js', 'CLAUDE.md']

function files(path) {
  let st
  try {
    st = statSync(path)
  } catch {
    return []
  }
  if (st.isFile()) return [path]
  return readdirSync(path).flatMap((name) => files(join(path, name)))
}

const all = scanned.flatMap((p) => files(join(root, p))).filter((f) => /\.(js|vue|css|html|svg|md|json)$/.test(f))

describe('source scan', () => {
  it('finds files to scan', () => {
    expect(all.length).toBeGreaterThan(10)
  })

  it('does not use the insecure RNG anywhere', () => {
    const needle = ['Math', 'random'].join('.')
    // CLAUDE.md states the rule in prose; it is documentation, not code.
    const code = all.filter((f) => !f.endsWith('.md'))
    const hits = code.filter((f) => readFileSync(f, 'utf8').includes(needle)).map((f) => relative(root, f))
    expect(hits).toEqual([])
  })

  it('contains no emoji', () => {
    const emoji = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u
    const hits = all.filter((f) => emoji.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f))
    expect(hits).toEqual([])
  })
})
