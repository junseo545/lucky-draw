import { expect } from '@playwright/test'

export const STORAGE_KEY = 'lucky-draw:v1'

/** Open the app with empty storage. */
export async function fresh(page) {
  await page.goto('/')
  await page.evaluate(() => {
    try {
      localStorage.clear()
    } catch {
      // storage blocked in this test
    }
  })
  await page.reload()
}

export async function fillNames(page, names) {
  await page.getByTestId('names-input').fill(names.join('\n'))
}

export async function setPrizes(page, prizes) {
  const names = page.locator('[data-role="name"]')
  const qtys = page.locator('[data-role="qty"]')
  for (let i = 0; i < prizes.length; i += 1) {
    if ((await names.count()) <= i) await page.getByRole('button', { name: '경품 추가' }).click()
    await names.nth(i).fill(prizes[i].name)
    await qtys.nth(i).fill(String(prizes[i].qty ?? 1))
  }
}

export async function choose(page, groupLabel, optionLabel) {
  await page.getByRole('radiogroup', { name: groupLabel }).getByText(optionLabel, { exact: true }).click()
}

/** Fill setup and go to the draw screen. */
export async function startEvent(page, { names, prizes, blankPolicy = 'exclude', turnMode = 'random', blankLabel } = {}) {
  await fresh(page)
  await fillNames(page, names)
  await setPrizes(page, prizes)
  if (blankLabel !== undefined) await page.locator('#blank-label').fill(blankLabel)
  if (blankPolicy === 'keep') await choose(page, '꽝이 나오면', '기회 유지')
  if (turnMode === 'manual') await choose(page, '차례 정하기', '직접 선택')
  await page.getByTestId('start').click()
  await expect(page.getByTestId('wheel')).toBeVisible()
}

export function people(n, prefix = '참가자') {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`)
}

/** Wait until the draw screen is idle again, or the result screen took over. */
export async function waitIdle(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-stage]')
    return !el || el.dataset.stage === 'idle'
  })
}

export async function onResultScreen(page) {
  return (await page.getByRole('heading', { level: 1, name: '결과' }).count()) > 0
}

/**
 * The segment actually painted under the pointer, found by hit-testing the
 * screen just below the pointer tip. Independent of app state.
 */
export async function segmentUnderPointer(page) {
  return page.evaluate(probePointer)
}

/** Runs in the browser. Hit-tests the point just below the pointer tip. */
function probePointer() {
  const svg = document.querySelector('[data-testid="wheel"]')
  const box = svg.getBoundingClientRect()
  const scale = box.width / 1000 // viewBox is 1000 wide
  const cx = box.left + 500 * scale
  const cy = box.top + 540 * scale // viewBox starts at y = -540
  const el = document.elementFromPoint(cx, cy - 330 * scale)?.closest('[data-segment-id]')
  return el ? { id: el.dataset.segmentId, name: el.dataset.segmentName, kind: el.dataset.segmentKind } : null
}

export async function wheelSegments(page) {
  return page.locator('[data-testid="wheel"] path[data-segment-id]').evaluateAll((els) =>
    els.map((el) => ({ id: el.dataset.segmentId, name: el.dataset.segmentName, kind: el.dataset.segmentKind })),
  )
}

/** Read the saved app state straight from localStorage. */
export async function saved(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)
}

/**
 * Call the next person (random mode), spin, and return what was shown at the
 * moment the result appeared, plus the segment hit-tested under the pointer.
 */
export async function drawOnce(page, { call = true } = {}) {
  if (call) await page.getByTestId('next').click()
  const name = (await page.getByTestId('turn-name').textContent()).trim()
  await page.getByTestId('spin').click()
  // Read the result line, the highlighted segment and the segment under the
  // pointer in the same frame the result first appears.
  const handle = await page.waitForFunction(
    (probeSrc) => {
      const line = document.querySelector('[data-testid="result-line"]')
      if (!line) return null
      const probe = new Function(`return (${probeSrc})()`)
      return {
        text: line.textContent.trim(),
        kind: line.dataset.kind,
        under: probe(),
        outlined: document.querySelector('[data-testid="win-outline"]')?.dataset.segmentId ?? null,
      }
    },
    probePointer.toString(),
    { timeout: 15_000, polling: 'raf' },
  )
  const snap = await handle.jsonValue()
  await waitIdle(page)
  return { name, ...snap, prize: snap.text.slice(snap.text.indexOf(' · ') + 3) }
}

/** Text snapshot of everything the undo test cares about. */
export async function boardState(page) {
  return {
    remaining: await page.getByTestId('remaining-list').innerText(),
    winners: (await page.getByTestId('winner-count').innerText()) + (await page.locator('#panel-winners').innerText()),
    stock: await page.locator('table.stock').innerText(),
    prizesLeft: await page.getByTestId('prizes-left').innerText(),
    segments: await wheelSegments(page),
    labels: await page.locator('[data-testid="wheel"] .label text').allTextContents(),
    rotor: await page.locator('[data-testid="wheel"] .rotor').getAttribute('transform'),
    turn: await page.locator('.banner-text').innerText(),
  }
}
