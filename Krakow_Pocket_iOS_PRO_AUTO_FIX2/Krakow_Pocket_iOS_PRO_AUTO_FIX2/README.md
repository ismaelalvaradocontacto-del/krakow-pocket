# Kraków Pocket

Mini-PWA móvil hecha para la escapada a Cracovia del 11–13 de agosto de 2026.

## Qué incluye
- Mapa interactivo con OpenStreetMap/Leaflet.
- GPS del iPhone con permiso del usuario.
- Puntos de interés geocodificados al cargar.
- Recomendaciones según ubicación, tiempo, ganas y modo trabajo.
- Misiones/“escamas” inspiradas en Cracovia.
- Free tour autoguiado.
- Control de presupuesto local.
- Progreso guardado en `localStorage`.
- Botones para abrir navegación peatonal en Google Maps.
- PWA instalable en pantalla de inicio.

## Importante para el GPS
Safari/Chrome solo permiten geolocalización en un contexto seguro: HTTPS (o localhost).
No basta con abrir `index.html` directamente desde Archivos.

## Publicación rápida
Sube toda esta carpeta a cualquier hosting estático HTTPS, por ejemplo:
- GitHub Pages
- Cloudflare Pages
- Netlify

No requiere servidor ni base de datos.

## Privacidad
La posición GPS no se envía a un servidor propio ni se guarda en la app.
Se usa en el navegador para distancias y recomendaciones. Las búsquedas iniciales
de lugares utilizan el servicio público Nominatim/OpenStreetMap.

## iPhone
Una vez publicada:
1. Abre la URL en Safari.
2. Pulsa Compartir.
3. “Añadir a pantalla de inicio”.
4. Abre la app y pulsa “Usar nuestra ubicación”.


## Sincronización Ismael + Laura

Esta versión incluye dos personajes:
- 🧭 Ismael · Explorador
- 🔎 Laura · Cronista
- 🤝 misiones cooperativas

Cada iPhone selecciona su personaje. Los gastos se guardan por persona y la app suma
automáticamente el gasto de ambos.

### Configurar Supabase
1. Crea un proyecto gratuito en Supabase.
2. Abre SQL Editor.
3. Copia y ejecuta `SUPABASE_SETUP.sql`.
4. Ve a Project Settings / API y copia:
   - Project URL
   - Publishable key (`sb_publishable_...`)
   Nunca uses `service_role`.
5. En el iPhone de Ismael, abre la app:
   - personaje: Ismael
   - introduce URL + publishable key
   - elige un código de aventura y una frase secreta (mínimo 8 caracteres)
   - pulsa “Crear partida”.
6. En el iPhone de Laura:
   - personaje: Laura
   - misma URL, publishable key, código y secreto
   - pulsa “Conectar / unirme”.

La app consulta cambios cada 4 segundos. Es sincronización casi en tiempo real y,
para este viaje, evita la complejidad de crear cuentas de usuario.

El secreto se guarda localmente en cada iPhone. No lo compartas públicamente.

## Versión PRO cooperativa

Esta revisión asume explícitamente que Ismael y Laura:
- viajan juntos en todo momento,
- visitan los mismos lugares,
- pagan desde una economía compartida,
- completan una única aventura,
- usan dos personajes solo como recurso narrativo.

El presupuesto es uno solo para la pareja. Las misiones son cooperativas.
Los dos iPhone muestran el mismo progreso y los mismos gastos al sincronizar.

## Base de Varsovia integrada
La app usa como base:
Stalowa 20/22, 03-426 Warszawa, Polonia.

Incluye:
- Casa → Warszawa Zachodnia.
- Objetivo de llegada a Zachodnia: 05:30 para el bus de las 06:00.
- Kraków MDA → W94.
- Regreso Kraków MDA 20:00 → Warszawa Zachodnia 00:10.
- Warszawa Zachodnia → casa.
- Cuenta atrás contextual.
- Modo regreso automático el jueves por la tarde.

Las rutas urbanas se abren en Google Maps para que use horarios vigentes y no una
línea de transporte codificada que pueda cambiar.

## Interfaz iOS refinada
Esta versión está optimizada específicamente para iPhone 13 y iPhone 15:
- safe areas de iOS,
- botones grandes,
- inputs de 16 px para evitar zoom involuntario,
- configuración de Supabase oculta en Ajustes,
- onboarding más limpio,
- acceso principal centrado en “qué hacemos ahora”,
- accesos rápidos a mapa/comida/trabajo/regreso,
- hoja de ajustes tipo bottom sheet,
- sincronización resumida con un indicador pequeño.

## Configuración automática (versión pareja)
Esta versión lleva ya preconfigurados el código de aventura, la URL de Supabase, la publishable key y el secreto compartido. Ismael y Laura solo tienen que elegir quién usa cada iPhone; la app intenta conectarse automáticamente al abrirse. Los datos técnicos quedan visibles en Ajustes solo como referencia y son de solo lectura.
