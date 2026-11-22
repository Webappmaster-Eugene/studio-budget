export const budgetCategories = [
  { id: 'design', label: 'Дизайн' },
  { id: 'production', label: 'Производство' },
  { id: 'materials', label: 'Материалы' },
  { id: 'logistics', label: 'Логистика' },
] as const

type Category = typeof budgetCategories[number]['id']

export type Project = {
  id: string
  name: string
  description: string
  budget: Record<Category, number>
  expenses: ReadonlyArray<{ category: Category; paidOn: string; kopecks: number }>
}

export const initialDate = '2026-10-18'

export const projects: readonly [Project, ...Project[]] = [
  {
    id: 'paper-fair',
    name: 'Осенняя книжная ярмарка',
    description: 'Концепция, оформление и выпуск материалов для осенней ярмарки.',
    budget: { design: 4_800_000, production: 9_200_000, materials: 2_800_000, logistics: 1_600_000 },
    expenses: [
      { category: 'design', paidOn: '2026-09-24', kopecks: 1_850_000 },
      { category: 'design', paidOn: '2026-10-10', kopecks: 2_350_000 },
      { category: 'production', paidOn: '2026-10-07', kopecks: 3_800_000 },
      { category: 'production', paidOn: '2026-10-18', kopecks: 5_850_000 },
      { category: 'materials', paidOn: '2026-10-12', kopecks: 1_475_050 },
      { category: 'materials', paidOn: '2026-10-22', kopecks: 925_000 },
      { category: 'logistics', paidOn: '2026-10-20', kopecks: 1_200_000 },
    ],
  },
  {
    id: 'bakery-identity',
    name: 'Фирменный стиль пекарни',
    description: 'Фирменный стиль, пробный тираж упаковки и доставка образцов.',
    budget: { design: 6_000_000, production: 3_500_000, materials: 1_800_000, logistics: 700_000 },
    expenses: [
      { category: 'design', paidOn: '2026-10-02', kopecks: 3_000_000 },
      { category: 'materials', paidOn: '2026-10-14', kopecks: 1_350_025 },
      { category: 'production', paidOn: '2026-10-21', kopecks: 2_200_000 },
      { category: 'design', paidOn: '2026-10-26', kopecks: 2_800_000 },
      { category: 'logistics', paidOn: '2026-10-28', kopecks: 520_000 },
    ],
  },
]
