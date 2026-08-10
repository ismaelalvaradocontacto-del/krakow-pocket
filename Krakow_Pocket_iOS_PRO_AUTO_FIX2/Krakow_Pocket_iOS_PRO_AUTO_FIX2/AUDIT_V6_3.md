# Kraków Pocket · auditoría exhaustiva v6.3

Fecha: 10/08/2026

## Objetivo
Continuar elevando la calidad gráfica sin volver a una arquitectura de parches por versiones y revisar de forma conjunta estilo, interacción, estado, sincronización, PWA, rendimiento y resistencia en iPhone.

## Mejoras gráficas realizadas

### Personajes
- Se separa el arte de personajes en `assets/characters.svg`.
- Nuevas ilustraciones de mayor detalle para Ismael, Laura y el Dragón de Wawel.
- Se aumentan volumen, sombreado, expresiones, facciones, cabello, ropa y lectura a tamaños pequeños.
- Los personajes se reutilizan en retrato del HUD, Aldea y diálogo del NPC.
- Monumentos y navegación permanecen en `assets/game-art.svg`, evitando duplicar las ilustraciones usadas en cada pantalla.

### Aldea
- `assets/village.svg` se redibuja con una escena de mayor profundidad: cielo, silueta urbana, arquitectura, río, caminos adoquinados, árboles por capas, casas, flores, arbustos y primer plano.
- Las formas CSS antiguas de río/camino se conservan solo como respaldo y quedan casi invisibles cuando la escena ilustrada está activa.
- Se añaden efectos ambientales de baja intensidad: polen, hojas, nubes y movimiento idle.
- El ambiente cambia suavemente según mañana, tarde, atardecer y noche.

### Mapa de encargos
- `assets/world-map.svg` se redibuja con zonas visuales para Stare Miasto, Kazimierz y Podgórze, Vístula, caminos, adoquines, puentes, árboles, casas, flores y rocas.
- El mapa SVG antiguo generado dentro de `game.js` queda prácticamente oculto cuando está disponible el nuevo fondo; sigue actuando como respaldo.
- Los monumentos usan ilustraciones independientes y conservan su interacción real.
- Las misiones completadas tienen lectura visual distinta y la siguiente misión recibe un foco claro.
- Se añaden reflejos de río y destellos ambientales ligeros.

### Interfaz
- HUD, objetivo actual, tarjetas, métricas, botones, diálogos y barra inferior comparten ahora una misma familia de madera/pergamino.
- La barra inferior se convierte visualmente en un inventario oscuro en lugar de parecer una barra de navegación web.
- Los números usan anchura tabular en métricas importantes para evitar pequeños saltos de composición.
- Estados de foco y toque se mantienen visibles y compatibles con accesibilidad.

## Auditoría exhaustiva de estilo

### Desbordamiento
`visuals.js` revisa en ejecución HUD, objetivo, títulos, tarjetas, hoja de ajustes, navegación, etiquetas del mapa, rutas y métricas. Si un elemento desborda se aplican correcciones locales de tamaño y anchura.

### Colisiones del mapa
Se revisan las cajas reales de los 12 nodos después del renderizado. Cuando dos nodos se solapan:
- se marca el par como `kp-crowded`;
- las etiquetas se desplazan en direcciones opuestas;
- los nodos cercanos a los bordes desplazan la etiqueta hacia dentro;
- las etiquetas próximas al final del mapa pueden pasar por encima del monumento para evitar quedar cortadas.

La auditoría deja un resumen accesible en `window.KP_VISUAL_AUDIT` para poder diagnosticar la pantalla real sin añadir controles visibles al usuario.

### Barra inferior y safe area
La altura real de la navegación se mide mediante `ResizeObserver` y se reserva dinámicamente en el contenido. Se mantienen safe areas laterales e inferior de iOS.

### Táctil y accesibilidad
Se inspeccionan botones, tabs, inputs, selects y textareas. Los objetivos demasiado pequeños reciben una corrección automática. Se conserva `focus-visible`, `prefers-reduced-motion` y pausa de animaciones al poner la PWA en segundo plano.

### Móviles estrechos
Se mantienen adaptaciones específicas para 420, 360 y 330 px, reduciendo monumentos, personajes, tipografía auxiliar y navegación antes de permitir desbordamientos.

## Auditoría de funcionamiento

### Integridad del estado
`runtime.js` valida la forma de la partida compartida:
- `visited` debe ser array;
- `expenses` debe ser array;
- `memories` debe ser array;
- `config` debe ser objeto;
- `missionStatus` se aplica únicamente a identificadores de misión conocidos.

`missionStatus` sigue siendo la autoridad para permitir deshacer misiones. Antes de guardar, `visited` se normaliza para evitar contradicciones entre una misión desmarcada y la unión histórica de visitas.

### Sincronización
La sincronización principal de `app.js` continúa a 5 segundos y no se ha ralentizado. Los polling auxiliares históricos permanecen limitados como respaldo, mientras que las actualizaciones del mismo dispositivo se propagan mediante `kp:statechange`.

### Avisos
Se añade un guardia de toasts que impide que un aviso heredado quede pegado indefinidamente: cualquier mensaje visible se cierra automáticamente tras un intervalo breve aunque provenga de código histórico.

### Diagnóstico de runtime
`window.KP_RUNTIME_AUDIT` registra de forma no visible:
- elementos estructurales ausentes;
- validez básica del estado;
- disponibilidad de localStorage;
- conexión online/offline;
- soporte de Service Worker;
- contexto HTTPS seguro.

No se muestran paneles técnicos durante el viaje.

### Funciones revisadas
- navegación entre Aldea, Mapa, Encargos, Crónica y Bolsa;
- apertura/cierre de ajustes y diálogos;
- mapa Leaflet y recalculo al hacerlo visible;
- GPS local;
- recomendaciones;
- completar, deshacer y reiniciar misiones;
- celebraciones;
- sincronización de misiones entre dos dispositivos;
- gastos y categorías;
- recuerdos;
- resumen compartible;
- Google Maps;
- modo offline básico;
- actualización del Service Worker;
- cambio de jugador;
- estados de visibilidad de la PWA.

## PWA y caché
- La caché activa pasa a la rama v6.3.
- Se precachean `game-art.svg`, `characters.svg`, `village.svg` y `world-map.svg`.
- JS/CSS/webmanifest siguen siendo network-first para evitar mezclar generaciones.
- Leaflet 1.9.4 queda almacenado en runtime tras una carga correcta.
- El manifiesto usa colores coherentes con la interfaz de madera y añade acceso directo a Encargos.

## Arquitectura actual

### JavaScript
1. `data.js`
2. `runtime.js`
3. `app.js`
4. `enhancements.js`
5. `game.js`
6. `visuals.js`

### CSS
1. `styles.css`
2. `enhancements.css`
3. `game.css`
4. `visuals.css`

### Arte
- `assets/game-art.svg`: monumentos y navegación.
- `assets/characters.svg`: personajes y Dragón.
- `assets/village.svg`: Aldea.
- `assets/world-map.svg`: mapa ilustrado de encargos.

## Deuda técnica restante

### `enhancements.js`
Continúa siendo la principal deuda técnica. Contiene lógica histórica de rutas y el reconciliador probado de `missionStatus`. Se ha aislado y ralentizado su polling auxiliar, pero no se elimina todavía porque hacerlo en plena víspera del viaje implicaría reescribir el flujo más delicado de sincronización/desmarcado de misiones.

### `game-art.svg`
Todavía conserva símbolos antiguos de personajes que ya no se utilizan desde que existe `characters.svg`. Pueden retirarse en una limpieza posterior sin afectar funcionalidad; no es un problema de ejecución porque el archivo se descarga una sola vez y se cachea.

### Validación física
La auditoría del repositorio y las defensas en ejecución cubren estructura y medidas reales del DOM. La apariencia exacta de la PWA instalada —barra de estado, zoom de texto, teclado, composición de WebKit y safe area física— solo puede cerrarse del todo observando una captura del iPhone real.

## Criterio de continuidad
No crear nuevas cadenas `vXX.js`/`vXX.css`. Las mejoras gráficas deben sustituir o enriquecer assets existentes; las correcciones funcionales deben entrar en el módulo responsable. Cada pasada debe mantener o reducir la complejidad total.