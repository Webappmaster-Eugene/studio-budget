import type { Contract, Payment, Work } from './contracts'
import { RequestError } from './http'
import { isCalendarDate } from './values'

type Input = Record<string, unknown>

function text(value: unknown, label: string, max: number, required = true) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if ((required && !normalized) || normalized.length > max || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new RequestError(400, label + ' должен содержать ' + (required ? 'от 1 до ' : 'до ') + max + ' символов.')
  }
  return normalized
}

export function validDate(value: unknown, label: string) {
  if (!isCalendarDate(value)) throw new RequestError(400, 'Проверьте дату «' + label + '».')
  return value
}

function optionalDate(value: unknown, label: string) {
  return value === null || value === '' || value === undefined ? null : validDate(value, label)
}

function money(value: unknown, label: string, positive = false) {
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : ''
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new RequestError(400, 'Введите «' + label + '» в рублях с точностью до копейки.')
  }
  const [whole = '0', fraction = ''] = normalized.split('.')
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (positive && amount === 0n) throw new RequestError(400, 'Сумма должна быть больше нуля.')
  return amount.toString()
}

export function validId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) {
    throw new RequestError(404, 'Запись не найдена.')
  }
  return value
}

export function validVersion(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_646) {
    throw new RequestError(400, 'Нужна актуальная версия записи.')
  }
  return value
}

export function contractInput(input: Input): Omit<Contract, 'id' | 'version'> {
  return {
    reference: text(input.reference, 'Номер договора', 60),
    title: text(input.title, 'Название договора', 160),
    counterparty: text(input.counterparty, 'Контрагент', 160, false),
    amount: money(input.amount, 'Сумма договора'),
    signedOn: validDate(input.signedOn, 'Подписание'),
  }
}

export function workInput(input: Input): Omit<Work, 'id' | 'version'> {
  const openedOn = validDate(input.openedOn, 'Постановка работы')
  const acceptedOn = optionalDate(input.acceptedOn, 'Приёмка')
  const cancelledOn = optionalDate(input.cancelledOn, 'Отмена')
  if ((acceptedOn && acceptedOn < openedOn) || (cancelledOn && cancelledOn < (acceptedOn ?? openedOn))) {
    throw new RequestError(400, 'Дата приёмки или отмены предшествует предыдущему событию.')
  }
  return {
    title: text(input.title, 'Название работы', 160),
    price: money(input.price, 'Цена работы'),
    openedOn, acceptedOn, cancelledOn,
  }
}

export function paymentInput(input: Input): Omit<Payment, 'id' | 'version'> {
  const amount = money(input.amount, 'Сумма платежа', true)
  const recordedOn = validDate(input.recordedOn, 'Запись платежа')
  const paidOn = optionalDate(input.paidOn, 'Оплата')
  const refundedOn = optionalDate(input.refundedOn, 'Возврат')
  const refundEntered = input.refundedAmount !== null && input.refundedAmount !== undefined && input.refundedAmount !== ''
  const refundedAmount = refundEntered ? money(input.refundedAmount, 'Сумма возврата', true) : null

  if (paidOn && paidOn < recordedOn) throw new RequestError(400, 'Оплата не может быть раньше записи платежа.')
  if (Boolean(refundedOn) !== Boolean(refundedAmount)) throw new RequestError(400, 'Укажите и дату, и сумму возврата.')
  if (refundedOn && (!paidOn || refundedOn < paidOn)) throw new RequestError(400, 'Возврат возможен с даты оплаты.')
  if (refundedAmount && BigInt(refundedAmount) > BigInt(amount)) {
    throw new RequestError(400, 'Сумма возврата превышает сумму платежа.')
  }

  return {
    workId: input.workId ? validId(input.workId) : null,
    purpose: text(input.purpose, 'Назначение платежа', 160),
    amount, recordedOn, paidOn, refundedOn, refundedAmount,
  }
}
