'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { BudgetReport } from '@/lib/report-types'

const integer = new Intl.NumberFormat('ru-RU')
const day = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })

function rubles(kopecks: number): string {
  const fraction = Math.abs(kopecks % 100)
  const whole = integer.format(Math.trunc(Math.abs(kopecks) / 100))
  const sign = kopecks < 0 ? '−' : ''
  return sign + whole + (fraction === 0 ? '' : ',' + String(fraction).padStart(2, '0'))
}

function shownDate(asOf: string): string {
  return day.format(new Date(asOf + 'T00:00:00Z'))
}

type DashboardProps = {
  projects: Array<{ id: string; name: string }>
  initialReport: BudgetReport
}

function ExpenseChart({ categories }: { categories: BudgetReport['categories'] }) {
  const maximum = Math.max(1, ...categories.map((row) => Math.max(row.budgetKopecks, row.spentKopecks)))
  const width = (amount: number) => ((amount / maximum) * 100) + '%'

  return (
    <figure className="chart" aria-hidden="true">
      <figcaption className="legend">
        <span><i className="key-plan" /> План</span>
        <span><i className="key-spent" /> Оплачено</span>
        <span><i className="key-over" /> Сверх плана</span>
      </figcaption>
      {categories.map((row) => (
        <div className="chart-row" key={row.id}>
          <span>{row.label}</span>
          <div className="tracks">
            <div className="track"><div className="bar plan-bar" style={{ width: width(row.budgetKopecks) }} /></div>
            <div className="track">
              <div className={row.leftKopecks < 0 ? 'bar over-bar' : 'bar spent-bar'} style={{ width: width(row.spentKopecks) }} />
            </div>
          </div>
        </div>
      ))}
    </figure>
  )
}

function ExpenseTable({ categories }: { categories: BudgetReport['categories'] }) {
  return (
    <table>
      <caption className="sr-only">Суммы по статьям расходов в рублях</caption>
      <thead>
        <tr>
          <th scope="col">Статья</th>
          <th scope="col">План, ₽</th>
          <th scope="col">Оплачено, ₽</th>
          <th scope="col">Остаток, ₽</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.label}</th>
            <td>{rubles(row.budgetKopecks)}</td>
            <td>{rubles(row.spentKopecks)}</td>
            <td className={row.leftKopecks < 0 ? 'over-text' : undefined}>
              {rubles(row.leftKopecks)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Dashboard({ projects, initialReport }: DashboardProps) {
  const [project, setProject] = useState(initialReport.project.id)
  const [asOf, setAsOf] = useState(initialReport.asOf)
  const [report, setReport] = useState(initialReport)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function requestReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')

    try {
      const query = new URLSearchParams({ asOf, project })
      const response = await fetch('/api/report?' + query, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) throw new Error('Отчёт недоступен')
      const nextReport: BudgetReport = await response.json()
      setReport(nextReport)
    } catch {
      setError('Не удалось обновить отчёт. Проверьте соединение и повторите запрос. Ниже остался предыдущий отчёт.')
    } finally {
      setPending(false)
    }
  }

  const { totals } = report
  const isOverBudget = totals.leftKopecks < 0
  const spentRatio = totals.budgetKopecks > 0 ? totals.spentKopecks / totals.budgetKopecks : 0

  return (
    <>
      <section className="overview" aria-labelledby="report-title">
        <div className="controls">
          <p className="demo-label">Демонстрационные данные</p>
          <h1 id="report-title">План и расходы</h1>
          <p className="intro">Выберите проект и дату, чтобы увидеть, сколько уже оплачено и какой остаток бюджета.</p>
          <form className="filters" onSubmit={requestReport}>
            <fieldset disabled={pending}>
              <legend className="sr-only">Параметры отчёта</legend>
              <div className="field project-field">
                <label htmlFor="project">Проект</label>
                <select id="project" value={project} onChange={(event) => setProject(event.currentTarget.value)}>
                  {projects.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="as-of">Дата отчёта</label>
                <input
                  id="as-of" type="date" value={asOf} required min="0001-01-01" max="9999-12-31"
                  onChange={(event) => setAsOf(event.currentTarget.value)}
                />
              </div>
              <button type="submit">{pending ? 'Обновляем…' : 'Построить отчёт'}</button>
            </fieldset>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </div>

        <div className={'balance' + (isOverBudget ? ' balance-over' : '')} aria-busy={pending}>
          <p className="report-date">На <time dateTime={report.asOf}>{shownDate(report.asOf)}</time></p>
          <dl className="balance-total">
            <dt>{isOverBudget ? 'Сверх бюджета' : 'Остаток бюджета'}</dt>
            <dd>{rubles(Math.abs(totals.leftKopecks))} <span>₽</span></dd>
          </dl>
          <div className="balance-track" aria-hidden="true">
            <div className="balance-fill" style={{ width: Math.min(spentRatio * 100, 100) + '%' }} />
          </div>
          <dl className="balance-detail">
            <div>
              <dt>План</dt>
              <dd>{rubles(totals.budgetKopecks)} <span>₽</span></dd>
            </div>
            <div>
              <dt>Оплачено</dt>
              <dd>{rubles(totals.spentKopecks)} <span>₽</span></dd>
            </div>
          </dl>
        </div>
      </section>
      <p className="sr-only" role="status">
        {pending ? 'Отчёт обновляется' : 'Отчёт на ' + shownDate(report.asOf) + '. ' + report.project.name}
      </p>
      <section className="report" aria-busy={pending} aria-labelledby="project-heading">
        <div className="report-heading">
          <h2 id="project-heading">{report.project.name}</h2>
          <p>{report.project.description}</p>
        </div>
        <section className="breakdown" aria-labelledby="breakdown-heading">
          <h3 id="breakdown-heading">Расходы по статьям</h3>
          {totals.spentKopecks === 0 && <p className="empty">К этой дате у проекта ещё нет оплаченных расходов.</p>}
          <div className="breakdown-grid">
            <ExpenseChart categories={report.categories} />
            <ExpenseTable categories={report.categories} />
          </div>
        </section>
      </section>
    </>
  )
}
