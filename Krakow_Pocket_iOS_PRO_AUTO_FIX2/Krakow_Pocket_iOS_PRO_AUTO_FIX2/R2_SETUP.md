# Cloudflare R2 setup for Kraków Pocket

Required binding: `KP_PHOTOS`

Create an R2 bucket (recommended: `krakow-pocket-photos`) and bind it to the Cloudflare Pages project using the variable/binding name `KP_PHOTOS`.

The application endpoint is `/api/photo`.

Safety rule: do not delete any existing embedded photo until the R2 upload has succeeded and the state has been updated with the R2-backed photo reference.
