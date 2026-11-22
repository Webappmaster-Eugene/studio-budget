export type Amounts = {
  budgetKopecks: number
  spentKopecks: number
  leftKopecks: number
}

export type BudgetReport = {
  project: { id: string; name: string; description: string }
  asOf: string
  totals: Amounts
  categories: Array<Amounts & { id: string; label: string }>
}
