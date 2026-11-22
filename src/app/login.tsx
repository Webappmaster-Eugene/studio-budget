'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { callApi, formValues, message } from './client'

export function Login() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const values = formValues(event.currentTarget)
    setPending(true)
    setError('')
    try {
      await callApi('/api/auth/login', { method: 'POST', body: JSON.stringify(values) })
      window.location.reload()
    } catch (reason) {
      setError(message(reason))
      setPending(false)
    }
  }

  return (
    <main className="login-layout">
      <div className="login-intro">
        <div className="identity"><span className="brand-mark" aria-hidden="true" /> Учёт выплат</div>
        <h1>Договоры и платежи</h1>
        <p>Ведите работы по договорам и сверяйте выплаты на любую дату.</p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Вход в рабочую область</h2>
        <label>Логин<input name="username" autoComplete="username" maxLength={128} required /></label>
        <label>Пароль<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={pending}>{pending ? 'Входим…' : 'Войти'}</button>
      </form>
    </main>
  )
}
