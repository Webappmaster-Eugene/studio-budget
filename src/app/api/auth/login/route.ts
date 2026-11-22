import { createSession, sessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { checkOrigin, json, readJson, routeError } from '@/lib/http'

export async function POST(request: Request) {
  try {
    checkOrigin(request)
    const { username, password } = await readJson(request)
    const token = await createSession(request, username, password)
    const response = json({ ok: true })
    response.cookies.set(SESSION_COOKIE, token, sessionCookie())
    return response
  } catch (error) {
    return routeError(error)
  }
}
