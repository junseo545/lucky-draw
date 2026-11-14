import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { drawOnce, onResultScreen, people, startEvent } from './helpers.js'

async function finishEvent(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startEvent(page, {
    names: ['김민수', '이영희', '박지훈', '최수진', '정하늘', '오세훈'],
    prizes: [
      { name: '에어팟 프로', qty: 1 },
      { name: '스타벅스 상품권', qty: 2 },
    ],
  })
  for (let i = 0; i < 20 && !(await onResultScreen(page)); i += 1) await drawOnce(page)
  await expect(page.getByRole('heading', { level: 1, name: '결과' })).toBeVisible()
}

test.describe('결과 화면', () => {
  test('당첨자, 꽝 명단, 남은 경품이 표시된다', async ({ page }) => {
    test.setTimeout(120_000)
    await finishEvent(page)
    const rows = page.getByTestId('winners-table').locator('tbody tr')
    const n = await rows.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i += 1) await expect(rows.nth(i).locator('td').first()).toHaveText(String(i + 1))
  })

  test('CSV는 UTF-8 BOM으로 시작하고 한글이 그대로 들어간다', async ({ page }) => {
    test.setTimeout(120_000)
    await finishEvent(page)
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('csv').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^럭키드로우_결과_\d{8}_\d{4}\.csv$/)
    const bytes = await readFile(await download.path())
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3))
    const lines = text.trimEnd().split('\r\n')
    expect(lines[0]).toBe('순서,이름,결과,구분')
    expect(lines.length).toBeGreaterThan(1)
    expect(text).toMatch(/김민수|이영희|박지훈|최수진|정하늘|오세훈/)
    for (const line of lines.slice(1)) expect(line).toMatch(/^\d+,[^,]+,[^,]+,(당첨|꽝)$/)
  })

  test('처음부터는 한 번 더 확인한 뒤 초기화하고, 입력은 남긴다', async ({ page }) => {
    test.setTimeout(120_000)
    await finishEvent(page)
    await page.getByRole('button', { name: '처음부터' }).click()
    await page.getByRole('button', { name: '취소' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '결과' })).toBeVisible()

    await page.getByRole('button', { name: '처음부터' }).click()
    await page.getByTestId('reset-confirm').click()
    await expect(page.getByTestId('start')).toBeVisible()
    await expect(page.getByTestId('names-input')).toHaveValue(/김민수/)
    await page.reload()
    await expect(page.getByTestId('start')).toBeVisible()
  })

  test('결과 화면에서 마지막 추첨을 되돌리면 추첨 화면으로 돌아간다', async ({ page }) => {
    test.setTimeout(120_000)
    await finishEvent(page)
    await page.getByTestId('undo').click()
    await expect(page.getByTestId('wheel')).toBeVisible()
    await expect(page.getByTestId('spin')).toBeEnabled()
  })

  test('참가자 수가 많아도 결과 화면이 동작한다', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(120), prizes: [{ name: '에어팟', qty: 1 }] })
    for (let i = 0; i < 40 && !(await onResultScreen(page)); i += 1) await drawOnce(page)
    await expect(page.getByTestId('winners-table').locator('tbody tr')).toHaveCount(1)
  })
})
