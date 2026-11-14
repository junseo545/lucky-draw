import { expect, test } from '@playwright/test'
import { boardState, drawOnce, onResultScreen, people, saved, startEvent } from './helpers.js'

test.describe('상태 저장', () => {
  test('추첨 5회 후 새로고침하면 5회 진행된 상태 그대로 이어진다', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startEvent(page, {
      names: people(30),
      prizes: [
        { name: '에어팟', qty: 3 },
        { name: '상품권', qty: 5 },
      ],
    })
    for (let i = 0; i < 5; i += 1) await drawOnce(page)
    const before = await boardState(page)
    const log = (await saved(page)).session.log
    expect(log).toHaveLength(5)

    await page.reload()
    await expect(page.getByTestId('wheel')).toBeVisible()
    await page.waitForTimeout(100)
    const after = await boardState(page)
    expect(after).toEqual(before)
    expect((await saved(page)).session.log).toEqual(log)
    expect(Number(await page.getByTestId('remaining-count').innerText())).toBe(25)

    // And it keeps going from there.
    await drawOnce(page)
    expect((await saved(page)).session.log).toHaveLength(6)
  })

  test('회전 도중 새로고침되면 이미 정해진 결과가 확정된 상태로 복원된다', async ({ page }) => {
    await startEvent(page, { names: people(10), prizes: [{ name: '에어팟', qty: 3 }] })
    await page.getByTestId('next').click()
    await page.getByTestId('spin').click()
    await page.waitForTimeout(800) // mid-spin (4-6 s)
    const mid = await saved(page)
    expect(mid.session.pending).not.toBeNull()
    const { participantId, segmentId } = mid.session.pending

    await page.reload()
    await expect(page.getByTestId('wheel')).toBeVisible()
    const after = await saved(page)
    expect(after.session.pending).toBeNull()
    expect(after.session.log).toHaveLength(1)
    expect(after.session.log[0]).toMatchObject({ participantId, segmentId })
    expect(after.session.current).toBeNull()
    // The recorded result is on screen, and that person cannot spin again.
    const name = after.session.log[0].name
    await expect(page.getByTestId('result-line')).toHaveText(`${name} · ${after.session.log[0].prizeName}`)
    await expect(page.getByTestId('spin')).toBeDisabled()
    expect(after.session.remaining).not.toContain(participantId)
  })

  test('설정 화면 입력도 새로고침 후 남아 있다', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByTestId('names-input').fill('김민수\n이영희')
    await page.locator('[data-role="name"]').first().fill('에어팟')
    await page.waitForTimeout(100)
    await page.reload()
    await expect(page.getByTestId('names-input')).toHaveValue('김민수\n이영희')
    await expect(page.locator('[data-role="name"]').first()).toHaveValue('에어팟')
  })

  for (const mode of ['getter-throws', 'setitem-throws']) {
    test(`저장소를 못 쓰는 환경에서도 오류 없이 끝까지 진행된다 (${mode})`, async ({ page }) => {
      test.setTimeout(200_000)
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await page.addInitScript((m) => {
        if (m === 'getter-throws') {
          // Storage blocked entirely (cookies off, some private modes).
          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
              throw new DOMException('The operation is insecure.', 'SecurityError')
            },
          })
        } else {
          // Storage present but every write fails (old Safari private mode).
          Storage.prototype.setItem = function () {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError')
          }
        }
      }, mode)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await startEvent(page, { names: people(8), prizes: [{ name: '에어팟', qty: 3 }, { name: '상품권', qty: 2 }] })
      await expect(page.getByTestId('wheel')).toBeVisible()
      for (let i = 0; i < 40 && !(await onResultScreen(page)); i += 1) await drawOnce(page)
      expect(await onResultScreen(page)).toBe(true)
      await page.getByRole('button', { name: '처음부터' }).click()
      await page.getByTestId('reset-confirm').click()
      await expect(page.getByTestId('start')).toBeVisible()
      expect(errors).toEqual([])
    })
  }

  test('저장소를 못 쓰면 설정 화면에 안내가 나온다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('denied', 'SecurityError')
        },
      })
    })
    await page.goto('/')
    await expect(page.getByText('진행 상황이 저장되지 않습니다')).toBeVisible()
  })
})

