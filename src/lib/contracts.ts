export type Contract = {
  id: string
  reference: string
  title: string
  counterparty: string
  amount: string
  signedOn: string
  version: number
}

export type Work = {
  id: string
  sourceReference?: string | null
  title: string
  price: string
  openedOn: string
  acceptedOn: string | null
  cancelledOn: string | null
  version: number
}

export type Payment = {
  id: string
  sourceReference?: string | null
  workId: string | null
  purpose: string
  amount: string
  recordedOn: string
  paidOn: string | null
  refundedOn: string | null
  refundedAmount: string | null
  version: number
}

export type ContractData = { contract: Contract; works: Work[]; payments: Payment[] }
export type WorkStatus = 'planned' | 'accepted' | 'cancelled'
export type WorkBalance = {
  id: string
  title: string
  status: WorkStatus
  price: string
  direct: string
  allocated: string
  paid: string
  due: string
  attention: 'cancelled-paid' | 'overpaid' | null
}

export type Statement = {
  active: boolean
  asOf: string
  contractAmount: string
  worksAmount: string
  paid: string
  allocated: string
  advance: string
  acceptedDue: string
  plannedDue: string
  works: WorkBalance[]
}
