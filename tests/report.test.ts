import { describe, expect, it } from 'vitest'
import { GET as health } from '../src/app/api/health/route'
import { GET } from '../src/app/api/report/route'
import { initialDate, projects } from '../src/lib/fixtures'
import { createReport, isCalendarDate } from '../src/lib/report'

const [fair, bakery] = projects

describe('расчёт бюджета', () => {
  it('берёт расходы по дату включительно и показывает перерасход по статье', () => {
    const report = createReport(fair, initialDate)
    expect(report.totals).toEqual({
      budgetKopecks: 18_400_000,
      spentKopecks: 15_325_050,
      leftKopecks: 3_074_950,
    })
    expect(report.categories).toEqual([
      { id: 'design', label: 'Дизайн', budgetKopecks: 4_800_000, spentKopecks: 4_200_000, leftKopecks: 600_000 },
      { id: 'production', label: 'Производство', budgetKopecks: 9_200_000, spentKopecks: 9_650_000, leftKopecks: -450_000 },
      { id: 'materials', label: 'Материалы', budgetKopecks: 2_800_000, spentKopecks: 1_475_050, leftKopecks: 1_324_950 },
      { id: 'logistics', label: 'Логистика', budgetKopecks: 1_600_000, spentKopecks: 0, leftKopecks: 1_600_000 },
    ])
    expect(createReport(fair, '2026-10-17').totals.spentKopecks).toBe(9_475_050)
  })

  it('сохраняет полный план при отсутствии расходов', () => {
    expect(createReport(fair, '2026-09-01').totals).toEqual({
      budgetKopecks: 18_400_000,
      spentKopecks: 0,
      leftKopecks: 18_400_000,
    })
  })

  it('отделяет расходы разных проектов', () => {
    expect(bakery).toBeDefined()
    if (!bakery) throw new Error('Ожидается второй демонстрационный проект')
    expect(createReport(bakery, initialDate).totals.spentKopecks).toBe(4_350_025)
  })

  it('проверяет календарную дату независимо от часового пояса', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-1-09')).toBe(false)
    expect(isCalendarDate('0000-01-01')).toBe(false)
  })
})

function request(query: string) {
  return GET(new Request('https://demo.example/api/report?' + query))
}

describe('HTTP API', () => {
  it('возвращает JSON отчёт без кеширования', async () => {
    const result = request('asOf=2026-10-18&project=bakery-identity')
    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('no-store')
    expect(await result.json()).toMatchObject({
      asOf: '2026-10-18',
      project: { id: 'bakery-identity' },
      totals: { spentKopecks: 4_350_025 },
    })
  })

  it.each([
    'project=paper-fair',
    'asOf=2026-02-29&project=paper-fair',
    'asOf=2026-10-18&asOf=2026-10-19&project=paper-fair',
    'asOf=2026-10-18&project=paper-fair&project=bakery-identity',
    'asOf=2026-10-18',
  ])('возвращает 400 при некорректных параметрах: %s', (query) => {
    expect(request(query).status).toBe(400)
  })

  it('возвращает 404 для отсутствующего проекта', () => {
    expect(request('asOf=2026-10-18&project=unknown').status).toBe(404)
  })

  it('сообщает версию запущенного приложения', async () => {
    expect(await health().json()).toEqual({ status: 'ok', version: '1.0.0' })
  })
})
