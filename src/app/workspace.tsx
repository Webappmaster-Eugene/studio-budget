'use client'

import { useEffect, useState } from 'react'
import type { Contract, ContractData, Statement } from '@/lib/contracts'
import { paymentStatusAt, workStatusAt } from '@/lib/event-status'
import { dateToday, humanMoney } from '@/lib/values'
import { ApiError, callApi, message } from './client'
import { ConfirmDelete, CsvImporter, RecordEditor } from './editor'
import type { Editor } from './editor'

type View = ContractData & { statement: Statement }
type Tab = 'report' | 'works' | 'payments'
type Deletion = { path: string; version: number; title: string; description: string; contract?: boolean }

const tabs: { id: Tab; label: string }[] = [
  { id: 'report', label: 'Отчёт' },
  { id: 'works', label: 'Работы' },
  { id: 'payments', label: 'Платежи' },
]

const workStatus = { planned: 'Плановая', accepted: 'Принята', cancelled: 'Отменена' }
const recordStatus = { ...workStatus, queued: 'В очереди', paid: 'Оплачен', refunded: 'Есть возврат' }

function dateLabel(value: string) {
  const [year, month, day] = value.split('-')
  return [day, month, year].join('.')
}

function Money({ amount }: { amount: string }) {
  return <span className="amount">{humanMoney(amount)}&nbsp;₽</span>
}

function StatementPanel({ statement }: { statement: Statement }) {
  if (!statement.active) return <div className="empty">На выбранную дату договор ещё не был подписан.</div>

  return (
    <>
      <dl className="summary-grid">
        <div><dt>Сумма договора</dt><dd><Money amount={statement.contractAmount} /></dd></div>
        <div className="summary-accent"><dt>Фактически выплачено</dt><dd><Money amount={statement.paid} /></dd></div>
        <div><dt>Аванс без распределения</dt><dd><Money amount={statement.advance} /></dd></div>
        <div><dt>Доплатить по принятым</dt><dd><Money amount={statement.acceptedDue} /></dd></div>
      </dl>
      <div className="statement-strip">
        <span>Действующие работы <strong><Money amount={statement.worksAmount} /></strong></span>
        <span>Отнесено на работы <strong><Money amount={statement.allocated} /></strong></span>
        <span>Остаток по плановым <strong><Money amount={statement.plannedDue} /></strong></span>
      </div>
      <section className="table-panel" aria-labelledby="statement-heading">
        <div className="panel-heading">
          <h3 id="statement-heading">Разбивка по работам</h3>
          <time dateTime={statement.asOf}>{dateLabel(statement.asOf)}</time>
        </div>
        {!statement.works.length ? (
          <p className="empty">К этой дате у договора нет работ.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th scope="col">Работа</th><th scope="col">Статус</th><th scope="col">Цена</th>
                <th scope="col">Прямые</th><th scope="col">Из аванса</th>
                <th scope="col">Выплачено</th><th scope="col">Осталось</th>
              </tr></thead>
              <tbody>
                {statement.works.map((work) => (
                  <tr key={work.id}>
                    <th scope="row">{work.title}
                      {work.attention && <small className="notice">
                        {work.attention === 'overpaid' ? 'Прямая переплата' : 'Оплата за отменённую работу'}
                      </small>}
                    </th>
                    <td><span className={'status ' + work.status}>{workStatus[work.status]}</span></td>
                    <td>{humanMoney(work.price)}</td><td>{humanMoney(work.direct)}</td>
                    <td>{humanMoney(work.allocated)}</td><td>{humanMoney(work.paid)}</td>
                    <td>{humanMoney(work.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <details className="calculation-note">
        <summary>Как распределяется аванс</summary>
        <p>Прямые платежи учитываются по связанным работам. Деньги без привязки закрывают принятые работы по очереди, начиная с самой ранней приёмки. Из выплат вычитаются возвраты, которые произошли к дате отчёта.</p>
      </details>
    </>
  )
}

function Register({ kind, data, edit, remove }: {
  kind: 'works' | 'payments'
  data: View
  edit: (editor: Editor) => void
  remove: (deletion: Deletion) => void
}) {
  const works = kind === 'works'
  const entries = works ? data.works : data.payments
  const label = works ? 'работу' : 'платёж'
  const titles = new Map(data.works.map((entry) => [entry.id, entry.title]))
  const today = dateToday()

  return (
    <section className="register">
      <div className="panel-heading">
        <h3>{works ? 'Работы по договору' : 'Платежи по договору'}</h3>
        <button className="primary" onClick={() => edit(works ? { kind: 'work' } : { kind: 'payment' })}>
          {works ? '+ Добавить работу' : '+ Добавить платёж'}
        </button>
      </div>
      {!entries.length && <p className="empty">{works ? 'Добавьте первую работу.' : 'Добавьте первый платёж.'}</p>}
      {entries.map((entry) => {
        const isWork = 'price' in entry
        const title = isWork ? entry.title : entry.purpose
        const linked = !isWork && entry.workId ? titles.get(entry.workId) : undefined
        const status = isWork ? workStatusAt(entry, today) : paymentStatusAt(entry, today)
        const action = () => edit(isWork
          ? { kind: 'work', value: entry }
          : { kind: 'payment', value: entry })
        return (
          <article className="entry" key={entry.id}>
            <div>
              <h4>{title}</h4>
              <span className="entry-meta">
                {isWork ? 'Поставлена ' + dateLabel(entry.openedOn) : linked ?? 'К договору целиком'}
              </span>
              {!isWork && entry.refundedAmount && (
                <small className="notice">
                  {status === 'refunded' ? 'Возврат' : 'Возврат запланирован'} <Money amount={entry.refundedAmount} />
                </small>
              )}
            </div>
            <div><Money amount={isWork ? entry.price : entry.amount} /><small className="entry-meta">{recordStatus[status]}</small></div>
            <div className="entry-actions">
              <button className="secondary" onClick={action} aria-label={'Изменить ' + title}>Изменить</button>
              <button className="danger" onClick={() => remove({
                path: '/api/contracts/' + data.contract.id + '/' + kind + '/' + entry.id,
                version: entry.version,
                title: 'Удалить ' + label + '?',
                description: 'Запись «' + title + '» будет удалена. Отчёт пересчитается.',
              })} aria-label={'Удалить ' + title}>Удалить</button>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export function Workspace({ initialContracts, initialDate }: { initialContracts: Contract[]; initialDate: string }) {
  const [contracts, setContracts] = useState(initialContracts)
  const [selected, setSelected] = useState(initialContracts[0]?.id ?? '')
  const [asOf, setAsOf] = useState(initialDate)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('report')
  const [view, setView] = useState<View | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [importing, setImporting] = useState(false)
  const [deletion, setDeletion] = useState<Deletion | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!selected || !asOf) return
    const controller = new AbortController()
    const path = '/api/contracts/' + selected + '?' + new URLSearchParams({ asOf })
    void callApi<View>(path, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setView(result) })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        if (reason instanceof ApiError && reason.status === 401) window.location.reload()
        else setError(message(reason))
      })

    return () => controller.abort()
  }, [selected, asOf, revision])

  const data = view?.contract.id === selected && view.statement.asOf === asOf ? view : null
  const selectedContract = contracts.find((contract) => contract.id === selected)
  const filtered = contracts.filter((contract) =>
    [contract.title, contract.reference, contract.counterparty].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )

  async function loadList(preferred?: string) {
    try {
      const next = await callApi<Contract[]>('/api/contracts')
      setContracts(next)
      setSelected(preferred && next.some((record) => record.id === preferred) ? preferred : (next[0]?.id ?? ''))
      setRevision((current) => current + 1)
    } catch (reason) {
      setError(message(reason))
    }
  }

  async function save(body: Record<string, unknown>) {
    if (!editor) return
    const item = editor.value
    const base = '/api/contracts'
    const path = editor.kind === 'contract'
      ? base + (item ? '/' + item.id : '')
      : base + '/' + selected + '/' + (editor.kind === 'work' ? 'works' : 'payments') + (item ? '/' + item.id : '')
    const result = await callApi<{ id: string }>(path, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(body) })
    setEditor(null)
    setError('')
    setView(null)
    setNotice('Запись сохранена.')
    setTab(editor.kind === 'work' ? 'works' : editor.kind === 'payment' ? 'payments' : 'report')
    await loadList(editor.kind === 'contract' ? result.id : selected)
  }

  async function remove() {
    if (!deletion) return
    await callApi(deletion.path, { method: 'DELETE', body: JSON.stringify({ version: deletion.version }) })
    setDeletion(null)
    setError('')
    setView(null)
    setNotice('Запись удалена.')
    if (deletion.contract) setTab('report')
    await loadList(deletion.contract ? undefined : selected)
  }

  async function logout() {
    setLeaving(true)
    try {
      await callApi('/api/auth/logout', { method: 'POST' })
      window.location.reload()
    } catch (reason) {
      setError(message(reason))
      setLeaving(false)
    }
  }

  function refresh() {
    setError('')
    void loadList(selected)
  }

  return (
    <>
      <header className="masthead">
        <div className="frame header-inner">
          <div className="identity"><span className="brand-mark" aria-hidden="true" /> Учёт выплат</div>
          <button className="secondary" onClick={logout} disabled={leaving}>Выйти</button>
        </div>
      </header>
      <main className="frame workspace">
        <aside className="sidebar" aria-label="Список договоров">
          <div className="sidebar-heading">
            <h1>Договоры</h1>
            <span>{contracts.length}</span>
          </div>
          <div className="sidebar-actions">
            <button className="primary" onClick={() => setEditor({ kind: 'contract' })}>+ Новый договор</button>
            <button className="secondary" onClick={() => setImporting(true)}>Импорт CSV</button>
          </div>
          {contracts.length > 0 && <label className="search-label">
            <span className="sr-only">Поиск договоров</span>
            <input type="search" placeholder="Найти договор" value={search}
              onChange={(event) => setSearch(event.currentTarget.value)} />
          </label>}
          <div className="case-list">
            {contracts.length > 0 && filtered.length === 0 && <p className="empty">По этому запросу ничего не найдено.</p>}
            {filtered.map((contract) => (
              <button key={contract.id} className="case-item" aria-pressed={selected === contract.id} onClick={() => {
                if (selected === contract.id) return
                setSelected(contract.id)
                setTab('report')
                setNotice('')
                setError('')
              }}>
                <small>{contract.reference}</small>
                <strong>{contract.title}</strong>
                {contract.counterparty && <span>{contract.counterparty}</span>}
              </button>
            ))}
          </div>
        </aside>
        <div className="content">
          {error && <div className="error recovery" role="alert"><span>{error}</span><button className="secondary" onClick={refresh}>Обновить</button></div>}
          {notice && <div className="success" role="status">{notice}</div>}
          {!selectedContract && (
            <section className="intro-empty">
              <h2>Создайте первый договор</h2>
              <p>Добавьте работы и платежи. Отчёт покажет выплаты, остаток и нераспределённый аванс на выбранную дату.</p>
              <button className="primary" onClick={() => setEditor({ kind: 'contract' })}>Создать договор</button>
            </section>
          )}
          {selectedContract && (
            <>
              <div className="contract-header">
                <div>
                  <p className="reference">{selectedContract.reference} <span>·</span> {dateLabel(selectedContract.signedOn)}</p>
                  <h2>{selectedContract.title}</h2>
                  {selectedContract.counterparty && <p className="counterparty">{selectedContract.counterparty}</p>}
                </div>
                <div className="contract-actions">
                  <button className="secondary" onClick={() => setEditor({ kind: 'contract', value: selectedContract })}>Изменить договор</button>
                  <button className="danger" onClick={() => setDeletion({
                    path: '/api/contracts/' + selectedContract.id,
                    version: selectedContract.version,
                    title: 'Удалить договор?',
                    description: 'Договор «' + selectedContract.title + '», его работы и платежи будут удалены.',
                    contract: true,
                  })}>Удалить договор</button>
                </div>
              </div>
              <div className="toolbar">
                <nav className="tabs" aria-label="Разделы договора">
                  {tabs.map((entry) => <button key={entry.id} aria-pressed={tab === entry.id} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
                </nav>
                {tab === 'report' && <label className="date-toolbar">Отчёт на дату
                  <input type="date" min="0001-01-01" max="9999-12-31" value={asOf} onChange={(event) => {
                    if (event.currentTarget.value && event.currentTarget.validity.valid) {
                      setAsOf(event.currentTarget.value)
                      setError('')
                    }
                  }} />
                </label>}
              </div>
              {!data && !error && <p className="loading" role="status">Загружаем договор…</p>}
              {data && (tab === 'report'
                ? <StatementPanel statement={data.statement} />
                : <Register kind={tab} data={data} edit={setEditor} remove={setDeletion} />)}
            </>
          )}
        </div>
      </main>
      {editor && <RecordEditor editor={editor} contract={selectedContract} works={data?.works ?? []} close={() => setEditor(null)} save={save} />}
      {importing && <CsvImporter close={() => setImporting(false)} done={async (id) => {
        setImporting(false)
        setError('')
        setView(null)
        setNotice('Договоры импортированы.')
        setTab('report')
        await loadList(id)
      }} />}
      {deletion && <ConfirmDelete title={deletion.title} description={deletion.description} close={() => setDeletion(null)} remove={remove} />}
    </>
  )
}
