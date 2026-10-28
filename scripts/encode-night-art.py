"""Encode approved generated night paintings; no creative pixel edits.

Usage: python scripts/encode-night-art.py <generated-images-directory>
Source names and prompts are recorded in docs/art/night-season-art.md.
"""
from pathlib import Path
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'sunlit-meadow': ('exec-14e277b5-414f-4c3f-946d-b0c2508df7fc.png', (1280, 720)),
    'woodland-brook': ('exec-6295c164-cd74-4d60-b4c0-c4c6a55aa554.png', (1536, 1024)),
    'secret-conservatory': ('exec-d152e47f-63cf-40fc-9838-90b963048532.png', (1536, 1024)),
    'cottage-bloom': ('exec-3e832ed4-8d7a-4c64-8948-da2342b01591.png', (1600, 900)),
    'rain-kissed-pond': ('exec-6e70d99a-ebbd-4625-b3ec-e82f29df5adf.png', (1600, 900)),
    'twilight-orchard': ('exec-0682980c-058c-4b93-8da6-6df6133fade0.png', (1600, 900)),
    'cloud-garden': ('exec-3417f088-14a2-4f7b-9700-26dbcc6c0014.png', (1600, 900)),
}

for scene, (name, size) in SOURCES.items():
    image = Image.open(Path(sys.argv[1]) / name).convert('RGB')
    image = image.resize(size, Image.Resampling.LANCZOS)
    out = ROOT / 'src' / 'assets' / f'garden-{scene}-night.webp'
    for quality in (80, 76, 72, 68):
        image.save(out, 'WEBP', quality=quality, method=6)
        if out.stat().st_size <= 300_000:
            break
    thumb = image.resize((375, 250) if size == (1536, 1024) else (400, 225), Image.Resampling.LANCZOS)
    thumb.save(ROOT / 'src' / 'assets' / f'thumb-{scene}-night.webp', 'WEBP', quality=75, method=6)
    print(scene, out.stat().st_size, 'bytes')
