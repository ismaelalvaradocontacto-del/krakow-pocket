# Kraków Pocket · auditoría exhaustiva actual

Fecha: 10/08/2026
Versión funcional: `7.1.0`

## Alcance
Revisión completa del código de producción: arquitectura, estado compartido, sincronización, PWA, caché, mapa, GPS, navegación externa, misiones, formularios, diálogos, personajes, SVG, responsive, accesibilidad, rendimiento, estilos y código muerto.

Este documento sustituye cualquier auditoría anterior.

## Resultado general
La aplicación mantiene una arquitectura de cuatro JavaScript y tres hojas CSS, sin loaders históricos ni capas paralelas. La auditoría ha detectado y corregido problemas adicionales de sincronización, render, SVG, identidad gráfica, caché, interacción móvil y accesibilidad.

## Arquitectura activa
JavaScript:
1. `data.js` — datos estáticos.
2. `app.js` — único núcleo funcional y de sincronización.
3. `game.js` — interfaz RPG y comportamiento del juego.
4. `visuals.js` — arte SVG, responsive y diagnóstico visual.

CSS:
1. `styles.css` — componentes funcionales.
2. `game.css` — estructura RPG.
3. `visuals.css` — acabado visual y adaptaciones móviles.

Assets:
1. `assets/characters.svg`
2. `assets/game-art.svg`
3. `assets/village.svg`
4. `assets/world-map.svg`

No se cargan `runtime`, `enhancements`, `compat`, `trip-tools` ni ninguna cadena `v34`–`v51`.

## Correcciones de funcionamiento

### 1. Sincronización de configuración
Problema: la elección de qué configuración económica ganaba durante una fusión utilizaba la fecha global del estado. Un recuerdo, gasto o misión podía hacer parecer más reciente una configuración que realmente no había cambiado.

Corrección: se añade `configUpdatedAt`. El objetivo diario y el importe ya pagado/configurado se reconcilian utilizando específicamente la fecha de modificación de la configuración.

### 2. Render completo cada cinco segundos
Problema: incluso cuando Supabase devolvía exactamente el mismo estado, el núcleo terminaba renderizando de nuevo toda la interfaz funcional.

Corrección: `syncCloud()` compara firmas de estado. `renderAll()` solo se ejecuta si la fusión produce una diferencia real. La capa RPG mantiene además firmas independientes para HUD, Aldea y Encargos.

### 3. Trabajo en segundo plano
Problema: sincronización y actualización periódica podían continuar mientras la app estaba oculta.

Corrección: el polling periódico solo sincroniza/renderiza cuando el documento está visible. Al regresar a primer plano se solicita una sincronización inmediata.

### 4. Mutación de los datos estáticos
Problema: el algoritmo de recomendaciones añadía `_score` y `_dist` sobre objetos de `KP_DATA`.

Corrección: el ranking se calcula en objetos temporales. Los datos estáticos ya no se ensucian durante el uso.

### 5. Campos de ajustes durante sincronización
Problema: un render provocado por nube podía reescribir un input que el usuario estaba editando antes de confirmar el cambio.

Corrección: los campos se actualizan desde estado únicamente cuando no tienen el foco.

### 6. Mapa sin Leaflet
Problema: si Leaflet no estaba disponible, el área de mapa podía quedar vacía y acciones posteriores podían asumir que existía una instancia.

Corrección: existe estado visual `map-unavailable`; se muestra un mensaje útil y las rutas/fichas siguen siendo utilizables. GPS y `focusPoi` comprueban la disponibilidad real del mapa.

### 7. Objetivo con icono incorrecto
Problema: el HUD RPG podía representar cualquier recomendación con un autobús aunque la recomendación activa fuese un lugar, comida, paseo, etc.

Corrección: el objetivo reutiliza el emoji real de la recomendación activa.

### 8. Diálogo de misión y sincronización
Problema: actualizar el tablero mientras un diálogo estaba abierto podía reconstruir el nodo que originó la interacción y provocar refocus innecesario.

Corrección: el diálogo solo se refresca cuando el tablero realmente cambia, actualiza su referencia al nuevo nodo y no fuerza el foco otra vez. Al cerrar, restaura foco únicamente si el origen sigue conectado.

### 9. Celebraciones
La celebración continúa ejecutándose directamente después de confirmar la misión; no existe un puente de `sessionStorage` ni estado efímero histórico.

### 10. Navegación externa
Google Maps se abre mediante navegación directa de la misma pestaña para evitar la pestaña intermedia vacía que daba problemas al volver en Safari.

## Auditoría gráfica

### Personajes
Problema detectado: el asset final de Ismael había derivado a pelo castaño aunque la identidad definida era rubio ceniza.

Corrección:
- `hairI` vuelve a una paleta rubio ceniza/taupe;
- se ajustan luces y contornos en retrato y sprite de Aldea;
- ambos tamaños reutilizan la misma paleta;
- Laura conserva su identidad de pelo oscuro en ambas escalas.

También se eliminaron los alias v3 de personajes que ya no tenían consumidores.

### Dragón de Wawel
Problema: `game-art.svg` conservaba un dragón antiguo y `characters.svg` otro más reciente. El mapa de Encargos podía mostrar una identidad diferente del NPC.

Corrección: el mapa utiliza `npc-dragon-v4` desde `characters.svg`. El dragón provisional y `landmark-dragon` se eliminan de `game-art.svg`.

### Limpieza de SVG
Problema: al insertar un símbolo, el antiguo renderizador copiaba el `<defs>` completo del paquete. En `characters.svg` ese bloque contenía además todos los grupos artísticos, multiplicando mucho el DOM por cada personaje insertado.

Corrección:
- se resuelven las referencias `<use>` antes de insertar;
- los grupos `art-*` no se duplican en el `<defs>` de cada SVG final;
- solo se mantienen gradientes/filtros reutilizables;
- `game-art.svg` ya no contiene personajes, ropa, piel, pelo ni filtros que solo servían a gráficos eliminados.

### Coherencia visual
- HUD, cards, objetivos y diálogos comparten pergamino/madera.
- Personajes se mantienen por encima del escenario y por debajo de controles relevantes.
- El auditor comprueba colisión de la pareja tanto contra etiquetas como contra edificios.
- Encargos conserva 12 posiciones deterministas y ajuste de etiquetas por bordes/colisión.
- El mapa del Dragón utiliza ahora exactamente el mismo personaje que la Aldea/diálogo.

## Responsive / iPhone
Se revisan breakpoints de 480, 390 y 350 px.

Correcciones y garantías:
- safe area superior en HUD;
- navegación inferior medida dinámicamente mediante `ResizeObserver`;
- contenido, toast y diálogo de misión respetan `--kp-nav-h`;
- botón de ajustes mantiene 44×44 px incluso en los breakpoints estrechos;
- botones compactos, borrar, cerrar, filtros, controles de Encargos y popup del mapa alcanzan 44 px;
- inputs mantienen 16 px;
- `min-width:0` evita desbordes en grid/flex;
- diálogos se limitan con `100dvh`.

## Accesibilidad
Correcciones aplicadas:
- foco `:focus-visible` real y visible; se elimina la regla móvil que lo anulaba;
- estado de actualización, sincronización y toast con regiones vivas;
- botones no-submit declaran `type=button`;
- filtros y selector de Crónica exponen `aria-pressed`;
- navegación expone `aria-current`;
- siguiente misión expone `aria-current=step`;
- misiones completadas incluyen su estado en el nombre accesible;
- objetivos y mapa disponen de etiquetas semánticas;
- diálogos de misión/celebración gestionan `aria-hidden` y foco;
- `prefers-reduced-motion` desactiva movimiento decorativo;
- `prefers-contrast: more` refuerza contraste y bordes.

## PWA y caché
Problema: una revisión podía cambiar archivos manteniendo exactamente la misma URL, dejando margen a que Safari/CDN mezclasen assets de momentos distintos.

Corrección:
- recursos propios cargados por `index.html` usan `?v=710`;
- fondos SVG de CSS también usan `?v=710`;
- `visuals.js` solicita los paquetes de símbolos con la misma versión;
- Service Worker `krakow-pocket-v7-1-20260810a` precachea esas URLs exactas;
- navegación y código/estilos mantienen estrategia de red primero;
- peticiones de Supabase quedan fuera del Service Worker;
- cachés anteriores se eliminan al activar la nueva versión.

## Auditor automático 7.1
`window.KP_AUDIT` y `window.KP_VISUAL_AUDIT` comprueban ahora:
- elementos estructurales ausentes;
- un único panel activo;
- una única pestaña activa;
- cinco destinos de navegación;
- forma y valores numéricos de estado/configuración;
- presencia de `configUpdatedAt`;
- exactamente 12 misiones;
- IDs de misión duplicados;
- POIs de misión duplicados;
- misiones huérfanas sin POI;
- símbolos SVG requeridos en ambos paquetes;
- identidad del retrato, Ismael, Laura y NPC;
- personajes ausentes;
- colisiones de protagonistas con edificios/etiquetas;
- colisiones de etiquetas de Encargos;
- overflow horizontal;
- overflow de componentes clave;
- controles por debajo de 44×44 px;
- diálogos que exceden viewport;
- IDs DOM duplicados;
- controles visibles sin nombre accesible;
- altura real de navegación;
- disponibilidad de Service Worker;
- contexto seguro, red, viewport y DPR.

El auditor completo se limita temporalmente para no convertir la propia auditoría en una fuente de jank. Se fuerza en carga, assets, resize, orientación, pageshow y cambios estructurales relevantes.

## Código muerto retirado durante esta revisión
- gradiente `greenLight` no utilizado;
- aliases `char-*-v3-*`;
- alias `npc-dragon-v2`;
- personajes antiguos `char-ismael` / `char-laura` de `game-art.svg`;
- `npc-dragon` antiguo;
- `landmark-dragon` duplicado;
- gradientes/filtros de `game-art.svg` usados únicamente por esos personajes antiguos.

Se mantiene deliberadamente la separación entre `styles.css`, `game.css` y `visuals.css`, porque siguen teniendo responsabilidades diferentes; fusionarlos no eliminaría lógica ni bytes significativos y empeoraría la mantenibilidad.

## Limitación de certificación visual
La auditoría del repositorio y las defensas de ejecución son exhaustivas respecto al código disponible. El píxel exacto de WebKit en un iPhone físico —incluyendo barras del navegador, modo instalado y particularidades del dispositivo— se valida mejor con captura real. La app incorpora diagnósticos geométricos precisamente para detectar esos casos en el viewport final.