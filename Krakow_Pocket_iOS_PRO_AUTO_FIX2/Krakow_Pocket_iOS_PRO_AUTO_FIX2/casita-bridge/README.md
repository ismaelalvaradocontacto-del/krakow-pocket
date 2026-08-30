# Casita bridge

Prepared pieces for the first real camera integration.

## Live video

Use go2rtc's Xiaomi source on the always-on home device. The first camera is already listed by go2rtc as supported:

- Mi 360 Home Security Camera 2K Pro
- `chuangmi.camera.021a04`
- `MJSXJ06CM`

The Xiaomi login and encryption data stay on the home device. Do not commit them to this repository.

Pocket accepts a browser-playable URL in `cameras[].streamUrl`. For iPhone, go2rtc can provide fMP4 HLS through:

`/api/stream.m3u8?src=<stream>&mp4`

## PTZ

`xiaomi_ptz.py` uses python-miio's `ChuangmiCamera.rotate()` implementation. The current library lists `chuangmi.camera.021a04` among its supported models and maps the four directions to the camera's local `set_motor` command.

Pocket sends `ptz_start` and `ptz_stop` while the user holds a direction. The final bridge will translate those events into motor steps at the cadence verified on the physical camera.

## What remains on site

Only values that cannot be known remotely:

- camera LAN address;
- camera local token;
- Xiaomi account login inside go2rtc;
- address used to reach the bridge from Pocket;
- verification of the PTZ movement cadence on the physical camera.

No secrets should be stored in `casita-config.js` or any public frontend file.
