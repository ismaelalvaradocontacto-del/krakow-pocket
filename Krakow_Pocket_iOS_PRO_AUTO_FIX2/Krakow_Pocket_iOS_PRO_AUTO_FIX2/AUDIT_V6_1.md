# Kraków Pocket · Auditoría v6.1

Fecha: 10/08/2026

## Resultado
La arquitectura consolidada v6 se mantiene. Esta revisión no vuelve a introducir la antigua cadena de versiones.

## Funcionamiento revisado
- Sincronización compartida: se mantiene en `app.js`/`enhancements.js`.
- Service Worker: caché renovada y lista CORE limitada a archivos vigentes.
- Se corrigió la discrepancia detectada entre la publishable key usada por la aplicación y la que normalizaba el Service Worker.
- Al abrir el panel Mapa se fuerzan dos eventos de `resize` espaciados para que Leaflet recalcule correctamente el tamaño después de estar oculto.
- Escape cierra los overlays propios de misión y celebración.
- La siguiente misión pendiente queda identificada dinámicamente sin modificar el estado de la partida.
- Los efectos visuales se pausan cuando la pestaña queda oculta.
- No se añade polling agresivo ni observador global permanente del DOM; los observadores se limitan a los dos contenedores gráficos que el juego redibuja.

## Estilo revisado
- HUD con mayor profundidad y lectura de recursos.
- Objetivo actual tratado como cinta/pergamino de misión.
- Aldea con iluminación, nubes, pájaros, agua animada, profundidad y personajes con animación de reposo.
- Mapa de encargos con viñeta, destellos y señal clara de la siguiente misión.
- Estados completados y activos más fáciles de distinguir.
- Mapa Leaflet, hojas de ajustes, diálogos y barra inferior armonizados con el lenguaje gráfico del juego.
- Breakpoints adicionales para 420 px y 360 px.
- Fallback de desbordamiento para textos y controles estrechos.
- `prefers-reduced-motion` respetado.

## Rendimiento
- `visuals.js` se carga después de que el núcleo de juego esté estable.
- Animaciones realizadas mayoritariamente con CSS y `transform`/`opacity`.
- Auditoría de overflow agrupada mediante `requestAnimationFrame`.
- No se añaden imágenes raster pesadas ni librerías nuevas.

## Riesgos conocidos
- Leaflet y sus teselas de OpenStreetMap continúan siendo recursos externos; el núcleo de la PWA funciona offline, pero no se garantiza que todas las teselas del mapa estén disponibles sin conexión si no fueron cacheadas previamente por el navegador.
- `enhancements.js` sigue siendo necesario porque conserva la reconciliación de misiones y la sincronización reversible. No debe eliminarse hasta migrar esa lógica al núcleo.

## Arquitectura visual vigente
`styles.css` → `enhancements.css` → `game.css` → `visuals.css`

`data.js` → `app.js` → `runtime.js` → `enhancements.js` → `game.js` → `visuals.js`
