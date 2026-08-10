# Kraków Pocket · recuperación compatible 10/08/2026

Incidencia observada en iPhone: la PWA podía quedar con HTML de una generación y JavaScript de otra durante la sustitución del Service Worker. El síntoma visible era `Calculando…` / `sincronizando…`, navegación estática y ausencia del HUD RPG.

La recuperación compatible usa el núcleo funcional consolidado que no depende de la cabecera hero ni del DOM legado de misiones. De esta forma puede arrancar tanto con el HTML anterior (que conserva esos elementos ocultos) como con el HTML nuevo (que ya los elimina). El Service Worker se invalida de nuevo para forzar la convergencia de archivos.

No se modifican las tablas ni el estado de Supabase.