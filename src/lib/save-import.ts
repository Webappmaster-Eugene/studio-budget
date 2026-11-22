import { transaction } from './db'
import type { ImportBatch } from './import'

export async function saveImport(batch: ImportBatch) {
  await transaction(async (client) => {
    await client.query(`
      INSERT INTO contracts (id, reference, title, counterparty, amount, signed_on)
      SELECT id, reference, title, counterparty, amount, "signedOn"
      FROM jsonb_to_recordset($1::jsonb)
        AS item(id uuid, reference text, title text, counterparty text, amount bigint, "signedOn" date)
    `, [JSON.stringify(batch.contracts)])
    await client.query(`
      INSERT INTO works (id, contract_id, title, source_reference, price, opened_on, accepted_on, cancelled_on)
      SELECT id, "contractId", title, "sourceReference", price, "openedOn", "acceptedOn", "cancelledOn"
      FROM jsonb_to_recordset($1::jsonb)
        AS item(id uuid, "contractId" uuid, title text, "sourceReference" text, price bigint, "openedOn" date,
          "acceptedOn" date, "cancelledOn" date)
    `, [JSON.stringify(batch.works)])
    await client.query(`
      INSERT INTO payments (id, contract_id, work_id, purpose, source_reference, amount, recorded_on, paid_on, refunded_on, refunded_amount)
      SELECT id, "contractId", "workId", purpose, "sourceReference", amount, "recordedOn", "paidOn", "refundedOn", "refundedAmount"
      FROM jsonb_to_recordset($1::jsonb)
        AS item(id uuid, "contractId" uuid, "workId" uuid, purpose text, "sourceReference" text, amount bigint, "recordedOn" date,
          "paidOn" date, "refundedOn" date, "refundedAmount" bigint)
    `, [JSON.stringify(batch.payments)])
  })
}
