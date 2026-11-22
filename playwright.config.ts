import process from 'node:process'
import { defineConfig } from '@playwright/test'

const baseURL = process.env.STUDIO_TEST_URL ?? 'http://127.0.0.1:3207'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    locale: 'ru-RU',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.STUDIO_TEST_URL
    ? undefined
    : { command: 'pnpm start', url: baseURL, env: { PORT: '3207' } },
})
