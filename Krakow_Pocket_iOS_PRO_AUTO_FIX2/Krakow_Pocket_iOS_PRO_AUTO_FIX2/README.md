# Kraków Pocket

PWA móvil para la escapada de Ismael y Laura a Cracovia del 11–13 de agosto de 2026, diseñada como una aventura cooperativa con estética de RPG acogedor.

## Producción
https://krakow-pocket.pages.dev/

## Versión activa
`7.1.0`

## Funciones activas
- Mapa real de Cracovia con OpenStreetMap/Leaflet.
- GPS opcional y exclusivamente local para ordenar lugares por cercanía.
- Recomendaciones según tiempo, tipo de plan, presupuesto y momento del viaje.
- 12 misiones cooperativas y sistema de Escamas de Wawel.
- Mapa ilustrado de encargos y celebraciones de misión.
- Crónica y recuerdos compartidos.
- Presupuesto conjunto con gastos por categoría.
- Sincronización automática entre los dos dispositivos.
- Navegación mediante Google Maps en la misma pestaña.
- PWA con recursos esenciales disponibles desde caché.

## Arquitectura de producción
La aplicación mantiene una sola implementación por responsabilidad y no carga capas históricas.

### JavaScript
1. `data.js` — datos estáticos del viaje, lugares, planning y misiones.
2. `app.js` — núcleo funcional: estado, presupuesto, recuerdos, recomendaciones, mapa, GPS, sincronización, PWA y compartir.
3. `game.js` — estructura RPG: HUD, Aldea, Encargos, diálogos y celebraciones.
4. `visuals.js` — carga e inserción del arte SVG, responsive y auditor automático en ejecución.

### CSS
1. `styles.css` — componentes funcionales.
2. `game.css` — estructura y geometría del juego.
3. `visuals.css` — acabado artístico, responsive, safe areas, iluminación, VFX y accesibilidad visual.

No se cargan `runtime`, `enhancements`, `compat`, `trip-tools` ni la antigua cadena `v34`–`v51`.

## Render y rendimiento
`game.js` usa firmas independientes para HUD, Aldea y Encargos. Una sincronización que no modifica el estado visible ya no reconstruye esos bloques.

`app.js` compara la firma del estado antes y después de sincronizar. Si la nube devuelve exactamente la misma partida, no ejecuta un `renderAll()` completo. El polling de sincronización se pausa cuando la aplicación queda oculta y se reanuda al volver a primer plano.

`visuals.js` carga cada paquete SVG una sola vez. Al insertar un símbolo resuelve sus referencias `<use>` y copia únicamente los gradientes/filtros necesarios como definiciones compartidas del paquete, evitando duplicar dentro de cada personaje todos los grupos de arte del archivo original.

## Estado y sincronización
La partida utiliza un único estado local/remoto.

- Las misiones guardan `done + updatedAt`, permitiendo completar, deshacer y reiniciar correctamente entre dos dispositivos.
- Gastos y recuerdos se fusionan por identificador y fecha de modificación.
- Los borrados se conservan como tombstones para impedir reapariciones.
- La configuración económica dispone de `configUpdatedAt`; un cambio de presupuesto ya no puede ganar o perder prioridad simplemente porque otra acción no relacionada actualizó el estado global.
- Un estado remoto vacío no sustituye una partida local válida.
- El Service Worker no modifica las peticiones de Supabase.

## Personajes y arte
`assets/characters.svg` es la única fuente de personajes:
- Ismael: retrato y personaje de Aldea comparten pelo rubio ceniza, ojos marrones, barba, ropa verde y la misma paleta facial.
- Laura: retrato y personaje de Aldea comparten pelo oscuro, ojos marrones, expresión y paleta de ropa.
- Dragón de Wawel: un único diseño se reutiliza como NPC y como icono de su misión.
- Guardián del viaje: personaje independiente.

Se eliminaron los alias gráficos v3 y los personajes provisionales que aún quedaban en `game-art.svg`. `assets/game-art.svg` contiene únicamente monumentos e iconos de navegación.

## Mapa y funcionamiento sin red
Leaflet se inicializa únicamente cuando se abre Mapa o una acción necesita enfocarlo. Si la librería no está disponible, el panel muestra un mensaje útil en lugar de quedarse vacío o provocar una excepción. El resto de la aventura continúa funcionando con el estado local.

La geolocalización nunca se sincroniza. Las distancias GPS viven únicamente en el dispositivo.

## PWA y caché
La revisión 7.1 utiliza recursos con versión `?v=710` para evitar que Safari/Cloudflare mezclen JavaScript, CSS o SVG de revisiones diferentes.

`sw.js`:
- usa una caché exclusiva de v7.1;
- precachea exactamente los recursos activos con sus URLs versionadas;
- usa network-first para HTML, JS, CSS y manifest;
- usa caché para assets estáticos después de cargarlos;
- deja pasar las peticiones remotas sin alterarlas;
- elimina cachés antiguas al activarse.

## Accesibilidad y móvil
- Targets táctiles funcionales de al menos 44 px.
- Inputs de 16 px para evitar zoom involuntario en iOS.
- Foco visible para teclado/tecnologías de asistencia.
- `aria-live` en estados relevantes y toast.
- `aria-current` en navegación y siguiente misión.
- `aria-pressed` en filtros y selector de Crónica.
- Safe area superior e inferior.
- Diálogos limitados por `100dvh`.
- La posición del foco de Encargos se conserva sin bucles de refocus cuando llega una sincronización remota.
- `prefers-reduced-motion` y `prefers-contrast` reciben estilos específicos.

## Auditor automático
`window.KP_AUDIT` / `window.KP_VISUAL_AUDIT` comprueba en ejecución:
- estructura principal;
- exactamente un panel y una pestaña activos;
- cinco destinos de navegación;
- integridad del estado y configuración;
- 12 misiones, duplicados y misiones huérfanas;
- símbolos SVG obligatorios;
- identidad real de Ismael, Laura y NPC;
- colisiones de protagonistas con edificios/etiquetas;
- colisiones entre etiquetas de Encargos;
- overflow horizontal y de componentes;
- targets táctiles inferiores a 44 px;
- diálogos fuera del viewport;
- IDs DOM duplicados;
- controles interactivos sin nombre accesible;
- altura real de la navegación;
- Service Worker, contexto seguro, red, viewport y DPR.

## Archivos de soporte
- `SUPABASE_SETUP.sql` — recuperación/configuración de infraestructura; no se ejecuta en el cliente.
- `AUDIT_CURRENT.md` — único informe de auditoría vigente.

Las auditorías históricas superadas se eliminan en vez de acumularse.