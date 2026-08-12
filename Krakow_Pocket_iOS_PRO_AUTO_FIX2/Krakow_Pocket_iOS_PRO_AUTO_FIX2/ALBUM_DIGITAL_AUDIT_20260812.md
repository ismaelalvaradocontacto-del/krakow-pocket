# Kraków Pocket · Auditoría exhaustiva del álbum digital V4

Fecha: 12/08/2026

## Objetivo

Transformar el álbum de Kraków Pocket desde una sucesión de tarjetas web hacia una experiencia de **álbum digital fotográfico**, pensada primero para iPhone pero conservable y compartible como un único HTML autosuficiente, con salida PDF y degradación correcta cuando el visor de iOS no ejecuta JavaScript.

La revisión cubre no solo el HTML final, sino toda la cadena que interviene en el resultado: captura de fotografías, compresión, almacenamiento, sincronización, generación del álbum, visor interno, animación, exportación, impresión, Quick Look, caché y auditorías de regresión.

---

## 1. Diagnóstico estético de la versión anterior

### Problema principal
La V3 era más editorial que la primera versión, pero seguía transmitiendo una estructura de **web con tarjetas**:

- fotografía dentro de contenedores repetitivos;
- bordes, fondos y cajas en casi todos los recuerdos;
- capítulos correctos pero visualmente similares entre sí;
- demasiada presencia del UI frente a la imagen;
- modo historia funcional, pero todavía parecido a una tarjeta ampliada;
- barra superior con apariencia de herramientas web;
- ritmo vertical homogéneo: foto + texto, foto + texto, foto + texto.

### Criterio V4
La V4 adopta una lógica más cercana a un álbum digital contemporáneo:

1. fotografía como elemento dominante;
2. grandes composiciones y páginas visuales;
3. jerarquía de capítulos mediante tipografía y espacio, no mediante cajas;
4. modo cine para enseñar el viaje a otra persona;
5. navegación secundaria y discreta;
6. animación ambiental suave, nunca necesaria para entender el contenido;
7. diseño que sigue siendo legible si todo el JavaScript desaparece.

---

## 2. Cadena de calidad fotográfica

### Hallazgo
Las misiones comprimían originalmente las fotografías a un tamaño muy conservador. Esa decisión protegía `localStorage` y la sincronización compartida, pero penalizaba el álbum al ampliar imágenes.

### Mejora aplicada
Se añade `album-photo-quality.js` como capa de mejora para **fotografías nuevas**:

- dimensión objetivo máxima: **1280 px**;
- JPEG inicial: calidad aproximada 0,82;
- límite de seguridad aproximado: **300.000 caracteres de Data URL** por fotografía;
- degradación progresiva a 1120, 960 y 820 px si la imagen supera el límite;
- `imageSmoothingQuality = high`;
- nunca se amplía artificialmente una fotografía pequeña;
- se conservan `photoWidth`, `photoHeight` y `photoQuality` en la evidencia;
- si el dispositivo no tiene espacio, se conserva la fotografía comprimida original en lugar de poner en riesgo la misión.

### Motivo del límite
La partida actual sincroniza las imágenes dentro del estado compartido y también usa almacenamiento local. Subir mucho más la resolución de todas las imágenes podría acercar la partida a límites prácticos de almacenamiento, memoria o tamaño de petición. La V4 prioriza una mejora visible de calidad sin cambiar la arquitectura de datos en pleno viaje.

### Limitación consciente
Las fotografías guardadas antes de esta mejora **no pueden recuperar información que ya fue descartada por una compresión anterior**. El nuevo diseño evita ampliarlas innecesariamente y mejora las fotografías capturadas a partir de la V4.

---

## 3. Privacidad y metadatos

Se mantiene el criterio existente:

- el álbum puede indicar que la misión fue verificada por GPS;
- conserva distancia aproximada y autor del recuerdo;
- no necesita mostrar ni exportar coordenadas exactas;
- Auschwitz-Birkenau conserva tratamiento diferenciado de memoria;
- el álbum no convierte Auschwitz en puntuación ni recompensa.

---

## 4. Entrada al álbum dentro de Kraków Pocket

### Antes
La tarjeta de acceso era principalmente informativa.

### V4
La vista previa se comporta visualmente como una pequeña portada fotográfica:

- collage de las tres primeras imágenes;
- primera fotografía con mayor superficie;
- tipografía de título más editorial;
- progreso y compartir siguen disponibles;
- el acceso principal continúa siendo un único botón claro.

---

## 5. Visor interno

El diálogo del álbum se convierte en un visor más inmersivo:

- fondo oscuro para separar el álbum del resto del juego;
- en iPhone ocupa prácticamente toda la pantalla;
- cabecera y pie reducidos;
- controles secundarios visualmente discretos;
- el iframe del álbum queda como protagonista;
- en escritorio se mantiene un máximo de anchura para no perder legibilidad.

---

## 6. Portada

### V4

- fotografía casi a pantalla completa;
- degradado menos agresivo sobre la parte superior;
- título grande y con composición editorial;
- alineación lateral en pantallas amplias y centrada en móvil;
- progreso integrado sin convertirse en un panel de estadísticas;
- efecto Ken Burns muy leve en navegadores con movimiento permitido;
- `prefers-reduced-motion` elimina el movimiento por completo.

La portada debe sentirse como el inicio de un recuerdo, no como el encabezado de una aplicación.

---

## 7. Barra de navegación del álbum

### V4

- pasa a una cápsula flotante de cristal/transparencia;
- se superpone ligeramente al final de la portada;
- Portada, Índice, Historia, PDF y Final permanecen accesibles;
- en 320–430 px se distribuyen en cinco columnas iguales;
- no debe existir scroll horizontal accidental;
- el botón Historia solo aparece cuando JavaScript funciona.

Esto conserva la solución del visor de iPhone: en Quick Look nunca se presenta como funcional un control que depende de JavaScript.

---

## 8. Resumen del viaje

Las cuatro métricas siguen existiendo, pero dejan de parecer cuatro tarjetas independientes:

- línea superior e inferior;
- separadores finos;
- fondo del propio álbum;
- cifras prominentes y etiquetas pequeñas.

El resumen aporta contexto sin competir con las fotografías.

---

## 9. Índice por capítulos

Se conserva por su utilidad, pero se limpia visualmente:

- título editorial de gran tamaño;
- capítulos como accesos compactos;
- día + nombre + número de fotos;
- enlaces HTML reales;
- funciona sin JavaScript;
- permite saltar directamente a una jornada.

---

## 10. Capítulos y ritmo visual

### Cambio principal V4
Las fotografías dejan de presentarse como tarjetas idénticas.

En pantallas amplias:

- rejilla de 12 columnas;
- fotografías protagonistas a ancho completo;
- imágenes secundarias en composiciones de dos columnas;
- determinadas fotografías vuelven a ocupar una gran franja central;
- separación mediante aire y tipografía, no mediante marcos pesados.

En móvil:

- una única columna;
- fotografías grandes;
- separación amplia entre recuerdos;
- sin bordes ornamentales repetidos.

El resultado debe parecer una secuencia de páginas fotográficas, no un feed de fichas.

---

## 11. Fotografías

### Tratamiento V4

- bordes eliminados del contenedor general;
- radio solo sobre la propia imagen;
- sombra muy suave y localizada;
- grandes imágenes 16:9 cuando la composición tiene espacio;
- 4:3 en móvil para evitar recortes excesivos;
- lazy loading en imágenes secundarias;
- `decoding=async`;
- zoom discreto al interactuar en escritorio;
- sin escalado artificial fuerte.

---

## 12. Texto y comentarios

El comentario deja de vivir dentro de una caja amarilla llamativa:

- fondo transparente;
- línea editorial fina;
- tipografía más neutra;
- título del lugar como elemento principal;
- GPS/autor pasan a una línea secundaria.

El comentario del Dragón sigue aportando personalidad, pero ya no domina sobre la fotografía.

---

## 13. Recuerdos escritos

Los recuerdos escritos se integran como páginas de diario limpias:

- menos sombra;
- borde fino;
- más espacio interior;
- dos columnas cuando existe anchura;
- una columna en iPhone;
- lugar, autor y texto siguen disponibles.

---

## 14. Auschwitz-Birkenau

Se mantiene una excepción visual y semántica:

- badge `EXTRA · MEMORIA`;
- iconografía sobria;
- comentario específico;
- no se mezcla con escamas, puntuación o recompensas;
- la fotografía sigue formando parte del relato cronológico del viaje.

---

## 15. Lightbox

### V4

- fondo prácticamente negro;
- fotografía más grande;
- menos esquinas y menos ornamentación;
- anterior/siguiente;
- Escape y flechas en escritorio;
- pie de foto discreto;
- controles semitransparentes.

La finalidad es examinar la fotografía, no enseñar otro cuadro de diálogo.

---

## 16. Modo Historia / Modo Cine

Es la principal mejora funcional de la V4.

### Incluye

- fotografía a gran tamaño;
- fondo ambiente derivado de la propia fotografía, desenfocado y oscurecido;
- título y comentario sobre degradado inferior;
- anterior/siguiente;
- tira de miniaturas;
- miniatura activa visible;
- contador `n / total`;
- barra de progreso;
- reproducción automática cada ~4,5 segundos;
- pausa manual;
- detención al llegar al final;
- swipe existente en táctil;
- navegación por teclado heredada;
- `prefers-reduced-motion` impide la reproducción automática.

El objetivo es poder enseñar el viaje a otra persona sin ir haciendo scroll por una página web.

---

## 17. Movimiento

Se auditan tres categorías:

1. portada: Ken Burns muy lento;
2. entrada del contenido: animaciones existentes de aparición;
3. modo cine: cambio de fotografía y barra de progreso.

Ninguna animación es necesaria para navegar o leer el álbum. Con `Reducir movimiento`, el contenido permanece completo y estático.

---

## 18. Móvil

Matriz de auditoría prevista y automatizada:

- 320 px;
- 390 px;
- 430 px;
- 768 px.

Criterios:

- `scrollWidth - clientWidth <= 1`;
- toolbar sin overflow;
- objetivos táctiles principales alrededor de 40–44 px o superiores;
- visor contenido dentro del viewport;
- capítulo sin salirse del ancho;
- story mode usable con una mano;
- filmstrip desplazable internamente sin crear overflow de página.

---

## 19. iPhone / Safari / WebKit

Se mantienen pruebas específicas en WebKit, no solo Chromium.

Se comprueba:

- carga de la capa V4;
- apertura del álbum;
- composición fotográfica;
- Modo Historia;
- miniaturas;
- autoplay/pausa;
- navegación;
- responsive;
- exportación;
- ausencia de errores relevantes de JavaScript.

---

## 20. Quick Look / Archivos de iOS

Se conserva la estrategia de mejora progresiva:

- Portada, Índice, PDF y Final son enlaces reales;
- las fotografías y textos son visibles sin JavaScript;
- el Modo Historia se oculta sin JavaScript;
- la ayuda para PDF permanece disponible;
- el HTML no se convierte en una pantalla vacía aunque Quick Look suprima scripts.

---

## 21. Compartir

El álbum sigue siendo un único archivo HTML:

- se puede compartir desde la hoja de compartir cuando iOS admite archivos;
- si compartir archivos no está disponible, cae a descarga;
- las fotografías quedan embebidas;
- no necesita un servidor para conservarse.

---

## 22. PDF

El CSS de impresión se mantiene separado del diseño cinematográfico:

- se eliminan toolbar, overlays, autoplay, miniaturas y efectos;
- fondo blanco;
- capítulos con saltos razonables;
- fotografías en rejilla estable;
- sombras y animaciones eliminadas;
- portada y cierre preparados para impresión.

En Quick Look se mantiene la guía del sistema: Compartir → Imprimir → Compartir → Guardar en Archivos.

---

## 23. HTML offline y longevidad

El álbum exportado continúa siendo autosuficiente:

- no usa Leaflet;
- no usa CDN;
- no usa fuentes web;
- no usa librerías externas;
- contiene CSS, JavaScript y fotografías en el mismo documento;
- el contenido esencial no depende del JavaScript.

Esto es una decisión deliberada para que el recuerdo pueda seguir abriéndose en el futuro aunque Kraków Pocket desaparezca.

---

## 24. Rendimiento

### Medidas

- fotografías secundarias con lazy loading;
- resolución futura limitada de forma consciente;
- sin librerías de animación;
- animaciones mediante CSS;
- DOM pequeño: máximo aproximado de las misiones + extras + recuerdos;
- miniaturas reutilizan las mismas Data URL, sin crear nuevas copias binarias externas.

### Riesgo vigilado
El principal límite de escalabilidad del álbum no es el renderizado, sino guardar fotografías como Data URL dentro del estado sincronizado. Para un viaje de unas 12–13 fotografías es aceptable con el límite actual. Un producto general con cientos de imágenes debería migrar las fotos a almacenamiento de objetos y guardar solo URLs/metadatos en el estado.

---

## 25. Accesibilidad

Se conserva y amplía:

- foco visible;
- botones nativos;
- nombres ARIA;
- enlaces reales para navegación esencial;
- controles de cierre accesibles;
- `prefers-reduced-motion`;
- contenido presente sin JavaScript;
- contraste alto en Modo Cine;
- texto no incrustado en las fotografías.

---

## 26. Sincronización

`album-photo-quality.js` no crea una segunda base de datos.

La mejora fotográfica:

1. prepara en paralelo una versión de mejor calidad;
2. espera a que la misión normal quede guardada;
3. sustituye únicamente la fotografía de esa misma evidencia;
4. actualiza `updatedAt`;
5. dispara los mismos eventos de cambio para que la sincronización existente adopte la versión nueva;
6. si falla por espacio, conserva la versión que ya había guardado la misión.

La lógica de completar misiones y la verificación GPS no se sustituye.

---

## 27. Service Worker y caché

Build V4:

`krakow-pocket-v42-digital-album-20260812a`

Se añaden al núcleo offline:

- `album-digital-v4.js`;
- `album-photo-quality.js`.

Los JS/CSS siguen usando estrategia de red primero con fallback a caché para evitar quedarse atrapados en una estética anterior cuando existe conexión.

---

## 28. Regresión

La V4 se añade como capa encima de V3 en vez de borrar el generador estable.

Ventajas:

- se conserva el HTML V3 probado;
- sigue activa la compatibilidad Quick Look;
- sigue activa la auditoría V3;
- la nueva auditoría V4 comprueba únicamente las capacidades adicionales;
- una regresión V4 es más fácil de aislar y restaurar.

El commit anterior a la V4 continúa siendo restaurable desde el historial de Git.

---

## 29. Auditorías automatizadas V4

La nueva batería comprueba como mínimo:

1. sintaxis de la capa V4;
2. sintaxis de calidad fotográfica;
3. presencia del loader;
4. presencia en Service Worker;
5. cache V42;
6. apertura del álbum;
7. tres fotografías simuladas;
8. Auschwitz como extra;
9. clase `digital-album`;
10. estilos V4 cargados;
11. Modo Historia;
12. tira de miniaturas;
13. navegación mediante miniaturas;
14. autoplay;
15. pausa;
16. fondo ambiente;
17. 320 px sin overflow;
18. 390 px sin overflow;
19. 430 px sin overflow;
20. 768 px sin overflow;
21. toolbar sin overflow;
22. tamaño táctil;
23. objetivo fotográfico 1280 px;
24. límite de almacenamiento 300.000;
25. HTML exportado con V4;
26. CSS de impresión;
27. compatibilidad offline heredada;
28. ausencia de CDN en el álbum exportado;
29. Chromium local;
30. WebKit local;
31. Chromium Cloudflare;
32. WebKit Cloudflare;
33. HTML descargado con JavaScript completamente desactivado;
34. capturas visuales reales para inspección.

---

## 30. Criterio de aceptación visual

La V4 solo se considera correcta si, además de pasar los tests, las capturas reales cumplen estos criterios:

- la primera impresión es una fotografía, no una interfaz;
- no existe repetición excesiva de tarjetas;
- los capítulos tienen aire y ritmo;
- la barra de herramientas no domina;
- los comentarios acompañan en lugar de encerrar la fotografía;
- el modo cine puede utilizarse para enseñar el viaje sin explicación previa;
- el álbum sigue teniendo detalles de Kraków Pocket, pero la estética RPG pasa a segundo plano frente al recuerdo fotográfico.

---

## 31. Limitaciones que no deben ocultarse

1. Las fotos antiguas ya comprimidas no pueden recuperar detalle real.
2. La arquitectura actual de fotos dentro del estado compartido es adecuada para este viaje, no para una biblioteca de cientos de fotografías.
3. Quick Look no ofrece el mismo JavaScript que Safari; por eso se mantiene un modo de lectura estático.
4. La creación de PDF depende del motor de impresión del dispositivo.
5. La V4 no utiliza un servicio de generación de vídeo; el Modo Cine es HTML/CSS/JS autosuficiente para mantener la portabilidad.

---

## Conclusión de diseño

Kraków Pocket V4 trata el álbum como un **recuerdo digital fotográfico** y no como otra sección de la app. La interfaz del juego sigue aportando contexto —misiones, Dragón, GPS, capítulos—, pero cede el protagonismo a las fotografías, al ritmo del viaje y a una presentación que pueda compartirse con una persona que nunca haya usado Kraków Pocket.
