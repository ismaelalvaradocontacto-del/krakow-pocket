# Kraków Pocket

PWA móvil para la escapada de Ismael y Laura a Cracovia del 11–13 de agosto de 2026, diseñada como una aventura cooperativa con estética de RPG acogedor.

## Funciones activas
- Mapa real de Cracovia con OpenStreetMap/Leaflet.
- GPS opcional y exclusivamente local para ordenar lugares por cercanía.
- Recomendaciones según tiempo, tipo de plan, presupuesto y momento del viaje.
- 12 misiones cooperativas y sistema de Escamas de Wawel.
- Mapa ilustrado de encargos y celebraciones de misión.
- Crónica y recuerdos compartidos.
- Presupuesto conjunto con gastos por categoría.
- Sincronización automática entre los dos dispositivos.
- Navegación mediante Google Maps sin crear una pestaña intermedia innecesaria.
- PWA con recursos esenciales disponibles desde caché.

## Arquitectura de producción
La aplicación tiene cuatro capas JavaScript con responsabilidades separadas y tres hojas de estilo activas. No hay loaders de versiones antiguas ni capas de compatibilidad/sincronización superpuestas.

### JavaScript
- `data.js`: datos estáticos del viaje, lugares, planning y misiones.
- `app.js`: único núcleo funcional. Gestiona estado, gastos, recuerdos, mapa, GPS, recomendaciones, sincronización, PWA, compartir y estado reversible de misiones.
- `game.js`: estructura de la experiencia RPG: HUD, Aldea, mapa de encargos, diálogos y celebraciones.
- `visuals.js`: render de arte SVG, adaptación Safari/iPhone, VFX, responsive y auditor automático.

`game.js` usa firmas de estado para no reconstruir HUD, Aldea o tablero de misiones cuando una sincronización no ha cambiado nada. La navegación se genera una sola vez por carga. Las celebraciones de misión ya no dependen de un estado temporal heredado: se lanzan directamente tras confirmar el cambio de misión.

### CSS
- `styles.css`: componentes funcionales reutilizados por mapa, formularios, diario, presupuesto, tarjetas y diálogos.
- `game.css`: geometría y estructura de los componentes RPG generados dinámicamente.
- `visuals.css`: acabado artístico, personajes, responsive, safe areas, iluminación y VFX.

`game.css` ya no contiene reglas para la antigua cabecera oculta ni para la antigua lista visual de misiones, porque esos elementos dejaron de existir en el HTML de producción.

### Arte activo
- `assets/characters.svg`: Ismael, Laura, Dragón de Wawel y Guardián.
- `assets/game-art.svg`: monumentos e iconos del juego.
- `assets/village.svg`: escenario de Aldea.
- `assets/world-map.svg`: escenario del mapa de encargos.

## Estado y sincronización
La partida utiliza un único estado local/remoto. Las misiones se almacenan con una operación por misión (`done` + fecha de modificación), por lo que completar, deshacer o reiniciar puede reconciliarse entre dispositivos sin que una unión antigua de `visited` vuelva a activar una misión.

Gastos y recuerdos se fusionan por identificador y fecha de modificación. Los borrados se conservan como tombstones para impedir que reaparezcan después de sincronizar. Si la nube aún no contiene una partida, el estado local actúa como punto de partida.

El Service Worker no altera las peticiones de sincronización. La autenticación de la API pertenece únicamente al núcleo funcional de la app.

## Personajes
Ismael y Laura tienen una identidad gráfica única. El retrato de cabecera y el sprite de Aldea comparten paleta y rasgos, adaptados a escalas distintas. El render visual inserta los símbolos SVG dentro del DOM para que Safari utilice exactamente el mismo arte que el resto de la aplicación.

## Auditoría automática
`window.KP_AUDIT` / `window.KP_VISUAL_AUDIT` comprueba en ejecución:
- estructura principal presente;
- exactamente un panel y una pestaña activos;
- cinco destinos de navegación;
- forma del estado local;
- datos de las 12 misiones;
- carga de assets;
- identidad de personajes;
- colisiones entre protagonistas y etiquetas;
- colisiones de etiquetas del mapa de encargos;
- overflow horizontal y de componentes;
- controles táctiles demasiado pequeños;
- diálogos que excedan el viewport;
- altura real de la navegación inferior;
- soporte PWA, contexto seguro y estado de red.

Las correcciones de geometría se realizan con tamaños, posiciones y clases específicas; no se oculta contenido como solución genérica a un overflow.

## Limpieza realizada
Se eliminaron del runtime todos los módulos antiguos `v34`–`v51`, `trip-tools`, `runtime`, `enhancements`, `compat` y auditorías históricas que ya no aportaban ejecución. El HTML no carga ninguno de ellos. Se mantienen únicamente los archivos activos, los cuatro assets SVG, los iconos, el manifest, el Service Worker, esta documentación y `SUPABASE_SETUP.sql` como infraestructura de recuperación/configuración.

## PWA
`sw.js` cachea únicamente los archivos activos. HTML, JavaScript, CSS y manifest intentan obtener la versión reciente y utilizan caché como respaldo; los assets estáticos se sirven desde caché cuando están disponibles. Cada revisión de producción cambia el nombre de la caché para retirar la anterior.

## Privacidad
La posición GPS no forma parte del estado compartido. Se usa únicamente en el dispositivo para distancias y recomendaciones.

## Producción
https://krakow-pocket.pages.dev/
