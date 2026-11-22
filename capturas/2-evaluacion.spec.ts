import { test, expect } from '@playwright/test'
import { abrir, ESCRITORIO, fotografo, ingresar, irA } from './comun'

// Recorrido de la guía de evaluación de impacto (guias/evaluacion.md). Corre antes
// que la docente: sus notas de la sesión 1 agregan un eje duplicado al tablero (eje guardado
// con el nombre largo en vez del código).
const foto = fotografo('evaluacion')

test('guía de evaluación', async ({ browser }) => {
  const web = await abrir(browser, ESCRITORIO)
  await ingresar(web, 'evaluacion@nco.pe')
  await expect(web).toHaveURL(/\/analitica\/impacto/)
  await web.waitForTimeout(800)
  await foto(web, '01-impacto', { completa: true })

  await irA(web, 'Panel Analítico')
  await foto(web, '03-panel')
  await web.getByRole('tab', { name: 'Seguimiento a Estudiantes' }).click()
  await web.waitForTimeout(800)
  await foto(web, '04-panel-estudiantes')

  await web.goto('/analitica/egresadas')
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(800)
  await foto(web, '05-egresadas')

  await web.context().close()
})
