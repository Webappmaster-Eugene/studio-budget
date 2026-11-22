import { requireSession } from './auth'
import { checkOrigin, routeError } from './http'

export async function workspaceRoute(request: Request, operation: () => Promise<Response>) {
  try {
    await requireSession()
    if (request.method !== 'GET') checkOrigin(request)
    return await operation()
  } catch (error) {
    return routeError(error)
  }
}
