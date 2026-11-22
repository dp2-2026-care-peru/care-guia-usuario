import { test, expect, type Page } from '@playwright/test'
// Ejecutar con la guía construida y servida: npm run build; npm run serve
//   npm run auditar   (en otra terminal)
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Auditoría de la guía de uso publicada: estructura del panel lateral, todas las páginas
// (escritorio y celular), imágenes, accesibilidad WCAG 2.2 AA y buscador.
const DOCS = path.join(__dirname, '..', 'docs')
const AXE = path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js')

interface Violacion { id: string; impact: string; help: string; nodes: Array<{ target: string[] }> }

/** Corre axe-core (WCAG 2.2 AA) sobre la página abierta. */
async function auditarAccesibilidad(page: Page): Promise<Violacion[]> {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: Violacion[] }> } }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target })) }))
  })
}

/** Perfiles y temas esperados, leídos de lo que generó construir.mjs. */
function estructuraEsperada() {
  return readdirSync(DOCS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const cat = JSON.parse(readFileSync(path.join(DOCS, d.name, '_category_.json'), 'utf8'))
      const temas = readdirSync(path.join(DOCS, d.name)).filter((f) => /^\d\d-.+\.md$/.test(f) && !f.startsWith('00-'))
      return { carpeta: d.name, etiqueta: cat.label as string, posicion: cat.position as number, temas: temas.length }
    })
    .sort((a, b) => a.posicion - b.posicion)
}

async function cargarImagenes(page: Page) {
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach((i) => { i.loading = 'eager' })
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r }))))
  })
}

/** Recorre el sitio desde la portada siguiendo los enlaces internos. */
async function rastrear(page: Page): Promise<string[]> {
  const vistas = new Set<string>()
  const pendientes = ['/']
  while (pendientes.length) {
    const ruta = pendientes.shift()!
    if (vistas.has(ruta)) continue
    vistas.add(ruta)
    await page.goto(ruta)
    const enlaces = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
    for (const href of enlaces) {
      const u = new URL(href)
      if (u.origin !== new URL(page.url()).origin || /\.(jpg|png|svg|xml)$/.test(u.pathname) || u.pathname.startsWith('/search')) continue
      const limpia = u.pathname.replace(/\/$/, '') || '/'
      if (!vistas.has(limpia)) pendientes.push(limpia)
    }
  }
  return [...vistas].sort()
}

test('auditoría de la guía de uso', async ({ browser }) => {
  const problemas: string[] = []
  const esperado = estructuraEsperada()
  const totalTemas = esperado.reduce((s, p) => s + p.temas, 0)

  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-PE' })
  const page = await ctx.newPage()
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(`${page.url()}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${page.url()}: ${m.text()}`) })

  // 1. Panel lateral: perfiles en orden y sus temas.
  await page.goto('/')
  const panel = page.getByRole('navigation', { name: /Barra lateral/ })
  for (const p of esperado) {
    const categoria = panel.getByRole('link', { name: p.etiqueta, exact: true })
    await expect(categoria, `perfil ${p.etiqueta} en el panel`).toBeVisible()
  }
  const etiquetas = await panel.locator('.theme-doc-sidebar-item-category-level-1 > .menu__list-item-collapsible > .menu__link').allInnerTexts()
  expect(etiquetas, 'orden de los perfiles').toEqual(esperado.map((p) => p.etiqueta))
  for (const p of esperado) {
    await page.goto(`/${p.carpeta}`)
    const temas = panel.locator('.menu__list-item--collapsed, .menu__list-item').filter({ has: page.locator(`a[href^="/${p.carpeta}/"]`) })
    const enlaces = await panel.locator(`a.menu__link[href^="/${p.carpeta}/"]`).count()
    if (enlaces !== p.temas) problemas.push(`Panel: ${p.etiqueta} muestra ${enlaces} temas, se esperaban ${p.temas}`)
    await expect(temas.first()).toBeVisible()
  }

  // 2. Todas las páginas en escritorio.
  const rutas = await rastrear(page)
  const esperadas = 1 + esperado.length + totalTemas
  if (rutas.length !== esperadas) problemas.push(`Rastreo: ${rutas.length} páginas, se esperaban ${esperadas}: ${rutas.join(', ')}`)

  for (const ruta of rutas) {
    const resp = await page.goto(ruta)
    if (!resp || resp.status() !== 200) problemas.push(`${ruta}: respuesta ${resp?.status()}`)
    await cargarImagenes(page)
    const r = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      const texto = main.textContent ?? ''
      return {
        h1: document.querySelectorAll('main h1, article h1').length,
        rotas: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')),
        sinAlt: [...document.images].filter((i) => !(i.getAttribute('alt') ?? '').trim()).map((i) => i.getAttribute('src')),
        desborde: document.documentElement.scrollWidth > window.innerWidth + 1,
        metadatos: /^\s*(pagina|claves):/m.test(texto),
        ingles: /\b(Search|Next|Previous|Edit this page|On this page)\b/.test(document.body.innerText),
        titulo: document.title,
      }
    })
    if (r.h1 !== 1) problemas.push(`${ruta}: ${r.h1} títulos h1`)
    if (r.rotas.length) problemas.push(`${ruta}: imágenes que no cargan ${r.rotas.join(', ')}`)
    if (r.sinAlt.length) problemas.push(`${ruta}: imágenes sin texto alternativo ${r.sinAlt.join(', ')}`)
    if (r.desborde) problemas.push(`${ruta}: desborde horizontal en escritorio`)
    if (r.metadatos) problemas.push(`${ruta}: quedaron líneas pagina:/claves: en el texto`)
    if (r.ingles) problemas.push(`${ruta}: textos de la interfaz en inglés`)
    if (ruta !== '/' && !/\S/.test(r.titulo)) problemas.push(`${ruta}: sin <title>`)

    for (const v of await auditarAccesibilidad(page)) problemas.push(`${ruta}: [axe ${v.impact}] ${v.id} · ${v.help} · ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)

    // Anterior/Siguiente nunca salen del perfil de la página.
    const perfil = ruta.split('/')[1]
    if (perfil) {
      const destinos = await page.locator('.pagination-nav a').evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname))
      for (const d of destinos) if (d.split('/')[1] !== perfil) problemas.push(`${ruta}: Anterior/Siguiente lleva a otro perfil (${d})`)
    }
    if (/^\/[^/]+\/[^/]+$/.test(ruta)) {
      const migas = await page.getByRole('navigation', { name: /Rastro de navegación/i }).count()
      if (!migas) problemas.push(`${ruta}: sin migas de pan`)
      const paginacion = await page.getByRole('navigation', { name: /Página del documento/i }).count()
      if (!paginacion) problemas.push(`${ruta}: sin navegación anterior/siguiente`)
    }
  }

  // 3. Celular: desborde, imágenes y menú.
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-PE' })
  const m = await cel.newPage()
  for (const ruta of rutas) {
    await m.goto(ruta)
    await cargarImagenes(m)
    const desborde = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (desborde) problemas.push(`${ruta}: desborde horizontal en celular`)
  }
  await m.goto('/docente/marcar-la-asistencia')
  await m.getByRole('button', { name: /Alternar barra/ }).click()
  for (const p of esperado) {
    if (!(await m.locator('.navbar-sidebar').getByRole('link', { name: p.etiqueta, exact: true }).isVisible())) problemas.push(`Celular: el menú no muestra ${p.etiqueta}`)
  }
  await cel.close()

  // 4. Buscador.
  await page.goto('/')
  await page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar/)).first().fill('asistencia')
  const sugerencias = page.locator('.aa-dropdown-menu, [role="listbox"]').first()
  await expect(sugerencias).toContainText(/Marcar la asistencia/, { timeout: 10000 }).catch(() => problemas.push('Buscador: «asistencia» no sugiere «Marcar la asistencia»'))
  await page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar/)).first().fill('dictamen')
  await expect(sugerencias).toContainText(/dictamen/i, { timeout: 10000 }).catch(() => problemas.push('Buscador: «dictamen» no encuentra el tema de la voluntaria'))

  if (errores.length) problemas.push(...errores.map((e) => `Consola: ${e}`))
  console.log(`\nAuditoría: ${rutas.length} páginas · ${esperado.length} perfiles · ${totalTemas} temas · ${problemas.length} problemas`)
  for (const p of problemas) console.log(' - ' + p)
  expect(problemas, problemas.join('\n')).toEqual([])
  await ctx.close()
})
