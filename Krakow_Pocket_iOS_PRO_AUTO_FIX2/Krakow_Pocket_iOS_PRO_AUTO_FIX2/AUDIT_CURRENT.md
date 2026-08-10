# Kraków Pocket · auditoría actual de producción

Fecha: 10/08/2026

## Alcance
Revisión exhaustiva de arquitectura, funcionamiento, sincronización, PWA, rendimiento, responsive, estilo, personajes, mapa y código muerto. Esta auditoría describe únicamente la implementación que sigue activa después de la limpieza; sustituye a los informes históricos de versiones anteriores.

## Arquitectura comprobada
JavaScript activo:
1. `data.js` — datos estáticos.
2. `app.js` — único núcleo funcional y de sincronización.
3. `game.js` — interfaz RPG y comportamiento del juego.
4. `visuals.js` — arte SVG, responsive y diagnóstico visual.

CSS activo:
1. `styles.css` — componentes funcionales.
2. `game.css` — estructura propia del juego.
3. `visuals.css` — acabado artístico y adaptaciones móviles.

No se cargan `runtime`, `enhancements`, `compat`, `trip-tools` ni ninguna cadena `v34`–`v51`.

## Correcciones de funcionamiento

### Sincronización
- Existe un solo propietario de las operaciones remotas: `app.js`.
- El Service Worker deja pasar las peticiones remotas sin reescribirlas.
- Las misiones utilizan estado por operación (`done` + `updatedAt`) para que deshacer y reiniciar sean reconciliables entre dos dispositivos.
- Gastos y recuerdos se fusionan por identificador y fecha de modificación; los borrados conservan tombstones para impedir reapariciones.
- Un estado remoto vacío no puede sustituir accidentalmente una partida local válida.
- La sincronización continúa cada 5 segundos, pero la capa RPG ya no reconstruye su DOM cuando el contenido relevante no ha cambiado.

### Render y rendimiento
Antes, cada evento de sincronización podía reconstruir HUD, Aldea, Encargos y navegación aunque la partida fuese idéntica. `game.js` utiliza ahora firmas independientes para HUD, Aldea y tablero de misiones:
- HUD solo se reconstruye si cambian jugador, escamas, gasto, misiones u objetivo visible.
- Aldea solo se reconstruye si cambia el progreso que modifica su mensaje/alertas.
- Encargos solo se reconstruye si cambia el bitmap de las 12 misiones.
- La navegación inferior se genera una única vez por carga salvo reconstrucción real.

Esto evita trabajo DOM innecesario, reduce parpadeos y disminuye el riesgo de perder estados visuales durante sincronizaciones periódicas.

### Celebraciones de misión
Se eliminó el puente temporal mediante `sessionStorage`. Al completar una misión desde Encargos, la celebración se lanza directamente después de que `app.js` confirme el cambio. Se reduce estado efímero y desaparece una ruta de ejecución que podía quedar obsoleta.

### Mapa y navegación externa
- Leaflet se inicializa cuando se necesita, no al abrir la aplicación.
- La geocodificación pendiente se inicia una sola vez por sesión.
- Google Maps utiliza navegación directa para evitar pestañas intermedias vacías en Safari.
- Al cambiar de panel la vista vuelve al inicio y el mapa invalida su tamaño al mostrarse.

### PWA
- `sw.js` cachea solo los archivos de producción actuales.
- HTML/JS/CSS/manifest usan red como primera opción con caché de respaldo.
- Assets estáticos pueden resolverse desde caché.
- Cada revisión cambia el nombre de caché y elimina las anteriores durante `activate`.

## Correcciones de estilo y estructura

### HTML
- Se eliminó la antigua cabecera funcional que permanecía oculta detrás del HUD RPG.
- Se eliminó la antigua tarjeta/lista de misiones que funcionaba como backend visual oculto.
- `#quests` es ahora un contenedor real para la interfaz de Encargos generada por `game.js`.
- Los estilos inline repetitivos se han reducido mediante clases de utilidad activas.

### CSS
`game.css` se ha recortado a los componentes que realmente genera `game.js`. Se retiraron específicamente:
- la regla que ocultaba la antigua `.hero`, porque ese elemento ya no existe;
- la regla que escondía el primer `article` de `#quests`, porque la lista antigua ya no existe;
- estilos heredados que pertenecían a gráficos provisionales sustituidos por assets finales.

Se mantiene deliberadamente la separación `styles.css` / `game.css` / `visuals.css`: las tres hojas tienen responsabilidades distintas y siguen aportando reglas activas. Fusionarlas solo reduciría el número de archivos a costa de mezclar componentes funcionales, geometría RPG y arte/responsive.

### iPhone y responsive
- Safe area superior controlada por el HUD.
- Altura inferior medida mediante `ResizeObserver` y expuesta como `--kp-nav-h`.
- Toasts y diálogo de misión respetan la navegación inferior.
- Breakpoints específicos para 480, 390 y 350 px.
- Inputs mantienen tamaño compatible con iOS y targets táctiles mínimos.
- `prefers-reduced-motion` desactiva animaciones/transiciones decorativas.

### Personajes
- Ismael y Laura conservan los mismos IDs gráficos en retrato y Aldea.
- Safari utiliza los mismos símbolos SVG insertados en línea, no una segunda versión visual.
- La auditoría compara el ID esperado con el ID realmente renderizado.
- La posición de la pareja dispone de corrección automática si invade etiquetas de Aldea.

### Encargos
- 12 nodos deterministas.
- Siguiente misión destacada.
- Etiquetas adaptables a bordes y colisiones.
- Deshacer/reiniciar solo disponibles cuando corresponde.
- Diálogo y celebración tienen roles de diálogo y no dependen de elementos HTML invisibles.

## Auditor automático en ejecución
`window.KP_AUDIT` (alias `window.KP_VISUAL_AUDIT`) comprueba:
- elementos estructurales;
- exactamente un panel y una pestaña activos;
- cinco destinos de navegación;
- integridad básica del estado local;
- integridad de datos de las 12 misiones;
- disponibilidad de paquetes de arte;
- identidad de Ismael, Laura y NPC;
- colisiones de personajes y etiquetas;
- colisiones de etiquetas en Encargos;
- overflow horizontal y de componentes;
- targets táctiles pequeños;
- diálogos que exceden el viewport;
- altura de navegación;
- Service Worker, contexto seguro, red, tamaño de viewport y DPR.

## Código eliminado
La limpieza acumulada ha retirado del runtime:
- capas `v34`–`v51`;
- `trip-tools` y variantes;
- `runtime.js`;
- `enhancements.js` / `enhancements.css`;
- `compat.js` / `compat.css`;
- auditorías históricas superadas;
- personajes y mapas provisionales generados desde JavaScript;
- DOM oculto de la antigua interfaz;
- estado temporal de celebración que ya no era necesario.

## Archivos que se conservan deliberadamente
- `SUPABASE_SETUP.sql`: infraestructura de recuperación/configuración; no se ejecuta en el cliente.
- `README.md`: documentación de arquitectura y despliegue.
- `AUDIT_CURRENT.md`: único informe de auditoría vigente.
- cuatro assets SVG y dos iconos: todos tienen referencias activas desde la app/manifest.

## Límite de la auditoría
Se ha comprobado el código real del repositorio y sus relaciones. La apariencia exacta de WebKit con la barra de navegador/PWA de un iPhone físico solo puede certificarse visualmente en el dispositivo; el auditor de la app cubre geometría, overflow, colisiones y tamaños cuando se ejecuta en ese viewport.
