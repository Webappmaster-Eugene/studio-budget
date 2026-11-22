'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Contract, Payment, Work } from '@/lib/contracts'
import { dateToday, decimalMoney } from '@/lib/values'
import { callApi, formValues, message } from './client'

export type Editor =
  | { kind: 'contract'; value?: Contract }
  | { kind: 'work'; value?: Work }
  | { kind: 'payment'; value?: Payment }

type EditorProps = {
  editor: Editor
  contract?: Contract
  works: Work[]
  close: () => void
  save: (body: Record<string, unknown>) => Promise<void>
}

export function Modal({ title, children, busy, close }: {
  title: string
  children: ReactNode
  busy: boolean
  close: () => void
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => {
      event.preventDefault()
      if (!busy) close()
    }}>
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" type="button" onClick={close} disabled={busy} aria-label="Закрыть">×</button>
      </div>
      {children}
    </dialog>
  )
}

function Rubles({ title, name, value, required }: { title: string; name: string; value?: string | null; required?: boolean }) {
  return (
    <label>{title}
      <span className="money-input">
        <input name={name} inputMode="decimal" defaultValue={value ? decimalMoney(value) : ''} maxLength={15}
          pattern="[0-9]{1,12}([.,][0-9]{1,2})?" placeholder="0,00" required={required} />
        <span aria-hidden="true">₽</span>
      </span>
    </label>
  )
}

function DateField({ title, name, value, min, required }: {
  title: string
  name: string
  value?: string | null
  min?: string
  required?: boolean
}) {
  return <label>{title}<input type="date" name={name} defaultValue={value ?? ''} min={min ?? '0001-01-01'} max="9999-12-31" required={required} /></label>
}

const titles = {
  contract: ['Новый договор', 'Редактирование договора'],
  work: ['Новая работа', 'Редактирование работы'],
  payment: ['Новый платёж', 'Редактирование платежа'],
}

export function RecordEditor({ editor, contract, works, close, save }: EditorProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const defaultDate = contract ? [contract.signedOn, dateToday()].sort().at(-1) : dateToday()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const body = formValues(event.currentTarget)
    setPending(true)
    setError('')
    try {
      await save({ ...body, version: editor.value?.version })
    } catch (reason) {
      setError(message(reason))
      setPending(false)
    }
  }

  return (
    <Modal title={titles[editor.kind][editor.value ? 1 : 0] ?? ''} busy={pending} close={close}>
      <form className="record-form" onSubmit={submit}>
        {editor.kind === 'contract' && <>
          <label>Название договора<input name="title" autoComplete="off" placeholder="Например, обновление каталога"
            defaultValue={editor.value?.title} maxLength={160} required /></label>
          <div className="form-grid">
            <label>Номер договора<input name="reference" autoComplete="off" placeholder="Д-014"
              defaultValue={editor.value?.reference} maxLength={60} required /></label>
            <DateField title="Дата подписания" name="signedOn" value={editor.value?.signedOn ?? defaultDate} required />
          </div>
          <label>Контрагент <small>при необходимости</small><input name="counterparty" autoComplete="off"
            defaultValue={editor.value?.counterparty} maxLength={160} /></label>
          <Rubles title="Сумма договора" name="amount" value={editor.value?.amount} required />
        </>}
        {editor.kind === 'work' && <>
          <label>Название работы<input name="title" autoComplete="off" placeholder="Например, подготовка макетов"
            defaultValue={editor.value?.title} maxLength={160} required /></label>
          <div className="form-grid">
            <Rubles title="Цена работы" name="price" value={editor.value?.price} required />
            <DateField title="Дата постановки" name="openedOn" value={editor.value?.openedOn ?? defaultDate} min={contract?.signedOn} required />
          </div>
          <div className="form-grid">
            <DateField title="Дата приёмки" name="acceptedOn" value={editor.value?.acceptedOn} min={contract?.signedOn} />
            <DateField title="Дата отмены" name="cancelledOn" value={editor.value?.cancelledOn} min={contract?.signedOn} />
          </div>
          <p className="field-help">Пока даты приёмки и отмены пустые, работа остаётся плановой.</p>
        </>}
        {editor.kind === 'payment' && <>
          <label>Назначение<input name="purpose" autoComplete="off" placeholder="Например, аванс по договору"
            defaultValue={editor.value?.purpose} maxLength={160} required /></label>
          <label>К чему относится платёж
            <select name="workId" defaultValue={editor.value?.workId ?? ''}>
              <option value="">К договору целиком</option>
              {works.map((work) => <option key={work.id} value={work.id}>{work.title}</option>)}
            </select>
          </label>
          <div className="form-grid">
            <Rubles title="Сумма платежа" name="amount" value={editor.value?.amount} required />
            <DateField title="Дата записи платежа" name="recordedOn" value={editor.value?.recordedOn ?? defaultDate} min={contract?.signedOn} required />
          </div>
          <DateField title="Дата оплаты" name="paidOn" value={editor.value?.paidOn} min={contract?.signedOn} />
          <p className="field-help">Пустая дата оплаты оставляет платёж в очереди.</p>
          <details className="refund" open={editor.value?.refundedOn ? true : undefined}>
            <summary>Возврат платежа</summary>
            <div className="form-grid">
              <DateField title="Дата возврата" name="refundedOn" value={editor.value?.refundedOn} min={contract?.signedOn} />
              <Rubles title="Сумма возврата" name="refundedAmount" value={editor.value?.refundedAmount} />
            </div>
          </details>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary" type="button" onClick={close} disabled={pending}>Отмена</button>
          <button className="primary" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </form>
    </Modal>
  )
}

export function ConfirmDelete({ title, description, close, remove }: {
  title: string
  description: string
  close: () => void
  remove: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await remove()
    } catch (reason) {
      setError(message(reason))
      setPending(false)
    }
  }

  return (
    <Modal title={title} busy={pending} close={close}>
      <div className="record-form">
        <p className="field-help">{description}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary" onClick={close} disabled={pending}>Отмена</button>
          <button className="danger-filled" onClick={confirm} disabled={pending}>{pending ? 'Удаляем…' : 'Удалить'}</button>
        </div>
      </div>
    </Modal>
  )
}

const csvSources = [
  ['contracts', 'Договоры'],
  ['works', 'Работы'],
  ['payments', 'Платежи'],
] as const

export function CsvImporter({ close, done }: { close: () => void; done: (id?: string) => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const files = csvSources.map(([key]) => {
        const file = form.get(key)
        if (!(file instanceof File) || !file.size) throw new Error('Выберите все три CSV-файла.')
        if (file.size > 160_000) throw new Error('Каждый CSV-файл должен занимать до 160 КБ.')
        return file
      })
      const values = await Promise.all(files.map((file) => file.text()))
      const body = Object.fromEntries(csvSources.map(([key], index) => [key, values[index]]))
      const response = await callApi<{ ids: string[] }>('/api/imports', { method: 'POST', body: JSON.stringify(body) })
      await done(response.ids[0])
    } catch (reason) {
      setError(message(reason))
      setPending(false)
    }
  }

  return (
    <Modal title="Импорт договоров" busy={pending} close={close}>
      <form className="record-form" onSubmit={upload}>
        <p className="field-help">Загрузите три CSV с заголовками. Импорт создаёт новые договоры и проверяет всю выгрузку перед сохранением.</p>
        {csvSources.map(([key, label]) => <label key={key}>
          {label} <small>{key}.csv</small><input type="file" name={key} accept=".csv,text/csv" required />
        </label>)}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary" type="button" onClick={close} disabled={pending}>Отмена</button>
          <button className="primary" disabled={pending}>{pending ? 'Импортируем…' : 'Импортировать'}</button>
        </div>
      </form>
    </Modal>
  )
}
