import { expect, type Browser, type Locator, type Page } from '@playwright/test'
import path from 'node:path'

// Utilidades compartidas por los recorridos de la guía. Cada rol guarda sus capturas en
// guias/img/<rol>/ con el número del paso de su guía.
export const ESCRITORIO = { viewport: { width: 1366, height: 820 } }
export const MOVIL = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
export const CLAVE_DEMO = 'nco2026'

type Recorte = { x: number; y: number; width: number; height: number }

export function fotografo(rol: string) {
  const dir = path.join(__dirname, '..', 'guias', 'img', rol)
  return async function foto(page: Page, nombre: string, opciones: { completa?: boolean; zona?: Locator; recorte?: Recorte } = {}) {
    await page.waitForTimeout(400)
    const destino = path.join(dir, `${nombre}.jpg`)
    if (opciones.recorte) {
      await page.screenshot({ path: destino, type: 'jpeg', quality: 85, clip: opciones.recorte })
    } else if (opciones.zona) {
      await opciones.zona.screenshot({ path: destino, type: 'jpeg', quality: 85 })
    } else {
      await page.screenshot({ path: destino, type: 'jpeg', quality: 85, fullPage: opciones.completa ?? false })
    }
  }
}

/** Foto de la ventana emergente abierta, para que su texto se lea; si no hay, de la página. */
export async function fotoDialogo(foto: (page: Page, nombre: string, o?: { zona?: Locator }) => Promise<void>, page: Page, nombre: string) {
  await page.waitForTimeout(500)
  // role="dialog" es la capa que cubre la pantalla: se fotografía el panel que contiene.
  const panel = page.getByRole('dialog').last().locator(':scope > div').first()
  await foto(page, nombre, (await panel.count()) ? { zona: panel } : {})
}

/** Marca con un recuadro del color de acento el control que se debe usar en ese paso. */
export async function resaltar(...objetivos: Locator[]) {
  for (const o of objetivos) {
    await o.scrollIntoViewIfNeeded()
    await o.evaluate((el) => {
      el.setAttribute('data-guia', '')
      Object.assign((el as HTMLElement).style, { outline: '4px solid var(--color-accent)', outlineOffset: '3px', borderRadius: '8px' })
    })
  }
}

export async function quitarResaltado(page: Page) {
  await page.evaluate(() => document.querySelectorAll('[data-guia]').forEach((el) => {
    el.removeAttribute('data-guia')
    ;(el as HTMLElement).style.outline = ''
  }))
}

export async function abrir(browser: Browser, opciones: object) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-PE', timezoneId: 'America/Lima' })
  return ctx.newPage()
}

export async function ingresar(page: Page, usuario: string) {
  await page.goto('/login')
  await page.getByLabel('Correo o DNI').fill(usuario)
  await page.getByRole('textbox', { name: /Contraseña/ }).fill(CLAVE_DEMO)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await page.waitForLoadState('networkidle')
}

/** Navega por el menú lateral, como lo haría la persona. */
export async function irA(page: Page, opcion: string | RegExp) {
  await page.getByRole('navigation').getByRole('link', { name: opcion }).first().click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
}

/** Cierra el diálogo abierto con Escape o, si no responde, con Cancelar/Cerrar. */
export async function cerrarDialogo(page: Page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const dialogo = page.getByRole('dialog')
  if (await dialogo.count()) {
    const boton = dialogo.getByRole('button', { name: /Cancelar|Cerrar/ }).first()
    if (await boton.count()) await boton.click()
  }
  await page.waitForTimeout(300)
}
