#!/usr/bin/env python3
"""Generate the Android launcher and splash icons from the PWA icon.

    python3 scripts/generate-android-icons.py

Needs Pillow (`pip install pillow`). Re-run it whenever
public/icons/icon-512.webp changes, and commit what it writes.

The artwork is a watercolour on cream paper that runs almost to the edges.
Android's adaptive icons draw a 108dp layer and show only the central 72dp,
cropped further by the launcher's mask (a circle on many devices). So the
whole icon is placed in that central 72dp, over a background of the same
paper colour: whatever mask the launcher uses, it cuts through paper, never
through the butterfly. The same foreground doubles as the splash icon, whose
safe area is the same two-thirds of its canvas.

Android 13+ can tint launcher icons to the wallpaper ("themed icons"), which
needs a one-colour silhouette. That is traced from the artwork by how far each
pixel is from the paper tone: ink, wings, petals and leaves are far from it,
paper is not.

Launchers older than Android 8 show ic_launcher.png as is, and expect it to
have a shape of its own rather than fill its square, so it gets rounded
corners and a small margin.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public' / 'icons' / 'icon-512.webp'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'

# The paper tone along the icon's opaque border (averaged from the source).
PAPER = (0xFD, 0xF1, 0xCE)

# Pixels per dp at each density bucket.
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

LEGACY_DP = 48
LEGACY_MARGIN_DP = 2
ADAPTIVE_DP = 108
VISIBLE_DP = 72

# Distance from PAPER (in RGB units) below which a pixel counts as paper, and
# how quickly the silhouette turns opaque past it.
INK_THRESHOLD = 30
INK_GAIN = 5


def fitted(icon: Image.Image, size: int) -> Image.Image:
    return icon.resize((size, size), Image.LANCZOS)


def on_paper(icon: Image.Image) -> Image.Image:
    """The icon flattened onto its paper, so no edge is left translucent."""
    base = Image.new('RGBA', icon.size, PAPER + (255,))
    base.alpha_composite(icon)
    return base


def silhouette(icon: Image.Image) -> Image.Image:
    """White artwork on transparency, for the themed-icon layer."""
    source = icon.load()
    alpha = Image.new('L', icon.size, 0)
    target = alpha.load()
    for y in range(icon.height):
        for x in range(icon.width):
            r, g, b, a = source[x, y]
            distance = ((r - PAPER[0]) ** 2 + (g - PAPER[1]) ** 2 + (b - PAPER[2]) ** 2) ** 0.5
            ink = max(0, min(255, int((distance - INK_THRESHOLD) * INK_GAIN)))
            target[x, y] = ink * a // 255
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    white = Image.new('RGBA', icon.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def centred(layer: Image.Image, canvas: int, visible: int) -> Image.Image:
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    offset = (canvas - visible) // 2
    out.alpha_composite(fitted(layer, visible), (offset, offset))
    return out


def main() -> None:
    icon = Image.open(SOURCE).convert('RGBA')
    mono = silhouette(icon)
    for bucket, scale in DENSITIES.items():
        folder = RES / f'mipmap-{bucket}'
        folder.mkdir(parents=True, exist_ok=True)

        legacy = round(LEGACY_DP * scale)
        margin = round(LEGACY_MARGIN_DP * scale)
        inner = legacy - 2 * margin
        square = on_paper(fitted(icon, inner))
        rounded = Image.new('L', (inner, inner), 0)
        ImageDraw.Draw(rounded).rounded_rectangle(
            (0, 0, inner - 1, inner - 1), radius=round(inner * 0.18), fill=255
        )
        legacy_icon = Image.new('RGBA', (legacy, legacy), (0, 0, 0, 0))
        legacy_icon.paste(square, (margin, margin), rounded)
        legacy_icon.save(folder / 'ic_launcher.png', optimize=True)

        circle = Image.new('L', (inner, inner), 0)
        ImageDraw.Draw(circle).ellipse((0, 0, inner - 1, inner - 1), fill=255)
        round_icon = Image.new('RGBA', (legacy, legacy), (0, 0, 0, 0))
        round_icon.paste(square, (margin, margin), circle)
        round_icon.save(folder / 'ic_launcher_round.png', optimize=True)

        canvas = round(ADAPTIVE_DP * scale)
        visible = round(VISIBLE_DP * scale)
        centred(icon, canvas, visible).save(
            folder / 'ic_launcher_foreground.png', optimize=True
        )
        centred(mono, canvas, visible).save(
            folder / 'ic_launcher_monochrome.png', optimize=True
        )

    print('Wrote launcher icons for', ', '.join(DENSITIES))


if __name__ == '__main__':
    main()
