# Kraków Pocket · Auditoría exhaustiva de producción

Fecha: 10/08/2026

## Alcance

Auditoría del repositorio, runtime, despliegue en Cloudflare Pages, JavaScript, CSS/HTML, PWA/Service Worker, sincronización con Supabase, navegación, responsive móvil, personajes y flujos de escritura. Se valida con Chromium y WebKit (motor de Safari) en viewport móvil 390 × 844 y DPR 3, tanto sobre un espejo local aislado como contra la URL pública real.

## Causas raíz encontradas

### 1. Error de sintaxis bloqueante en `app.js`

La versión posterior a la limpieza contenía un error de sintaxis (`SyntaxError: Unexpected token ')'`). Como consecuencia, HTML y CSS cargaban, pero el núcleo JavaScript no llegaba a ejecutarse. El síntoma visible era exactamente: `Calculando…`, `sincronizando…`, 0/12, ausencia del HUD RPG y botones sin respuesta.

### 2. Limpieza demasiado agresiva del runtime

En una sola secuencia de cambios se eliminaron o sustituyeron varias capas funcionales (`runtime.js`, `compat.js/.css`, `enhancements.js/.css`) y se modificaron simultáneamente `app.js`, `index.html`, `game.js`, `sw.js`, `visuals.js` y `visuals.css`. La recuperación posterior se estaba haciendo sobre una base ya inconsistente.

Se restauró el runtime de producción desde la última base anterior a esa limpieza identificada en el historial:

`b4aa4ebac310d51468d86b91547084e1852a842e`

La restauración mantiene el historial de Git y conserva la nueva infraestructura de auditoría.

### 3. Clave pública de Supabase con un carácter incorrecto

La base restaurada incluía una errata de un carácter en la clave publishable de Supabase, provocando HTTP 401 `Invalid API key`. `runtime.js` corrige ahora el header `apikey` antes de que salga cualquier RPC de Supabase. La sincronización real vuelve a alcanzar el estado `sincronizados`.

### 4. Carrera de render de personajes específica de Safari/WebKit

`visuals.js` podía reconstruir los personajes mediante referencias SVG externas mientras `compat.js` intentaba sustituirlas por SVG inline para Safari. Después de navegar por varias secciones y volver a Aldea, WebKit podía dejar el marco del retrato o los personajes de la pareja sin dibujo aunque el resto de la app siguiera funcionando.

Se corrigió en dos niveles:

- cuando el modo inline ya está activo, `visuals.js` deja de regenerar referencias externas de personajes;
- `compat.js` reaplica el SVG inline de forma síncrona en `kp:render`, `kp:game-render`, `kp:statechange` y `pageshow`, además de mantener su observador de DOM y ráfaga de comprobación.

La caché PWA final de esta recuperación es:

`krakow-pocket-v6-8-20260810e`

## Estado funcional comprobado

- Todos los JavaScript de producción pasan `node --check`.
- La app arranca y sale de `Calculando…`.
- La sincronización real llega a `sincronizados`.
- El HUD RPG, objetivo actual y Aldea se renderizan.
- El retrato del jugador contiene SVG inline real.
- Ismael y Laura aparecen como dos SVG inline reales en la Aldea después de recorrer toda la navegación y volver.
- Navegación operativa: Aldea, Mapa, Encargos, Crónica y Bolsa.
- Ajustes abre y cierra correctamente.
- Historias abren y cierran su diálogo.
- Añadir y borrar gastos funciona en prueba aislada.
- Añadir y borrar recuerdos funciona en prueba aislada.
- Completar una misión persiste el estado, atraviesa la recarga/celebración y conserva el progreso.
- La sincronización permanece sana después de operaciones de escritura aisladas.
- No existe overflow horizontal en viewport de iPhone auditado.
- Producción Cloudflare devuelve HTTP 200.
- La URL pública auditada es `https://krakow-pocket.pages.dev/`.
- El runtime de producción identificado es `6.8.1`.

## Resultado final automatizado

Workflow final:

- Run: `31412198338`
- Job: `93532689027`
- Commit auditado: `572b571da9b2169c6d139020da19a6ec68f85c6d`
- Resultado: **SUCCESS**

La ejecución final pasó todas las fases:

1. sintaxis de todos los JavaScript;
2. espejo local exacto de producción;
3. smoke test local Chromium;
4. smoke test local WebKit;
5. flujos de escritura aislados;
6. convergencia del despliegue de Cloudflare;
7. smoke test contra Cloudflare real en Chromium;
8. smoke test contra Cloudflare real en WebKit;
9. captura visual final de ambos motores.

Las capturas finales muestran en Chromium y WebKit el retrato del jugador, Ismael y Laura en Aldea, objetivo, recomendación, estado `sincronizados`, navegación inferior y contenido móvil sin desbordamiento.

## Matriz de pruebas automatizadas permanente

El workflow `.github/workflows/krakow-audit.yml` ejecuta en cada push a `main`:

1. Validación de sintaxis de todos los `.js` de la aplicación.
2. Espejo local del directorio exacto que publica Cloudflare.
3. Smoke test aislado en Chromium.
4. Smoke test aislado en WebKit.
5. Prueba aislada de escritura: Ajustes, gasto, recuerdo, misión e historia.
6. Espera hasta que Cloudflare confirme el runtime auditado.
7. Smoke test contra la URL pública real en Chromium.
8. Smoke test contra la URL pública real en WebKit.
9. Verificación obligatoria del SVG inline del retrato y de los dos personajes de Aldea.
10. Capturas de auditoría como artefacto.

Las pruebas locales no usan ni modifican la partida real de Supabase. Las pruebas de producción son de arranque/navegación y no crean gastos, recuerdos ni misiones.

## PWA y Service Worker

El Service Worker actual usa caché versionada, elimina cachés anteriores, usa network-first para navegación/JS/CSS/manifest y deja pasar las peticiones de Supabase sin interceptarlas. Los assets estáticos se pueden resolver desde caché.

Riesgo no bloqueante: Leaflet se carga desde CDN y no forma parte del precache de instalación. En una primera apertura completamente offline el mapa podría no estar disponible aunque el resto de la aplicación sí.

## Responsive / iPhone

Se ha validado en viewport 390 × 844 con DPR 3 tanto en Chromium como en WebKit. No hay overflow horizontal. El HUD, objetivo, contenido y navegación inferior se mantienen dentro del ancho útil. WebKit pasa navegación, render completo y persistencia de los personajes después de cambiar de pantalla.

## Sincronización y estado

El estado se conserva en `localStorage` y se sincroniza mediante RPC de Supabase. Gastos y recuerdos utilizan identificadores y marcas de actualización; los borrados utilizan `deletedAt`. Las misiones disponen de normalización adicional en runtime para conservar correctamente deshacer/reiniciar y reconciliación tras recargas.

## Seguridad

La clave publishable de Supabase es pública por diseño. Sin embargo, el código de aventura y el secreto compartido también están presentes en código cliente, por lo que no deben considerarse un mecanismo de autenticación fuerte. Para esta app privada de viaje puede mantenerse durante la estabilización, pero una evolución seria debería usar autenticación real, un token privado rotatable o una capa de acceso delante de los RPC.

## Deuda técnica deliberadamente NO limpiada ahora

La prioridad actual es estabilidad. Permanecen varias capas históricas (`runtime.js`, `app.js`, `enhancements.js`, `game.js`, `visuals.js`, `compat.js`) con responsabilidades parcialmente solapadas. También existen algunos marcadores/archivos de recuperación que no se cargan en producción. No se eliminarán hasta después de validación física en los dos iPhone y siempre detrás del workflow de auditoría.

`enhancements.js` conserva además una copia histórica del enlace de Netlify y una copia antigua de la clave Supabase. Actualmente no afectan al funcionamiento: el resumen se intercepta en `runtime.js` para usar `location.origin`, y el header Supabase se corrige antes de cada petición. Deben consolidarse en una refactorización posterior, no durante esta recuperación.

El mapa/geocodificación también puede optimizarse más adelante para inicializarse solo cuando se abre Mapa, reduciendo tráfico y trabajo de arranque.

## Regla de mantenimiento a partir de ahora

No eliminar, fusionar ni sustituir capas del runtime por motivos de “limpieza” sin que la rama resultante pase primero la auditoría completa en Chromium + WebKit y la comprobación contra Cloudflare Pages. La estabilidad funcional tiene prioridad sobre reducir archivos.

## Resultado

Los fallos bloqueantes identificados fueron reproducibles, se corrigieron y la versión pública final pasó la batería exhaustiva completa en Chromium y WebKit. El proyecto dispone ahora de una auditoría automatizada que evita volver a desplegar silenciosamente una aplicación cuyo JavaScript no arranque, cuya sincronización falle, cuya navegación se rompa o cuyos personajes desaparezcan en Safari.
