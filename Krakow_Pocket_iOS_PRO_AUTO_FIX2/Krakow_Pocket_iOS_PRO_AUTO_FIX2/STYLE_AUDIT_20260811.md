# Kraków Pocket — auditoría exhaustiva de estilo

Fecha: 11/08/2026

## Objetivo

Revisar la interfaz completa de Kraków Pocket en móvil, con prioridad en iPhone/Safari, manteniendo la identidad de aventura ilustrada/RPG pero eliminando ruido visual, problemas de jerarquía y elementos demasiado pequeños.

## Hallazgos y correcciones

### 1. Jerarquía visual

**Hallazgo:** demasiados elementos competían con el mismo peso visual: marcos de 3–6 px, sombras inferiores muy gruesas y numerosas cajas anidadas.

**Corrección:** reducción general de bordes, sombras y profundidad. Los paneles siguen pareciendo pergaminos/tableros, pero con una lectura más limpia y contemporánea.

### 2. Legibilidad

**Hallazgo:** varios textos secundarios estaban entre 6,8 y 9 px en móvil, especialmente recursos, etiquetas del mapa, navegación y textos auxiliares.

**Corrección:** aumento de tamaños mínimos, mejor interlineado y mayor contraste del texto secundario. Los títulos mantienen Georgia para conservar el carácter narrativo; controles, botones y navegación usan tipografía de sistema para mejorar lectura.

### 3. Cabecera y perfiles

**Hallazgo:** la cabecera tenía mucha profundidad visual y los perfiles podían competir con el logotipo.

**Corrección:** se mantiene el sistema de doble retrato Ismael/Laura, pero con marcos y sombras más ligeros. Se mejora el equilibrio entre perfiles, marca y ajustes, especialmente en 320–390 px.

### 4. Recursos de cabecera

**Hallazgo:** los tres indicadores de recursos eran demasiado pequeños y parecían mini-botones.

**Corrección:** indicadores más planos, mayor tipografía y menos borde. Se conserva la lectura rápida de escamas, gasto y misiones.

### 5. Misión actual

**Hallazgo:** título, descripción e indicador estaban demasiado comprimidos dentro de un marco visualmente pesado.

**Corrección:** mejor proporción entre icono, texto y contador; borde y sombra más suaves y descripción más legible.

### 6. Aldea y tablero de misiones

**Hallazgo:** las ilustraciones eran uno de los puntos fuertes, pero los marcos gruesos y etiquetas pequeñas reducían su calidad percibida.

**Corrección:** marcos más finos, etiquetas de lugares más legibles, sombras de sprites más suaves y mejor integración del cuadro de diálogo.

### 7. Recomendación principal

**Hallazgo:** la tarjeta inicial concentraba muchos controles con poca separación jerárquica.

**Corrección:** tamaños, separación y botones ajustados para que la recomendación sea el foco y los selectores sean secundarios.

### 8. Acciones rápidas

**Hallazgo:** texto secundario pequeño y botones demasiado parecidos a los botones principales.

**Corrección:** se conserva la cuadrícula 2×2, pero con mayor legibilidad, altura coherente y una profundidad visual menor.

### 9. Progreso de la aventura

**Hallazgo importante:** en móvil las tres métricas se apilaban verticalmente, alargando mucho la pantalla sin aportar valor.

**Corrección:** las tres métricas permanecen en una sola fila también en móvil, con tamaños adaptativos. El anillo de progreso se compacta y se mejora la proporción general.

### 10. Ruta y planning

**Hallazgo:** demasiadas cajas dentro de cajas y bordes gruesos en cada paso.

**Corrección:** pasos de ruta y distritos con un único borde fino, iconos más limpios y tipografía de sistema en contenido operativo.

### 11. Navegación inferior

**Hallazgo:** el dock era excesivamente alto y visualmente pesado.

**Corrección:** dock más bajo, marcos y sombras reducidos, iconos ligeramente más pequeños y estado activo más limpio. Se mantienen áreas táctiles cómodas y safe area de iPhone.

### 12. Mapa y filtros

**Hallazgo:** chips y marco del mapa heredaban demasiado peso del estilo RPG.

**Corrección:** chips más ligeros, buen tamaño táctil, mapa con radio mayor y sombra más discreta.

### 13. Diario y presupuesto

**Hallazgo:** segmentos, métricas, recuerdos y filas de gasto tenían estilos heterogéneos.

**Corrección:** unificación de radios, bordes, fondos y jerarquía tipográfica.

### 14. Ajustes y diálogos

**Hallazgo:** el marco del modal y la cabecera eran muy pesados, y los controles necesitaban una sensación más nativa de iPhone.

**Corrección:** modal más limpio, botón de cierre de 48–50 px, fondo desenfocado, tarjetas de jugador refinadas y controles más claros.

### 15. Accesibilidad visual

Se añadieron estados `:focus-visible`, se mantuvieron controles con tamaño táctil adecuado, se reforzó contraste de texto secundario y se respeta `prefers-reduced-motion`.

### 16. Responsive

La capa final incluye ajustes específicos para <=480 px, <=380 px y <=340 px. Se mantiene el soporte de safe areas y la compatibilidad con Safari/WebKit.

## Criterio final

La aplicación conserva su personalidad de cuento/juego de viaje, pero la interfaz queda menos recargada, más legible y con una jerarquía más cercana a una PWA móvil actual. La ilustración pasa a ser protagonista y los marcos dejan de competir con el contenido.
