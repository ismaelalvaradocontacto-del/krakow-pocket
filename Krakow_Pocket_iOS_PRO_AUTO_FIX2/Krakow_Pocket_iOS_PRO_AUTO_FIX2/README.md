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
La interfaz se consolidó para eliminar la antigua cadena de parches de versiones `v34`–`v51`.

Runtime cargado:
- `data.js`: datos del viaje, lugares, misiones y planning.
- `app.js`: núcleo funcional, mapa, formularios, estado y sincronización base.
- `enhancements.js`: funciones cooperativas adicionales y gestión reversible de misiones.
- `game.js`: interfaz RPG consolidada, gráficos vectoriales, Aldea, mapa ilustrado, celebraciones y adaptación de navegación.

Estilos cargados:
- `styles.css`: base funcional.
- `enhancements.css`: componentes auxiliares todavía utilizados.
- `game.css`: sistema visual principal y responsive de la experiencia RPG.

Ya no se utilizan loaders encadenados ni hojas/JS versionados `v34`–`v51`.

## Sincronización
Los dos dispositivos usan una única partida compartida. Se sincronizan:
- misiones;
- gastos;
- recuerdos;
- configuración común.

La gestión adicional de misiones conserva un historial de estado para permitir deshacer una misión o reiniciar el tablero sin que una sincronización posterior vuelva a marcarla accidentalmente como completada.

## Privacidad
La posición GPS se utiliza únicamente en el dispositivo para distancias y recomendaciones. No forma parte del estado compartido de la partida.

La sincronización utiliza una publishable key de Supabase; nunca debe usarse una `service_role` en el cliente.

## PWA y actualizaciones
`sw.js` mantiene en caché únicamente los recursos actuales de la aplicación. HTML, JS y CSS utilizan una estrategia orientada a obtener primero la versión más reciente y usar la caché como respaldo.

La aplicación muestra un aviso cuando existe una nueva versión y recarga cuando el nuevo Service Worker toma el control.

## iPhone
La interfaz utiliza:
- `viewport-fit=cover` y safe areas;
- inputs de 16 px o más para evitar zoom involuntario;
- navegación inferior accesible con una mano;
- controles táctiles amplios;
- breakpoints específicos para pantallas estrechas;
- soporte de `prefers-reduced-motion`.

## Publicación
El frontend puede publicarse en un hosting estático HTTPS, actualmente Cloudflare Pages. La sincronización de datos depende de Supabase.

URL de producción:
`https://krakow-pocket.pages.dev/`
