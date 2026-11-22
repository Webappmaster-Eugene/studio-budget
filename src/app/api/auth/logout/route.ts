import { endSession, sessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { checkOrigin, json, routeError } from '@/lib/http'

export async function POST(request: Request) {
  try {
    checkOrigin(request)
    await endSession()
    const response = json({ ok: true })
    response.cookies.set(SESSION_COOKIE, '', sessionCookie(0))
    return response
  } catch (error) {
    return routeError(error)
  }
}
