import { readFile, readdir } from 'node:fs/promises'
import process from 'node:process'
import pg from 'pg'

const directory = new URL('../db/migrations/', import.meta.url)

export async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before applying migrations')

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()

  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2531539266)')
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    const applied = await client.query('SELECT name FROM schema_migrations')
    const appliedNames = new Set(applied.rows.map(({ name }) => name))
    const files = (await readdir(directory)).filter((file) => /^\d+_[a-z_]+\.sql$/.test(file)).sort()

    for (const file of files) {
      if (appliedNames.has(file)) continue
      await client.query(await readFile(new URL(file, directory), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
