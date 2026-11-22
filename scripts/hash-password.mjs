import { randomBytes, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '')
if (password.length < 12 || password.length > 128) {
  process.stderr.write('Пароль должен содержать от 12 до 128 символов.\n')
  process.exitCode = 1
} else {
  const salt = randomBytes(16)
  const digest = scryptSync(password, salt, 32)
  process.stdout.write(salt.toString('base64url') + ':' + digest.toString('base64url') + '\n')
}
