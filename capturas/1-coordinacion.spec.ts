import { test, expect } from '@playwright/test'
import { abrir, cerrarDialogo, ESCRITORIO, fotoDialogo, fotografo, ingresar, irA, quitarResaltado, resaltar } from './comun'

// Recorrido de la guía de coordinación, administración y monitoreo
// (guias/coordinacion.md). Usa la cuenta demo de coordinación.
const foto = fotografo('coordinacion')

test('guía de coordinación', async ({ browser }) => {
  const web = await abrir(browser, ESCRITORIO)
  await ingresar(web, 'coordinacion@nco.pe')
  await expect(web).toHaveURL(/\/analitica\/cobertura/)

  // Panel analítico
  await foto(web, '01-panel', { completa: true })
  await web.getByRole('tab', { name: 'Seguimiento a Docentes' }).click()
  await web.waitForTimeout(800)
  await foto(web, '02-panel-docentes')
  await web.getByRole('tab', { name: 'Seguimiento a Estudiantes' }).click()
  await web.waitForTimeout(800)
  await foto(web, '03-panel-estudiantes')
  await web.getByRole('tab', { name: 'Resumen Multinivel y Mapa' }).click()
  await web.waitForTimeout(500)
  await resaltar(web.getByRole('button', { name: /Exportar cobertura/ }))
  await foto(web, '04-panel-exportar')
  await quitarResaltado(web)

  // Estudiantes
  await irA(web, 'Estudiantes')
  await foto(web, '05-estudiantes')
  await web.getByRole('button', { name: /Nuevo Estudiante/ }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '06-estudiantes-nuevo')
  await cerrarDialogo(web)
  await web.getByRole('button', { name: /Importar Nómina/ }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '07-estudiantes-importar')
  await cerrarDialogo(web)

  // Egresadas
  await irA(web, 'Egresados')
  await foto(web, '08-egresadas')
  await web.getByRole('button', { name: 'Seguimiento' }).first().click()
  await web.waitForTimeout(700)
  await fotoDialogo(foto, web, '08b-egresadas-seguimiento')
  await cerrarDialogo(web)
  await web.getByRole('tab', { name: /Formularios de Encuesta/ }).click()
  await web.waitForTimeout(600)
  await foto(web, '09-egresadas-encuestas')
  await web.getByRole('tab', { name: /Resultados y Estadísticas/ }).click()
  await web.waitForTimeout(800)
  await foto(web, '10-egresadas-resultados')

  // Docentes
  await irA(web, 'Docentes')
  await foto(web, '11-docentes')
  await web.getByRole('button', { name: /Nuevo Docente/ }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '12-docentes-nuevo')
  await cerrarDialogo(web)
  await web.getByRole('tab', { name: /Matriz de Actividades/ }).click()
  await web.waitForTimeout(800)
  await foto(web, '13-docentes-matriz')
  await web.getByRole('tab', { name: 'Vista Padrón' }).click()
  await web.getByRole('link', { name: 'Rosa Docente de Ejemplo' }).click()
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(800)
  await foto(web, '13b-docente-detalle')

  // Territorio
  await irA(web, 'Territorio')
  await foto(web, '14-territorio')
  await web.getByRole('link', { name: /I\.E\. de ejemplo/ }).click()
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(800)
  await foto(web, '14b-territorio-colegio')
  await irA(web, 'Territorio')
  await web.getByRole('button', { name: 'Configurar regiones donde funciona CARE' }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '15-territorio-regiones')
  await cerrarDialogo(web)

  // Gestores
  await irA(web, 'Gestores')
  await foto(web, '16-gestores')
  await web.getByRole('link', { name: 'Jorge Gestor de Ejemplo' }).click()
  await web.waitForLoadState('networkidle')
  await web.waitForTimeout(800)
  await foto(web, '16b-gestor-detalle')
  await irA(web, 'Gestores')
  await web.getByRole('button', { name: /Nuevo Gestor/ }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '17-gestores-nuevo')
  await cerrarDialogo(web)

  // Malla curricular
  await irA(web, 'Malla Curricular')
  await foto(web, '18-malla')
  await web.getByRole('button', { name: 'Desplegar sesión 1', exact: true }).click()
  await web.waitForTimeout(500)
  await web.getByText('Configuración de Sesión #1', { exact: true }).evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -140)
  })
  await foto(web, '18b-malla-sesion')
  await web.getByRole('button', { name: /Gestionar Ejes/ }).click()
  await web.waitForTimeout(600)
  await fotoDialogo(foto, web, '19-malla-ejes')
  await cerrarDialogo(web)
  await web.getByRole('tab', { name: /Malla Formativa Docente/ }).click()
  await web.waitForTimeout(800)
  await foto(web, '20-malla-formativa')

  // Bitácora del asistente (sin enlace en el menú)
  await web.goto('/asistente/bitacora')
  await web.waitForLoadState('networkidle')
  await foto(web, '21-bitacora')

  await web.context().close()
})
