import { randomUUID } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import type { Contract, Payment, Work } from './contracts'
import { RequestError } from './http'
import { contractInput, paymentInput, workInput } from './input'

type Row = Record<string, string>
type NewContract = Omit<Contract, 'version'>
type ImportedWork = Omit<Work, 'version'> & { contractId: string }
type ImportedPayment = Omit<Payment, 'version'> & { contractId: string }
export type ImportBatch = { contracts: NewContract[]; works: ImportedWork[]; payments: ImportedPayment[] }

const contractHeaders = ['contract_id', 'contractor', 'amount', 'signed_at']
const workHeaders = ['work_id', 'contract_id', 'title', 'price', 'status', 'completed_at', 'cancelled_at']
const paymentHeaders = ['payment_id', 'contract_id', 'work_id', 'purpose', 'amount', 'status', 'created_at', 'paid_at', 'refunded_at']

function entries(raw: unknown, name: string, headers: string[]) {
  if (typeof raw !== 'string' || !raw.trim()) throw new RequestError(400, 'Выберите файл ' + name + '.csv.')
  try {
    let readHeader = false
    const rows = parse<Row>(raw, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      max_record_size: 8192,
      columns: (actual) => {
        if (actual.length !== headers.length || headers.some((column) => !actual.includes(column))) {
          throw new RequestError(400, 'Проверьте колонки файла ' + name + '.csv.')
        }
        readHeader = true
        return actual
      },
    })
    if (!readHeader) throw new RequestError(400, 'Файл ' + name + '.csv должен иметь строку заголовков.')
    if (rows.length > 2000) throw new RequestError(400, 'В каждом файле допустимо до 2000 записей.')
    return rows
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(400, 'Не удалось прочитать CSV ' + name + '.csv. Проверьте разделители и кавычки.')
  }
}

function rowId(row: Row, key: string, seen: Set<string>) {
  const id = row[key]?.trim()
  if (!id) throw new RequestError(400, 'Обязательное поле ' + key + '.')
  if (seen.has(id.toLowerCase())) throw new RequestError(400, 'Повторяется идентификатор ' + id + '.')
  seen.add(id.toLowerCase())
  return id
}

function decode<T>(rows: Row[], name: string, callback: (row: Row) => T): T[] {
  return rows.map((row, index) => {
    try {
      return callback(row)
    } catch (error) {
      if (!(error instanceof RequestError)) throw error
      throw new RequestError(error.status, name + '.csv, запись ' + (index + 1) + '. ' + error.message)
    }
  })
}

export function parseImport(input: Record<string, unknown>): ImportBatch {
  const contractIds = new Set<string>()
  const workIds = new Set<string>()
  const paymentIds = new Set<string>()
  const byReference = new Map<string, NewContract>()
  const byWorkId = new Map<string, ImportedWork>()

  const contracts = decode(entries(input.contracts, 'contracts', contractHeaders), 'contracts', (row) => {
    const reference = rowId(row, 'contract_id', contractIds)
    const contract = { id: randomUUID(), ...contractInput({
      reference, title: 'Договор ' + reference, counterparty: row.contractor, amount: row.amount, signedOn: row.signed_at,
    }) }
    byReference.set(reference, contract)
    return contract
  })
  if (!contracts.length) throw new RequestError(400, 'Укажите хотя бы один договор.')

  const works = decode(entries(input.works, 'works', workHeaders), 'works', (row) => {
    const sourceId = rowId(row, 'work_id', workIds)
    const contract = byReference.get(row.contract_id ?? '')
    if (!contract) throw new RequestError(400, 'Договор работы отсутствует в выгрузке.')
    if (
      (row.status === 'planned' && (row.completed_at || row.cancelled_at)) ||
      (row.status === 'done' && (!row.completed_at || row.cancelled_at)) ||
      (row.status === 'cancelled' && (!row.cancelled_at || row.completed_at)) ||
      !['planned', 'done', 'cancelled'].includes(row.status ?? '')
    ) throw new RequestError(400, 'Статус работы и даты не согласованы.')
    const work = { id: randomUUID(), contractId: contract.id, sourceReference: sourceId, ...workInput({
      title: row.title, price: row.price, openedOn: contract.signedOn,
      acceptedOn: row.completed_at, cancelledOn: row.cancelled_at,
    }) }
    byWorkId.set(sourceId, work)
    return work
  })

  const payments = decode(entries(input.payments, 'payments', paymentHeaders), 'payments', (row) => {
    const sourceId = rowId(row, 'payment_id', paymentIds)
    const contract = byReference.get(row.contract_id ?? '')
    if (!contract) throw new RequestError(400, 'Договор платежа отсутствует в выгрузке.')
    const work = row.work_id ? byWorkId.get(row.work_id) : undefined
    if (row.work_id && work?.contractId !== contract.id) throw new RequestError(400, 'Работа платежа отсутствует в этом договоре.')
    if (
      (row.status === 'queued' && (row.paid_at || row.refunded_at)) ||
      (row.status === 'paid' && (!row.paid_at || row.refunded_at)) ||
      (row.status === 'refunded' && (!row.paid_at || !row.refunded_at)) ||
      !['queued', 'paid', 'refunded'].includes(row.status ?? '')
    ) throw new RequestError(400, 'Статус платежа и даты не согласованы.')
    const payment = { id: randomUUID(), contractId: contract.id, sourceReference: sourceId, ...paymentInput({
      purpose: row.purpose || 'Платёж ' + sourceId,
      amount: row.amount, workId: work?.id, recordedOn: row.created_at,
      paidOn: row.paid_at, refundedOn: row.refunded_at,
      refundedAmount: row.refunded_at ? row.amount : null,
    }) }
    if (payment.recordedOn < contract.signedOn) throw new RequestError(400, 'Платёж записан раньше подписания договора.')
    return payment
  })
  return { contracts, works, payments }
}
