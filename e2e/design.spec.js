import { expect, test } from '@playwright/test'
import { drawOnce, fillNames, fresh, onResultScreen, people, setPrizes, startEvent } from './helpers.js'

const SHOTS = 'test-results/screens'

/** Computed-style checks for the banned patterns in spec section 6. */
async function bannedStyles(page) {
  return page.evaluate(() => {
    const hits = []
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      const tag = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`
      if (cs.backgroundImage.includes('gradient')) hits.push(`gradient: ${tag}`)
      if (cs.backdropFilter && cs.backdropFilter !== 'none') hits.push(`backdrop-filter: ${tag}`)
      if (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') hits.push(`backdrop-filter: ${tag}`)
      if (cs.textShadow && cs.textShadow !== 'none') hits.push(`text-shadow: ${tag}`)
      if (cs.filter && cs.filter.includes('blur')) hits.push(`blur: ${tag}`)
    }
    const bodyBg = getComputedStyle(document.body).backgroundImage
    if (bodyBg !== 'none') hits.push(`body background-image: ${bodyBg}`)
    return hits
  })
}

async function emojiInPage(page) {
  return page.evaluate(() => {
    const re = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u
    const text = document.body.innerText + [...document.querySelectorAll('[aria-label],[placeholder],[title]')].map((e) => e.getAttribute('aria-label') + e.getAttribute('placeholder') + e.getAttribute('title')).join('')
    return [...text].filter((c) => re.test(c))
  })
}

test.describe('디자인', () => {
  test('1920×1080에서 원판이 화면 높이의 70% 이상이다', async ({ page }) => {
    await startEvent(page, { names: people(12), prizes: [{ name: '에어팟', qty: 1 }, { name: '상품권', qty: 2 }] })
    const disk = await page.locator('[data-testid="wheel"] .rim').boundingBox()
    const vh = page.viewportSize().height
    expect(disk.height / vh).toBeGreaterThanOrEqual(0.7)
    // The disk fits on screen.
    expect(disk.y).toBeGreaterThanOrEqual(0)
    expect(disk.y + disk.height).toBeLessThanOrEqual(vh)
  })

  test('태블릿 가로 화면(1180×820)에서도 원판과 버튼이 모두 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 })
    await startEvent(page, { names: people(12), prizes: [{ name: '에어팟', qty: 1 }, { name: '상품권', qty: 2 }] })
    const disk = await page.locator('[data-testid="wheel"] .rim').boundingBox()
    expect(disk.y + disk.height).toBeLessThanOrEqual(820)
    expect(disk.x + disk.width).toBeLessThanOrEqual(1180)
    await expect(page.getByTestId('spin')).toBeInViewport()
    await expect(page.getByTestId('next')).toBeInViewport()
    await page.screenshot({ path: `${SHOTS}/tablet-draw.png` })
  })

  test('설정·추첨·결과 화면 스크린샷, 금지 스타일과 이모지 없음', async ({ page }) => {
    test.setTimeout(120_000)
    await fresh(page)
    await fillNames(page, ['김민수', '이영희', '박지훈', '김민수', '최수진', '정하늘', '오세훈', '한지민'])
    await setPrizes(page, [
      { name: '에어팟 프로', qty: 1 },
      { name: '스타벅스 상품권', qty: 2 },
      { name: '기계식 키보드', qty: 1 },
    ])
    await page.screenshot({ path: `${SHOTS}/setup.png`, fullPage: true })
    expect(await bannedStyles(page)).toEqual([])
    expect(await emojiInPage(page)).toEqual([])

    await page.getByTestId('start').click()
    await page.getByTestId('next').click()
    await page.screenshot({ path: `${SHOTS}/draw.png` })
    expect(await bannedStyles(page)).toEqual([])
    expect(await emojiInPage(page)).toEqual([])

    await page.getByTestId('spin').click()
    await expect(page.getByTestId('result-line')).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: `${SHOTS}/draw-result.png` })
    expect(await emojiInPage(page)).toEqual([])

    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (let i = 0; i < 20 && !(await onResultScreen(page)); i += 1) await drawOnce(page)
    await page.screenshot({ path: `${SHOTS}/result.png`, fullPage: true })
    expect(await bannedStyles(page)).toEqual([])
    expect(await emojiInPage(page)).toEqual([])
  })

  test('결과 문구는 "이름 · 경품" 형식이고 느낌표가 없다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(5), prizes: [{ name: '에어팟 프로', qty: 3 }] })
    const r = await drawOnce(page)
    expect(r.text).toMatch(/^참가자\d · (에어팟 프로|꽝)$/)
    expect(await page.locator('body').innerText()).not.toContain('!')
  })

  test('동작 줄이기 설정이면 회전 1초, 포인터 반동 없음', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(5), prizes: [{ name: 'A', qty: 3 }, { name: 'B', qty: 3 }, { name: 'C', qty: 3 }] })
    await page.getByTestId('next').click()
    const pointer = page.locator('[data-testid="wheel"] .pointer')
    const angles = []
    const t0 = Date.now()
    await page.getByTestId('spin').click()
    while (!(await page.getByTestId('result-line').count())) {
      angles.push(await pointer.getAttribute('transform'))
      await page.waitForTimeout(40)
    }
    const took = Date.now() - t0
    expect(took).toBeLessThan(1800)
    expect(took).toBeGreaterThan(900)
    expect(new Set(angles.map((a) => a.replace('-0.000', '0.000')))).toEqual(new Set(['rotate(0.000 0 -512)']))
  })

  test('보통 설정이면 핀이 지나갈 때 포인터가 튕긴다', async ({ page }) => {
    test.setTimeout(60_000)
    await startEvent(page, { names: people(5), prizes: [{ name: 'A', qty: 3 }, { name: 'B', qty: 3 }, { name: 'C', qty: 3 }] })
    await page.getByTestId('next').click()
    await page.getByTestId('spin').click()
    const pointer = page.locator('[data-testid="wheel"] .pointer')
    const angles = new Set()
    for (let i = 0; i < 40; i += 1) {
      angles.add(await pointer.getAttribute('transform'))
      await page.waitForTimeout(60)
    }
    expect(angles.size).toBeGreaterThan(5)
  })
})
