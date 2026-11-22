import process from 'node:process'
import { defineConfig } from '@playwright/test'

const baseURL = process.env.LEDGER_TEST_URL
if (!baseURL) throw new Error('Set LEDGER_TEST_URL to an isolated test instance')

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    locale: 'ru-RU',
    screenshot: 'only-on-failure',
  },
})
