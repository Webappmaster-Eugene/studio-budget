export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export async function callApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15_000),
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error('Нет соединения с сервером. Проверьте сеть и повторите.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data?.error || 'Не удалось завершить операцию.')
  if (data === null) throw new Error('Сервер вернул пустой ответ.')
  return data as T
}

export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form))
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось завершить операцию.'
}
