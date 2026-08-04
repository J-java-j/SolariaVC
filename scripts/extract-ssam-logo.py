"""Place the Ssam.ai S mark large on a dark 4:5 frame without eating logo shading."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "portfolio" / "ssam-ai.png"
ASSET = Path(
    r"C:\Users\danie\.cursor\projects\c-Users-danie-Desktop-Solaria-WebFourthJUL26"
    r"\assets\c__Users_danie_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
    r"_image-9388740b-b875-4f9c-af9d-a8caf9fc09b7.png"
)
DARK = (10, 12, 14)


def main() -> None:
    src = Image.open(ASSET).convert("RGB")
    src = src.resize((src.width * 4, src.height * 4), Image.Resampling.LANCZOS)
    w, h = src.size
    px = src.load()

    samples = [
        px[x, y]
        for x, y in [
            (2, 2),
            (w - 3, 2),
            (2, h - 3),
            (w - 3, h - 3),
            (w // 2, 2),
            (2, h // 2),
            (w // 2, h - 3),
            (w - 3, h // 2),
        ]
    ]
    br = sum(s[0] for s in samples) / len(samples)
    bg = sum(s[1] for s in samples) / len(samples)
    bb = sum(s[2] for s in samples) / len(samples)

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            sat = (mx - mn) / mx if mx else 0
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            dist = ((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2) ** 0.5
            # Keep ribbon colors AND dark fold shading (prevents "black holes").
            if sat >= 0.17 or lum <= 0.58:
                continue
            if lum >= 0.70 and (sat < 0.20 or dist < 55):
                px[x, y] = DARK

    # Keep only the largest content blob (the S); drop pastel leftovers.
    def is_content(r: int, g: int, b: int) -> bool:
        return abs(r - DARK[0]) + abs(g - DARK[1]) + abs(b - DARK[2]) > 28

    visited = [[False] * w for _ in range(h)]
    components: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if visited[y][x] or not is_content(*px[x, y]):
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            visited[y][x] = True
            cells: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                cells.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if (
                        0 <= nx < w
                        and 0 <= ny < h
                        and not visited[ny][nx]
                        and is_content(*px[nx, ny])
                    ):
                        visited[ny][nx] = True
                        q.append((nx, ny))
            components.append(cells)
    components.sort(key=len, reverse=True)
    for cells in components[1:]:
        for x, y in cells:
            px[x, y] = DARK

    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            if is_content(*px[x, y]):
                xs.append(x)
                ys.append(y)
    pad = 40
    box = (
        max(0, min(xs) - pad),
        max(0, min(ys) - pad),
        min(w, max(xs) + pad + 1),
        min(h, max(ys) + pad + 1),
    )
    mark = src.crop(box)

    cw, ch = 900, 1125
    canvas = Image.new("RGB", (cw, ch), DARK)
    scale = min((cw * 0.88) / mark.width, (ch * 0.88) / mark.height)
    ns = (max(1, int(mark.width * scale)), max(1, int(mark.height * scale)))
    mark = mark.resize(ns, Image.Resampling.LANCZOS)
    canvas.paste(mark, ((cw - ns[0]) // 2, (ch - ns[1]) // 2))

    px = canvas.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b = px[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            sat = (mx - mn) / mx if mx else 0
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            d = abs(r - DARK[0]) + abs(g - DARK[1]) + abs(b - DARK[2])
            if (sat < 0.12 and lum < 0.22) or (d < 40 and sat < 0.15):
                px[x, y] = DARK

    canvas.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} mark={ns}")


if __name__ == "__main__":
    main()
