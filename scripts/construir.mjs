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
//   3. okf/: la guía como paquete Open Knowledge Format (OKF v0.3), para que agentes y modelos
//      de IA la lean y la citen: un concepto (archivo con frontmatter `type`) por tema, enlaces
//      Markdown entre conceptos y `resource` con la página publicada de cada tema.
//
//   npm run construir
//   GUIA_URL_BASE=http://localhost:4173/ npm run construir   (enlaces a la vista previa local)
//
// GUIA_URL_BASE es la dirección del sitio: el asistente y el paquete OKF arman con ella el
// enlace de cada tema (<base><perfil>/<tema>). Por omisión es el sitio publicado en GitHub
// Pages. Una dirección local solo sirve para probar: no subas las copias generadas con ella.
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
const SITIO_PUBLICADO = 'https://dp2-2026-care-peru.github.io/care-guia-usuario/'
const BASE = (process.env.GUIA_URL_BASE || SITIO_PUBLICADO).replace(/\/?$/, '/')
const OKF = join(REPO, 'okf')
const OKF_VERSION = '0.3'

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
  // Párrafo completo (las fuentes cortan las líneas a ~100 caracteres), no solo su primera línea.
  const bloques = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  // Si el tema empieza directo con los pasos, la descripción es el primer paso.
  const primero = bloques.find((p) => !/^(!\[|\*[^*]|\d+\.|- )/.test(p))
    ?? bloques.find((p) => /^(\d+\.|- )/.test(p))?.replace(/^(\d+\.|-)\s+/, '').split(/\n(?:\d+\.|-)\s/)[0]
  const plano = (primero ?? '').replace(/\s*\n\s*/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '$1')
  return plano.split(/(?<=[.:])\s/)[0].replace(/:$/, '.').trim()
}

/** Reescribe las imágenes hacia la carpeta del perfil y agrega su pie de foto. */
function conImagenes(texto, perfil, origen) {
  // [ \t]* y no \s*: \s* se comería la línea en blanco siguiente y pegaría el pie al párrafo de abajo.
  return texto.replace(/^([ \t]*)!\[([^\]]*)\]\(img\/[^/]+\/([^)]+)\)[ \t]*$/gm, (_, sangria, alt, archivo) => {
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
    .map((l) => l.replace(/`([^`]+)`/g, '$1')
      // Los enlaces entre temas quedan como texto: el asistente cita cada tema con su propio enlace.
      .replace(/\[([^\]]+)\]\((?:[a-z-]+\.md)?(?:#[a-z0-9-]+)?\)/g, '$1'))
  const primeraSeccion = lineas.findIndex((l) => l.startsWith('## '))
  const texto = lineas.slice(primeraSeccion).join('\n').replace(/\n{3,}/g, '\n\n')
    // Negritas sobre el texto completo: algunas abarcan dos líneas de la fuente.
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    // Las preguntas de ejemplo («¿Cómo calmo al grupo…?») se quitan de la copia: si quedan, el
    // asistente responde esa pregunta pedagógica con la guía de uso en vez de con las fichas.
    .replace(/[ \t]*,?[ \t]*\b[Pp]or ejemplo[,:]?\s+«¿[^»]*\?»/g, '')
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
    { title: 'Guía de uso de la plataforma', sidebar_label: 'Inicio', sidebar_position: 0, slug: '/', description: 'Instrucciones paso a paso, con capturas de pantalla, para usar la plataforma del programa Niñas con Oportunidades.',
      // Desde la portada, «Siguiente: Introducción» no dice de qué perfil: se elige en la tabla.
      pagination_next: null },
    `# Guía de uso de la plataforma

Instrucciones paso a paso, con capturas de pantalla, para usar la plataforma del programa Niñas con
Oportunidades. Elige tu perfil en el panel de la izquierda o en esta tabla:

| Perfil | Para quién | Contenido |
|---|---|---|
${filas.join('\n')}

## Cómo leer esta guía

- Cada tema explica una tarea, en pasos numerados y con una captura de pantalla de cada paso.
- En las capturas, el **recuadro naranja** marca el botón o el campo que debes usar.
- Toca o haz clic en una captura para verla en tamaño completo; vuelve a tocarla para cerrarla.
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

  const fuentes = readdirSync(RAIZ).filter((n) => n.endsWith('.md') && n !== 'README.md').sort()
  // Primera pasada: archivo de cada tema, para resolver los enlaces entre temas y entre guías.
  const mapa = new Map()
  for (const nombre of fuentes) {
    const { meta, cuerpo } = leerGuia(join(RAIZ, nombre))
    const temas = new Map(partir(cuerpo).temas.map((t, i) => [ancla(t.titulo), `${String(i + 1).padStart(2, '0')}-${ancla(t.titulo)}.md`]))
    mapa.set(nombre, { carpeta: meta.archivo.replace(/\/$/, ''), temas })
  }
  /**
   * [texto](#tema) y [texto](otra-guia.md#tema) → enlace al archivo del tema: en docs/ el archivo
   * numerado de Docusaurus; en okf/ el concepto (<carpeta>/<tema>.md) o el índice del perfil.
   */
  const conEnlaces = (texto, nombre, formato = 'docs') => texto.replace(/\]\(([a-z-]+\.md)?(?:#([a-z0-9-]+))?\)/g, (todo, guia, tema) => {
    if (!guia && !tema) return todo
    const destino = mapa.get(guia ?? nombre)
    if (!destino) throw new Error(`${nombre}: el enlace ${todo} apunta a una guía que no existe`)
    const archivo = tema ? destino.temas.get(tema) : '00-introduccion.md'
    if (!archivo) throw new Error(`${nombre}: el enlace ${todo} apunta a un tema que no existe`)
    const carpeta = guia ? `../${destino.carpeta}/` : './'
    if (formato === 'okf') return `](${carpeta}${tema ? `${tema}.md` : 'index.md'})`
    return `](${carpeta}${archivo})`
  })

  rmSync(OKF, { recursive: true, force: true })
  mkdirSync(OKF, { recursive: true })

  const guias = []
  for (const nombre of fuentes) {
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
      `# ${titulo}\n\n${conEnlaces(conImagenes(intro, perfil, nombre), nombre)}\n\n## Temas de esta guía\n\n${lista.join('\n')}`,
    ))

    temas.forEach((t, i) => {
      const texto = conEnlaces(conImagenes(t.lineas.join('\n').trim(), perfil, nombre), nombre)
      writeFileSync(join(destino, `${String(i + 1).padStart(2, '0')}-${ancla(t.titulo)}.md`), documento(
        { title: t.titulo, sidebar_position: i + 1, slug: `/${carpeta}/${ancla(t.titulo)}`, description: descripcion(texto), keywords: t.claves, pagination_next: i === temas.length - 1 ? null : undefined },
        `# ${t.titulo}\n\n${texto}`,
      ))
    })

    // Paquete OKF: el índice del perfil (lista, sin `type`) y un concepto por tema.
    const destinoOkf = join(OKF, carpeta)
    mkdirSync(destinoOkf, { recursive: true })
    if (existsSync(join(RAIZ, 'img', perfil))) cpSync(join(RAIZ, 'img', perfil), join(destinoOkf, 'img'), { recursive: true })
    writeFileSync(join(destinoOkf, 'index.md'), documento(
      { title: meta.perfil, description: meta.para },
      `# ${titulo}\n\n${conEnlaces(conImagenes(intro, perfil, nombre), nombre, 'okf')}\n\n## Temas\n\n` +
        temas.map((t) => `- [${t.titulo}](./${ancla(t.titulo)}.md): ${descripcion(t.lineas.join('\n'))}`).join('\n'),
    ))
    temas.forEach((t, i) => {
      const texto = conEnlaces(conImagenes(t.lineas.join('\n').trim(), perfil, nombre), nombre, 'okf')
      writeFileSync(join(destinoOkf, `${ancla(t.titulo)}.md`), documento(
        {
          type: 'Playbook',
          title: t.titulo,
          description: descripcion(texto),
          resource: `${BASE}${carpeta}/${ancla(t.titulo)}`,
          tags: t.claves,
          status: 'stable',
          'x-care-perfil': meta.perfil,
          'x-care-eje': meta.eje,
          'x-care-orden': i + 1,
          'x-care-version-guia': meta.version,
        },
        `# ${t.titulo}\n\nTema ${i + 1} de la guía de [${meta.perfil}](./index.md).\n\n${texto}`,
      ))
    })

    if (HAY_PLATAFORMA) writeFileSync(join(GUIAS_ASISTENTE, `10-guia-uso-${perfil}.md`), copiaAsistente(meta, cuerpo))
    guias.push({ meta, carpeta, temas: temas.length, lista: temas.map((t) => t.titulo) })
    console.log(`✓ ${meta.perfil}: ${temas.length} temas${HAY_PLATAFORMA ? ` · care-software/server/data/guias/10-guia-uso-${perfil}.md` : ''}`)
  }

  guias.sort((a, b) => Number(a.meta.orden ?? 99) - Number(b.meta.orden ?? 99))
  writeFileSync(join(DOCS, 'index.md'), portada(guias))
  writeFileSync(join(OKF, 'index.md'), documento(
    {
      okf_version: OKF_VERSION,
      title: 'Guía de uso de la plataforma Niñas con Oportunidades',
      description: 'Instrucciones paso a paso para usar la plataforma del programa Niñas con Oportunidades (CARE Perú), por perfil de usuario.',
    },
    `# Guía de uso de la plataforma Niñas con Oportunidades

Paquete [Open Knowledge Format](https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md)
(OKF v${OKF_VERSION}) generado desde \`guias/*.md\` por \`scripts/construir.mjs\`: no se edita a mano.

Cada tema es un concepto de tipo \`Playbook\`: una tarea de la plataforma explicada en pasos. Su
campo \`resource\` es la página publicada del tema, que es la que se debe citar. Las capturas
de pantalla están en la carpeta \`img/\` de cada perfil y usan datos ficticios.

${guias.map((g) => `## [${g.meta.perfil}](./${g.carpeta}/index.md)\n\n${g.meta.para}\n\n${g.lista.map((t) => `- [${t}](./${g.carpeta}/${ancla(t)}.md)`).join('\n')}`).join('\n\n')}`,
  ))
  console.log(`Contenido listo en docs/ y okf/ · enlaces de los temas: ${BASE}`)
}

construir()
