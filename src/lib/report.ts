import { budgetCategories } from './fixtures'
import type { Project } from './fixtures'
import type { Amounts, BudgetReport } from './report-types'

export function isCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false

  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function amounts(budgetKopecks: number, spentKopecks: number): Amounts {
  return { budgetKopecks, spentKopecks, leftKopecks: budgetKopecks - spentKopecks }
}

export function createReport(project: Project, asOf: string): BudgetReport {
  const spent = new Map<string, number>()
  for (const expense of project.expenses) {
    if (expense.paidOn > asOf) continue
    spent.set(expense.category, (spent.get(expense.category) ?? 0) + expense.kopecks)
  }

  const categories = budgetCategories.map(({ id, label }) => ({
    id,
    label,
    ...amounts(project.budget[id], spent.get(id) ?? 0),
  }))

  return {
    project: { id: project.id, name: project.name, description: project.description },
    asOf,
    totals: amounts(
      categories.reduce((total, category) => total + category.budgetKopecks, 0),
      categories.reduce((total, category) => total + category.spentKopecks, 0),
    ),
    categories,
  }
}
