// Guía de uso de la plataforma Niñas con Oportunidades.
// Las páginas de docs/ las genera scripts/construir.mjs a partir de guias/*.md:
// no se editan a mano.
//
// GUIA_URL      origen donde se publica (p. ej. https://<organización>.github.io)
// GUIA_BASE     ruta del sitio dentro de ese origen (p. ej. /<repositorio>/guia/)
const { themes } = require('prism-react-renderer')

const url = process.env.GUIA_URL ?? 'http://localhost:4173'
const baseUrl = process.env.GUIA_BASE ?? '/'

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: 'Guía de uso · Niñas con Oportunidades',
  tagline: 'Cómo usar la plataforma del programa, paso a paso y por perfil',
  favicon: 'img/favicon.svg',
  url,
  baseUrl,
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    format: 'detect',
    hooks: { onBrokenMarkdownLinks: 'throw', onBrokenMarkdownImages: 'throw' },
  },
  i18n: { defaultLocale: 'es', locales: ['es'] },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          breadcrumbs: true,
          showLastUpdateTime: false,
        },
        blog: false,
        pages: false,
        theme: { customCss: require.resolve('./src/css/custom.css') },
      }),
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['es'],
        docsRouteBasePath: '/',
        indexBlog: false,
        indexPages: false,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        explicitSearchResultPath: true,
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // La plataforma no tiene modo oscuro: la guía se ve igual que la app.
      colorMode: { defaultMode: 'light', disableSwitch: true, respectPrefersColorScheme: false },
      docs: { sidebar: { hideable: true, autoCollapseCategories: true } },
      navbar: {
        title: 'Guía de uso',
        logo: { alt: 'CARE · Niñas con Oportunidades', src: 'img/logo_care.svg' },
        items: [
          { type: 'docSidebar', sidebarId: 'guia', position: 'left', label: 'Perfiles' },
        ],
      },
      footer: {
        style: 'light',
        copyright: 'Programa Niñas con Oportunidades · CARE Perú. Las imágenes usan datos de ejemplo.',
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      prism: { theme: themes.github },
    }),
}
