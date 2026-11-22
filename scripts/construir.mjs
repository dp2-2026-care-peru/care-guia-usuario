// Construye la guía de usuario a partir de guias/*.md (uno por perfil):
//   1. docs/: el contenido del sitio Docusaurus. Una carpeta por perfil (categoría del
//      panel lateral) con una introducción y una página por tema.
//   2. Si encuentra el repositorio de la plataforma (care-software, al lado de este o en
//      CARE_SOFTWARE):
//      - server/data/guias/10-guia-uso-<perfil>.md: la misma guía sin imágenes, para que el
//        asistente curricular la indexe y cite cada tema con su enlace.
//      - src/css/tokens.css: los colores de la plataforma, desde web/src/index.css.
//      Sin la plataforma (por ejemplo, en GitHub Actions) se usa el tokens.css versionado.
//
//   npm run construir
//   GUIA_URL_BASE=https://<org>.github.io/<repo>/ npm run construir
//
// GUIA_URL_BASE es la dirección pública del sitio: el asistente arma con ella el enlace
// de cada tema (<base><perfil>/<tema>). Sin la variable la copia guarda una ruta relativa
// y el asistente cita el tema sin enlace (así nunca se versiona una dirección local).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAIZ = join(REPO, 'guias')
const DOCUSAURUS = REPO
const DOCS = join(REPO, 'docs')
const PLATAFORMA = resolve(process.env.CARE_SOFTWARE ?? join(REPO, '..', 'care-software'))
const HAY_PLATAFORMA = existsSync(join(PLATAFORMA, 'server', 'data', 'guias')) && existsSync(join(PLATAFORMA, 'web', 'src', 'index.css'))
const GUIAS_ASISTENTE = join(PLATAFORMA, 'server', 'data', 'guias')
const BASE = process.env.GUIA_URL_BASE ? process.env.GUIA_URL_BASE.replace(/\/?$/, '/') : ''

/** Ancla (slug) de un tema. Debe coincidir con anclaSeccion() del asistente (Go). */
export function ancla(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const yaml = (v) => JSON.stringify(v)
const META_SECCION = /^(pagina|claves|grado):\s*(.*)$/i

function leerGuia(archivo) {
  const texto = readFileSync(archivo, 'utf8').replace(/\r\n/g, '\n')
  const m = texto.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) throw new Error(`${archivo}: falta el encabezado --- ... ---`)
  const meta = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:(.*)/s).map((p) => p.trim())).filter((p) => p[0]))
  for (const campo of ['titulo', 'eje', 'archivo', 'perfil']) if (!meta[campo]) throw new Error(`${archivo}: falta "${campo}" en el encabezado`)
  return { meta, cuerpo: texto.slice(m[0].length) }
}

/** Separa la guía en título, introducción y temas (cada `## `). */
function partir(cuerpo) {
  const lineas = cuerpo.split('\n')
  let titulo = ''
  const intro = []
  const temas = []
  for (const linea of lineas) {
    let m
    if ((m = linea.match(/^# (.+)$/))) titulo = m[1].trim()
    else if ((m = linea.match(/^## (.+)$/))) temas.push({ titulo: m[1].trim(), claves: [], lineas: [] })
    else if (temas.length === 0) intro.push(linea)
    else {
      const meta = linea.trim().match(META_SECCION)
      if (meta && temas.at(-1).lineas.every((l) => !l.trim())) {
        if (meta[1].toLowerCase() === 'claves') temas.at(-1).claves = meta[2].split(',').map((c) => c.trim()).filter(Boolean)
        continue
      }
      temas.at(-1).lineas.push(linea)
    }
  }
  return { titulo, intro: intro.join('\n').trim(), temas }
}

/** Primera oración del texto, sin formato: descripción del tema para buscadores. */
function descripcion(texto) {
  const plano = texto.split('\n').find((l) => l.trim() && !/^(!\[|\d+\.|- )/.test(l.trim())) ?? ''
  const oracion = plano.replace(/\*\*(.+?)\*\*/g, '$1').split(/(?<=\.)\s/)[0]
  return oracion.trim()
}

/** Reescribe las imágenes hacia la carpeta del perfil y agrega su pie de foto. */
function conImagenes(texto, perfil, origen) {
  return texto.replace(/^(\s*)!\[([^\]]*)\]\(img\/[^/]+\/([^)]+)\)\s*$/gm, (_, sangria, alt, archivo) => {
    if (!existsSync(join(RAIZ, 'img', perfil, archivo))) throw new Error(`${origen}: no existe la imagen img/${perfil}/${archivo} (ejecuta las capturas)`)
    return `${sangria}![${alt}](./img/${archivo})\n\n${sangria}*${alt}*`
  })
}

function documento(frente, cuerpo) {
  const cabecera = Object.entries(frente).filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v === null ? 'null' : Array.isArray(v) ? `[${v.map(yaml).join(', ')}]` : typeof v === 'number' ? v : yaml(v)}`)
  return `---\n${cabecera.join('\n')}\n---\n\n${cuerpo.trim()}\n`
}

/** Copia para el asistente: mismo encabezado y temas, sin imágenes ni marcas de formato. */
function copiaAsistente(meta, cuerpo) {
  const lineas = cuerpo.split('\n')
    .filter((l) => !/^!\[/.test(l.trim()) && !/^# /.test(l))
    .map((l) => l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1'))
  const primeraSeccion = lineas.findIndex((l) => l.startsWith('## '))
  const texto = lineas.slice(primeraSeccion).join('\n').replace(/\n{3,}/g, '\n\n')
  return `---
titulo: ${meta.titulo}
eje: ${meta.eje}
version: ${meta.version ?? ''}
archivo: ${BASE}${meta.archivo}
---

<!-- Archivo generado por el repositorio care-guia-usuario (scripts/construir.mjs) a partir
     de guias/${meta.fuente}. No editar a mano: cambia la fuente allá y vuelve a construir. -->

${texto.trim()}
`
}

/** Tokens de color de la plataforma (web/src/index.css) para el tema de Docusaurus. */
function tokensCss() {
  const css = readFileSync(join(PLATAFORMA, 'web', 'src', 'index.css'), 'utf8')
  const vistos = new Map()
  for (const [, nombre, valor] of css.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    if (!vistos.has(nombre)) vistos.set(nombre, valor)
  }
  return `/* Generado por scripts/construir.mjs desde care-software/web/src/index.css: no editar a mano. */\n:root {\n${[...vistos].map(([n, v]) => `  ${n}: ${v};`).join('\n')}\n}\n`
}

function portada(guias) {
  const filas = guias.map((g) => `| [${g.meta.perfil}](./${g.carpeta}/00-introduccion.md) | ${g.meta.para} | ${g.temas} temas |`)
  return documento(
    { title: 'Guía de uso de la plataforma', sidebar_label: 'Inicio', sidebar_position: 0, slug: '/', description: 'Instrucciones paso a paso, con capturas de pantalla, para usar la plataforma del programa Niñas con Oportunidades.' },
    `# Guía de uso de la plataforma

Instrucciones paso a paso, con capturas de pantalla, para usar la plataforma del programa Niñas con
Oportunidades. Elige tu perfil en el panel de la izquierda o en esta tabla:

| Perfil | Para quién | Contenido |
|---|---|---|
${filas.join('\n')}

## Cómo leer esta guía

- Cada tema explica una tarea, en pasos numerados y con una captura de pantalla de cada paso.
- En las capturas, el **recuadro naranja** marca el botón o el campo que debes usar.
- Las capturas usan un colegio, docentes y estudiantes **de ejemplo**: en tu cuenta verás tus propios datos.
- Usa el buscador de arriba para encontrar una tarea, por ejemplo «asistencia» o «evidencia».
- En el celular, abre el menú con el botón de las tres rayas, arriba a la izquierda.

## ¿Necesitas ayuda?

- Pregúntale al **asistente curricular** de la plataforma: también conoce esta guía y te indica el tema que responde tu duda.
- Si algo no funciona como se describe aquí, comunícate con tu gestor territorial o con la coordinación del programa.`,
  )
}

function construir() {
  rmSync(DOCS, { recursive: true, force: true })
  mkdirSync(DOCS, { recursive: true })
  if (HAY_PLATAFORMA) writeFileSync(join(DOCUSAURUS, 'src', 'css', 'tokens.css'), tokensCss())
  else console.log(`Sin la plataforma en ${PLATAFORMA}: se usa el tokens.css versionado y no se actualizan las copias del asistente.`)

  const guias = []
  for (const nombre of readdirSync(RAIZ).filter((n) => n.endsWith('.md') && n !== 'README.md').sort()) {
    const { meta, cuerpo } = leerGuia(join(RAIZ, nombre))
    meta.fuente = nombre
    const perfil = nombre.replace(/\.md$/, '')
    const carpeta = meta.archivo.replace(/\/$/, '')
    const destino = join(DOCS, carpeta)
    mkdirSync(destino, { recursive: true })
    if (existsSync(join(RAIZ, 'img', perfil))) cpSync(join(RAIZ, 'img', perfil), join(destino, 'img'), { recursive: true })

    const { titulo, intro, temas } = partir(cuerpo)
    writeFileSync(join(destino, '_category_.json'), JSON.stringify({
      label: meta.perfil,
      position: Number(meta.orden ?? 99),
      collapsible: true,
      collapsed: true,
      link: { type: 'doc', id: `${carpeta}/introduccion` },
    }, null, 2) + '\n')

    const lista = temas.map((t, i) => `${i + 1}. [${t.titulo}](./${String(i + 1).padStart(2, '0')}-${ancla(t.titulo)}.md)`)
    writeFileSync(join(destino, '00-introduccion.md'), documento(
      // Anterior/Siguiente no salen del perfil: la introducción no enlaza al perfil previo.
      { title: titulo, sidebar_label: 'Introducción', sidebar_position: 0, slug: `/${carpeta}`, description: descripcion(intro), pagination_prev: null },
      `# ${titulo}\n\n${conImagenes(intro, perfil, nombre)}\n\n## Temas de esta guía\n\n${lista.join('\n')}`,
    ))

    temas.forEach((t, i) => {
      const texto = conImagenes(t.lineas.join('\n').trim(), perfil, nombre)
      writeFileSync(join(destino, `${String(i + 1).padStart(2, '0')}-${ancla(t.titulo)}.md`), documento(
        { title: t.titulo, sidebar_position: i + 1, slug: `/${carpeta}/${ancla(t.titulo)}`, description: descripcion(texto), keywords: t.claves, pagination_next: i === temas.length - 1 ? null : undefined },
        `# ${t.titulo}\n\n${texto}`,
      ))
    })

    if (HAY_PLATAFORMA) writeFileSync(join(GUIAS_ASISTENTE, `10-guia-uso-${perfil}.md`), copiaAsistente(meta, cuerpo))
    guias.push({ meta, carpeta, temas: temas.length })
    console.log(`✓ ${meta.perfil}: ${temas.length} temas${HAY_PLATAFORMA ? ` · care-software/server/data/guias/10-guia-uso-${perfil}.md` : ''}`)
  }

  guias.sort((a, b) => Number(a.meta.orden ?? 99) - Number(b.meta.orden ?? 99))
  writeFileSync(join(DOCS, 'index.md'), portada(guias))
  console.log(`Contenido listo en docs/ · enlaces del asistente: ${BASE || 'sin enlace (define GUIA_URL_BASE al publicar)'}`)
}

construir()
