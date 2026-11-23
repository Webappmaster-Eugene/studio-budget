import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const username = process.env.LEDGER_TEST_USERNAME
const password = process.env.LEDGER_TEST_PASSWORD
const origin = process.env.LEDGER_TEST_URL
if (!username || !password || !origin) throw new Error('Set test URL and account credentials')
const headers = { Origin: new URL(origin).origin }
const unique = () => 'ПР-' + randomUUID().slice(0, 8)

async function loginApi(request: APIRequestContext) {
  const result = await request.post('/api/auth/login', { headers, data: { username, password } })
  expect(result.status()).toBe(200)
  return result
}

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Логин').fill(username ?? '')
  await page.getByLabel('Пароль').fill(password ?? '')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Договоры', exact: true })).toBeVisible()
}

function contractBody(reference = unique()) {
  return { reference, title: 'Подготовка выставки', signedOn: '2026-03-01', amount: '1200,00' }
}

const workBody = {
  title: 'Макет стенда', price: '800', openedOn: '2026-03-01', acceptedOn: '2026-03-10',
}

const paymentBody = {
  purpose: 'Оплата работ', amount: '500', recordedOn: '2026-03-02', paidOn: '2026-03-02',
}

async function cleanup(request: APIRequestContext, id: string) {
  const snapshot = await request.get('/api/contracts/' + id)
  if (!snapshot.ok()) return
  const body = await snapshot.json()
  const result = await request.delete('/api/contracts/' + id, { headers, data: { version: body.contract.version } })
  expect(result.status()).toBe(200)
}

test('защищает рабочие данные, проверяет вход и отзывает сессию на выходе', async ({ request }) => {
  expect((await request.get('/api/contracts')).status()).toBe(401)
  expect((await request.post('/api/contracts', { headers, data: contractBody() })).status()).toBe(401)

  const wrong = await request.post('/api/auth/login', { headers, data: { username, password: 'wrong password' } })
  expect(wrong.status()).toBe(401)
  expect((await request.get('/api/contracts')).status()).toBe(401)

  const valid = await loginApi(request)
  expect(valid.headers()['set-cookie']).toContain('HttpOnly')
  expect(valid.headers()['set-cookie']).toContain('SameSite=lax')
  expect((await request.get('/api/contracts')).status()).toBe(200)

  const logout = await request.post('/api/auth/logout', { headers })
  expect(logout.status()).toBe(200)
  expect((await request.get('/api/contracts')).status()).toBe(401)
})

test('проверяет origin, дубли, связи и конкурирующие изменения', async ({ request }) => {
  await loginApi(request)
  const forbidden = await request.post('/api/contracts', {
    headers: { Origin: 'https://foreign.example' }, data: contractBody(),
  })
  expect(forbidden.status()).toBe(403)
  const body = contractBody()
  const first = await request.post('/api/contracts', { headers, data: body })
  const second = await request.post('/api/contracts', { headers, data: contractBody() })
  expect(first.status()).toBe(201)
  expect(second.status()).toBe(201)
  const contract = await first.json()
  const other = await second.json()
  const url = '/api/contracts/' + contract.id

  try {
    const duplicate = await request.post('/api/contracts', {
      headers, data: { ...body, reference: body.reference.toLowerCase() },
    })
    expect(duplicate.status()).toBe(409)

    expect((await request.get(url + '?asOf=2025-02-29')).status()).toBe(400)
    expect((await request.get('/api/contracts/invalid')).status()).toBe(404)

    const updates = await Promise.all(['Версия А', 'Версия Б'].map((title) => request.patch(url, {
      headers, data: { ...body, title, version: contract.version },
    })))
    expect(updates.map((response) => response.status()).sort()).toEqual([200, 409])

    const workResponse = await request.post(url + '/works', { headers, data: workBody })
    expect(workResponse.status()).toBe(201)
    const work = await workResponse.json()
    const wrongLink = await request.post('/api/contracts/' + other.id + '/payments', {
      headers, data: { ...paymentBody, workId: work.id },
    })
    expect(wrongLink.status()).toBe(400)

    const tooEarly = await request.post(url + '/payments', {
      headers, data: { ...paymentBody, recordedOn: '2026-02-28', workId: work.id },
    })
    expect(tooEarly.status()).toBe(400)
    const paymentResponse = await request.post(url + '/payments', {
      headers, data: { ...paymentBody, workId: work.id },
    })
    expect(paymentResponse.status()).toBe(201)
    const savedPayment = await paymentResponse.json()
    const conflict = await request.delete(url + '/works/' + work.id, { headers, data: { version: work.version } })
    expect(conflict.status()).toBe(409)
    const invalidChange = await request.patch(url + '/works/' + work.id, {
      headers, data: { ...workBody, openedOn: '2026-03-06', version: work.version },
    })
    expect(invalidChange.status()).toBe(409)

    const removedPayment = await request.delete(url + '/payments/' + savedPayment.id, {
      headers, data: { version: savedPayment.version },
    })
    expect(removedPayment.status()).toBe(200)
    const removedWork = await request.delete(url + '/works/' + work.id, { headers, data: { version: work.version } })
    expect(removedWork.status()).toBe(200)
  } finally {
    await cleanup(request, contract.id)
    await cleanup(request, other.id)
  }
})

test('создаёт договор, работу и платежи в формах, сверяет отчёт и повторное открытие', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const reference = unique()
  const title = 'Оформление выставки ' + reference

  await login(page)
  await page.getByRole('button', { name: /Новый договор/ }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Название договора').fill(title)
  await dialog.getByLabel('Номер договора').fill(reference)
  await dialog.getByLabel('Дата подписания').fill('2026-03-01')
  await dialog.getByLabel('Сумма договора').fill('1200,00')
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  await page.getByRole('button', { name: 'Работы', exact: true }).click()
  await page.getByRole('button', { name: /Добавить работу/ }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Название работы').fill(workBody.title)
  await dialog.getByLabel('Цена работы').fill(workBody.price)
  await dialog.getByLabel('Дата постановки').fill(workBody.openedOn)
  await dialog.getByLabel('Дата приёмки').fill(workBody.acceptedOn)
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { name: workBody.title })).toBeVisible()

  await page.getByRole('button', { name: 'Платежи', exact: true }).click()
  await page.getByRole('button', { name: /Добавить платёж/ }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Назначение').fill('Общий аванс')
  await dialog.getByLabel('Сумма платежа').fill('700,09')
  await dialog.getByLabel('Дата записи платежа').fill('2026-03-02')
  await dialog.getByLabel('Дата оплаты').fill('2026-03-02')
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { name: 'Общий аванс' })).toBeVisible()

  await page.getByRole('button', { name: /Добавить платёж/ }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Назначение').fill('Прямой платёж')
  await dialog.getByLabel('К чему относится платёж').selectOption({ label: workBody.title })
  await dialog.getByLabel('Сумма платежа').fill('300')
  await dialog.getByLabel('Дата записи платежа').fill('2026-03-02')
  await dialog.getByLabel('Дата оплаты').fill('2026-03-02')
  await dialog.getByText('Возврат платежа').click()
  await dialog.getByLabel('Дата возврата').fill('2026-03-12')
  await dialog.getByLabel('Сумма возврата').fill('100')
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { name: 'Прямой платёж' })).toBeVisible()

  await page.getByRole('button', { name: 'Отчёт', exact: true }).click()
  await page.getByLabel('Отчёт на дату').fill('2026-03-10')
  await expect(page.getByText('1 000,09 ₽', { exact: true })).toBeVisible()
  await expect(page.getByText('200,09 ₽', { exact: true })).toBeVisible()
  await page.getByLabel('Отчёт на дату').fill('2026-03-12')
  await expect(page.getByText('900,09 ₽', { exact: true })).toBeVisible()
  await expect(page.getByText('100,09 ₽', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByRole('row', { name: /Макет стенда/ })).toContainText('800')
  await page.getByLabel('Поиск договоров').fill('Номер которого нет')
  await expect(page.getByText('По этому запросу ничего не найдено.')).toBeVisible()
  await page.getByLabel('Поиск договоров').clear()

  await page.getByRole('button', { name: 'Изменить договор' }).click()
  dialog = page.getByRole('dialog')
  const updatedTitle = title + ' · исправлено'
  await dialog.getByLabel('Название договора').fill(updatedTitle)
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
  await expect(page.getByRole('row', { name: /Макет стенда/ })).toContainText('800')
  await page.getByRole('button', { name: 'Удалить договор' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('heading', { name: updatedTitle })).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const width of [320, 390, 1440]) {
  test('доступная форма на ширине ' + width + ' px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await page.getByRole('button', { name: /Новый договор/ }).click()
    await expect(page.getByRole('dialog').getByLabel('Название договора')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

test('импортирует выгрузку целиком и откатывает повторный пакет', async ({ page }) => {
  await login(page)
  const reference = unique()
  const titles = {
    contracts: 'contract_id,contractor,amount,signed_at',
    works: 'work_id,contract_id,title,price,status,completed_at,cancelled_at',
    payments: 'payment_id,contract_id,work_id,purpose,amount,status,created_at,paid_at,refunded_at',
  }
  const csv = {
    contracts: titles.contracts + '\n' + reference + ',"Площадка, отдел оформления",1200.75,2026-03-01\n',
    works: titles.works + '\nW-X,' + reference + ',Витрина,100.00,done,2026-03-05,\n',
    payments: titles.payments + '\nP-X,' + reference + ',,Аванс,50.05,paid,2026-03-02,2026-03-02,\n' +
      'P-Y,' + reference + ',W-X,Оплата,35.00,paid,2026-03-03,2026-03-03,\n',
  }

  await page.getByRole('button', { name: 'Импорт CSV' }).click()
  const dialog = page.getByRole('dialog')
  for (const [key, contents] of Object.entries(csv)) {
    await dialog.locator('[name="' + key + '"]').setInputFiles({
      name: key + '.csv', mimeType: 'text/csv', buffer: Buffer.from(contents),
    })
  }

  await dialog.getByRole('button', { name: 'Импортировать' }).click()
  await expect(page.getByRole('heading', { name: 'Договор ' + reference })).toBeVisible()
  await expect(page.getByText('85,05 ₽', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('row', { name: /Витрина/ })).toContainText('14,95')

  const list = await (await page.request.get('/api/contracts')).json()
  const contract = list.find((row: { reference: string }) => row.reference === reference)
  const fresh = unique()
  try {
    const duplicated = await page.request.post('/api/imports', {
      headers,
      data: { ...csv, contracts: csv.contracts + fresh + ',Организация,100.00,2026-03-01\n' },
    })
    expect(duplicated.status()).toBe(409)
    const current = await (await page.request.get('/api/contracts')).json()
    expect(current.some((row: { reference: string }) => row.reference === fresh)).toBe(false)
  } finally {
    await cleanup(page.request, contract.id)
  }
})


test('ограничивает попытки входа и размер JSON', async ({ request }) => {
  const bucket = { ...headers, 'x-real-ip': 'test-' + randomUUID() }
  for (let attempt = 1; attempt <= 11; attempt += 1) {
    const result = await request.post('/api/auth/login', {
      headers: bucket,
      data: { username, password: 'invalid password' },
    })
    expect(result.status()).toBe(attempt <= 10 ? 401 : 429)
  }
  const blocked = await request.post('/api/auth/login', { headers: bucket, data: { username, password } })
  expect(blocked.status()).toBe(429)
  await loginApi(request)

  const malformed = await request.post('/api/contracts', {
    headers: { ...headers, 'Content-Type': 'application/json' }, data: '{',
  })
  expect(malformed.status()).toBe(400)
  const large = await request.post('/api/contracts', { headers, data: { title: 'x'.repeat(70_000) } })
  expect(large.status()).toBe(413)
})

test('форма входа использует POST до запуска JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: origin, javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('form').filter({ has: page.getByLabel('Пароль') })).toHaveAttribute('method', 'post')
  } finally {
    await context.close()
  }
})

test('списки меняют статусы в день события независимо от даты отчёта', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-03-08T12:00:00+03:00'))
  await loginApi(page.request)
  const reference = unique()
  const title = 'Проверка дат ' + reference
  const created = await page.request.post('/api/contracts', {
    headers, data: { ...contractBody(reference), title },
  })
  expect(created.status()).toBe(201)
  const contract = await created.json()
  const path = '/api/contracts/' + contract.id
  const entry = (name: string) => page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
  const openWorks = () => page.getByRole('button', { name: 'Работы', exact: true }).click()
  const openPayments = () => page.getByRole('button', { name: 'Платежи', exact: true }).click()

  try {
    for (const work of [
      { ...workBody, title: 'Будущая приёмка', acceptedOn: '2026-03-09' },
      { ...workBody, title: 'Будущая отмена', acceptedOn: '2026-03-06', cancelledOn: '2026-03-10' },
    ]) {
      expect((await page.request.post(path + '/works', { headers, data: work })).status()).toBe(201)
    }

    for (const payment of [
      { ...paymentBody, purpose: 'Будущая оплата', paidOn: '2026-03-09' },
      { ...paymentBody, purpose: 'Будущий возврат', refundedOn: '2026-03-10', refundedAmount: '100' },
    ]) {
      expect((await page.request.post(path + '/payments', { headers, data: payment })).status()).toBe(201)
    }

    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(reference) }).click()
    await page.getByLabel('Отчёт на дату').fill('2026-03-12')
    await openWorks()
    await expect(entry('Будущая приёмка').getByText('Плановая', { exact: true })).toBeVisible()
    await expect(entry('Будущая отмена').getByText('Принята', { exact: true })).toBeVisible()
    await openPayments()
    await expect(entry('Будущая оплата').getByText('В очереди', { exact: true })).toBeVisible()
    await expect(entry('Будущий возврат').getByText('Оплачен', { exact: true })).toBeVisible()
    await expect(entry('Будущий возврат').getByText('Возврат запланирован')).toBeVisible()

    await page.clock.setFixedTime(new Date('2026-03-09T00:00:00+03:00'))
    await openWorks()
    await expect(entry('Будущая приёмка').getByText('Принята', { exact: true })).toBeVisible()
    await openPayments()
    await expect(entry('Будущая оплата').getByText('Оплачен', { exact: true })).toBeVisible()

    await page.clock.setFixedTime(new Date('2026-03-10T00:00:00+03:00'))
    await openWorks()
    await expect(entry('Будущая отмена').getByText('Отменена', { exact: true })).toBeVisible()
    await openPayments()
    await expect(entry('Будущий возврат').getByText('Есть возврат', { exact: true })).toBeVisible()
    await expect(entry('Будущий возврат').getByText('Возврат запланирован')).toHaveCount(0)
  } finally {
    await cleanup(page.request, contract.id)
  }
})
