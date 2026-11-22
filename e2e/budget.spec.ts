import { expect, test } from '@playwright/test'

test('выбирает проект и дату и получает новый отчёт от API', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'План и расходы' })).toBeVisible()
  await expect(page.getByText('30 749,50 ₽', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Осенняя книжная ярмарка' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Производство/ })).toContainText('−4 500')

  await page.getByLabel('Проект', { exact: true }).selectOption('bakery-identity')
  await page.getByLabel('Дата отчёта').fill('2026-10-21')
  const response = page.waitForResponse('**/api/report?asOf=2026-10-21&project=bakery-identity')
  await page.getByRole('button', { name: 'Построить отчёт' }).press('Enter')

  expect((await response).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Фирменный стиль пекарни' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Производство/ })).toContainText('22 000')
  await expect(page.getByText('54 499,75 ₽', { exact: true })).toBeVisible()
  await expect(page.locator('time')).toHaveAttribute('datetime', '2026-10-21')
  expect(errors).toEqual([])
})

test('показывает отсутствие расходов, затем сообщает о сбое и сохраняет отчёт', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Дата отчёта').fill('2026-09-01')
  await page.getByRole('button', { name: 'Построить отчёт' }).click()
  await expect(page.getByText('К этой дате у проекта ещё нет оплаченных расходов.')).toBeVisible()

  await page.route('**/api/report?*', (route) => route.abort())
  await page.getByLabel('Дата отчёта').fill('2026-09-02')
  await page.getByRole('button', { name: 'Построить отчёт' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Не удалось обновить отчёт.' })).toBeVisible()
  await expect(page.locator('time')).toHaveAttribute('datetime', '2026-09-01')
})

for (const width of [320, 390, 1440]) {
  test('помещает интерфейс на ширине ' + width + ' px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('table')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Проект', { exact: true })).toBeFocused()
  })
}
