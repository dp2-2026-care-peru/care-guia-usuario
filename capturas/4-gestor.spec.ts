import { test, expect } from '@playwright/test'
import { abrir, ESCRITORIO, fotoDialogo, fotografo, ingresar, irA, quitarResaltado, resaltar } from './comun'

// Recorrido de la guía del gestor territorial (guias/gestor.md). Necesita la
// evidencia que deja el recorrido de la docente (3-docente.spec.ts se ejecuta antes).
const foto = fotografo('gestor')

test('guía del gestor territorial', async ({ browser }) => {
  const web = await abrir(browser, ESCRITORIO)
  await ingresar(web, 'gestor@nco.pe')
  await expect(web).toHaveURL(/\/analitica\/cobertura/)
  await foto(web, '01-panel')

  // Cartera de docentes (sin enlace en el menú)
  await web.goto('/cartera')
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(800)
  await foto(web, '02-cartera')
  await web.getByRole('combobox').filter({ hasText: 'Visita presencial a la I.E.' }).selectOption('LLAMADA')
  const nota = web.getByRole('textbox', { name: 'Registrar nuevo contacto' })
  await nota.fill('Llamé a la docente: confirmó que dictará la sesión 2 el lunes y pidió apoyo con la evaluación.')
  const guardar = web.getByRole('button', { name: 'Guardar en bitácora' })
  await resaltar(guardar)
  // Panel de la docente seleccionada (columna derecha de la cartera).
  const panelDocente = web.getByText('Docente seleccionada', { exact: true }).locator('xpath=ancestor::*[.//*[@role="tab"]][1]').first()
  await foto(web, '03-cartera-contacto', { zona: panelDocente })
  await quitarResaltado(web)
  await guardar.click()
  await web.waitForTimeout(1200)
  const registro = web.getByText(/Bitácora de contacto \(\d+\)/i).first()
  await registro.scrollIntoViewIfNeeded()
  await resaltar(registro.locator('xpath=following-sibling::*[1]'))
  await foto(web, '04-cartera-bitacora', { zona: panelDocente })
  await quitarResaltado(web)
  await web.getByRole('button', { name: 'Programar visita' }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '05-cartera-visita')
  await web.keyboard.press('Escape')
  await web.getByRole('tab', { name: /Criterios/ }).click()
  await web.waitForTimeout(700)
  await foto(web, '06-cartera-criterios', { zona: panelDocente })
  await web.getByRole('tab', { name: 'Malla Curricular Docentes' }).click()
  await web.waitForTimeout(800)
  await foto(web, '07-cartera-malla')
  await web.getByRole('tab', { name: 'Alumnos a Cargo' }).click()
  await web.waitForTimeout(800)
  await foto(web, '08-cartera-alumnos')

  // Evidencias (sin enlace en el menú)
  await web.goto('/evidencias')
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(800)
  // Solo la lista: los indicadores laterales de la cola aún usan valores de ejemplo del servidor.
  await foto(web, '09-evidencias', { zona: web.getByRole('heading', { name: 'Evidencias pendientes' }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]') })

  // Módulos del menú
  await irA(web, 'Docentes')
  await foto(web, '10-docentes')
  await irA(web, 'Estudiantes')
  await foto(web, '11-estudiantes')
  await irA(web, 'Territorio')
  await foto(web, '12-territorio')

  await web.context().close()
})
