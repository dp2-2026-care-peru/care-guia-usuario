# Guía de uso · Niñas con Oportunidades

Guía paso a paso, con capturas de pantalla, para usar la plataforma del programa Niñas con
Oportunidades (CARE Perú). Es un sitio [Docusaurus](https://docusaurus.io/): en el panel izquierdo
cada perfil tiene su introducción y una página por tema, y el sitio incluye un buscador en español.

La plataforma está en el repositorio [`care-software`](https://github.com/dp2-2026-care-peru/care-software).

## Estructura

| Carpeta | Contenido |
|---|---|
| `guias/` | **La fuente que se edita.** Hay un `.md` por perfil, y sus capturas están en `guias/img/<perfil>/`. |
| `scripts/construir.mjs` | Arma `docs/` (una página por tema) y las copias para el asistente. |
| `capturas/` | Recorridos de Playwright que toman las capturas contra la plataforma en local. |
| `auditoria/` | Auditoría del sitio compilado. |
| `src/`, `static/`, `i18n/` | Tema (colores de la plataforma), logo y textos de la interfaz en español. |
| `docs/`, `build/` | Se generan al compilar y no se versionan. |

| Guía | Perfiles | Recorrido |
|---|---|---|
| `guias/docente.md` | Docente tutora y cotutor | `capturas/3-docente.spec.ts` |
| `guias/coordinacion.md` | Coordinación, administración y monitoreo | `capturas/1-coordinacion.spec.ts` |
| `guias/gestor.md` | Gestor territorial | `capturas/4-gestor.spec.ts` |
| `guias/evaluacion.md` | Evaluación de impacto | `capturas/2-evaluacion.spec.ts` |
| `guias/voluntaria.md` | Voluntaria de revisión de evidencias | `capturas/5-voluntaria.spec.ts` |

**Sin guía, a propósito:**

- **Promotor UGEL:** hoy ve el menú de la docente, y Mi Formación responde «El usuario no está asociado a una docente tutora».
- **Egresada:** la Ruta de Oportunidad todavía devuelve datos fijos desde el servidor.

Se documentarán cuando esos módulos funcionen.

## Ver y revisar la guía

```powershell
npm install
npm start          # vista previa con recarga en http://localhost:4173
npm run build      # compila en build/ (falla ante cualquier enlace o imagen rota)
npm run serve      # sirve build/ en http://localhost:4173
npm run auditar    # en otra terminal, con el sitio servido
```

`npm run auditar` recorre todas las páginas, en escritorio y en celular, y falla si encuentra algo de esta lista:

- Un perfil o un tema que falta en el panel.
- Imágenes rotas o sin texto alternativo.
- Más de un título principal en una página.
- Desborde horizontal.
- Errores de consola.
- Textos de la interfaz en inglés.
- Fallas de accesibilidad WCAG 2.2 AA (axe-core).
- Un «Anterior / Siguiente» que salta a otro perfil.
- Un buscador que no encuentra los temas.

## Volver a tomar las capturas

Clona `care-software` en la misma carpeta que este repositorio (`../care-software`) o indica su ruta
en `CARE_SOFTWARE`. Luego, en `care-software`, con la base de datos levantada:

```powershell
npm run db:seed          # una vez: usuarios demo y catálogos
npm run guia:escenario   # escenario ficticio de la guía (reinicia lo registrado)
npm run dev:server       # API en :4000
npm run dev:web          # web en :5173
```

Y en este repositorio:

```powershell
npx playwright install chromium   # una vez
npm run capturas                  # todas las capturas, en orden
npm run build
```

El número de cada recorrido fija el orden de ejecución:

- **Evaluación antes que la docente:** las notas que registra la docente agregan un eje duplicado al tablero de impacto.
- **Gestor y voluntaria después de la docente:** revisan la evidencia que ella sube.

`guia:escenario` solo corre contra una base local. Crea un colegio de ejemplo con 14 alumnas y 3 egresadas ficticias, las pruebas de entrada y salida, la cartera del gestor demo y las cuentas `voluntaria@nco.pe` y `promotor@nco.pe` (clave `nco2026`). **No tomes capturas de un entorno con datos reales.**

## Al editar una guía

- Cada sección `##` es un tema. Debajo lleva `pagina:` (su número) y `claves:`. Estas líneas no se ven en el sitio.
- Las `claves:` son las frases con las que el asistente encuentra el tema. Usa frases específicas («marcar asistencia», «programar visita»), no palabras sueltas comunes («estudiantes», «aula», «sesiones»). Esas palabras aparecen en casi todas las preguntas pedagógicas, y el asistente terminaría respondiendo con la guía de uso en lugar de la pedagógica.

## Copias para el asistente curricular

Si `care-software` está al lado (o en `CARE_SOFTWARE`), `npm run construir` también actualiza dos cosas allá:

- **`server/data/guias/10-guia-uso-<perfil>.md`:** la guía sin imágenes. El asistente la indexa con el eje `PLATAFORMA` y cita cada tema.
- **`src/css/tokens.css`** (en este repositorio): los colores de la plataforma, desde `web/src/index.css`. Sin la plataforma se usa el archivo versionado.

Para que las citas enlacen al tema publicado, construye las copias con la dirección del sitio:

```powershell
$env:GUIA_URL_BASE = 'https://dp2-2026-care-peru.github.io/care-guia-usuario/'; npm run construir
```

Después, en `care-software`, sigue estos pasos:

1. Ejecuta `cd server; go run ./cmd/evaluar_asistente -generar` y revisa que no haya preguntas «del dominio rechazadas por error».
2. Ejecuta `go run ./cmd/ingestar_guias -aplicar`.
3. Sube las copias en un PR.

Sin `GUIA_URL_BASE`, la copia guarda una ruta relativa y el asistente cita el tema sin enlace. Así nunca se versiona una dirección local.

## Publicación

El workflow `.github/workflows/pages.yml` compila y audita cada PR. En `main` publica el sitio en GitHub Pages, en `https://<organización>.github.io/<repositorio>/`. Requiere que Pages esté activado con la fuente **GitHub Actions**, y el plan Free de GitHub solo lo permite en repositorios públicos.
