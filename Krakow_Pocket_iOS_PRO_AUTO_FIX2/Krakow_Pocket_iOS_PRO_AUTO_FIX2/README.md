# Kraków Pocket

PWA móvil para la escapada de Ismael y Laura a Cracovia del 11–13 de agosto de 2026, diseñada como una aventura cooperativa con estética de RPG acogedor.

## Funciones
- Mapa real de Cracovia con OpenStreetMap/Leaflet.
- GPS opcional y exclusivamente local para ordenar lugares por cercanía.
- Recomendaciones según tiempo, tipo de plan, presupuesto y momento del viaje.
- 12 misiones cooperativas y sistema de Escamas de Wawel.
- Mapa ilustrado de encargos y celebraciones de misión.
- Crónica y recuerdos compartidos.
- Presupuesto conjunto con gastos por categoría.
- Sincronización automática entre los dos dispositivos.
- Navegación mediante Google Maps sin dejar pestañas vacías al volver.
- PWA con recursos esenciales disponibles desde caché.

## Arquitectura actual · v7.0
La aplicación se consolidó para que cada responsabilidad tenga un único propietario. Ya no existen capas de compatibilidad o sincronización superpuestas.

### JavaScript
- `data.js`: datos estáticos del viaje, lugares, planning y misiones.
- `app.js`: único núcleo funcional. Gestiona estado, gastos, recuerdos, mapa, GPS, recomendaciones, sincronización, PWA, compartir y el estado reversible de las misiones.
- `game.js`: estructura de la interfaz RPG, Aldea, HUD, mapa de encargos, diálogos y celebraciones.
- `visuals.js`: único renderizador de arte SVG y auditor automático de estilo/funcionamiento visible.

### CSS
- `styles.css`: componentes funcionales base utilizados por mapa, formularios, diario, presupuesto, tarjetas y diálogos.
- `game.css`: estructura y componentes propios de la interfaz de juego.
- `visuals.css`: acabado artístico, personajes, responsive, safe areas, VFX y correcciones específicas de móvil.

### Arte activo
- `assets/characters.svg`: Ismael, Laura, Dragón de Wawel y Guardián.
- `assets/game-art.svg`: monumentos e iconos del juego.
- `assets/village.svg`: escenario de Aldea.
- `assets/world-map.svg`: escenario del mapa de encargos.

## Estado compartido
La partida utiliza un único estado local y remoto. Las misiones se almacenan con una operación por misión (`done` + fecha de modificación), por lo que completar, deshacer o reiniciar una misión puede reconciliarse correctamente entre dispositivos sin que una unión antigua de `visited` vuelva a activarla.

Gastos y recuerdos se fusionan por identificador y fecha de modificación. Los borrados se conservan como tombstones para que no reaparezcan después de sincronizar.

Si la nube todavía no contiene una partida, el estado local se sube como punto de partida; un resultado remoto vacío no puede sustituir la configuración local por valores por defecto.

## Personajes
Ismael y Laura tienen una identidad gráfica única. El retrato de cabecera y el sprite de Aldea reutilizan la misma paleta y rasgos, adaptados a dos escalas distintas. El renderizador normal y Safari utilizan exactamente los mismos símbolos, insertados en línea para evitar SVG externos vacíos.

## Auditoría automática
`window.KP_AUDIT` / `window.KP_VISUAL_AUDIT` comprueba en ejecución:
- estructura principal presente;
- exactamente un panel y una pestaña activos;
- cinco destinos de navegación;
- forma del estado local;
- datos de las 12 misiones;
- carga de assets;
- identidad de los personajes;
- colisiones de protagonistas y etiquetas;
- colisiones de etiquetas del mapa de encargos;
- overflow horizontal y de componentes;
- controles táctiles demasiado pequeños;
- diálogos que excedan el viewport;
- altura real de la navegación inferior;
- soporte PWA, contexto seguro y estado de red.

Las correcciones visuales de diagnóstico se aplican mediante clases controladas y no ocultan contenido como solución a un overflow.

## Rendimiento
La versión 7 elimina los antiguos `runtime`, `enhancements` y `compat`, así como sus polling, MutationObserver generales y renderizadores duplicados. El mapa real se inicializa únicamente cuando se utiliza. El renderizador gráfico reacciona a eventos explícitos de la app y solo observa el tamaño de la navegación inferior.

## PWA
`sw.js` cachea únicamente los archivos activos. HTML, JavaScript, CSS y manifest usan estrategia network-first; los assets estáticos usan cache-first. Las peticiones de sincronización no son modificadas por el Service Worker.

## Privacidad
La ubicación GPS no forma parte del estado compartido. Se usa únicamente en el dispositivo para distancias y recomendaciones.

## Producción
https://krakow-pocket.pages.dev/
