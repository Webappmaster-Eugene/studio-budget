import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { database } from './db'
import { applicationOrigin, RequestError } from './http'

export const SESSION_COOKIE = 'project_session'
const SESSION_SECONDS = 12 * 60 * 60
function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

function credentials() {
  const username = process.env.APP_USERNAME
  const hash = process.env.APP_PASSWORD_HASH
  if (!username || !hash || !/^[\w-]{22}:[\w-]{43}$/.test(hash)) {
    throw new Error('Set APP_USERNAME and APP_PASSWORD_HASH')
  }
  return { username, hash }
}

export function checkAuthConfiguration() {
  credentials()
  applicationOrigin()
}

function sessionDigest(token: string) {
  return createHash('sha256').update(credentials().hash).update(':').update(token).digest('hex')
}

export function sessionCookie(maxAge = SESSION_SECONDS) {
  return {
    httpOnly: true,
    secure: applicationOrigin().protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function hasSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !/^[\w-]{43}$/.test(token)) return false
  const result = await database().query(
    'SELECT 1 FROM account_sessions WHERE digest = $1 AND expires_at > now()',
    [sessionDigest(token)],
  )
  return result.rowCount === 1
}

export async function requireSession() {
  if (!(await hasSession())) throw new RequestError(401, 'Войдите в рабочую область.')
}

function loginBucket(request: Request) {
  const source = request.headers.get('x-real-ip') ?? 'unknown'
  return createHash('sha256').update(source).digest('hex')
}

export async function createSession(request: Request, username: unknown, password: unknown): Promise<string> {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 128 || password.length > 128) {
    throw new RequestError(400, 'Введите логин и пароль.')
  }

  const { username: expected, hash } = credentials()
  const db = database()
  const bucket = loginBucket(request)
  await db.query('DELETE FROM login_limits WHERE expires_at <= now()')
  const { rows } = await db.query<{ attempts: number }>(`
    INSERT INTO login_limits (bucket, attempts, expires_at)
    VALUES ($1, 1, now() + interval '15 minutes')
    ON CONFLICT (bucket) DO UPDATE
    SET attempts = CASE WHEN login_limits.expires_at <= now() THEN 1 ELSE least(login_limits.attempts + 1, 11) END,
        expires_at = CASE WHEN login_limits.expires_at <= now() THEN excluded.expires_at ELSE login_limits.expires_at END
    RETURNING attempts
  `, [bucket])

  if ((rows[0]?.attempts ?? 11) > 10) throw new RequestError(429, 'Слишком много попыток. Повторите через 15 минут.')

  const [salt = '', digest = ''] = hash.split(':')
  const actual = await deriveKey(password, Buffer.from(salt, 'base64url'))
  if (username !== expected || !timingSafeEqual(actual, Buffer.from(digest, 'base64url'))) {
    throw new RequestError(401, 'Неверный логин или пароль.')
  }

  const token = randomBytes(32).toString('base64url')
  await db.query('DELETE FROM account_sessions WHERE expires_at <= now()')
  await db.query(`
    INSERT INTO account_sessions (digest, expires_at)
    VALUES ($1, now() + $2 * interval '1 second')
  `, [sessionDigest(token), SESSION_SECONDS])
  await db.query('DELETE FROM login_limits WHERE bucket = $1', [bucket])
  return token
}

export async function endSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token && /^[\w-]{43}$/.test(token)) {
    await database().query('DELETE FROM account_sessions WHERE digest = $1', [sessionDigest(token)])
  }
}
