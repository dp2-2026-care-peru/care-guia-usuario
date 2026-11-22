import { defineConfig } from '@playwright/test'

// Auditoría del sitio de la guía ya construido y servido (npm run build && npm run serve).
//   npm run build && npm run serve, y en otra terminal: npm run auditar
export default defineConfig({
  testDir: '.',
  outputDir: '../.resultados/auditoria',
  timeout: 600000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.GUIA_AUDITAR_URL ?? 'http://localhost:4173',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium',
    headless: true,
    locale: 'es-PE',
  },
})
