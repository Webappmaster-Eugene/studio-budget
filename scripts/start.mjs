import { migrate } from './migrate.mjs'

await migrate()
await import('../server.js')
