# CLAUDE.md

## UI y marca

La UI (`src/ui/`) sigue el Manual de Marca de Trama ITBA. Al tocarla:

- Usar siempre los componentes y variables de `src/ui/styles.html` (`.card`, `.campo`, `.control`, `.btn`, `.aviso`, `.estado`, `.globo`, `.chip`, `.cargando`, tokens como `--negro`, `--crema`, `--radio-*`, etc.).
- Colores por club con `var(--club)` y `var(--on-club)`. El club lo fija `data-club` en el `<body>` (lo pone `aplicarClub()` en `client.js.html`). No escribir colores de club a mano.
- Títulos con la clase `.titulo` (Montserrat Black en mayúscula).
- No inventar estilos nuevos. Si algo no se puede armar con lo que hay en `styles.html`, preguntar antes de agregar.
- Las formas de cada club e íconos están en `src/ui/brand.html` (`<use href="#shape-...">`, `#ico-...`) y el logo en `src/ui/logo.html`.
- Referencia visual, fuera del repo (no copiarlas acá): `../ui/preview.html` (la página armada con datos de ejemplo) y `../Trama Manual de Marca.pdf`.
