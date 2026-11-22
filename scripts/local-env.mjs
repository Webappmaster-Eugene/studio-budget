import { randomBytes, scryptSync } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import process from 'node:process'

const port = process.env.APP_PORT ?? '3212'
if (!/^\d{2,5}$/.test(port) || Number(port) > 65535 || Number(port) < 1024) throw new Error('Choose APP_PORT from 1024 to 65535')

const username = 'reviewer'
const token = randomBytes(12).toString('base64url')
const salt = randomBytes(16)
const hash = salt.toString('base64url') + ':' + scryptSync(token, salt, 32).toString('base64url')

writeFileSync('.env', [
  'APP_PORT=' + port,
  'APP_ORIGIN=http://127.0.0.1:' + port,
  'APP_USERNAME=' + username,
  'APP_PASSWORD_HASH=' + hash,
  'POSTGRES_PASSWORD=' + randomBytes(24).toString('hex'),
].join('\n') + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' })

process.stdout.write('Локальный логин: ' + username + '\nЛокальный пароль: ' + token + '\n')
