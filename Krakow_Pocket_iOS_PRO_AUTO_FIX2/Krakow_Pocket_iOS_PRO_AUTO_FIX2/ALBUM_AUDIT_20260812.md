# Kraków Pocket · Auditoría exhaustiva del álbum

Fecha: 12/08/2026

## Objetivo
Convertir el álbum de Kraków Pocket en un recuerdo digital de calidad suficiente para conservar y compartir, sin perder compatibilidad con iPhone, Safari, archivos HTML descargados, modo offline y PDF.

## Diagnóstico de la versión anterior

### 1. Portada
- La fotografía funcionaba bien como elemento emocional, pero la portada ocupaba demasiado espacio vertical en móvil.
- El título podía partirse de forma poco equilibrada en pantallas estrechas.
- Faltaba una lectura visual clara del progreso del viaje.

### 2. Jerarquía editorial
- El álbum era principalmente una colección de tarjetas consecutivas.
- No existía un índice visual por jornadas.
- El usuario no podía entender de un vistazo cómo se estructuraba la historia.

### 3. Navegación
- Portada y Final dependían originalmente de JavaScript.
- El visor Quick Look/Archivos de iOS puede renderizar HTML sin ejecutar el JavaScript del documento.
- Esto provocó controles visibles pero inactivos.

### 4. Visualización de fotografías
- La fotografía tenía protagonismo, pero faltaba navegación entre imágenes.
- No existía siguiente/anterior en la vista ampliada.
- Faltaba una experiencia cómoda para enseñar el viaje a otra persona.

### 5. Experiencia narrativa
- No existía modo presentación o modo historia.
- Los comentarios se mostraban correctamente, pero el álbum requería desplazamiento manual continuo.

### 6. Móvil
- La barra de herramientas podía ocupar demasiado ancho y depender de desplazamiento horizontal.
- El diseño necesitaba una matriz explícita para 320, 390, 430 y tablet/escritorio.
- Los objetivos táctiles no estaban auditados de forma específica.

### 7. Exportación y conservación
- HTML offline era una buena base.
- PDF dependía del soporte de impresión del navegador.
- Era necesario mantener un camino comprensible en el visor de Archivos de iPhone, donde window.print() puede no ejecutarse.

### 8. Accesibilidad
- Ya existía soporte parcial para `prefers-reduced-motion`.
- Faltaba una comprobación más completa de foco visible, tamaño táctil y degradación sin JavaScript.

### 9. Rendimiento
- El álbum no usa librerías externas, lo cual es positivo.
- Las fotografías deben cargarse de forma diferida salvo la portada/primera imagen.
- El archivo debe seguir siendo autosuficiente para no depender de Kraków Pocket en el futuro.

### 10. Auschwitz-Birkenau
- Debe permanecer diferenciado de las misiones gamificadas.
- El lenguaje, iconografía y tratamiento visual deben ser sobrios y respetuosos.

## Cambios aplicados en Album Experience 3.0

### Portada cinematográfica más contenida
- Altura móvil reducida.
- Tipografía fluida con `clamp()` y `text-wrap: balance`.
- Degradado más controlado para conservar detalle en la fotografía.
- Indicador visual de progreso de misiones.
- Acceso directo al índice.

### Índice por capítulos
- Nueva sección “La historia, por capítulos”.
- Agrupación automática por Día 1, Día 2, Día 3 y extras.
- Número de fotografías por capítulo.
- Enlaces internos compatibles sin JavaScript.

### Tarjetas fotográficas de nueva generación
- Mayor protagonismo de imagen.
- Metadatos simplificados y legibles.
- Badge de recuerdo GPS verificado.
- Tratamiento diferenciado para “EXTRA · MEMORIA”.
- Comentarios integrados con jerarquía editorial.
- Carga diferida y `decoding=async` en imágenes no prioritarias.

### Lightbox mejorado
- Foto ampliada.
- Anterior / siguiente.
- Teclado con flechas en escritorio.
- Escape para cerrar.
- Leyenda con lugar y autor.

### Nuevo Modo Historia
- Reproducción de las fotografías como presentación.
- Imagen + lugar + comentario.
- Controles anterior/siguiente.
- Posición actual `n / total`.
- Gestos de swipe en dispositivos táctiles.
- El botón solo aparece cuando JavaScript está disponible, evitando controles muertos en Quick Look.

### Navegación robusta
- Portada, Índice, PDF y Final son enlaces reales.
- Si JavaScript está bloqueado, la navegación sigue funcionando.
- Las animaciones se consideran una mejora progresiva, nunca un requisito para leer el álbum.

### PDF
- CSS específico `@media print` con formato A4.
- Portada, índice, capítulos, recuerdos y cierre separados de forma editorial.
- Se eliminan controles, overlays y sombras innecesarias en impresión.
- En Quick Look se mantiene la guía: Compartir → Imprimir → Compartir → Guardar en Archivos.

### Responsive
Matriz incluida en auditoría:
- 320 px
- 390 px
- 430 px
- 768 px

Criterios:
- sin desbordamiento horizontal;
- controles principales con altura táctil mínima auditada;
- una columna fotográfica en móvil;
- dos columnas cuando existe espacio suficiente;
- modo historia adaptado de dos columnas a una en móvil.

### Accesibilidad
- `:focus-visible` explícito.
- etiquetas ARIA en navegación, lightbox y modo historia.
- controles de cierre con nombre accesible.
- soporte de `prefers-reduced-motion`.
- contenido visible por defecto cuando JavaScript está desactivado.

### Rendimiento y longevidad
- Sin CDN ni dependencias para el álbum descargado.
- HTML, CSS, JavaScript y fotografías quedan integrados en un único archivo.
- Lazy loading en fotografías secundarias.
- El álbum seguirá abriendo aunque en el futuro no exista el servidor de Kraków Pocket.

## Criterios de auditoría automatizada

1. Sintaxis JavaScript.
2. Album Experience 3.0 cargado.
3. Integración en Crónica.
4. Vista previa de fotografías.
5. Apertura/cierre del diálogo.
6. 4 estadísticas principales.
7. Índice de capítulos.
8. Todas las fotografías de evidencia.
9. Auschwitz diferenciado.
10. Recuerdos escritos.
11. Lightbox funcional.
12. Anterior/siguiente cambia realmente de fotografía.
13. Modo Historia abre.
14. Modo Historia avanza de `1 / n` a `2 / n`.
15. HTML exportable autosuficiente.
16. Marcadores de compatibilidad Quick Look.
17. Guía PDF presente.
18. CSS de impresión presente.
19. `prefers-reduced-motion` presente.
20. API funcional del álbum.
21. Sin errores JavaScript relevantes.
22. 320 px sin overflow.
23. 390 px sin overflow.
24. 430 px sin overflow.
25. 768 px sin overflow.
26. Altura táctil de toolbar auditada.
27. Prueba en Chromium.
28. Prueba en WebKit/Safari.
29. Prueba local.
30. Prueba en Cloudflare production.
31. HTML con JavaScript completamente desactivado.
32. Portada/Final/PDF utilizables sin JavaScript.
33. Capturas visuales generadas para revisión.

## Limitaciones conscientes
- Un archivo HTML abierto en Quick Look de iOS no tiene las mismas capacidades que Safari. Por eso la versión descargada se diseña para seguir siendo legible y navegable incluso sin JavaScript.
- Las fotografías ya guardadas no pueden recuperar detalle que se haya perdido durante una compresión anterior. La maquetación evita ampliaciones artificiales innecesarias.
- La impresión PDF depende del motor del sistema, pero el documento incluye CSS específico para producir una salida estable.

## Criterio final de diseño
El álbum debe sentirse como un recuerdo editorial moderno, no como una pantalla administrativa de la app. La identidad RPG de Kraków Pocket queda en detalles —dragón, paleta, badges y comentarios— mientras que las fotografías pasan a ser el elemento principal.