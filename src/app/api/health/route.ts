import { checkAuthConfiguration } from '@/lib/auth'
import { database } from '@/lib/db'
import { json } from '@/lib/http'
import { version } from '../../../../package.json'

export async function GET() {
  try {
    checkAuthConfiguration()
    await database().query('SELECT 1 FROM schema_migrations LIMIT 1')
    return json({ status: 'ok', version })
  } catch {
    return json({ status: 'unavailable', version }, 503)
  }
}
