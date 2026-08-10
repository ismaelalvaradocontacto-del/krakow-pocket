# Kraków Pocket

PWA móvil para la escapada de Ismael y Laura a Cracovia del 11–13 de agosto de 2026, planteada como una aventura cooperativa con estética de RPG acogedor.

## Funciones principales
- Mapa real de Cracovia con OpenStreetMap/Leaflet.
- GPS opcional del dispositivo para ordenar lugares cercanos.
- Recomendaciones según tiempo disponible, tipo de plan, presupuesto y contexto.
- Misiones cooperativas y “Escamas de Wawel”.
- Mapa ilustrado de encargos y celebraciones al completar misiones.
- Crónica y recuerdos compartidos.
- Presupuesto común con gastos por categoría.
- Sincronización de progreso entre los dos dispositivos mediante Supabase.
- Apertura de navegación en Google Maps.
- Funcionamiento como PWA y soporte offline de los recursos esenciales.

## Arquitectura actual · v6
La interfaz se consolidó para eliminar la antigua cadena de parches de versiones `v34`–`v51` y los antiguos `trip-tools`.

Runtime cargado:
- `data.js`: datos del viaje, lugares, misiones y planning.
- `app.js`: núcleo funcional, mapa, formularios, estado y sincronización base.
- `runtime.js`: guardas de rendimiento y compatibilidad del runtime actual.
- `enhancements.js`: funciones cooperativas y gestión reversible/sincronizada de misiones.
- `game.js`: interfaz RPG consolidada, gráficos vectoriales, Aldea, mapa ilustrado, celebraciones y navegación del juego.

Estilos cargados:
- `styles.css`: base funcional.
- `enhancements.css`: componentes cooperativos que siguen en uso y ajustes de safe-area.
- `game.css`: sistema visual principal y responsive de la experiencia RPG.

Ya no se utilizan loaders encadenados, hojas/JS versionados `v34`–`v51` ni el antiguo módulo `trip-tools`.

## Sincronización
Los dos dispositivos usan una única partida compartida. Se sincronizan misiones, gastos, recuerdos y configuración común.

La gestión de misiones conserva un estado específico para permitir deshacer una misión o reiniciar el tablero sin que una sincronización posterior vuelva a marcarla accidentalmente como completada.

## Rendimiento
La versión v6 elimina los redibujados y loaders acumulados de las capas antiguas. Los refrescos auxiliares heredados se limitan mediante `runtime.js`; los cambios relevantes siguen reaccionando inmediatamente a eventos de almacenamiento, visibilidad, conectividad y acciones del usuario.

## Privacidad
La posición GPS se utiliza únicamente en el dispositivo para distancias y recomendaciones. No forma parte del estado compartido de la partida.

La sincronización utiliza una publishable key de Supabase; nunca debe usarse una `service_role` en el cliente.

## PWA y actualizaciones
`sw.js` mantiene en caché únicamente los recursos actuales de la aplicación. HTML, JS y CSS intentan obtener primero la versión más reciente y usan la caché como respaldo.

La aplicación muestra un aviso cuando existe una nueva versión y recarga cuando el nuevo Service Worker toma el control.

## iPhone
La interfaz utiliza `viewport-fit=cover`, safe areas, inputs de tamaño suficiente para evitar zoom involuntario, navegación inferior accesible con una mano, controles táctiles amplios, breakpoints para pantallas estrechas y soporte de `prefers-reduced-motion`.

## Publicación
El frontend se publica en Cloudflare Pages y la sincronización de datos depende de Supabase.

Producción:
`https://krakow-pocket.pages.dev/`
