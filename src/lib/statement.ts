import type { ContractData, Payment, Statement, Work, WorkBalance, WorkStatus } from './contracts'

function state(work: Work, asOf: string): WorkStatus {
  if (work.cancelledOn && work.cancelledOn <= asOf) return 'cancelled'
  if (work.acceptedOn && work.acceptedOn <= asOf) return 'accepted'
  return 'planned'
}

function paymentNet(payment: Payment, asOf: string) {
  if (!payment.paidOn || payment.paidOn > asOf) return 0n
  const refund = payment.refundedOn && payment.refundedOn <= asOf ? BigInt(payment.refundedAmount ?? '0') : 0n
  return BigInt(payment.amount) - refund
}

function remaining(price: bigint, paid: bigint) {
  return price > paid ? price - paid : 0n
}

export function createStatement({ contract, works, payments }: ContractData, asOf: string): Statement {
  const active = contract.signedOn <= asOf
  const visible = active ? works.filter((work) => work.openedOn <= asOf) : []
  const direct = new Map<string, bigint>()
  let paid = 0n
  let advance = 0n
  for (const payment of active ? payments : []) {
    const net = paymentNet(payment, asOf)
    paid += net
    if (payment.workId) direct.set(payment.workId, (direct.get(payment.workId) ?? 0n) + net)
    else advance += net
  }

  const accepted = visible
    .filter((work) => state(work, asOf) === 'accepted')
    .sort((a, b) => ((a.acceptedOn ?? '') + (a.sourceReference ?? a.id)).localeCompare((b.acceptedOn ?? '') + (b.sourceReference ?? b.id)))

  const allocated = new Map<string, bigint>()
  for (const work of accepted) {
    const due = remaining(BigInt(work.price), direct.get(work.id) ?? 0n)
    const value = due < advance ? due : advance
    allocated.set(work.id, value)
    advance -= value
    if (advance === 0n) break
  }

  let worksAmount = 0n
  let acceptedDue = 0n
  let plannedDue = 0n
  const lines = visible.map((work): WorkBalance => {
    const status = state(work, asOf)
    const price = BigInt(work.price)
    const directPaid = direct.get(work.id) ?? 0n
    const allocatedPaid = allocated.get(work.id) ?? 0n
    const workPaid = directPaid + allocatedPaid
    const due = status === 'cancelled' ? 0n : remaining(price, workPaid)
    if (status !== 'cancelled') worksAmount += price
    if (status === 'accepted') acceptedDue += due
    if (status === 'planned') plannedDue += due

    const attention = status === 'cancelled' && workPaid > 0n
      ? 'cancelled-paid'
      : workPaid > price ? 'overpaid' : null

    return {
      id: work.id, title: work.title, status, price: work.price,
      direct: String(directPaid), allocated: String(allocatedPaid), paid: String(workPaid),
      due: String(due), attention,
    }
  })

  return {
    active, asOf, contractAmount: active ? contract.amount : '0',
    worksAmount: String(worksAmount), paid: String(paid), allocated: String(paid - advance),
    advance: String(advance), acceptedDue: String(acceptedDue), plannedDue: String(plannedDue), works: lines,
  }
}
