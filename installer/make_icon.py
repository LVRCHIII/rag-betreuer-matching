"""Erzeugt das (Platzhalter-)App-Icon: schwarze Salamander-Silhouette auf Orange.

Erzeugt aus einer hochaufgelösten Zeichnung:
  - installer/icon_source.png   (1024x1024)
  - installer/windows/app.ico   (Multi-Size)
  - installer/macos/app.icns    (falls von Pillow unterstützt)

Aufruf:  python installer/make_icon.py
Wird später durch ein echtes, designtes Icon ersetzt (gleiche Dateinamen).
"""
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ORANGE = (255, 168, 116, 255)  # Brand-Akzent #FFA874
BLACK = (255, 255, 255, 255)  # Salamander-Silhouette in Weiß

S = 1024  # Render-Auflösung


def lerp(a, b, t):
    return a + (b - a) * t


def spine_point(t):
    """Sanfte S-förmige Wirbelsäule von Kopf (t=0) bis Schwanzspitze (t=1)."""
    x = S * 0.5 + math.sin(t * math.pi) * S * 0.11
    y = lerp(S * 0.13, S * 0.90, t)
    return x, y


# Stückweise-lineares Breitenprofil (t, Faktor) – immer positiv, kein Durchpinchen.
_WIDTH_CTRL = [
    (0.00, 0.085),  # Hals
    (0.16, 0.150),
    (0.32, 0.170),  # Bauch (dickste Stelle)
    (0.50, 0.150),
    (0.62, 0.110),  # Becken
    (0.74, 0.070),
    (0.86, 0.038),
    (1.00, 0.006),  # Schwanzspitze
]


def width_at(t):
    for i in range(len(_WIDTH_CTRL) - 1):
        t0, w0 = _WIDTH_CTRL[i]
        t1, w1 = _WIDTH_CTRL[i + 1]
        if t <= t1:
            f = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return lerp(w0, w1, f) * S
    return _WIDTH_CTRL[-1][1] * S


def normal_at(t):
    cx, cy = spine_point(t)
    ax, ay = spine_point(min(t + 0.004, 1.0))
    dx, dy = ax - cx, ay - cy
    ln = math.hypot(dx, dy) or 1.0
    return -dy / ln, dx / ln


def build_body_polygon():
    left, right = [], []
    n = 160
    for i in range(n + 1):
        t = i / n
        cx, cy = spine_point(t)
        nx, ny = normal_at(t)
        w = width_at(t)
        left.append((cx + nx * w, cy + ny * w))
        right.append((cx - nx * w, cy - ny * w))
    return left + right[::-1]


def thick_line(draw, pts, width):
    draw.line(pts, fill=BLACK, width=int(width), joint="curve")
    r = width / 2.0
    for (x, y) in pts:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=BLACK)


def leg(draw, t, side, reach, swing_deg):
    """Gebogenes Bein (Hüfte→Knie→Fuß) seitlich am Körper, mit Fuß."""
    cx, cy = spine_point(t)
    nx, ny = normal_at(t)
    # Tangente (entlang Körper) für die Schwung-Richtung
    tx, ty = ny, -nx
    hipx, hipy = cx + nx * width_at(t) * 0.6 * side, cy + ny * width_at(t) * 0.6 * side
    sw = math.radians(swing_deg)
    # Knie: nach außen
    kx = hipx + nx * reach * 0.55 * side + tx * reach * 0.10 * math.copysign(1, swing_deg)
    ky = hipy + ny * reach * 0.55 + ty * reach * 0.10 * math.copysign(1, swing_deg)
    # Fuß: weiter außen + entlang Körper geschwungen
    fx = kx + nx * reach * 0.45 * side + tx * reach * 0.55 * math.copysign(1, swing_deg)
    fy = ky + ny * reach * 0.45 + ty * reach * 0.55 * math.copysign(1, swing_deg)
    thick_line(draw, [(hipx, hipy), (kx, ky), (fx, fy)], S * 0.044)
    # Fuß mit drei kurzen Zehen
    toe_r = S * 0.05
    draw.ellipse([fx - toe_r, fy - toe_r, fx + toe_r, fy + toe_r], fill=BLACK)
    for a in (-32, 0, 32):
        ang = math.atan2(fy - ky, fx - kx) + math.radians(a)
        ex, ey = fx + math.cos(ang) * toe_r * 1.5, fy + math.sin(ang) * toe_r * 1.5
        thick_line(draw, [(fx, fy), (ex, ey)], S * 0.022)


def draw_salamander(img):
    draw = ImageDraw.Draw(img)
    # Beine zuerst (Körper überdeckt die Ansätze → nahtlos verbunden)
    leg(draw, 0.17, +1, S * 0.20, -50)
    leg(draw, 0.17, -1, S * 0.20, -50)
    leg(draw, 0.55, +1, S * 0.21, +50)
    leg(draw, 0.55, -1, S * 0.21, +50)
    # Körper + Schwanz als ein durchgehender Umriss
    draw.polygon(build_body_polygon(), fill=BLACK)
    # Kopf (runde Schnauze, überlappt den Hals)
    hx, hy = spine_point(0.0)
    hr = S * 0.105
    draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=BLACK)
    # Augen als orange Aussparung
    eye = S * 0.02
    for sx in (-1, 1):
        ex, ey = hx + sx * hr * 0.42, hy - hr * 0.18
        draw.ellipse([ex - eye, ey - eye, ex + eye, ey + eye], fill=ORANGE)


def main():
    img = Image.new("RGBA", (S, S), ORANGE)
    draw_salamander(img)

    src = os.path.join(HERE, "icon_source.png")
    img.save(src)
    print("PNG  ->", src)

    ico_path = os.path.join(HERE, "windows", "app.ico")
    os.makedirs(os.path.dirname(ico_path), exist_ok=True)
    img.save(ico_path, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("ICO  ->", ico_path)

    icns_path = os.path.join(HERE, "macos", "app.icns")
    os.makedirs(os.path.dirname(icns_path), exist_ok=True)
    try:
        # Pillow erwartet quadratische RGBA-Bilder; 1024 reicht als Basis
        img.save(icns_path)
        print("ICNS ->", icns_path)
    except Exception as exc:
        print("ICNS übersprungen (auf macOS bauen):", exc)


if __name__ == "__main__":
    main()
