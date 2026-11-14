import { expect, test } from '@playwright/test'
import { choose, fillNames, fresh, people, setPrizes, wheelSegments } from './helpers.js'

function prizeNames(page) {
  return page.locator('[data-role="name"]').evaluateAll((els) => els.map((e) => e.value))
}

test.describe('설정 화면', () => {
  test('이름 120명을 붙여넣으면 120명으로 인식된다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await fresh(page)
    // Spreadsheet-style clipboard: CRLF, stray spaces, blank lines.
    const text = people(120, '사원').map((n, i) => (i % 7 === 0 ? `  ${n}  ` : n)).join('\r\n') + '\r\n\r\n'
    await page.evaluate((t) => navigator.clipboard.writeText(t), text)
    await page.getByTestId('names-input').focus()
    await page.keyboard.press('ControlOrMeta+V')
    await expect(page.getByTestId('names-input')).toHaveValue(/사원120/)
    await expect(page.getByTestId('participant-count')).toHaveText('총 120명')

    await setPrizes(page, [{ name: '경품', qty: 1 }])
    await page.getByTestId('start').click()
    await expect(page.getByTestId('remaining-count')).toHaveText('120')
  })

  test('같은 이름 3명이 이름, 이름 (2), 이름 (3)으로 구분된다', async ({ page }) => {
    await fresh(page)
    await fillNames(page, ['김민수', '이영희', '김민수', '박지훈', '김민수'])
    await expect(page.getByTestId('participant-count')).toHaveText('총 5명')
    const notice = page.getByTestId('dedupe-notice')
    await expect(notice).toContainText('2명에게 번호를 붙였습니다')
    await expect(notice).toContainText('김민수 (2)')
    await expect(notice).toContainText('김민수 (3)')

    await setPrizes(page, [{ name: '경품', qty: 1 }])
    await page.getByTestId('start').click()
    const list = page.getByTestId('remaining-list').locator('li')
    await expect(list).toHaveText(['김민수', '이영희', '김민수 (2)', '박지훈', '김민수 (3)'])
  })

  test('번호 생성 1~50 입력 시 50명이 만들어진다', async ({ page }) => {
    await fresh(page)
    await choose(page, '참가자 입력 방식', '번호 생성')
    await page.locator('#range-start').fill('1')
    await page.locator('#range-end').fill('50')
    await expect(page.getByTestId('participant-count')).toHaveText('총 50명')
    await setPrizes(page, [{ name: '경품', qty: 1 }])
    await page.getByTestId('start').click()
    await expect(page.getByTestId('remaining-count')).toHaveText('50')
    const list = page.getByTestId('remaining-list').locator('li')
    await expect(list.first()).toHaveText('1')
    await expect(list.last()).toHaveText('50')
  })

  test('참가자나 경품이 없으면 시작 버튼이 눌리지 않는다', async ({ page }) => {
    await fresh(page)
    const start = page.getByTestId('start')
    await expect(start).toBeDisabled()

    await fillNames(page, ['a', 'b'])
    await expect(start).toBeDisabled() // no prize yet
    await start.click({ force: true })
    await expect(page.getByTestId('wheel')).toHaveCount(0)

    await fillNames(page, ['', '   ', ''])
    await setPrizes(page, [{ name: '에어팟', qty: 1 }])
    await expect(page.getByTestId('participant-count')).toHaveText('총 0명')
    await expect(start).toBeDisabled() // prize but nobody
    await start.click({ force: true })
    await expect(page.getByTestId('wheel')).toHaveCount(0)

    await fillNames(page, ['a'])
    await expect(start).toBeEnabled()
  })

  test('경품이 참가자보다 많으면 경고만 하고 시작할 수 있다', async ({ page }) => {
    await fresh(page)
    await fillNames(page, ['a', 'b'])
    await setPrizes(page, [{ name: '에어팟', qty: 5 }])
    await expect(page.getByTestId('prize-total')).toContainText('총 5개')
    await expect(page.getByTestId('oversupply')).toBeVisible()
    await page.getByTestId('start').click()
    await expect(page.getByTestId('wheel')).toBeVisible()
  })

  test('수량은 기본 1, 최소 1이다', async ({ page }) => {
    await fresh(page)
    const qty = page.locator('[data-role="qty"]').first()
    await expect(qty).toHaveValue('1')
    await qty.fill('0')
    await qty.blur()
    await expect(qty).toHaveValue('1')
    await qty.fill('-4')
    await qty.blur()
    await expect(qty).toHaveValue('1')
  })

  test('엑셀에서 붙여넣은 경품 여러 줄이 각각의 행이 된다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await fresh(page)
    await page.evaluate((t) => navigator.clipboard.writeText(t), '에어팟 프로\t2\r\n스타벅스 상품권\t3\r\n텀블러\t1\r\n')
    await page.locator('[data-role="name"]').first().focus()
    await page.keyboard.press('ControlOrMeta+V')
    await expect(page.locator('[data-role="name"]')).toHaveCount(3)
    await expect(page.locator('[data-role="name"]').nth(1)).toHaveValue('스타벅스 상품권')
    await expect(page.locator('[data-role="qty"]').nth(1)).toHaveValue('3')
    await expect(page.getByTestId('prize-total')).toContainText('3종류 · 총 6개')
  })

  test('경품 순서를 드래그로 바꾸면 원판 배치 순서가 바뀐다', async ({ page }) => {
    await fresh(page)
    await fillNames(page, ['a', 'b', 'c'])
    await setPrizes(page, [
      { name: '첫째', qty: 1 },
      { name: '둘째', qty: 1 },
      { name: '셋째', qty: 1 },
    ])
    const handles = page.locator('[data-role="handle"]')
    const from = await handles.nth(2).boundingBox()
    const to = await handles.nth(0).boundingBox()
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 12 })
    await page.mouse.up()
    await expect.poll(() => prizeNames(page)).toEqual(['셋째', '첫째', '둘째'])

    // Keyboard: move the first row down one.
    await handles.nth(0).focus()
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => prizeNames(page)).toEqual(['첫째', '셋째', '둘째'])

    await page.getByTestId('start').click()
    const segs = await wheelSegments(page)
    expect(segs.map((s) => s.name)).toEqual(['첫째', '셋째', '둘째', '꽝'])
  })

  test('꽝 칸 이름을 바꿀 수 있다', async ({ page }) => {
    await fresh(page)
    await fillNames(page, ['a'])
    await setPrizes(page, [{ name: '에어팟', qty: 1 }])
    await page.locator('#blank-label').fill('다음 기회에')
    await page.getByTestId('start').click()
    const segs = await wheelSegments(page)
    expect(segs.at(-1)).toMatchObject({ kind: 'blank', name: '다음 기회에' })
  })
})
