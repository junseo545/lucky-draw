import { expect, test } from '@playwright/test'
import {
  boardState,
  drawOnce,
  onResultScreen,
  people,
  saved,
  segmentUnderPointer,
  startEvent,
  waitIdle,
  wheelSegments,
} from './helpers.js'

async function remainingNames(page) {
  return (await page.getByTestId('remaining-list').locator('li').allInnerTexts()).map((t) => t.trim())
}

test.describe('추첨 화면', () => {
  test('원판 칸 수 = 남은 경품 종류 수 + 1(꽝)', async ({ page }) => {
    await startEvent(page, {
      names: people(10),
      prizes: [
        { name: '에어팟', qty: 2 },
        { name: '상품권', qty: 3 },
        { name: '키보드', qty: 1 },
      ],
    })
    const segs = await wheelSegments(page)
    expect(segs).toHaveLength(4)
    expect(segs.filter((s) => s.kind === 'blank')).toHaveLength(1)
    // Labels show the remaining quantity.
    await expect(page.locator('[data-testid="wheel"] .label text')).toHaveText(['에어팟 ×2', '상품권 ×3', '키보드 ×1', '꽝'])
  })

  test('포인터가 가리킨 칸과 판정 결과가 100회 연속 일치한다', async ({ page }) => {
    test.setTimeout(900_000)
    await page.emulateMedia({ reducedMotion: 'reduce' }) // 1 s spins; same geometry and judgment
    await startEvent(page, {
      names: people(200),
      prizes: [
        { name: '에어팟', qty: 500 },
        { name: '상품권', qty: 500 },
        { name: '키보드', qty: 500 },
      ],
      blankPolicy: 'keep',
    })
    const seen = new Map()
    for (let i = 0; i < 100; i += 1) {
      const r = await drawOnce(page)
      expect(r.under, `spin ${i + 1}: nothing under the pointer`).not.toBeNull()
      expect(r.under.name, `spin ${i + 1}: pointer shows ${r.under.name}, result says ${r.text}`).toBe(r.prize)
      expect(r.outlined, `spin ${i + 1}: highlighted segment`).toBe(r.under.id)
      expect(r.text).toBe(`${r.name} · ${r.prize}`)
      seen.set(r.under.name, (seen.get(r.under.name) ?? 0) + 1)
    }
    // Sanity: every segment came up at least once in 100 spins.
    expect(seen.size).toBe(4)
  })

  test('실제 회전 속도에서도 포인터와 판정이 일치한다', async ({ page }) => {
    test.setTimeout(180_000)
    await startEvent(page, {
      names: people(30),
      prizes: [
        { name: 'A', qty: 50 },
        { name: 'B', qty: 50 },
        { name: 'C', qty: 50 },
        { name: 'D', qty: 50 },
        { name: 'E', qty: 50 },
      ],
      blankPolicy: 'keep',
    })
    for (let i = 0; i < 6; i += 1) {
      const started = Date.now()
      const r = await drawOnce(page)
      const took = Date.now() - started
      expect(r.under.name).toBe(r.prize)
      expect(took).toBeGreaterThan(3900) // 4-6 s spin, plus result display
    }
  })

  test('회전 중 버튼 연타·스페이스바 연타로 두 번 돌아가지 않는다', async ({ page }) => {
    await startEvent(page, { names: people(10), prizes: [{ name: '에어팟', qty: 5 }] })
    await page.getByTestId('next').click()
    const spinBtn = page.getByTestId('spin')
    await spinBtn.click()
    // While the wheel turns: hammer the button (forced, it is disabled) and the space bar.
    for (let i = 0; i < 10; i += 1) {
      await spinBtn.click({ force: true, noWaitAfter: true })
      await page.keyboard.press('Space')
    }
    await expect(page.getByTestId('result-line')).toBeVisible({ timeout: 15_000 })
    await waitIdle(page)
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Space') // nobody called: nothing happens
    await page.waitForTimeout(300)
    const state = await saved(page)
    expect(state.session.log).toHaveLength(1)
    expect(state.session.pending).toBeNull()
  })

  test('스페이스바로 돌리고, 포커스된 버튼이 함께 눌리지 않는다', async ({ page }) => {
    await startEvent(page, { names: people(10), prizes: [{ name: '에어팟', qty: 5 }] })
    await page.getByTestId('next').click()
    const name = await page.getByTestId('turn-name').textContent()
    await page.getByTestId('next').focus()
    await page.keyboard.press('Space')
    await expect(page.locator('[data-stage="spinning"]')).toBeVisible()
    await expect(page.getByTestId('turn-name')).toHaveText(name) // "다음 사람" was not triggered
    await expect(page.getByTestId('result-line')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('result-line')).toContainText(name)
  })

  test('수량 1인 경품이 당첨되면 그 칸이 사라지고 원판이 다시 그려진다', async ({ page }) => {
    test.setTimeout(300_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, {
      names: people(80),
      prizes: [
        { name: '상품권', qty: 1 },
        { name: '머그컵', qty: 100 },
      ],
      blankPolicy: 'keep',
    })
    for (let i = 0; i < 60; i += 1) {
      const r = await drawOnce(page)
      if (r.prize === '상품권') {
        const segs = await wheelSegments(page)
        expect(segs.map((s) => s.name)).toEqual(['머그컵', '꽝'])
        await expect(page.locator('[data-testid="wheel"] .label text')).toHaveText([/^머그컵 ×\d+$/, '꽝'])
        return
      }
      expect(await wheelSegments(page)).toHaveLength(3)
    }
    throw new Error('상품권 never came up in 60 spins')
  })

  test('당첨된 사람은 랜덤 호출로 다시 나오지 않는다', async ({ page }) => {
    test.setTimeout(300_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(6), prizes: [{ name: '에어팟', qty: 20 }], blankPolicy: 'keep' })
    const winners = new Set()
    for (let guard = 0; guard < 80 && !(await onResultScreen(page)); guard += 1) {
      await page.getByTestId('next').click()
      // Re-calling a few times must never land on a winner either.
      for (let k = 0; k < 3; k += 1) {
        const called = (await page.getByTestId('turn-name').textContent()).trim()
        expect(winners.has(called), `${called} already won`).toBe(false)
        if ((await page.getByTestId('remaining-count').innerText()) !== '1') await page.getByTestId('next').click()
      }
      const r = await drawOnce(page, { call: false })
      expect(winners.has(r.name), `${r.name} spun twice after winning`).toBe(false)
      if (r.kind === 'prize') winners.add(r.name)
    }
    expect(await onResultScreen(page)).toBe(true)
    expect(winners.size).toBe(6)
  })

  test('당첨된 사람은 직접 선택 명단에도 나오지 않는다', async ({ page }) => {
    test.setTimeout(300_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(5), prizes: [{ name: '에어팟', qty: 20 }], blankPolicy: 'keep', turnMode: 'manual' })
    await expect(page.getByTestId('next')).toHaveCount(0)
    const winners = new Set()
    for (let guard = 0; guard < 60 && !(await onResultScreen(page)); guard += 1) {
      const buttons = page.getByTestId('remaining-list').getByRole('button')
      const names = (await buttons.allTextContents()).map((t) => t.trim())
      for (const w of winners) expect(names).not.toContain(w)
      await buttons.first().click()
      const r = await drawOnce(page, { call: false })
      if (r.kind === 'prize') winners.add(r.name)
    }
    expect(winners.size).toBe(5)
  })

  test('꽝 설정 "명단에서 제외": 꽝이 나온 사람은 명단에서 빠진다', async ({ page }) => {
    test.setTimeout(200_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(40), prizes: [{ name: '에어팟', qty: 40 }], blankPolicy: 'exclude' })
    for (let i = 0; i < 30; i += 1) {
      const before = Number(await page.getByTestId('remaining-count').innerText())
      const r = await drawOnce(page)
      const after = Number(await page.getByTestId('remaining-count').innerText())
      expect(after).toBe(before - 1)
      expect(await remainingNames(page)).not.toContain(r.name)
      if (r.kind === 'blank') return
    }
    throw new Error('no blank in 30 spins')
  })

  test('꽝 설정 "기회 유지": 꽝이 나온 사람은 명단에 남는다', async ({ page }) => {
    test.setTimeout(200_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(40), prizes: [{ name: '에어팟', qty: 40 }], blankPolicy: 'keep' })
    for (let i = 0; i < 30; i += 1) {
      const before = Number(await page.getByTestId('remaining-count').innerText())
      const r = await drawOnce(page)
      const after = Number(await page.getByTestId('remaining-count').innerText())
      if (r.kind === 'blank') {
        expect(after).toBe(before)
        expect(await remainingNames(page)).toContain(r.name)
        return
      }
      expect(after).toBe(before - 1)
    }
    throw new Error('no blank in 30 spins')
  })

  test('되돌리기 후 경품 수량, 명단, 원판이 직전 상태와 완전히 같다', async ({ page }) => {
    test.setTimeout(200_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, {
      names: people(20),
      prizes: [
        { name: '상품권', qty: 1 },
        { name: '머그컵', qty: 1 },
        { name: '텀블러', qty: 3 },
      ],
    })
    await expect(page.getByTestId('undo')).toBeDisabled()
    await drawOnce(page)
    await drawOnce(page)

    // Find a draw that changes the wheel (a prize), to make undo prove the most.
    for (let i = 0; i < 15; i += 1) {
      await page.getByTestId('next').click()
      const before = await boardState(page)
      const r = await drawOnce(page, { call: false })
      const after = await boardState(page)
      expect(after).not.toEqual(before)

      await page.getByTestId('undo').click()
      await waitIdle(page)
      await page.waitForTimeout(100)
      const restored = await boardState(page)
      expect(restored).toEqual(before)
      await expect(page.getByTestId('undo')).toBeDisabled() // only one level

      if (r.kind === 'prize') return
      // Blank: spin again with the same person to try for a prize.
      await page.getByTestId('spin').click()
      await expect(page.getByTestId('result-line')).toBeVisible({ timeout: 15_000 })
      await waitIdle(page)
    }
    throw new Error('no prize in 15 tries')
  })

  test('경품이 모두 소진되면 결과 화면으로 자동 이동한다', async ({ page }) => {
    test.setTimeout(200_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(30), prizes: [{ name: '에어팟', qty: 2 }], blankPolicy: 'keep' })
    for (let i = 0; i < 60 && !(await onResultScreen(page)); i += 1) await drawOnce(page)
    await expect(page.getByRole('heading', { level: 1, name: '결과' })).toBeVisible()
    await expect(page.getByTestId('winners-table').locator('tbody tr')).toHaveCount(2)
    await expect(page.getByTestId('leftover-table')).toHaveCount(0)
  })

  test('남은 참가자가 0명이면 결과 화면으로, 남은 경품이 함께 보인다', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, { names: people(3), prizes: [{ name: '에어팟', qty: 10 }] })
    for (let i = 0; i < 3; i += 1) await drawOnce(page)
    await expect(page.getByRole('heading', { level: 1, name: '결과' })).toBeVisible()
    await expect(page.getByText('남은 참가자가 없습니다.')).toBeVisible()
    await expect(page.getByTestId('leftover-table')).toContainText('에어팟')
  })

  test('남은 참가자 / 당첨자 패널을 접었다 펼 수 있다', async ({ page }) => {
    await startEvent(page, { names: people(5), prizes: [{ name: '에어팟', qty: 1 }] })
    const head = page.getByRole('button', { name: /남은 참가자/ })
    await expect(page.getByTestId('remaining-list')).toBeVisible()
    await head.click()
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('remaining-list')).toBeHidden()
    await head.click()
    await expect(page.getByTestId('remaining-list')).toBeVisible()
  })

  test('포인터 아래 칸 판정 헬퍼가 정지 상태에서도 칸을 찾는다', async ({ page }) => {
    await startEvent(page, { names: people(5), prizes: [{ name: '에어팟', qty: 1 }] })
    expect(await segmentUnderPointer(page)).not.toBeNull()
  })
})
