import { Pool } from 'pg'
import type { PoolClient } from 'pg'

const globalDatabase = globalThis as typeof globalThis & { projectDatabase?: Pool }

export function database(): Pool {
  if (globalDatabase.projectDatabase) return globalDatabase.projectDatabase
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing')

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    max: 8,
  })
  pool.on('error', () => process.stderr.write('PostgreSQL idle connection error\n'))
  globalDatabase.projectDatabase = pool
  return pool
}

export async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
