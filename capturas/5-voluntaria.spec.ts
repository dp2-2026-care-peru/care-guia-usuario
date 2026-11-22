import { test, expect } from '@playwright/test'
import { abrir, ESCRITORIO, fotografo, ingresar, quitarResaltado, resaltar } from './comun'

// Recorrido de la guía de la voluntaria (guias/voluntaria.md): revisa la evidencia
// que deja el recorrido de la docente (3-docente.spec.ts se ejecuta antes).
const foto = fotografo('voluntaria')

test('guía de la voluntaria', async ({ browser }) => {
  const web = await abrir(browser, ESCRITORIO)
  await ingresar(web, 'voluntaria@nco.pe')
  await expect(web).toHaveURL(/\/evidencias/)
  await web.waitForTimeout(800)
  // Solo la lista: los indicadores laterales de la cola aún usan valores de ejemplo del servidor.
  const lista = web.getByRole('heading', { name: 'Evidencias pendientes' }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
  const revisar = web.getByRole('button', { name: /Revisar/ }).first()
  await resaltar(revisar)
  await foto(web, '01-cola', { zona: lista })
  await quitarResaltado(web)
  await revisar.click()
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(1000)
  await foto(web, '02-revision')

  await web.getByRole('radio', { name: 'Aprobada' }).click()
  const retro = web.getByRole('textbox', { name: /Retroalimentación para la docente/ })
  await retro.fill('Buena evidencia del semáforo del cuerpo. En la próxima sesión adjunta también una foto del cierre.')
  const registrar = web.getByRole('button', { name: /Registrar dictamen/ })
  await expect(registrar).toBeEnabled()
  await resaltar(web.getByRole('radio', { name: 'Aprobada' }), registrar)
  await foto(web, '03-dictamen')
  await quitarResaltado(web)
  await registrar.click()
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(1200)

  await web.context().close()
})
