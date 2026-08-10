# Kraków Pocket · auditoría exhaustiva de personajes y estilo v6.8

Fecha: 10/08/2026

## Objetivo
Unificar por completo la identidad visual de Ismael, Laura y los NPC visibles de Kraków Pocket. Un personaje debe conservar los mismos rasgos, colores y lenguaje gráfico independientemente de si aparece como retrato, sprite del escenario o avatar de diálogo.

## Problemas detectados

1. **Ismael cambiaba demasiado entre cabecera y Aldea.** El retrato y el sprite compartían nombre pero no suficientes rasgos visuales.
2. **Laura cambiaba de proporciones entre cabecera y Aldea.** La coleta y los rasgos faciales no tenían la misma lectura a ambas escalas.
3. **El código base todavía contenía personajes antiguos.** `game.js` genera placeholders heredados antes de que las capas visuales los sustituyan. Esto podía producir un destello de un Ismael antiguo con pelo ceniza o una Laura de otra paleta en cargas lentas.
4. **El Dragón de Wawel no era consistente.** Algunas capas mostraban un emoji mientras el diálogo de Aldea acababa sustituyéndolo por un SVG.
5. **El Guardián del viaje no tenía gráfico propio.** Al llegar al mensaje del Guardián, la capa visual podía seguir mostrando el Dragón.
6. **Los personajes se acercaban demasiado a la etiqueta de Encargos.** El aumento de tamaño de versiones anteriores mejoró la lectura pero creó riesgo de colisión.
7. **Los personajes eran pequeños respecto al escenario.** A tamaño de iPhone perdían rasgos identificativos.
8. **Safari necesita una ruta de render alternativa.** Las referencias SVG externas pueden quedar vacías; la versión inline debe usar exactamente los mismos IDs y arte que la normal.
9. **Las dos rutas de render podían divergir.** `visuals.js` y `compat.js` tenían que compartir una única tabla de identidad.
10. **No existía una auditoría de identidad.** Se comprobaba si había un SVG, pero no si ese SVG correspondía realmente al personaje correcto.

## Correcciones aplicadas

### Sistema único de personajes
`assets/characters.svg` contiene ahora un único conjunto de arte reutilizable. Los símbolos de retrato y mundo derivan de los mismos grupos gráficos y paletas. Los alias heredados apuntan al mismo arte, de modo que una referencia antigua no puede volver a mostrar otra identidad.

### Ismael
- pelo corto castaño, con laterales visualmente más ajustados y textura en la parte superior;
- ojos marrones;
- cejas oscuras;
- barba corta y bigote visibles tanto en retrato como en sprite;
- sonrisa con dientes;
- verde oscuro como color principal de ropa;
- paleta de piel y pelo idéntica en cabecera y Aldea.

### Laura
- pelo muy oscuro con raya central y coleta larga;
- ojos marrones grandes;
- cejas oscuras y pestañas más marcadas;
- sonrisa amplia;
- camiseta clara como identificador principal;
- pantalón oliva en el sprite de mundo;
- misma paleta de piel, pelo y ojos en las dos escalas.

### Escala de mundo
Los sprites de Aldea crecen y ganan detalle, pero mantienen una silueta compacta. Se añaden correas, botas, capas de ropa y pequeños detalles de aventura sin cambiar la identidad facial.

### NPC
El Dragón de Wawel se redibuja dentro del mismo lenguaje de contorno, volumen y sombra. El Guardián del viaje recibe un avatar propio. `visuals.js` y `compat.js` seleccionan el NPC según el nombre real del interlocutor.

### Colisiones
La posición de Encargos se eleva y Mapa se desplaza ligeramente a la derecha. La pareja se centra en una zona segura. Además, la auditoría calcula intersecciones entre la caja de Ismael/Laura y las etiquetas de los edificios; si detecta una colisión activa una posición de seguridad.

### Safari
`compat.js` usa los mismos IDs v4 que `visuals.js` e inserta el SVG completo dentro del DOM. Ya no existe una versión visual distinta para Safari.

## Auditoría automática
`window.KP_VISUAL_AUDIT.characters` registra:
- retrato vacío;
- ausencia de cualquiera de los dos protagonistas;
- personaje seleccionado;
- ID real del retrato;
- ID real de Ismael en Aldea;
- ID real de Laura en Aldea;
- ID real del NPC;
- discrepancias de identidad;
- colisiones entre la pareja y etiquetas del escenario.

Una discrepancia de identidad activa `kp-character-warning`. Una colisión activa `kp-character-collision` y la hoja de estilo mueve a la pareja a una zona de seguridad.

## Responsive auditado
Se han definido escalas específicas para ancho general, <=480 px, <=380 px y <=340 px. El retrato reduce tamaño antes que el logo; los sprites reducen tamaño sin cambiar proporciones; la navegación y el safe area siguen teniendo prioridad.

## Funcionamiento protegido
No se modifica el estado de misiones, gastos, recuerdos, sincronización ni selección de jugador. El cambio de jugador solo cambia el retrato de cabecera; Ismael y Laura siguen apareciendo juntos en la Aldea. `runtime.js`, `visuals.js` y el Service Worker quedan alineados en v6.8.

## Resultado esperado
- Ismael es reconocible como el mismo personaje arriba y abajo.
- Laura es reconocible como el mismo personaje arriba y abajo.
- El Dragón no cambia de estilo entre estados.
- El Guardián nunca utiliza por error el avatar del Dragón.
- No aparecen personajes heredados en la interfaz final.
- Ningún protagonista tapa etiquetas o controles en los anchos móviles auditados.
