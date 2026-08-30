# Casita · Bridge contract

Pocket is intentionally device-agnostic. The home bridge only needs to expose two JSON endpoints.

## Configuration

`casita-config.js` contains the public HTTPS base URL of the bridge:

```js
window.POCKET_HOME_CONFIG = Object.freeze({
  apiBase: "https://home.example.com",
  pollMs: 3000,
  timeoutMs: 6000
});
```

No camera, Xiaomi or service credentials belong in Pocket.

## GET /api/v1/state

Return only real values. Unknown values should be `null` or omitted.

```json
{
  "environment": {
    "value": null,
    "unit": "%",
    "state": null
  },
  "zones": [],
  "water": {
    "availableLiters": null,
    "capacityLiters": null,
    "todayLiters": null,
    "weekLiters": null,
    "rateLitersHour": null
  },
  "energy": {
    "todayKwh": null,
    "devices": []
  },
  "devices": [],
  "cameras": [
    {
      "id": "camera-1",
      "name": "Cámara",
      "online": true,
      "ptz": true,
      "streamUrl": "https://home.example.com/api/stream.m3u8?src=camera-1&mp4"
    }
  ],
  "access": []
}
```

Camera fields supported by Pocket:

- `id`: stable identifier used by commands.
- `name`: visible name.
- `label`: optional secondary label.
- `online`: `true`, `false` or omitted.
- `ptz`: enables movement controls when `true`.
- `streamUrl`: browser-playable live video URL.
- `snapshotUrl`: optional image fallback when no stream is available.

## POST /api/v1/command

Pocket sends JSON commands. Device toggles use `turn_on` / `turn_off`.

PTZ commands:

```json
{ "device": "camera-1", "action": "ptz_start", "params": { "direction": "left" } }
```

The bridge must continue movement until:

```json
{ "device": "camera-1", "action": "ptz_stop", "params": { "direction": "left" } }
```

Directions are `up`, `down`, `left`, `right`.

Optional centre/home command:

```json
{ "device": "camera-1", "action": "ptz_home" }
```

## First camera

Current camera identified for the first integration:

- Mi 360 Home Security Camera 2K Pro
- MJSXJ06CM
- Xiaomi model `chuangmi.camera.021a04`
- Firmware seen in Xiaomi Home: `4.3.4_0407`

The current go2rtc Xiaomi source supports this camera model for local live video. Xiaomi credentials stay on the home bridge and never in Pocket.

For go2rtc, the bridge can expose an HTTPS proxy to a browser-compatible stream. go2rtc documents fMP4 HLS as:

`/api/stream.m3u8?src=<stream>&mp4`

The PTZ implementation is kept behind `/api/v1/command`, so Pocket does not depend on whichever Xiaomi/Home Assistant/local implementation is ultimately used for movement.
