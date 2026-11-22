import { defineConfig } from '@playwright/test'

// Toma las capturas de la guía contra la plataforma corriendo en local (repositorio
// care-software): la API (4000), la web (5173) y el escenario de ejemplo
// (`npm run guia:escenario` en care-software). Solo con datos ficticios.
//   npm run capturas
export default defineConfig({
  testDir: '.',
  outputDir: '../.resultados',
  timeout: 240000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.GUIA_PLATAFORMA_URL ?? 'http://localhost:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium',
    headless: true,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    actionTimeout: 15000,
  },
  expect: { timeout: 15000 },
})
