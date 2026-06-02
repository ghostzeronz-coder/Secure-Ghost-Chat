#!/usr/bin/env python3
"""Generate the GHOSTFACE 'GF' monogram app icons (antique gold on near-black)."""
import os
from PIL import Image, ImageDraw, ImageFont

W = 1024
BG = (10, 10, 10, 255)          # near-black
GOLD_MID = (191, 155, 48)       # #bf9b30 brand antique gold
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images")


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gold_at(t):
    """Vertical metallic gold ramp, t in [0,1] top->bottom."""
    stops = [
        (0.00, (236, 213, 138)),  # bright top highlight
        (0.30, (212, 175, 75)),
        (0.42, (245, 228, 170)),  # sheen band
        (0.55, (191, 155, 48)),   # brand mid
        (0.78, (150, 117, 38)),
        (1.00, (108, 86, 26)),    # deep shadow
    ]
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0))
    return GOLD_MID


def gold_text_layer(size_canvas, font, text):
    """Return an RGBA layer with `text` filled by a vertical metallic gradient, centered."""
    layer = Image.new("RGBA", size_canvas, (0, 0, 0, 0))
    mask = Image.new("L", size_canvas, 0)
    md = ImageDraw.Draw(mask)
    bbox = md.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size_canvas[0] - tw) / 2 - bbox[0]
    y = (size_canvas[1] - th) / 2 - bbox[1]
    md.text((x, y), text, font=font, fill=255)

    grad = Image.new("RGBA", size_canvas, (0, 0, 0, 0))
    px = grad.load()
    top, bot = bbox[1] + y, bbox[3] + y
    span = max(1.0, bot - top)
    for yy in range(size_canvas[1]):
        t = min(1.0, max(0.0, (yy - top) / span))
        r, g, b = gold_at(t)
        for xx in range(size_canvas[0]):
            px[xx, yy] = (r, g, b, 255)
    layer.paste(grad, (0, 0), mask)
    return layer


def fit_font(text, target_w):
    s = 200
    while True:
        f = ImageFont.truetype(FONT_PATH, s)
        d = ImageDraw.Draw(Image.new("L", (10, 10)))
        bb = d.textbbox((0, 0), text, font=f)
        if (bb[2] - bb[0]) >= target_w or s > 1600:
            return f
        s += 8


def make_icon():
    img = Image.new("RGBA", (W, W), BG)
    d = ImageDraw.Draw(img)
    # subtle radial vignette glow behind the mark
    cx = cy = W / 2
    for rad, alpha in ((430, 10), (330, 12), (230, 14)):
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(191, 155, 48, alpha))
    img = Image.alpha_composite(Image.new("RGBA", (W, W), BG), img)

    font = fit_font("GF", int(W * 0.60))
    img = Image.alpha_composite(img, gold_text_layer((W, W), font, "GF"))

    # thin inset gold frame for polish
    d2 = ImageDraw.Draw(img)
    inset = 54
    d2.rounded_rectangle([inset, inset, W - inset, W - inset],
                         radius=120, outline=(191, 155, 48, 90), width=4)
    return img.convert("RGB")


def make_adaptive():
    # transparent foreground, GF kept inside Android safe zone (~58%)
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    font = fit_font("GF", int(W * 0.46))
    return Image.alpha_composite(img, gold_text_layer((W, W), font, "GF"))


icon = make_icon()
icon.save(os.path.join(ASSETS, "icon.png"))
make_adaptive().save(os.path.join(ASSETS, "adaptive-icon.png"))
print("Generated icon.png, adaptive-icon.png")
