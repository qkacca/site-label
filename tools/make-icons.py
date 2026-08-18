"""Generate the Site Label PNG icons.

No third-party libraries: the PNGs are written straight out with zlib. Run
from the project root:

    python tools/make-icons.py

The mark: a rounded tile in a deep blue gradient, two white label lines in the
upper left, and a gold ribbon across the lower-right corner - the ribbon being
the thing the extension actually draws on a page. Deliberately chunky, because
the 16px rendering is the one that has to survive.
"""

import os
import struct
import zlib

# Deep, calm blue reads as trustworthy and stays legible against both light
# and dark browser themes.
BG_TOP = (43, 95, 168)
BG_BOTTOM = (20, 48, 90)

LINE_1 = (255, 255, 255)
LINE_2 = (203, 219, 244)

GOLD = (240, 180, 41)
GOLD_EDGE = (198, 138, 18)

SIZES = (16, 32, 48, 128)
STORE_SIZES = (300,)
SUPERSAMPLE = 4

CORNER_RADIUS = 0.22

# Anti-diagonal band, as a fraction of the tile, measured from the top-left.
RIBBON_INNER = 1.34
RIBBON_OUTER = 1.66
RIBBON_EDGE = 0.045

# Label lines: (x0, x1, y0, y1) in tile fractions.
BAR_1 = (0.17, 0.68, 0.25, 0.38)
BAR_2 = (0.17, 0.50, 0.45, 0.58)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def inside_rounded_rect(x, y, size, radius):
    """True if (x, y) falls inside a rounded square of the given size."""
    if radius <= 0:
        return True
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= radius * radius


def inside_capsule(x, y, bar, size):
    """True inside a horizontal rounded bar given in tile fractions."""
    x0, x1, y0, y1 = (v * size for v in bar)
    radius = (y1 - y0) / 2.0
    cy = (y0 + y1) / 2.0
    # Clamp to the bar's centre line, then measure distance to it.
    cx = min(max(x, x0 + radius), x1 - radius)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= radius * radius


def geometry(size):
    """Two label lines have no room to read below about 20px, where they just
    blur into one another - so the small sizes get a single bolder line and a
    slightly wider ribbon instead."""
    if size <= 20:
        return {
            "bars": [((0.18, 0.68, 0.28, 0.45), LINE_1)],
            "inner": 1.30,
            "outer": 1.70,
        }
    return {
        "bars": [(BAR_1, LINE_1), (BAR_2, LINE_2)],
        "inner": RIBBON_INNER,
        "outer": RIBBON_OUTER,
    }


def sample(x, y, size, geo):
    """Colour for one sub-pixel, or None where the tile is transparent."""
    if not inside_rounded_rect(x, y, size, size * CORNER_RADIUS):
        return None

    # Main-diagonal coordinate: 0 at the top-left, 2 at the bottom-right.
    u = (x + y) / float(size)

    if geo["inner"] <= u <= geo["outer"]:
        return GOLD
    if geo["inner"] - RIBBON_EDGE <= u < geo["inner"]:
        return GOLD_EDGE
    if geo["outer"] < u <= geo["outer"] + RIBBON_EDGE:
        return GOLD_EDGE

    for bar, colour in geo["bars"]:
        if inside_capsule(x, y, bar, size):
            return colour

    return lerp(BG_TOP, BG_BOTTOM, y / float(size))


def render(size):
    """Render one icon as a list of RGBA rows, supersampled for smooth edges."""
    ss = SUPERSAMPLE
    geo = geometry(size)
    rows = []

    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px * ss + sx + 0.5) / ss
                    y = (py * ss + sy + 0.5) / ss
                    colour = sample(x, y, size, geo)
                    if colour is not None:
                        r += colour[0]
                        g += colour[1]
                        b += colour[2]
                        a += 255
            total = ss * ss
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                covered = a // 255
                row += bytes((r // covered, g // covered, b // covered, a // total))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, payload):
        data = tag + payload
        return struct.pack(">I", len(payload)) + data + struct.pack(">I", zlib.crc32(data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as handle:
        handle.write(png)


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
    icons = os.path.normpath(os.path.join(root, "icons"))
    store = os.path.normpath(os.path.join(root, "store"))
    os.makedirs(icons, exist_ok=True)
    os.makedirs(store, exist_ok=True)

    for size in SIZES:
        path = os.path.join(icons, "icon-%d.png" % size)
        write_png(path, size, render(size))
        print("wrote %s (%d bytes)" % (path, os.path.getsize(path)))

    # Partner Center asks for a 300x300 store logo; it is not part of the
    # packaged extension, so it lives with the other listing assets.
    for size in STORE_SIZES:
        path = os.path.join(store, "store-logo-%d.png" % size)
        write_png(path, size, render(size))
        print("wrote %s (%d bytes)" % (path, os.path.getsize(path)))


if __name__ == "__main__":
    main()
