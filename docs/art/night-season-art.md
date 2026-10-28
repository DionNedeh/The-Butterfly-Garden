# Night and season artwork

Prepared alone by Codex on 27 October 2026 for the artwork portion of PR #68.
No subagents. The owner explicitly chose **art only** for keepsakes and outfits:
gifting, ownership, placement and availability remain pending.

## Deliverables and retained decisions

- Seven night WebPs in `src/assets/garden-*-night.webp`, matching day-scene
  dimensions, each under 300,000 bytes. One night painting per scene.
- Seven night thumbnails in `src/assets/thumb-*-night.webp`, prepared but not
  yet selected by the gallery. Device theme alone would not respect manual mode.
- Two original moth designs in `src/components/garden/Moth.tsx`, on composited
  sprite layers: at most three on fully grown nectar plants, night/full motion,
  outside winter. Device reduced motion hides them too.
- CSS seasonal petals, pollen, autumn leaves, snow and still frost. New particles
  are absent under Calm/reduced motion; still frost stays, except on personal
  photos. Existing butterfly flight remains unchanged.
- Four keepsakes, four outfits and a heart symbol in `docs/art/seasonal/*.svg`.
  Rebuild these original drawings with `node scripts/seasonal-vector-art.mjs`.
  They are not catalogue items or earned possessions. No new jar character,
  entitlement, saved-look ID, gift, shelf, or state-version change is introduced.
- Outfit SVGs show anchor-space art translated near (40,50) in an 80×88 box.
  Transplant their inner groups into OutfitOverlay only after product decisions;
  life-stage fit must then be checked at the existing head/body anchors.
- The two free scenes' night paintings are precached; optional scenes use the
  existing runtime cache. Personal-image priority is preserved. Built-in night
  paintings get a lighter contrast wash; personal photos retain their old wash.

## Provenance and prompt set

Paintings: built-in OpenAI image-generation tool, 27 October 2026. Its model ID
was not exposed. Each existing repository day painting was the edit target;
no external source images, third-party brushes or textures were supplied.
These are AI-generated illustrations, not photographs. Original day files stay
unchanged. No provenance is invented for older artwork with unknown history.

Common prompt: lighting-weather edit, preserve exact framing, perspective,
architecture, paths, horizon and botanical masses. Retain detailed botanical
gouache/watercolour texture. Repaint as real indigo/blue-teal moonlit night,
silver edges and softly coloured flowers, not a flat dark filter. Keep upper-left
55% width × 40% height dark and quiet, requested luminance under .10, for cream
UI text. No visible moon, sunlight, people, insects, text, watermark or added
structures. Requested luminance is a design target, not measured acceptance;
the app keeps a dark text-protection wash.

| Scene | Per-scene prompt | Generated PNG suffix |
|---|---|---|
| Sunlit Meadow | Preserve path and arch, silver flower/path rims, subtle stars, no gold sky; 1280×720 composition | 14e277b5-414f-4c3f-946d-b0c2508df7fc |
| Woodland Brook | Preserve brook, stones and clearing; silver ripples, readable bellflowers and columbines; 1536×1024 | 6295c164-cd74-4d60-b4c0-c4c6a55aa554 |
| Secret Conservatory | Preserve ribs, arches and round pool; silver-blue stone, reflected sky, muted pink/purple blooms; 1536×1024 | d152e47f-63cf-40fc-9838-90b963048532 |
| Cottage Bloom | Preserve cottage, steps, lawn and hills; faint warm window allowed, silver daisies and roses; 1600×900 | 3e832ed4-8d7a-4c64-8948-da2342b01591 |
| Rain-kissed Pond | Preserve rain rings, mist, lilies, irises; blue-slate sky and low silver mist; 1600×900 | 6e70d99a-ebbd-4625-b3ec-e82f29df5adf |
| Twilight Orchard | Same orchard later at night; remove sunset, preserve and softly light existing lanterns amber; 1600×900 | 0682980c-058c-4b93-8da6-6df6133fade0 |
| Cloud Garden | Preserve terrace, pavilion, islands and cloud sea; blue-violet clouds lit from outside upper right; 1600×900 | 3417f088-14a2-4f7b-9700-26dbcc6c0014 |

Source names are `exec-<suffix>.png`. `scripts/encode-night-art.py` only resizes
with Lanczos and encodes WebP (q80 decreasing to meet 300 kB, method 6), plus
400×225 or 375×250 thumbnails. Original PNGs remain in Codex generated-image
storage. Committed WebPs are complete production assets.

SVG/CSS: original code-native shapes drawn directly by Codex, with no external
fonts, textures or embedded raster material. Existing project licence applies.

## Validation boundary

Check results belong in the final handoff. Image inspection is not a device
test; Chromium's Android-bundle project is not hardware or Play acceptance.
No store submission is part of this work.
