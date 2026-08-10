# Kraków Pocket · auditoría v6.2

Fecha: 10/08/2026

## Objetivo
Revisar de forma completa el estado gráfico, la experiencia móvil, la sincronización, el rendimiento, la PWA y los flujos principales después de la consolidación v6.

## Cambios gráficos
- Se incorpora un sprite-sheet SVG propio (`assets/game-art.svg`) con personajes, NPC, 12 monumentos y navegación.
- Ismael pasa a utilizar un personaje ilustrado con pelo rubio ceniza; Laura tiene personaje propio.
- La Aldea utiliza un escenario ilustrado independiente (`assets/village.svg`) en lugar de depender solo de formas CSS.
- El mapa de encargos utiliza un fondo ilustrado independiente (`assets/world-map.svg`) y monumentos del sprite-sheet.
- Se mantienen capas ambientales suaves (nubes, luz, destellos, idle de personajes) sin convertirlas en lógica crítica.
- El mapa real Leaflet mantiene su función independiente del mapa ilustrado de misiones.

## Auditoría de estilo y móvil
### Corregido
- Safe area superior aplicada al HUD del juego.
- Altura reservada para la barra inferior calculada en ejecución mediante `ResizeObserver`, evitando contenido tapado.
- Breakpoints específicos para 420, 360 y 330 px.
- Auditor de overflow horizontal para cabecera, objetivo, tarjetas, etiquetas, rutas y navegación.
- Auditor de colisiones de nodos del mapa de encargos.
- Tamaños táctiles mínimos reforzados.
- Estados `focus-visible` visibles para accesibilidad.
- Diálogos limitados por `100dvh` y con overscroll controlado.
- `prefers-reduced-motion` respetado.
- Animaciones pausadas cuando la aplicación pasa a segundo plano.
- La siguiente misión se destaca sin recrear continuamente el DOM.

### Fallo detectado y corregido durante esta auditoría
El resaltado de la siguiente misión retiraba y recreaba la flecha en cada pasada del observador. Eso podía provocar un ciclo MutationObserver → render → MutationObserver. En v6.2 el proceso es idempotente: solo cambia el DOM cuando el estado realmente cambia.

## Auditoría de estado y sincronización
### Problema detectado
El núcleo histórico combina `visited` mediante unión para no perder progresos entre dos móviles. Las versiones posteriores añadieron `missionStatus` para permitir deshacer una misión. En una desmarcación remota podía existir temporalmente contradicción entre `visited` y `missionStatus`.

### Corrección v6.2
`runtime.js` intercepta exclusivamente las escrituras de la partida `krakowPocketCoop` y normaliza `visited` según `missionStatus` antes de persistir. Si detecta una contradicción procedente de una sincronización remota fuerza una única recarga limpia para que el estado en memoria y el persistido vuelvan a coincidir.

Las escrituras del mismo dispositivo generan además eventos de actualización internos para que las capas visuales y auxiliares no dependan de polling rápido.

## Auditoría de rendimiento
- El antiguo parche general de temporizadores se ha limitado a tres intervalos heredados conocidos.
- Los refrescos auxiliares de 900 ms y 1.800 ms pasan a un fallback de 30 s; los cambios reales se actualizan mediante eventos de estado.
- El polling auxiliar de misiones pasa de 4 s a 15 s como respaldo; la sincronización principal de 5 s permanece intacta.
- Los gráficos nuevos son SVG y comparten un único sprite-sheet para reducir peticiones y DOM repetido.
- Los observadores visuales están limitados al HUD, Aldea, mapa de misiones y barra inferior.
- No se utiliza un MutationObserver global sobre `body`.

## Auditoría PWA / offline
- `visuals.css` y `visuals.js` se cargan estáticamente desde `index.html` para evitar un flash de estilos y una cadena de carga dinámica.
- Los tres nuevos assets gráficos se precargan.
- El Service Worker cachea los assets nuevos.
- Se añade caché de ejecución para Leaflet 1.9.4 desde jsDelivr, mejorando el uso posterior sin conexión.
- Navegación HTML sigue siendo network-first con fallback a `index.html`.
- JavaScript/CSS siguen siendo network-first para evitar mezclar versiones.

## Auditoría de funciones principales
Revisadas las dependencias y flujos de:
- cambio de pestañas;
- mapa Leaflet y recalculo de tamaño;
- geolocalización local;
- recomendaciones;
- misiones y celebraciones;
- deshacer/reiniciar misiones;
- presupuesto y categorías;
- recuerdos;
- sincronización compartida;
- botón de reconexión;
- apertura de Google Maps;
- resumen compartible;
- actualización del Service Worker;
- funcionamiento offline básico;
- cambio de jugador Ismael/Laura;
- safe areas y barra inferior.

## Arquitectura actual
Carga principal:
1. `data.js`
2. `app.js`
3. `runtime.js`
4. `enhancements.js`
5. `game.js`
6. `visuals.js`

Estilos:
1. `styles.css`
2. `enhancements.css`
3. `game.css`
4. `visuals.css`

Gráficos:
- `assets/game-art.svg`
- `assets/village.svg`
- `assets/world-map.svg`

## Pendientes no bloqueantes
- `enhancements.js` conserva dos bloques históricos porque contienen la reconciliación de misiones ya probada entre ambos dispositivos. Se ha reducido su frecuencia desde `runtime.js`, pero conviene consolidarlo en una futura refactorización cuando la sincronización pueda tocarse sin riesgo.
- Leaflet continúa siendo una dependencia externa; ahora queda cacheada después de una carga satisfactoria.
- La validación visual final específica de Safari instalado como PWA debe realizarse sobre dispositivo físico, ya que el repositorio no reproduce exactamente la barra de estado, zoom de texto y comportamiento de WebKit del iPhone.

## Criterio para siguientes versiones
No volver a crear cadenas `vXX.js/vXX.css`. Las mejoras gráficas se integrarán en `assets/`, `visuals.css` y `visuals.js`; los cambios de lógica en el módulo responsable existente.
