import { test, expect, type Browser, type Page } from '@playwright/test'
import path from 'node:path'
import { abrir, CLAVE_DEMO, ESCRITORIO, fotoDialogo, fotografo, ingresar as ingresarComo, MOVIL, quitarResaltado, resaltar } from './comun'

// Recorrido de la guía del docente. Cada captura lleva el número del paso de
// guias/docente.md; si cambia la interfaz, se vuelve a ejecutar este script.
const foto = fotografo('docente')

async function ingresar(page: Page) {
  await ingresarComo(page, 'docente@nco.pe')
  await expect(page).toHaveURL(/\/inicio/)
}

/** Imagen de ejemplo que hace de "foto del papelógrafo" al adjuntar evidencias. */
async function fotoDeEjemplo(browser: Browser): Promise<string> {
  const p = await abrir(browser, { viewport: { width: 800, height: 600 } })
  await p.setContent(`<body style="margin:0;display:grid;place-items:center;height:100vh;background:#f4efe6;font-family:sans-serif">
    <div style="width:640px;height:440px;background:#fff;border:2px solid #ccc;padding:32px;box-sizing:border-box">
      <h1 style="color:#241E4E;margin:0 0 16px">Semáforo del cuerpo</h1>
      <p style="font-size:22px;color:#059669">● Verde: respiro despacio</p>
      <p style="font-size:22px;color:#B45309">● Ámbar: tomo agua</p>
      <p style="font-size:22px;color:#B91C1C">● Rojo: pido ayuda</p>
      <p style="margin-top:40px;color:#888">Imagen de ejemplo para la guía</p></div></body>`)
  const destino = path.join(__dirname, '..', '.resultados', 'papelografo-ejemplo.jpg')
  await p.screenshot({ path: destino, type: 'jpeg', quality: 80 })
  await p.context().close()
  return destino
}

test('guía del docente', async ({ browser }) => {
  // 1. Ingreso
  const web = await abrir(browser, ESCRITORIO)
  await web.goto('/login')
  await web.getByLabel('Correo o DNI').fill('docente@nco.pe')
  await web.getByRole('textbox', { name: /Contraseña/ }).fill(CLAVE_DEMO)
  await resaltar(web.getByRole('button', { name: /Ingresar/ }))
  // Solo el formulario: el panel de cuentas demo no existe para las docentes reales.
  await foto(web, '01-ingreso', { recorte: { x: 700, y: 40, width: 440, height: 480 } })
  await quitarResaltado(web)

  await web.getByRole('button', { name: /¿Olvidaste tu contraseña\?/ }).click()
  await expect(web.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible()
  await fotoDialogo(foto, web, '02-recuperar-contrasena')
  await web.getByRole('button', { name: 'Cancelar' }).click()

  // 2. Panel de inicio
  await ingresar(web)
  await foto(web, '03-inicio', { completa: true })

  // 3. Malla de sesiones
  await web.getByRole('link', { name: 'Sesiones' }).first().click()
  await web.waitForLoadState('networkidle')
  await resaltar(web.getByRole('tab', { name: /Sesión Activa/ }), web.getByRole('button', { name: 'Registrar Sesión y Aula' }))
  await foto(web, '04-sesiones')
  await quitarResaltado(web)
  await web.getByRole('button', { name: 'Tabla' }).click()
  await foto(web, '05-sesiones-tabla')

  // 4. Registro de aula desde el celular
  const cel = await abrir(browser, MOVIL)
  await ingresar(cel)
  await resaltar(cel.getByRole('button', { name: /Registrar Asistencia y Aula/ }))
  await foto(cel, '06-movil-inicio')
  await quitarResaltado(cel)
  await cel.getByRole('button', { name: /Registrar Asistencia y Aula/ }).click()
  await expect(cel.getByRole('heading', { name: /Registro de aula/ })).toBeVisible()
  await cel.waitForLoadState('networkidle')
  // Desde arriba: se ven los tres pasos y los contadores, no solo la lista.
  await cel.evaluate(() => window.scrollTo(0, 0))
  await resaltar(cel.getByRole('tab', { name: /Asistencia/ }).or(cel.getByRole('button', { name: /^1\. Asistencia/ })).first())
  await foto(cel, '07-movil-asistencia')
  await quitarResaltado(cel)

  const ana = cel.getByRole('button', { name: /Estudiante #3 .*Presente/ })
  await ana.click()
  await cel.getByRole('button', { name: /Estudiante #8 .*Presente/ }).click()
  await resaltar(cel.getByRole('button', { name: /Estudiante #3 / }), cel.getByRole('button', { name: /Estudiante #8 / }))
  await foto(cel, '08-movil-ausentes')
  await quitarResaltado(cel)

  await cel.getByRole('button', { name: /Continuar a calificación/ }).click()
  await expect(cel.getByText(/Nota:/).first()).toBeVisible()
  const notas = [14, 16, 0, 12, 18, 15, 13, 0, 17, 11, 16, 14, 19, 12]
  for (let n = 1; n <= notas.length; n++) {
    if (!notas[n - 1]) continue
    await cel.getByRole('button', { name: new RegExp(`^#${n} `) }).click()
    for (const d of String(notas[n - 1])) await cel.getByRole('button', { name: d, exact: true }).click()
    await cel.getByRole('button', { name: '✓', exact: true }).click()
    if (n === 2) {
      await cel.getByRole('button', { name: /^#3 / }).scrollIntoViewIfNeeded()
      await cel.getByRole('button', { name: /^#4 / }).click()
      await cel.getByRole('button', { name: '1', exact: true }).click()
      await resaltar(cel.getByRole('button', { name: /^#4 / }), cel.getByRole('button', { name: '2', exact: true }))
      await foto(cel, '09-movil-notas')
      await quitarResaltado(cel)
      await cel.getByRole('button', { name: '2', exact: true }).click()
      await cel.getByRole('button', { name: '✓', exact: true }).click()
      n = 4
    }
  }
  await cel.getByRole('button', { name: /Continuar al cierre/ }).click()
  await expect(cel.getByRole('heading', { name: /Evidencias de la sesión/ })).toBeVisible()

  await cel.getByRole('textbox', { name: /Observaciones generales|Comentario de la sesión/ }).first()
    .fill('Las estudiantes participaron con entusiasmo en la dinámica del semáforo.')
    .catch(() => cel.getByPlaceholder(/Observaciones generales/).fill('Las estudiantes participaron con entusiasmo en la dinámica del semáforo.'))
  const imagen = await fotoDeEjemplo(browser)
  await cel.getByLabel('Tomar fotografía de evidencia o adjuntar archivos').setInputFiles(imagen)
  await cel.waitForTimeout(1500)
  await resaltar(cel.getByRole('button', { name: /Adjuntar general|Tomar o adjuntar evidencias masivas/ }).first())
  await foto(cel, '10-movil-evidencias')
  await quitarResaltado(cel)

  const cerrar = cel.getByRole('button', { name: /Cerrar y sincronizar sesión/ })
  await resaltar(cerrar)
  await foto(cel, '11-movil-cerrar')
  await quitarResaltado(cel)
  await cerrar.click()
  await cel.waitForTimeout(2500)
  await expect(cel).toHaveURL(/\/formacion/)
  await foto(cel, '12-movil-sesion-cerrada')
  await cel.goto('/sesiones')
  await cel.waitForLoadState('networkidle')
  await cel.getByRole('tab', { name: /Ejecutadas/ }).click()
  await foto(cel, '12b-movil-sesion-ejecutada')

  // 5. Trabajar sin conexión
  await cel.goto('/inicio')
  await cel.waitForLoadState('networkidle')
  await cel.context().setOffline(true)
  await cel.evaluate(() => window.dispatchEvent(new Event('offline')))
  await cel.waitForTimeout(800)
  await foto(cel, '13-movil-sin-conexion')
  await cel.context().setOffline(false)
  await cel.evaluate(() => window.dispatchEvent(new Event('online')))

  // 6. Menú en el celular
  await cel.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  await cel.waitForTimeout(500)
  await foto(cel, '14-movil-menu')
  await cel.getByRole('button', { name: 'Cerrar menú de navegación' }).first().click().catch(() => {})

  // 7. Registro desde la computadora (misma sesión en la vista de escritorio)
  await web.goto('/aula')
  await web.waitForLoadState('networkidle')
  await foto(web, '15-escritorio-aula')

  // 8. Nómina de estudiantes y seguimiento
  await web.getByRole('link', { name: 'Estudiantes' }).first().click()
  await web.waitForLoadState('networkidle')
  await foto(web, '16-estudiantes')
  const postular = web.getByRole('button', { name: 'Postular' }).first()
  await resaltar(postular)
  await foto(web, '16b-estudiantes-postular')
  await quitarResaltado(web)
  await postular.click()
  await web.waitForTimeout(800)
  await fotoDialogo(foto, web, '16c-estudiantes-postular-dialogo')
  await web.keyboard.press('Escape')
  await web.goto('/estudiantes')
  await web.waitForLoadState('networkidle')
  await web.getByRole('tab', { name: /Matriz de Actividades/ }).click()
  await web.waitForTimeout(600)
  await foto(web, '17-estudiantes-matriz')


  // 9. Mi Formación
  await web.getByRole('link', { name: 'Mi Formación' }).first().click()
  await web.waitForLoadState('networkidle')
  await foto(web, '19-formacion')
  await foto(web, '20-formacion-criterios', { zona: web.getByText(/Criterios de Aprobación/).first().locator('xpath=ancestor::section[1] | ancestor::div[contains(@class,"rounded")][1]').first() })

  // 10. Asistente curricular
  // Desde f9ba51a el menú no enlaza al asistente: se abre por su dirección.
  await web.goto('/asistente')
  await web.waitForLoadState('networkidle')
  const panel = web.getByRole('region', { name: /Asistente Curricular/ })
  await foto(web, '21-asistente', { zona: panel })
  await panel.getByRole('textbox').fill('¿Cómo calmo al grupo después del recreo?')
  await panel.getByRole('button', { name: 'Enviar pregunta' }).click()
  await expect(panel.getByRole('list', { name: 'Fuentes citadas' })).toBeVisible({ timeout: 30000 })
  await foto(web, '22-asistente-respuesta', { zona: panel })
  await panel.getByRole('button', { name: /Buscador RAG/ }).click()
  await panel.getByRole('textbox').first().fill('metas a futuro')
  await panel.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(panel.getByText(/fragmentos? recuperados?/)).not.toHaveText(/^0 /, { timeout: 20000 })
  await web.waitForTimeout(800)
  await foto(web, '23-asistente-buscador', { zona: panel })

  // El asistente también responde con esta guía y enlaza a la sección.
  await panel.getByRole('button', { name: /Chat Asistente/ }).click()
  await panel.getByRole('textbox').fill('¿Cómo marco que una estudiante faltó?')
  await panel.getByRole('button', { name: 'Enviar pregunta' }).click()
  const enlace = panel.getByRole('link', { name: 'ver la sección en la guía' }).last()
  await expect(enlace).toBeVisible({ timeout: 30000 })
  await resaltar(enlace)
  await foto(web, '24-asistente-guia-uso', { zona: panel })

  await cel.context().close()
  await web.context().close()
})
