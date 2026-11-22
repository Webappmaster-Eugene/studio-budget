import { describe, expect, it } from 'vitest'
import type { ContractData, Payment, Work } from '../src/lib/contracts'
import { contractInput, paymentInput, workInput } from '../src/lib/input'
import { createStatement } from '../src/lib/statement'
import { decimalMoney, humanMoney, isCalendarDate } from '../src/lib/values'

const work = (id: string, price: string, acceptedOn: string | null, changes: Partial<Work> = {}): Work => ({
  id, title: 'Работа ' + id, price, openedOn: '2026-03-01', acceptedOn, cancelledOn: null, version: 1, ...changes,
})
const payment = (id: string, amount: string, changes: Partial<Payment> = {}): Payment => ({
  id, purpose: 'Платёж ' + id, amount, workId: null, recordedOn: '2026-03-04',
  paidOn: '2026-03-04', refundedOn: null, refundedAmount: null, version: 1, ...changes,
})

const data = (works: Work[], payments: Payment[]): ContractData => ({
  contract: { id: 'demo', title: 'Витрина', counterparty: '', signedOn: '2026-03-01', amount: '400000', reference: 'ДС-7', version: 1 },
  works, payments,
})

describe('отчёт на дату', () => {
  it('сначала учитывает прямой платёж и распределяет аванс по дате приёмки', () => {
    const seed = data(
      [work('b', '10000', '2026-03-09'), work('a', '10000', '2026-03-05'), work('c', '50000', null)],
      [payment('p1', '15000'), payment('p2', '3000', { workId: 'b' })],
    )
    const result = createStatement(seed, '2026-03-10')
    expect(result).toMatchObject({ paid: '18000', advance: '0', allocated: '18000', acceptedDue: '2000', plannedDue: '50000' })
    expect(result.works).toMatchObject([
      { id: 'b', direct: '3000', allocated: '5000', paid: '8000', due: '2000' },
      { id: 'a', paid: '10000', due: '0' },
      { id: 'c', status: 'planned', paid: '0' },
    ])
  })

  it('сохраняет точные копейки и не трогает будущие работы', () => {
    const result = createStatement(data([
      work('a', '99999999999999', '2026-03-02'),
      work('b', '1000', null, { openedOn: '2026-03-19' }),
    ], [payment('p', '99999999999998')]), '2026-03-04')
    expect(result).toMatchObject({ paid: '99999999999998', acceptedDue: '1', plannedDue: '0' })
    expect(result.works.map(({ id }) => id)).toEqual(['a'])
  })

  it('учитывает частичный и полный возврат с даты возврата', () => {
    const seed = data([], [
      payment('p1', '10000', { refundedOn: '2026-03-10', refundedAmount: '2500' }),
      payment('p2', '1000', { refundedOn: '2026-03-11', refundedAmount: '1000' }),
      payment('p3', '7777', { paidOn: null }),
      payment('p4', '3150', { paidOn: '2026-03-12' }),
    ])
    expect(createStatement(seed, '2026-03-09').paid).toBe('11000')
    expect(createStatement(seed, '2026-03-10').paid).toBe('8500')
    expect(createStatement(seed, '2026-03-11').paid).toBe('7500')
    expect(createStatement(seed, '2026-03-12').paid).toBe('10650')
  })

  it('сохраняет прямые выплаты при отмене и открывает аванс для других работ', () => {
    const seed = data([
      work('a', '10000', '2026-03-02', { cancelledOn: '2026-03-07' }),
      work('b', '10000', '2026-03-03'),
    ], [payment('p1', '2000', { workId: 'a' }), payment('p2', '9000')])
    expect(createStatement(seed, '2026-03-06').works[0]?.paid).toBe('10000')
    expect(createStatement(seed, '2026-03-07').works).toMatchObject([
      { id: 'a', status: 'cancelled', paid: '2000', due: '0', attention: 'cancelled-paid' },
      { id: 'b', paid: '9000', due: '1000' },
    ])
  })

  it('показывает прямую переплату, сохраняет сумму и оставляет свободный аванс', () => {
    const result = createStatement(data([work('a', '1000', '2026-03-02')], [
      payment('p1', '1600', { workId: 'a' }), payment('p2', '500'),
    ]), '2026-03-04')
    expect(result).toMatchObject({ paid: '2100', allocated: '1600', advance: '500', acceptedDue: '0' })
    expect(result.works[0]).toMatchObject({ attention: 'overpaid', paid: '1600', due: '0' })
  })

  it('показывает пустое состояние до подписания договора', () => {
    expect(createStatement(data([work('a', '1000', null)], []), '2026-02-28'))
      .toMatchObject({ active: false, contractAmount: '0', works: [], paid: '0' })
  })
})

describe('валидация', () => {
  it('принимает точные суммы с запятой и сохраняет только рубли и копейки', () => {
    expect(contractInput({ reference: 'Д-1', title: 'Смета', signedOn: '2026-03-01', amount: '35,08' }).amount).toBe('3508')
    expect(decimalMoney('90071992547409971')).toBe('900719925474099.71')
    expect(humanMoney('3508')).toBe('35,08')
    expect(() => contractInput({ reference: 'Д-1', title: 'Смета', signedOn: '2026-03-01', amount: '35.081' })).toThrow()
  })

  it('проверяет календарь и порядок событий работы', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2025-02-29')).toBe(false)
    expect(() => workInput({ title: 'Макеты', price: '1', openedOn: '2026-03-04', acceptedOn: '2026-03-02' })).toThrow()
  })

  it.each([
    { recordedOn: '2026-03-04', paidOn: '2026-03-03' },
    { refundedOn: '2026-03-07', refundedAmount: '1' },
    { paidOn: '2026-03-06', refundedAmount: '1' },
    { paidOn: '2026-03-06', refundedOn: '2026-03-07', refundedAmount: '101' },
  ])('отклоняет противоречивый платёж %#', (changes) => {
    expect(() => paymentInput({ purpose: 'Оплата', amount: '100', recordedOn: '2026-03-04', ...changes })).toThrow()
  })
})
