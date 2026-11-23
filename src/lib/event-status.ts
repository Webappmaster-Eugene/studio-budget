import type { Payment, Work, WorkStatus } from './contracts'

export function workStatusAt(work: Work, asOf: string): WorkStatus {
  if (work.cancelledOn && work.cancelledOn <= asOf) return 'cancelled'
  if (work.acceptedOn && work.acceptedOn <= asOf) return 'accepted'
  return 'planned'
}

export function paymentStatusAt(payment: Payment, asOf: string) {
  if (!payment.paidOn || payment.paidOn > asOf) return 'queued'
  if (payment.refundedOn && payment.refundedOn <= asOf) return 'refunded'
  return 'paid'
}
