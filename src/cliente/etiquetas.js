// El buscador local trae su etiqueta accesible fija en inglés («Search»). Los lectores de
// pantalla la leen en voz alta, así que se reemplaza por la etiqueta en español.
const ETIQUETAS = [['.navbar__search-input', 'Buscar en la guía']]

function traducir() {
  for (const [selector, etiqueta] of ETIQUETAS) {
    document.querySelectorAll(selector).forEach((el) => el.setAttribute('aria-label', etiqueta))
  }
}

export function onRouteDidUpdate() {
  traducir()
  // El buscador se monta después de la primera hidratación.
  window.setTimeout(traducir, 0)
}
