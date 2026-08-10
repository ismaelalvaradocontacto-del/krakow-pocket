# Kraków Pocket · auditoría de estilo v6.6

Fecha: 10/08/2026

## Objetivo
Mejorar a Ismael y Laura dentro de la aplicación usando como referencia las fotografías aportadas, manteniendo una estética de RPG ilustrado y asegurando que los personajes sigan siendo legibles en tamaños muy pequeños de iPhone.

## Personajes

### Ismael
Se abandona el pelo ceniza de versiones anteriores porque la referencia actual muestra pelo corto castaño, con laterales más ajustados y volumen en la parte superior. Se añaden ojos marrones, cejas oscuras, barba corta y bigote, sonrisa más marcada y camiseta/ropa verde oscura. El retrato usa proporciones menos genéricas y una mandíbula ligeramente más ancha.

### Laura
Se mantiene el pelo oscuro pero se redibuja con coleta larga y volumen lateral, cejas oscuras muy definidas, ojos marrones grandes y pestañas más visibles, rostro ovalado y sonrisa amplia. El retrato usa camiseta clara y la versión de mapa mantiene una silueta aventurera coherente con el juego.

### Dos escalas distintas
Se separan los retratos del HUD de los personajes del escenario. Los retratos priorizan parecido facial; los chibi priorizan silueta, peinado y lectura a 45–55 px. Esto evita el fallo anterior de usar exactamente el mismo dibujo para dos escalas incompatibles.

## Auditoría y correcciones

1. **Retrato demasiado pequeño y genérico.** Se aumenta ligeramente el marco y se reajusta el recorte facial.
2. **Personajes del escenario poco distinguibles.** Se usan nuevos sprites chibi específicos para Ismael y Laura, con peinado, color de ropa y proporciones distintas.
3. **Riesgo de desaparecer detrás del escenario.** Se fijan z-index y overflow de los personajes y sus SVG.
4. **Safari y SVG externos.** El fallback de compatibilidad inserta los símbolos de personaje dentro del DOM para evitar referencias externas en blanco.
5. **Conflicto entre visuales y fallback.** Ambos sistemas utilizan ahora exactamente los mismos IDs v3; se evita que dos MutationObserver alternen entre versiones de personaje.
6. **HUD en iPhone pequeño.** Se establecen tamaños específicos en 480 px y 380 px para que el retrato no comprima logo, recursos o ajustes.
7. **Pareja demasiado separada.** Se solapan ligeramente ambos sprites en la Aldea para que se lean como pareja y no como dos iconos aislados.
8. **Avatar del Dragón recortado.** Se incrementa el tamaño interior y se centra el SVG.
9. **Overflow de textos y grids.** Se mantiene min-width:0 en hijos de filas y grids y se corrigen saltos de palabra.
10. **Auditor automático.** `KP_VISUAL_AUDIT` comprueba ahora si falta el retrato o cualquiera de los dos personajes del escenario, además de overflow, colisiones, targets táctiles y doble marco de diálogos.
11. **Navegación/safe area.** La barra inferior y los avisos siguen calculándose con la altura real del dock y el safe-area del iPhone.
12. **Sincronización.** Se elimina la duplicación de credenciales en runtime y service worker: `app.js` vuelve a ser la única fuente de la petición y el service worker preserva sus headers.

## Resultado esperado
El HUD debe mostrar un retrato reconocible de la persona seleccionada. En Aldea deben aparecer Ismael y Laura juntos, con siluetas claramente diferentes. Ninguno de los personajes debe quedar vacío en Safari/iPhone. La interfaz debe conservar el mismo lenguaje visual de madera, pergamino y aventura sin perder legibilidad ni espacio útil.
