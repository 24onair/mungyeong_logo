"""Paper factory for the collage reel.

Generates torn-paper sprites (with white torn fringe, paper grain, baked drop
shadow), the photo print / photo sticker, and a manifest (src/collage/sprites.js)
describing each sprite's size and the offset of its "paper" origin inside the
padded PNG. Layout and animation live in collage.js.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets/collage")
os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920
SS = 2          # supersampling for torn edges
PAD = 28        # room for shadow
FONT = os.path.join(ROOT, "assets/fonts/NotoSansKR-Black.ttf")
manifest = {}


def rs(seed):
    return np.random.default_rng(seed)


def fnoise(n, r, octaves=(0.012, 0.05, 0.18), amps=(1.0, 0.45, 0.2)):
    """1-D fractal value noise in roughly [-1, 1]."""
    x = np.arange(n)
    out = np.zeros(n)
    for f, a in zip(octaves, amps):
        k = max(2, int(n * f) + 2)
        pts = r.uniform(-1, 1, k)
        out += a * np.interp(x * (k - 1) / max(1, n - 1), np.arange(k), pts)
    return out / sum(amps)


def tear(poly, amps, r, step=3.0):
    """Resample a closed polygon and push every point along the edge normal by
    fractal noise. amps[i] is the tear amplitude of edge i (0 = clean cut).
    Returns (inner, outer) point lists; outer adds the white fibrous fringe."""
    inner, outer = [], []
    n = len(poly)
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        m = max(2, int(L / step))
        nx, ny = (y1 - y0) / L, -(x1 - x0) / L       # outward for clockwise screen polys
        amp = amps[i] if isinstance(amps, (list, tuple)) else amps
        noise = fnoise(m, r) * amp + r.uniform(-1, 1, m) * (0.9 if amp else 0)
        fr = (np.clip(fnoise(m, r, (0.03, 0.2), (1, 0.6)), -1, 1) * 0.5 + 0.5) * amp * 0.55 + (1.4 if amp else 0)
        for j in range(m):
            u = j / m
            px, py = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
            inner.append((px + nx * noise[j], py + ny * noise[j]))
            outer.append((px + nx * (noise[j] + fr[j]), py + ny * (noise[j] + fr[j])))
    return inner, outer


def poly_mask(pts, size):
    im = Image.new("L", (size[0] * SS, size[1] * SS), 0)
    ImageDraw.Draw(im).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return im.resize(size, Image.LANCZOS)


def grain(size, r, strength=0.028, fibers=True):
    w, h = size
    g = r.normal(0, 1, (h // 2 + 1, w // 2 + 1)).astype(np.float32)
    g = np.asarray(Image.fromarray(g, "F").resize((w, h), Image.BILINEAR))
    g2 = np.asarray(Image.fromarray(r.normal(0, 1, (h // 8 + 1, w // 8 + 1)).astype(np.float32), "F").resize((w, h), Image.BICUBIC))
    tex = 1 + strength * (0.6 * g + 0.8 * g2)
    if fibers:
        fim = Image.new("L", size, 128)
        d = ImageDraw.Draw(fim)
        for _ in range(int(w * h / 9000)):
            x, y, a, l = r.uniform(0, w), r.uniform(0, h), r.uniform(0, math.pi), r.uniform(6, 30)
            d.line([(x, y), (x + math.cos(a) * l, y + math.sin(a) * l)], fill=int(r.choice([100, 160])), width=1)
        f = (np.asarray(fim.filter(ImageFilter.GaussianBlur(0.6)), np.float32) - 128) / 128
        tex += 0.025 * f
    return tex[..., None]


def hex2rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def compose(color_rgb, inner, outer, size, r, fringe="#FBF8F1", overlay=None, shadow=(5, 7, 7, 0.32)):
    """Build padded RGBA sprite: shadow + white fringe + textured colour paper."""
    w, h = size
    fw, fh = w + 2 * PAD, h + 2 * PAD
    sh = lambda pts: [(x + PAD, y + PAD) for x, y in pts]
    mi, mo = poly_mask(sh(inner), (fw, fh)), poly_mask(sh(outer), (fw, fh))
    tex = grain((fw, fh), r)
    if isinstance(color_rgb, np.ndarray) and color_rgb.ndim == 3:
        col = color_rgb
    else:
        col = np.ones((fh, fw, 3), np.float32) * hex2rgb(color_rgb)
    col = np.clip(col * tex, 0, 255)
    if overlay is not None:
        col = overlay(col)
    fr = np.clip(np.ones((fh, fw, 3), np.float32) * hex2rgb(fringe) * (0.97 + 0.03 * tex), 0, 255)
    ai, ao = np.asarray(mi, np.float32)[..., None] / 255, np.asarray(mo, np.float32)[..., None] / 255
    rgb = col * ai + fr * (1 - ai)
    a = np.maximum(ai, ao)
    out = np.zeros((fh, fw, 4), np.float32)
    if shadow:
        dx, dy, blur, op = shadow
        s = mo.filter(ImageFilter.GaussianBlur(blur))
        s = np.asarray(s.transform(s.size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy)), np.float32)[..., None] / 255 * op
        out[..., 3:] = s
        out[..., :3] = np.array([30, 25, 20], np.float32)
    # alpha-composite paper over shadow
    oa = a + out[..., 3:] * (1 - a)
    out[..., :3] = (rgb * a + out[..., :3] * out[..., 3:] * (1 - a)) / np.maximum(oa, 1e-6)
    out[..., 3:] = oa
    return Image.fromarray(np.dstack([np.clip(out[..., :3], 0, 255), np.clip(out[..., 3:] * 255, 0, 255)]).astype(np.uint8), "RGBA")


def save(name, img, w, h, **extra):
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    manifest[name] = {"src": f"../../assets/collage/{name}.png", "w": w, "h": h, "pad": PAD, **extra}


def rect(w, h):
    return [(0, 0), (w, 0), (w, h), (0, h)]


def printed_text(txt, size, color, alpha=0.22, angle=0, line=1.5):
    font = ImageFont.truetype(FONT, size)

    def fn(col):
        hh, ww = col.shape[:2]
        layer = Image.new("L", (ww * 2, hh * 2), 0)
        d = ImageDraw.Draw(layer)
        y = -size
        while y < hh * 2:
            d.text((-(y * 3) % 400 - 400, y), (txt + "   ") * 12, font=font, fill=255)
            y += int(size * line)
        layer = layer.rotate(angle, resample=Image.BICUBIC).crop((ww // 2, hh // 2, ww // 2 + ww, hh // 2 + hh))
        m = np.asarray(layer, np.float32)[..., None] / 255 * alpha
        return col * (1 - m) + hex2rgb(color) * m
    return fn


def halftone(color, cell=14, alpha=0.28, direction=1):
    def fn(col):
        hh, ww = col.shape[:2]
        im = Image.new("L", (ww * 2, hh * 2), 0)
        d = ImageDraw.Draw(im)
        for y in range(0, hh * 2, cell * 2):
            for x in range(0, ww * 2, cell * 2):
                u = (x / (ww * 2)) if direction > 0 else (1 - x / (ww * 2))
                rr = cell * 0.9 * (0.15 + 0.85 * u)
                ox = cell if (y // (cell * 2)) % 2 else 0
                d.ellipse([x + ox - rr, y - rr, x + ox + rr, y + rr], fill=255)
        m = np.asarray(im.resize((ww, hh), Image.LANCZOS), np.float32)[..., None] / 255 * alpha
        return col * (1 - m) + hex2rgb(color) * m
    return fn


# ------------------------------------------------------------------ background
r = rs(1)
bg = np.ones((H, W, 3), np.float32) * hex2rgb("#F3EEE3")
bg *= grain((W, H), r, 0.03)[..., :]
yy, xx = np.mgrid[0:H, 0:W]
vig = 1 - 0.10 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2.2
bg *= vig[..., None]
Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "paper_bg.jpg"), quality=94)
manifest["paper_bg"] = {"src": "../../assets/collage/paper_bg.jpg", "w": W, "h": H, "pad": 0}

# ---------------------------------------------------------------- sky strips
SKY = [("#BFDDF2", None), ("#9FCBEA", printed_text("MUNGYEONG  PARAGLIDING  SKY", 20, "#2E6EA8", 0.16, 4)),
       ("#D7EBF7", None), ("#86BBE3", halftone("#3C7FC0", 12, 0.22)), ("#CFE6F5", None)]
for i, (col, ov) in enumerate(SKY):
    r = rs(100 + i)
    w, h = 1260, int(r.uniform(95, 150))
    inner, outer = tear(rect(w, h), [11, 0, 11, 0], r)
    save(f"sky{i}", compose(col, inner, outer, (w, h), r, overlay=ov, shadow=(3, 5, 5, 0.22)), w, h)

# --------------------------------------------------------------------- sun
r = rs(7)
pts = [(110 + 100 * math.cos(a), 110 + 100 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 90, endpoint=False)]
inner, outer = tear(pts, 4, r, step=4)
save("sun", compose("#F6C531", inner, outer, (220, 220), r, overlay=halftone("#E89A12", 10, 0.25, -1)), 220, 220)

# ------------------------------------------------------------------- clouds
for i, (col, w, h) in enumerate([("#FFFFFF", 330, 150), ("#C9D5E2", 300, 130), ("#A9BBCE", 260, 110), ("#E9EEF3", 240, 100)]):
    r = rs(200 + i)
    pts = []
    for a in np.linspace(0, 2 * math.pi, 120, endpoint=False):
        ca, sa = math.cos(a), math.sin(a)
        bump = 1 + 0.16 * abs(math.sin(3 * a + i)) + 0.08 * abs(math.sin(7 * a))
        yv = sa * (0.62 if sa > 0 else 1.0)
        pts.append((w / 2 + ca * w / 2 * 0.95 * (bump if sa < 0 else 1), h * 0.62 + yv * h * 0.55 * (bump if sa < 0 else 1)))
    inner, outer = tear(pts, 4, r, step=4)
    save(f"cloud{i}", compose(col, inner, outer, (w, h), r, shadow=(3, 5, 5, 0.2)), w, h)

# ----------------------------------------------------------- mountains / hill
def ridge_strip(name, col, seed, w, h, peaks, amp, ov=None, tear_amp=9):
    r = rs(seed)
    top = []
    xs = np.linspace(w, 0, 90)
    ph = r.uniform(0, 9, 3)
    for x in xs:
        n = 0.65 * (1 - abs(math.sin(x / w * math.pi * peaks + ph[0]))) ** 1.5 + 0.35 * (1 - abs(math.sin(x / w * math.pi * peaks * 2.3 + ph[1])))
        top.append((x, amp * (1 - n)))
    # clockwise: along the ridge left->right, then down the right side, bottom, up left
    ridge = top[::-1]
    poly = ridge + [(w, h), (0, h)]
    amps = [tear_amp] * (len(ridge) - 1) + [0, 0, 0]
    inner, outer = tear(poly, amps, r, step=4)
    save(name, compose(col, inner, outer, (w, h), r, overlay=ov, shadow=(3, -6, 7, 0.28)), w, h)


ridge_strip("mtn0", "#9DBFE3", 301, 1280, 420, 2.2, 150)
ridge_strip("mtn1", "#3F7FC4", 302, 1280, 420, 1.6, 170, printed_text("문경 · MUNGYEONG · 활공 · FLY", 22, "#FFFFFF", 0.1, -3, 2.4))
ridge_strip("mtn2", "#1E4C95", 303, 1280, 420, 2.8, 120, halftone("#0C2A5E", 12, 0.3))
ridge_strip("mtn3", "#4BA3C4", 304, 1280, 380, 1.2, 90)
ridge_strip("hill0", "#8DBE55", 401, 1280, 520, 0.7, 70, halftone("#5E8F2F", 12, 0.22, -1), 7)
ridge_strip("hill1", "#5E9C3E", 402, 1280, 520, 0.55, 60, printed_text("TAKE OFF  ·  이륙  ·  TANDEM", 20, "#FFFFFF", 0.08, 2, 2.6), 7)
ridge_strip("hill2", "#A9CF6B", 403, 1280, 520, 0.45, 50, None, 7)
ridge_strip("ground0", "#3F7A33", 404, 1280, 480, 0.9, 60, halftone("#2A5A22", 12, 0.25), 8)
ridge_strip("ground1", "#1E4C95", 405, 1280, 360, 0.6, 40, printed_text("MUNGYEONG  PARAGLIDING  ·  문경", 20, "#FFFFFF", 0.07, 1, 2.4), 8)

# ----------------------------------------------------------- photo: tandem print
r = rs(501)
ph = Image.open(os.path.join(ROOT, "assets/photos/launch_tandem.jpg")).convert("RGB")
crop = (200, 40, 1145, 1330)
pw = 560
scale = pw / (crop[2] - crop[0])
phc = ph.crop(crop)
ph_h = int(phc.height * scale)
phc = phc.resize((pw, ph_h), Image.LANCZOS)
arr = np.asarray(phc, np.float32)
arr = np.clip((arr - 128) * 1.08 + 128 + np.array([6, 2, -4]), 0, 255)       # a touch of print contrast/warmth
m = 20
cw, chh = pw + 2 * m, ph_h + 2 * m
card = np.ones((chh + 2 * PAD, cw + 2 * PAD, 3), np.float32) * hex2rgb("#FBF9F4")
card[PAD + m:PAD + m + ph_h, PAD + m:PAD + m + pw] = arr
inner, outer = tear(rect(cw, chh), [6, 6, 6, 6], r)
save("photo_tandem", compose(card, inner, outer, (cw, chh), r, fringe="#FFFFFF", shadow=(8, 12, 12, 0.38)), cw, chh,
     inner=[m, m, pw, ph_h], srcScale=scale, srcCrop=list(crop))

# ----------------------------------------------------------- photo: crew sticker
r = rs(502)
cut = Image.open(os.path.join(ROOT, "assets/photos/launch_crew_cutout.png")).convert("RGBA")
bbox = (200, 360, 1213, 1215)
cut = cut.crop(bbox)
cw_ = 660
sc = cw_ / cut.width
cut = cut.resize((cw_, int(cut.height * sc)), Image.LANCZOS)
ca = np.asarray(cut, np.float32)
al = ca[..., 3] / 255
al = np.clip((al - 0.35) / 0.3, 0, 1)                         # firm up soft matte edges
B = 13
fw, fh = cut.width + 2 * (B + PAD), cut.height + 2 * (B + PAD)
big = np.zeros((fh, fw), np.float32)
big[B + PAD:B + PAD + cut.height, B + PAD:B + PAD + cut.width] = al
from scipy import ndimage  # noqa: E402

dist = ndimage.distance_transform_edt(big < 0.5)
border = np.clip(B - dist + 0.5, 0, 1)
border = np.asarray(Image.fromarray((border * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
border = np.clip((border - 0.5) * 3 + 0.5, 0, 1)
rgb = np.ones((fh, fw, 3), np.float32) * hex2rgb("#FFFFFF")
photo = np.zeros((fh, fw, 3), np.float32)
photo[B + PAD:B + PAD + cut.height, B + PAD:B + PAD + cut.width] = np.clip((ca[..., :3] - 128) * 1.06 + 128 + np.array([5, 2, -3]), 0, 255)
rgb = photo * big[..., None] + rgb * (1 - big[..., None])
a = np.maximum(border, big)
shadow = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)).transform((fw, fh), Image.AFFINE, (1, 0, -8, 0, 1, -12)), np.float32) / 255 * 0.38
oa = a + shadow * (1 - a)
rgb = (rgb * a[..., None] + np.array([30, 25, 20]) * (shadow * (1 - a))[..., None]) / np.maximum(oa, 1e-6)[..., None]
img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), oa * 255]).astype(np.uint8), "RGBA")
img.save(os.path.join(OUT, "photo_crew.png"), optimize=True)
manifest["photo_crew"] = {"src": "../../assets/collage/photo_crew.png", "w": cut.width + 2 * B, "h": cut.height + 2 * B, "pad": PAD,
                          "srcScale": sc, "srcCrop": list(bbox), "border": B}

# ----------------------------------------------------------- cards, tape, strips
r = rs(601)
w, h = 1010, 300
inner, outer = tear(rect(w, h), [7, 7, 7, 7], r)
save("logo_card", compose("#FFFDF8", inner, outer, (w, h), r, shadow=(7, 10, 11, 0.34)), w, h)

for i in range(4):
    r = rs(700 + i)
    w, h = 170, 50
    inner, outer = tear(rect(w, h), [1.2, 5, 1.2, 5], r)
    img = compose("#EADFBF", inner, outer, (w, h), r, fringe="#EADFBF", shadow=(1, 2, 2, 0.15))
    a = np.asarray(img, np.float32)
    a[..., 3] *= 0.82
    save(f"tape{i}", Image.fromarray(a.astype(np.uint8), "RGBA"), w, h)

r = rs(801)
w, h = 1300, 290
inner, outer = tear(rect(w, h), [12, 0, 12, 0], r)
save("red_strip", compose("#E4271F", inner, outer, (w, h), r, overlay=halftone("#B3120D", 12, 0.25), shadow=(5, 9, 9, 0.35)), w, h)

r = rs(802)
w, h = 400, 100
inner, outer = tear(rect(w, h), [2, 8, 2, 8], r)
save("label_yellow", compose("#FFD23F", inner, outer, (w, h), r, shadow=(4, 6, 6, 0.3)), w, h)

TILE = ["#FFFDF6", "#FFF3C4", "#E6F1FA", "#FFFDF6", "#FFF3C4", "#FFFDF6", "#E6F1FA", "#FFF3C4", "#FFFDF6"]
for i, col in enumerate(TILE):
    r = rs(900 + i)
    w, h = (120, 170) if i != 4 else (70, 40)
    inner, outer = tear(rect(w, h), 3.5, r)
    save(f"tile{i}", compose(col if i != 4 else "#1E4C95", inner, outer, (w, h), r, shadow=(4, 6, 5, 0.33)), w, h)

# grain overlay for the whole frame (multiplied in at low strength)
r = rs(999)
g = np.clip(128 + 60 * (grain((W, H), r, 0.3)[..., 0] - 1), 0, 255).astype(np.uint8)
Image.fromarray(g).save(os.path.join(OUT, "grain.png"), optimize=True)
manifest["grain"] = {"src": "../../assets/collage/grain.png", "w": W, "h": H, "pad": 0}

with open(os.path.join(ROOT, "src/collage/sprites.js"), "w") as f:
    f.write("// generated by make_paper.py\nwindow.SPRITES = " + json.dumps(manifest, indent=1) + ";\n")
print("sprites:", len(manifest))
