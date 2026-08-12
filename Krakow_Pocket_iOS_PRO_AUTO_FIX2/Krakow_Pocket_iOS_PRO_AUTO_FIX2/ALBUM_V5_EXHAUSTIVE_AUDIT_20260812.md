# Kraków Pocket · Auditoría exhaustiva del Álbum V5

Fecha: 12/08/2026

## Estado

Auditoría final en ejecución sobre la arquitectura **V5 unificada**. Este informe sustituye las conclusiones de V3/V4 y solo se considerará cerrado cuando la misma batería pase en Chromium y WebKit/Safari, primero sobre el código local exacto y después sobre Cloudflare production.

## Alcance

Se revisa toda la cadena relacionada con el álbum, no solo su estética:

- fotografía de las misiones y calidad de compresión;
- evidencia GPS + foto;
- visita extra Auschwitz-Birkenau;
- persistencia en localStorage;
- sincronización entre los dos iPhone y Supabase;
- generación HTML V5;
- tarjeta de acceso desde Crónica;
- visor modal e iframe;
- capítulos y agrupación cronológica;
- lightbox;
- Modo Historia, miniaturas, autoplay y pausa;
- actualizaciones mientras el álbum está abierto;
- scroll del iframe en Safari/WebKit;
- HTML descargable y autosuficiente;
- Quick Look/Archivos de iOS con JavaScript desactivado;
- impresión/PDF;
- responsive 320 / 390 / 430 / 768 px;
- objetivos táctiles y reducción de movimiento;
- caché PWA y coherencia de versión.

## Fallos reales encontrados durante la auditoría

### 1. Varias generaciones de álbum coexistían

`mission-proof.js` y `auschwitz-extra.js` todavía podían crear o parchear elementos del álbum antiguo mientras V5 intentaba ser la fuente única. Esto producía carreras de DOM y podía hacer reaparecer controles o exportadores heredados tras sincronización, `pageshow` o cambios de visibilidad.

**Corrección:** ambos módulos son ahora únicamente fuentes de evidencia. Guardan GPS/foto y delegan abrir, descargar, compartir e imprimir exclusivamente en V5. Los marcadores `legacyAlbumUi:false` / `legacyAlbumExporter:false` forman parte de la auditoría.

### 2. PDF podía ejecutarse antes de cargar el álbum

Si se pulsaba PDF sin haber abierto previamente el visor, el iframe podía seguir en blanco cuando se invocaba `print()`.

**Corrección:** V5 espera a que el documento `data-kp-album-v5="1"` exista realmente en el iframe y deja dos ciclos de render antes de imprimir (`pdfWaitsForFrame:true`).

### 3. Safari podía mover la posición de lectura al refrescar el iframe

WebKit puede restaurar internamente una posición histórica después de sustituir `srcdoc`, incluso después de que V5 haya llamado a `scrollTo()`.

**Corrección:** el guard externo conserva la posición real del lector por documento interno, la captura en `scroll`, `pagehide`, `beforeunload` y al ocultarse el documento, y la reaplica durante la fase de restauración de WebKit. Marcadores: `albumIframeGuardRevision:"20260812b"`, `albumIframePagehideCapture:true`.

### 4. Una actualización compartida podía verse y después retroceder

Supabase guarda el estado de la partida como un JSON completo: `adventure_put` sustituye el estado, no fusiona campos individualmente. Durante la auditoría se detectó que copias internas antiguas podían volver a escribir datos del álbum después de una adopción remota.

**Corrección:** `state-bridge.js` protege por timestamp `missionEvidence`, fotos de perfil, recuerdos y gastos; la adopción de campos compartidos se hace de forma atómica y cualquier `PUT` vuelve a pasar por el merge protegido. Marcadores: `bridgeRevision:"20260812c"`, `atomicSharedFieldAdoption:true`, `staleDiaryRecordProtection:true`, `outgoingEvidenceTimestampGuard:true`.

## Arquitectura resultante

- `album-v5.js` es la única fuente de generación y presentación del álbum.
- `mission-proof.js` solo aporta evidencias de misiones.
- `auschwitz-extra.js` solo aporta la evidencia de la visita extra.
- `album-photo-quality.js` mejora las fotografías nuevas sin ampliar artificialmente imágenes pequeñas.
- `state-bridge.js` protege la coherencia del contenido compartido.
- `stability.js` estabiliza el iframe en Safari/WebKit.
- `sw.js` usa la caché final `krakow-pocket-v49-album-v5-stable-20260812a` para evitar mezclar scripts de versiones anteriores en el iPhone.

## Matriz que debe superar la verificación final

1. álbum vacío;
2. álbum con una sola fotografía;
3. doce misiones + Auschwitz-Birkenau;
4. textos y recuerdos largos;
5. ausencia de UI V3/V4 y reaparición tras eventos;
6. apertura/cierre repetido del visor;
7. PDF desde visor nunca abierto;
8. lightbox anterior/siguiente/Escape;
9. Modo Historia, filmstrip, autoplay y pausa;
10. guardado de recuerdos mientras Historia está abierta;
11. actualización diferida al cerrar overlays;
12. conservación de scroll > 0 y scroll = 0;
13. sincronización de una evidencia más nueva desde el segundo iPhone durante varios ciclos;
14. HTML descargado con los datos actuales;
15. Quick Look/no-JS;
16. responsive 320/390/430/768 px;
17. ausencia de overflow horizontal y toolbar cortada;
18. controles táctiles adecuados;
19. HTML autosuficiente sin CDN;
20. ausencia de errores JavaScript relevantes.

## Cierre pendiente

La auditoría se marcará como aprobada únicamente después de que la pasada R3 valide este mismo estado tanto localmente como en `https://krakow-pocket.pages.dev/`. Hasta entonces no se declara el álbum como cerrado.