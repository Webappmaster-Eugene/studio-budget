import { NextResponse } from 'next/server'

export class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function applicationOrigin() {
  const value = process.env.APP_ORIGIN
  if (!value) throw new Error('APP_ORIGIN is missing')
  const url = new URL(value)
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  if (url.origin !== value.replace(/\/$/, '') || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('APP_ORIGIN must be a HTTPS origin or an HTTP loopback')
  }
  return url
}

export function checkOrigin(request: Request) {
  if (request.headers.get('origin') !== applicationOrigin().origin) {
    throw new RequestError(403, 'Запрос отправлен с другого сайта.')
  }
}

export async function readJson(request: Request, limit = 65_536): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    throw new RequestError(415, 'Ожидается запрос в формате JSON.')
  }

  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, 'Пустой запрос.')

  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new RequestError(413, 'Запрос слишком большой.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'Некорректный запрос.')
  }
}

export function routeError(error: unknown) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status)

  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (code === '23505') return json({ error: 'Запись с таким уникальным значением уже существует.' }, 409)
  if (code === '23503') return json({ error: 'Связанная запись изменена или используется.' }, 409)
  process.stderr.write('Request error: ' + (typeof code === 'string' ? code : 'internal') + '\n')
  return json({ error: 'Не удалось завершить операцию. Попробуйте ещё раз.' }, 500)
}
