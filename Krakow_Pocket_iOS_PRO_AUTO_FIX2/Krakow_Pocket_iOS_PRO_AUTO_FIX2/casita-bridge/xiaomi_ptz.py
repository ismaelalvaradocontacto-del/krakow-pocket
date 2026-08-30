from __future__ import annotations

from miio.integrations.chuangmi.camera import ChuangmiCamera, Direction

_DIRECTIONS = {
    "left": Direction.Left,
    "right": Direction.Right,
    "up": Direction.Up,
    "down": Direction.Down,
}


class XiaomiPtz:
    def __init__(self, ip: str, token: str, model: str = "chuangmi.camera.021a04") -> None:
        self.camera = ChuangmiCamera(ip=ip, token=token, model=model)

    def step(self, direction: str):
        value = _DIRECTIONS.get(direction)
        if value is None:
            raise ValueError(f"Unsupported PTZ direction: {direction}")
        return self.camera.rotate(value)
