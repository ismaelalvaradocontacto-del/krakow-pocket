# Cloudflare R2 setup for Kraków Pocket

## Recursos requeridos

- Bucket R2 recomendado: `krakow-pocket-photos`
- Binding de Cloudflare Pages: `KP_PHOTOS`
- Secreto de Cloudflare Pages: `KP_UPLOAD_TOKEN`
- Endpoint de la app: `/api/photo`

## Configuración

1. Crear el bucket R2 `krakow-pocket-photos`.
2. En el proyecto Cloudflare Pages `krakow-pocket`, añadir un binding R2 llamado exactamente `KP_PHOTOS` y apuntarlo al bucket anterior.
3. Añadir `KP_UPLOAD_TOKEN` como secreto/variable cifrada tanto en Preview como en Production. Usar un valor aleatorio largo (48 caracteres o más recomendado).
4. Volver a desplegar el preview de la rama `r2-photo-storage-migration`.
5. Comprobar `/api/photo?health=1`.

Respuesta esperada cuando la infraestructura esté lista:

```json
{"ok":true,"storage":"r2","binding":true,"uploadProtected":true}
```

## iPhone autorizados

El token no se guarda en GitHub. Cada iPhone autorizado lo conserva localmente en `localStorage` bajo `kpR2UploadToken`.

Puede aprovisionarse una sola vez abriendo el preview con el fragmento `#r2token=TOKEN`. El fragmento se elimina inmediatamente de la barra de direcciones después de guardarlo.

## Funcionamiento

- La foto original se sube a R2.
- En el estado compartido solo se conserva una miniatura ligera junto con `photoFull` y `photoKey`.
- `missionEvidence` se sincroniza mediante Supabase, por lo que el otro iPhone recibe la referencia R2.
- El Service Worker no cachea los originales servidos por `/api/photo`.
- Las fotos antiguas Base64 solo se sustituyen después de una subida R2 correcta.
- Si R2 no está disponible, las fotos existentes permanecen intactas.

## Seguridad

Las credenciales de R2 nunca se exponen al navegador. POST y DELETE requieren `KP_UPLOAD_TOKEN`. GET sirve únicamente objetos cuyo nombre contiene un identificador aleatorio no predecible y el bucket R2 no necesita ser público.

No fusionar esta rama a producción hasta completar una subida real en preview y verificar que el original se abre correctamente desde el segundo iPhone.
