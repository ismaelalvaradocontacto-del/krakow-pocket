# Kraków Pocket · auditoría exhaustiva v7.0

Fecha: 10/08/2026

## Alcance
Auditoría completa de arquitectura, funcionamiento, sincronización, PWA, rendimiento, responsive, estilo, personajes, mapa y código muerto. El objetivo de v7.0 es reducir la aplicación a una sola implementación por responsabilidad y eliminar las capas de parche que se habían acumulado durante las iteraciones gráficas.

## Problemas detectados y corregidos

### 1. Demasiadas capas de ejecución
Existían `runtime.js`, `enhancements.js`, `compat.js`, `app.js`, `game.js` y `visuals.js` actuando sobre partes coincidentes del estado o del DOM. Había además hojas equivalentes para enhancements y compatibilidad.

**Corrección:** el runtime queda reducido a `data.js -> app.js -> game.js -> visuals.js`. Se eliminan `runtime.js`, `enhancements.js`, `enhancements.css`, `compat.js` y `compat.css`.

### 2. Sincronización duplicada
El núcleo y enhancements tenían mecanismos independientes de sincronización. Eso aumentaba peticiones, podía producir carreras y obligaba a mantener la misma configuración en varios sitios.

**Corrección:** `app.js` es la única capa que lee y escribe la partida compartida. El Service Worker no altera las peticiones remotas.

### 3. Deshacer misiones no era representable en `visited`
Una unión de arrays solo puede añadir elementos. Una misión desmarcada podía reaparecer al mezclarse con otro dispositivo.

**Corrección:** cada misión tiene `missionStatus[id] = { done, updatedAt }`. La reconciliación selecciona la operación más reciente, tanto si completa como si deshace. Reiniciar las misiones genera operaciones `done:false` para las 12.

### 4. Estado remoto vacío podía parecer más reciente
Normalizar un objeto remoto vacío con una fecha actual podía darle prioridad sobre una configuración local válida.

**Corrección:** se distingue entre una partida remota inexistente y una partida real. Si la nube está vacía, se sube el estado local; no se generan valores remotos ficticiamente más nuevos.

### 5. Renderizadores de personajes duplicados
`visuals.js` y `compat.js` podían reemplazar los mismos nodos. Safari utilizaba una ruta distinta a otros navegadores.

**Corrección:** `visuals.js` es el único renderizador. Los SVG se cargan una vez y sus símbolos se insertan dentro del DOM, por lo que Safari y el resto utilizan exactamente los mismos personajes y monumentos.

### 6. Arte provisional dentro de `game.js`
El archivo conservaba funciones para dibujar personajes, edificios y mapas provisionales aunque luego fueran sustituidos por los assets finales.

**Corrección:** `game.js` solo construye estructura y comportamiento de juego. Los nodos de arte quedan vacíos para que `visuals.js` inserte los assets definitivos.

### 7. Actualizador PWA y puente de Maps duplicados
Había más de una implementación de actualización de Service Worker y lógica histórica para Google Maps.

**Corrección:** `app.js` posee una sola implementación de cada flujo. Google Maps navega en la misma pestaña para evitar el problema de Safari al volver de una pestaña vacía.

### 8. DOM oculto usado como backend visual
La cabecera antigua y una lista completa de misiones seguían renderizándose aunque la interfaz RPG las ocultase.

**Corrección:** ambos bloques se eliminan del HTML. La Aldea/HUD y el mapa de encargos son ahora la interfaz real, no una capa sobre una interfaz invisible.

### 9. CSS muerto acumulado
`styles.css` seguía conteniendo la antigua cabecera y componentes abandonados; `game.css` y `visuals.css` acumulaban reglas de generaciones anteriores.

**Corrección:** se reconstruye `styles.css` con los componentes funcionales que siguen vivos, se recorta `game.css` a la estructura RPG activa y se concentra todo el acabado/responsive en `visuals.css`.

### 10. Polling y observación excesiva
Versiones anteriores usaron timers cortos y MutationObserver amplios para reparar la interfaz después de cada render.

**Corrección:** la interfaz se coordina mediante eventos `kp:render` y `kp:game-render`. `visuals.js` no observa todo el body; únicamente utiliza ResizeObserver para medir la navegación inferior. La auditoría ambiental se repite con baja frecuencia.

### 11. Inicialización innecesaria del mapa
Leaflet y geocodificación podían prepararse aunque el usuario no abriera Mapa.

**Corrección:** el mapa real se inicializa cuando se abre su panel. La geocodificación de lugares incompletos se ejecuta una sola vez por sesión.

### 12. Riesgo de pérdida de celebración
Al retirar el antiguo puente de botones de misión, la celebración podía dejar de saber qué misión acababa de completarse.

**Corrección:** el diálogo de Encargos registra temporalmente el identificador antes de confirmar la misión. La celebración se consume una única vez después del render correcto.

## Auditoría de estilo

### HUD
- retrato con tamaño controlado por breakpoint;
- logo con truncado seguro antes de invadir ajustes;
- recursos en tres columnas estables;
- contraste de pergamino/madera;
- números tabulares;
- safe area superior con un único propietario.

### Objetivo
- estructura `icono + texto flexible + contador`;
- saltos de texto controlados;
- versión compacta para iPhone estrecho;
- contador no invade el título.

### Aldea
- Ismael y Laura mantienen identidad en cabecera y escenario;
- pareja por encima del paisaje y por debajo de controles cuando corresponde;
- Encargos y Mapa reposicionados para liberar la zona de personajes;
- posición de seguridad automática si la auditoría detecta una colisión;
- VFX sin interacción táctil y con `prefers-reduced-motion`.

### Encargos
- 12 nodos con posiciones deterministas;
- siguiente misión destacada;
- etiquetas con corrección automática izquierda/derecha/arriba;
- auditor de colisiones entre etiquetas;
- botones de deshacer/reiniciar deshabilitados correctamente a 0 misiones.

### Navegación
- cinco destinos obligatorios;
- exactamente una pestaña activa;
- altura real medida y exportada a `--kp-nav-h`;
- toast y diálogos flotantes respetan esa altura;
- safe area inferior incorporada al dock.

### Formularios y diálogos
- inputs de al menos 44 px;
- fuente de 16 px para evitar zoom involuntario de iOS;
- `min-width:0` en layouts flex/grid;
- diálogos limitados por `100dvh`;
- auditor de diálogos fuera del viewport;
- controles compactos sin ocultar contenido.

## Auditoría automática
`window.KP_AUDIT` (alias `window.KP_VISUAL_AUDIT`) registra:
- elementos estructurales ausentes;
- número de paneles y tabs activos;
- número de tabs principal;
- forma del estado local;
- integridad de los datos de misiones;
- disponibilidad de los dos paquetes de arte;
- identidad real de retrato, Ismael, Laura y NPC;
- colisiones de personajes;
- colisiones de etiquetas de Encargos;
- overflow horizontal;
- componentes con overflow interno;
- targets táctiles pequeños;
- diálogos fuera del viewport;
- altura de navegación;
- soporte de Service Worker, contexto seguro y estado de red;
- dimensiones y DPR del viewport.

## Archivos eliminados
- `runtime.js`
- `enhancements.js`
- `enhancements.css`
- `compat.js`
- `compat.css`
- auditorías v6 ya superadas

## Arquitectura final

JavaScript activo:
1. `data.js`
2. `app.js`
3. `game.js`
4. `visuals.js`

CSS activo:
1. `styles.css`
2. `game.css`
3. `visuals.css`

Assets gráficos activos:
1. `characters.svg`
2. `game-art.svg`
3. `village.svg`
4. `world-map.svg`

## Comportamientos protegidos
- selección Ismael/Laura por dispositivo;
- sincronización de gastos, recuerdos, configuración y misiones;
- deshacer y reiniciar misiones;
- celebraciones y hitos 3/6/9/12;
- GPS únicamente local;
- filtros y navegación del mapa;
- historias y marcado de lugares;
- presupuesto y borrado sincronizable;
- compartir resumen;
- actualización PWA;
- funcionamiento offline de recursos esenciales.

## Resultado
v7.0 deja de ser una suma de capas de corrección. Existe un núcleo funcional, una capa de interfaz y un renderizador visual. Las mismas entidades tienen una única fuente de estado y los personajes una única fuente gráfica. Cualquier diagnóstico posterior debe corregirse en esas capas en vez de añadir otra versión paralela.