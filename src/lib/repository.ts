import type { PoolClient } from 'pg'
import type { Contract, ContractData, Payment, Work } from './contracts'
import { database, transaction } from './db'
import { RequestError } from './http'

const contractColumns = 'id, reference, title, counterparty, amount::text, signed_on::text AS "signedOn", version'
const workColumns = `id, title, source_reference AS "sourceReference", price::text, opened_on::text AS "openedOn",
  accepted_on::text AS "acceptedOn", cancelled_on::text AS "cancelledOn", version`
const paymentColumns = `id, work_id AS "workId", purpose, source_reference AS "sourceReference", amount::text, recorded_on::text AS "recordedOn",
  paid_on::text AS "paidOn", refunded_on::text AS "refundedOn", refunded_amount::text AS "refundedAmount", version`

type ContractInput = Omit<Contract, 'id' | 'version'>
type WorkInput = Omit<Work, 'id' | 'version'>
type PaymentInput = Omit<Payment, 'id' | 'version'>

function notFound(): never {
  throw new RequestError(404, 'Запись не найдена.')
}

function changed(): never {
  throw new RequestError(409, 'Запись уже изменилась. Обновите данные и повторите.')
}

async function lockContract(client: PoolClient, id: string) {
  const result = await client.query<{ signedOn: string; version: number }>(
    'SELECT signed_on::text AS "signedOn", version FROM contracts WHERE id = $1 FOR UPDATE', [id],
  )
  return result.rows[0] ?? notFound()
}

function checkDate(value: string, lower: string, message: string) {
  if (value < lower) throw new RequestError(400, message)
}

export async function listContracts() {
  const result = await database().query<Contract>(
    'SELECT ' + contractColumns + ' FROM contracts ORDER BY signed_on DESC, lower(reference), id',
  )
  return result.rows
}

export async function readContract(id: string): Promise<ContractData> {
  const result = await database().query<ContractData>(`
    SELECT
      (SELECT row_to_json(item) FROM (SELECT ${contractColumns}) item) AS contract,
      coalesce((SELECT jsonb_agg(item ORDER BY item."openedOn", item.id)
        FROM (SELECT ${workColumns} FROM works WHERE contract_id = contracts.id) item), '[]') AS works,
      coalesce((SELECT jsonb_agg(item ORDER BY item."recordedOn", item.id)
        FROM (SELECT ${paymentColumns} FROM payments WHERE contract_id = contracts.id) item), '[]') AS payments
    FROM contracts WHERE id = $1
  `, [id])
  return result.rows[0] ?? notFound()
}

export async function insertContract(input: ContractInput) {
  const result = await database().query<Contract>(`
    INSERT INTO contracts (reference, title, counterparty, amount, signed_on)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING ${contractColumns}
  `, [input.reference, input.title, input.counterparty, input.amount, input.signedOn])
  return result.rows[0] ?? notFound()
}

export async function updateContract(id: string, version: number, input: ContractInput) {
  return transaction(async (client) => {
    const current = await lockContract(client, id)
    if (current.version !== version) changed()
    const { rows } = await client.query<{ before: boolean }>(`
      SELECT EXISTS (SELECT 1 FROM works WHERE contract_id = $1 AND opened_on < $2)
        OR EXISTS (SELECT 1 FROM payments WHERE contract_id = $1 AND recorded_on < $2) AS before
    `, [id, input.signedOn])
    if (rows[0]?.before) throw new RequestError(409, 'Новая дата подписания позже уже внесённой работы или платежа.')

    const result = await client.query<Contract>(`
      UPDATE contracts SET reference = $2, title = $3, counterparty = $4,
        amount = $5, signed_on = $6, version = version + 1
      WHERE id = $1 RETURNING ${contractColumns}
    `, [id, input.reference, input.title, input.counterparty, input.amount, input.signedOn])
    return result.rows[0] ?? notFound()
  })
}

export async function deleteContract(id: string, version: number) {
  await transaction(async (client) => {
    const current = await lockContract(client, id)
    if (current.version !== version) changed()
    await client.query('DELETE FROM contracts WHERE id = $1', [id])
  })
}

async function touchContract(client: PoolClient, id: string) {
  await client.query('UPDATE contracts SET version = version + 1 WHERE id = $1', [id])
}

async function verifyWorkDate(client: PoolClient, contractId: string, workId: string, openedOn: string) {
  const { rows } = await client.query<{ before: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM payments WHERE contract_id = $1 AND work_id = $2 AND recorded_on < $3) AS before
  `, [contractId, workId, openedOn])
  if (rows[0]?.before) throw new RequestError(409, 'Дата постановки работы позже уже привязанного платежа.')
}

async function verifyLinkedWork(client: PoolClient, contractId: string, input: PaymentInput) {
  if (!input.workId) return
  const { rows } = await client.query<{ openedOn: string }>(
    'SELECT opened_on::text AS "openedOn" FROM works WHERE id = $1 AND contract_id = $2',
    [input.workId, contractId],
  )
  const linked = rows[0]
  if (!linked) throw new RequestError(400, 'Эта работа не относится к договору.')
  checkDate(input.recordedOn, linked.openedOn, 'Платёж записан раньше постановки связанной работы.')
}

export async function saveWork(contractId: string, input: WorkInput, existing?: { id: string; version: number }) {
  return transaction(async (client) => {
    const { signedOn } = await lockContract(client, contractId)
    checkDate(input.openedOn, signedOn, 'Работа не может быть поставлена раньше подписания договора.')
    const values = [contractId, input.title, input.price, input.openedOn, input.acceptedOn, input.cancelledOn]
    if (existing) await verifyWorkDate(client, contractId, existing.id, input.openedOn)

    const result = existing
      ? await client.query<Work>(`
        UPDATE works SET title = $2, price = $3, opened_on = $4, accepted_on = $5,
          cancelled_on = $6, version = version + 1
        WHERE contract_id = $1 AND id = $7 AND version = $8 RETURNING ${workColumns}
      `, [...values, existing.id, existing.version])
      : await client.query<Work>(`
        INSERT INTO works (contract_id, title, price, opened_on, accepted_on, cancelled_on)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${workColumns}
      `, values)

    const saved = result.rows[0] ?? changed()
    await touchContract(client, contractId)
    return saved
  })
}

export async function savePayment(contractId: string, input: PaymentInput, existing?: { id: string; version: number }) {
  return transaction(async (client) => {
    const { signedOn } = await lockContract(client, contractId)
    checkDate(input.recordedOn, signedOn, 'Платёж не может быть записан раньше подписания договора.')
    await verifyLinkedWork(client, contractId, input)
    const values = [
      contractId, input.workId, input.purpose, input.amount, input.recordedOn,
      input.paidOn, input.refundedOn, input.refundedAmount,
    ]

    const result = existing
      ? await client.query<Payment>(`
        UPDATE payments SET work_id = $2, purpose = $3, amount = $4, recorded_on = $5,
          paid_on = $6, refunded_on = $7, refunded_amount = $8, version = version + 1
        WHERE contract_id = $1 AND id = $9 AND version = $10 RETURNING ${paymentColumns}
      `, [...values, existing.id, existing.version])
      : await client.query<Payment>(`
        INSERT INTO payments (contract_id, work_id, purpose, amount, recorded_on, paid_on, refunded_on, refunded_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${paymentColumns}
      `, values)

    const saved = result.rows[0] ?? changed()
    await touchContract(client, contractId)
    return saved
  })
}

export async function deleteEntry(contractId: string, table: 'works' | 'payments', id: string, version: number) {
  await transaction(async (client) => {
    await lockContract(client, contractId)
    const sql = table === 'works'
      ? 'DELETE FROM works WHERE contract_id = $1 AND id = $2 AND version = $3'
      : 'DELETE FROM payments WHERE contract_id = $1 AND id = $2 AND version = $3'
    const result = await client.query(sql, [contractId, id, version])
    if (result.rowCount !== 1) changed()
    await touchContract(client, contractId)
  })
}
