# Kraków Pocket · Auditoría final del álbum digital V4

Fecha: 12/08/2026

## Estado final

El subsistema de álbum se ha transformado de una sucesión de tarjetas web a una experiencia de álbum digital fotográfico. La versión de producción correspondiente usa la caché `krakow-pocket-v46-digital-album-ordered-20260812a`.

## Estética auditada

- Portada fotográfica inmersiva con jerarquía editorial y movimiento Ken Burns suave.
- Fotografías como elemento dominante; la interfaz pasa a segundo plano.
- Capítulos con ritmo de álbum: tipografía grande, espacio en blanco y composiciones de imagen, no una repetición de tarjetas.
- En escritorio/tablet se usan composiciones fotográficas amplias; en iPhone se mantiene una columna grande y clara.
- Comentarios y metadatos dejan de estar encerrados en cajas pesadas y se integran como pies editoriales.
- Recuerdos escritos se diferencian como páginas de diario.
- Lightbox oscuro y mínimo.
- Cierre del álbum oscuro, fotográfico y separado del estilo administrativo de la app.
- Auschwitz-Birkenau mantiene un tratamiento sobrio de `EXTRA · MEMORIA`, sin puntuación ni gamificación.

## Modo Historia / Modo Cine

- Fotografía principal a gran tamaño.
- Fondo ambiente derivado de la fotografía activa, con compatibilidad específica para WebKit/Safari.
- Tira de miniaturas navegable.
- Indicador `n / total`.
- Barra de progreso.
- Anterior / siguiente.
- Reproducción automática y pausa.
- El runtime se monta de forma determinista para evitar carreras de carga entre Chromium y WebKit.
- Los controles Reproducir/Pausar y Cerrar tienen protección específica contra solapamientos.
- `prefers-reduced-motion` mantiene una versión estática y evita movimiento innecesario.

## Calidad de las fotografías

Las fotografías nuevas se preparan con una capa de calidad específica:

- objetivo máximo: 1280 px;
- JPEG inicial aproximado: 0,82;
- límite de seguridad aproximado: 300.000 caracteres de Data URL;
- reducción escalonada a 1120, 960 y 820 px cuando es necesario;
- `imageSmoothingQuality = high`;
- sin ampliar artificialmente imágenes pequeñas;
- si el almacenamiento no permite guardar la mejora, se conserva la fotografía original de la misión en lugar de arriesgar el progreso.

Las fotografías tomadas antes de esta mejora no pueden recuperar detalle perdido por compresiones anteriores.

## Funcionamiento y conservación

- HTML exportado autosuficiente: fotografía, CSS y JavaScript en un solo archivo.
- Sin CDN ni librerías externas en el álbum descargado.
- Portada, Índice, PDF y Final siguen siendo enlaces HTML reales.
- En Quick Look/Archivos de iOS, si JavaScript está bloqueado, el contenido esencial sigue visible y navegable.
- El Modo Historia se presenta solo cuando el entorno puede ejecutarlo.
- CSS específico de impresión/PDF.
- Compartir por hoja nativa cuando el navegador admite archivos, con descarga como alternativa.
- La ubicación exacta no necesita formar parte del álbum; se conserva únicamente la verificación/distancia aproximada ya prevista.

## Responsive y accesibilidad

Matriz funcional auditada en 320, 390, 430 y 768 px:

- desbordamiento horizontal de página: 0;
- desbordamiento de toolbar: 0;
- objetivos táctiles principales: al menos 40 px en la auditoría automatizada;
- foco visible y controles nativos;
- nombres accesibles en controles de cierre/navegación;
- soporte de `prefers-reduced-motion`;
- contenido utilizable sin JavaScript.

## Auditoría funcional automatizada

La batería final del álbum pasó con éxito:

- Chromium local;
- WebKit/Safari local;
- Chromium en Cloudflare production;
- WebKit/Safari en Cloudflare production;
- HTML exportado con JavaScript completamente desactivado, local y en Cloudflare;
- navegación por miniaturas;
- cambio real de `1 / 3` a `2 / 3` en la prueba funcional;
- reproducción automática y pausa;
- fondo ambiente;
- calidad fotográfica 1280/300000;
- exportación offline;
- CSS de impresión;
- ausencia de CDN;
- sin errores JavaScript relevantes en la ejecución final.

## Auditoría visual exhaustiva

Se ejecutó además una revisión visual independiente con un álbum de prueba más completo: 6 fotografías, 2 capítulos y 2 recuerdos escritos.

Se capturaron 5 estados distintos:

1. portada;
2. capítulo fotográfico;
3. recuerdos escritos;
4. Modo Cine;
5. cierre.

Cada estado se capturó en:

- Chromium local;
- WebKit local;
- Chromium Cloudflare;
- WebKit Cloudflare.

Total: 20 capturas finales.

En las cuatro ejecuciones se comprobó una anchura de 390 px con `scrollWidth = 390`, dos capítulos, seis fotografías, dos recuerdos, modo digital activo y `toolbarOverflow = 0`.

## Elementos relacionados incluidos en la auditoría

- `album-experience.js`: generación y datos del álbum.
- `album-v3-polish.js`: compatibilidad editorial previa.
- `album-ios-compat.js`: Quick Look / no-JS / PDF.
- `album-digital-v4.js`: presentación digital V4.
- `album-digital-v4-runtime-fix.js`: runtime y orden de carga del Modo Cine.
- `album-digital-v4-ambient-fix.js`: fondo ambiente y compatibilidad WebKit.
- `album-photo-quality.js`: calidad de fotografías nuevas.
- `mission-proof.js`: origen de fotografías de las misiones.
- `auschwitz-extra.js`: evidencia fotográfica del extra de memoria.
- `stability.js`: carga determinista de capas.
- `sw.js`: caché/offline.
- sincronización de `missionEvidence`: persistencia de fotografías y metadatos compartidos.

## Limitaciones conscientes

1. Una imagen antigua ya comprimida no puede reconstruir detalle inexistente.
2. Guardar imágenes como Data URL dentro del estado compartido es adecuado para el volumen de este viaje, pero no sería la arquitectura indicada para un servicio con cientos de fotografías por usuario.
3. Quick Look no tiene las mismas capacidades JavaScript que Safari, por lo que se mantiene una degradación estática deliberada.
4. La creación final del PDF depende del motor de impresión del dispositivo.

## Conclusión

La V4 se considera apta como álbum digital de viaje: las fotografías son el elemento principal, la navegación funciona como mejora progresiva, el Modo Cine permite enseñar el viaje sin recorrer una web de tarjetas, y el archivo exportado sigue siendo conservable de forma independiente de Kraków Pocket.