# Kraków Pocket · auditoría exhaustiva de estilo v6.4

Fecha: 10/08/2026

## Alcance
Revisión específica de jerarquía visual, safe areas de iPhone/PWA, barra inferior, diálogos, tarjetas, grids, formularios, mapa ilustrado de encargos, mapa Leaflet, estados deshabilitados, overflow, legibilidad y comportamiento responsive.

## Errores detectados y corregidos

### 1. Safe area superior duplicada
`enhancements.css` aplicaba safe-area a `.app` y `visuals.css` volvía a aplicarla al HUD. En iPhone podía producir un hueco superior excesivo.

**Corrección:** la app deja de reservar safe-area superior y el HUD pasa a ser el único responsable del inset superior.

### 2. Reserva inferior inconsistente
La barra inferior se medía dinámicamente, pero además flotaba por encima del home indicator. La reserva de contenido no incluía siempre la misma geometría que la navegación, con riesgo de contenido oculto o espacio inferior sobrante.

**Corrección:** la barra incluye ahora el `safe-area-inset-bottom` dentro de su propia altura y queda pegada al borde inferior. La altura medida por `ResizeObserver` coincide con la reserva real del contenido.

### 3. Toasts con posición fija heredada
Los avisos usaban una altura inferior fija y podían pisar la barra si la navegación cambiaba de tamaño por safe area o viewport.

**Corrección:** los avisos se posicionan usando `--kp-nav-h`, la altura real medida de la navegación.

### 4. Doble marco en el diálogo de historias
`game.css` aplicaba marco a `.story-dialog .dialog-body`, mientras `visuals.css` aplicaba otro al diálogo exterior. El resultado potencial era borde doble, fondo duplicado y menor espacio útil.

**Corrección:** el marco queda exclusivamente en el diálogo exterior; el cuerpo interior se resetea a fondo transparente y sin borde/sombra.

### 5. Safe area innecesaria dentro del encabezado de ajustes
El encabezado del sheet añadía de nuevo el inset superior aunque el diálogo ya estaba limitado por el viewport.

**Corrección:** padding interno normal y max-height del diálogo respetando el viewport seguro.

### 6. Tarjetas que ocultaban contenido para “arreglar” overflow
Las auditorías anteriores usaban `overflow:hidden` y `contain:layout paint` en tarjetas. Eso podía ocultar focus rings, sombras, elementos desplazados y convertir un fallo real en contenido recortado.

**Corrección:** las tarjetas ya no solucionan overflow ocultándolo. Se fuerza `min-width:0` en hijos de grids/rows y los diagnósticos solo compactan texto cuando es necesario.

### 7. Auditor de overflow demasiado agresivo
`kp-visual-overflow` y el antiguo `kp-overflow-fix` podían terminar ocultando contenido.

**Corrección:** ambos se convierten en correcciones de tamaño/min-width sin `overflow:hidden`. Los textos problemáticos reciben una reducción moderada y específica.

### 8. Riesgo de overflow por hijos de grid/flex
Varios hijos conservaban el `min-width:auto` por defecto, lo que puede impedir que un grid se encoja correctamente en Safari.

**Corrección:** `row`, `grid2`, `grid3`, formularios, timeline y pasos de ruta fuerzan `min-width:0` en sus hijos.

### 9. Métricas móviles incoherentes
La hoja base convertía `.grid3` a una sola columna en móvil, generando una pantalla innecesariamente larga y rompiendo la estética de HUD.

**Corrección:** en modo juego se mantienen tres métricas compactas con tipografía fluida y reducción adicional en 360/330 px.

### 10. Estados disabled visualmente ambiguos
Los botones deshabilitados podían conservar el aspecto de botón activo.

**Corrección:** estado deshabilitado con menor saturación, opacidad y sin sombra de pulsación.

### 11. Focus y teclado móvil
Los controles cercanos a la navegación podían quedar demasiado pegados al dock al recibir foco.

**Corrección:** `scroll-margin-bottom` dinámico basado en la altura real de la navegación.

### 12. Popup de Leaflet demasiado ancho
Un popup con texto largo podía acercarse demasiado a los bordes del viewport.

**Corrección:** límite responsive de ancho y `overflow-wrap` en el contenido.

### 13. Coste innecesario de `will-change`
Todos los nodos del mapa mantenían `will-change:transform` permanentemente, reservando recursos gráficos sin necesidad.

**Corrección:** eliminado el hint permanente; las animaciones siguen funcionando normalmente.

### 14. Colisiones de etiquetas del mapa
La auditoría comparaba el rectángulo del nodo completo, no el rectángulo real de la etiqueta. Una etiqueta transformada podía seguir chocando aunque el diagnóstico creyera lo contrario.

**Corrección:** la detección trabaja directamente con los `<small>` visibles y aplica desplazamiento lateral solo cuando las etiquetas realmente se solapan.

### 15. Barra inferior con mezcla de bordes de dos sistemas
`game.css` aportaba un borde completo y `visuals.css` modificaba solo el borde superior, creando una combinación de reglas difícil de predecir.

**Corrección:** `visuals.css` define ahora de forma explícita los cuatro bordes, fondo, radio, posición y padding seguro de la barra final.

## Auditor automático v6.4
`window.KP_VISUAL_AUDIT` registra ahora:
- elementos estructurales ausentes;
- colisiones entre etiquetas de misiones;
- controles táctiles corregidos;
- altura real de la barra inferior;
- cantidad de overflows detectados;
- overflow horizontal global del documento;
- posible doble marco de diálogo;
- integridad mínima de datos y viewport.

La clase `kp-audit-warning` solo se activa si existe un problema estructural real, overflow horizontal global, datos inválidos o doble marco de diálogo.

## Responsive revisado
Breakpoints activos revisados para:
- >420 px;
- ≤420 px;
- ≤360 px;
- ≤330 px.

Se mantienen tamaños táctiles mínimos, textos compactos sin pérdida de contenido, mapa de misiones escalado y barra inferior legible.

## Criterio visual consolidado
- Un único safe-area superior: HUD.
- Un único safe-area inferior: dock medido.
- Un único marco por diálogo.
- No ocultar errores de layout mediante clipping.
- Grids con `min-width:0` real.
- Estados disabled y focus claramente diferenciados.
- Navegación, pergamino, madera y mapas con una única jerarquía de color.

## Versión resultante
Kraków Pocket v6.4.