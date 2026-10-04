JSW SPORTS (HARYANA STEELERS) BOOK - WEB EXPORT
Generated 2026-10-04 (re-baked with the real covers). Working copy: jsw-sports_web-export.blend (originals untouched).

SOURCE
- 1.blend (named in the brief) only has the book as a closed solid block lying flat, which cannot be opened.
- 3.blend in the same folder has the same book modelled OPEN (Book_Spread_1, rounded spine, 3 mm boards, page block with
  gutter curve) with the HS spreads mapped from textures\HS\spread_1-4.png. That model was used; nothing was modelled
  from scratch and the artwork mapping is yours.
- Covers relinked to textures\HS Covers: hs_front_cover.png (front board), hs_back_cover.png (back board),
  hs_sleeve.png (spine). The old front_cover.jpg / back_cover.jpg / side_label.jpg references were dead links.

NODE
jsw_book   0.564 W x 0.220 D x 0.2747 H m, standing on its bottom edge, 110 deg between the pages.
           Spread faces the front (-Y in Blender = +Z in glTF); front and back covers are on the outside of the V.
           Page size ~0.351 x 0.275 m (your model, landscape coffee-table format).
LOD0 3,772 tris (budget 20,000)   LOD1 3,772 tris (budget 5,000; already under, decimating would only damage spine/gutter)
Edges: 1 mm 2-segment bevel on all edges over 60 deg, Smooth by Angle 30, merged at 0.0001, triangulated.

MATERIAL / TEXTURES (2048 PNG on UV1; spread and cover islands given extra atlas space)
basecolor.png (= basecolor_spread-1.png)  sRGB: spread 1 inside, real covers + spine, page colour on the block
basecolor_spread-2.png / -3.png / -4.png  swap-in basecolors for the other spreads (same mesh, UVs, ORM and normal)
orm.png     R AO 128 spp, G roughness (cover laminate 0.45, pages/spread 0.8), B metallic
normal.png  OpenGL; page-edge lines on the block edges and the cover board grain from your materials

GOLD FOIL: NOT APPLIED
About a quarter of the front cover is yellow/gold-coloured ink. There is no separate foil mask in the files, and a colour
pick cannot tell foil from printed yellow, so metallic is 0 everywhere. If any of it is foil, send a black/white foil
mask (same size as hs_front_cover.png) and it becomes metallic 1 there only.

FILE SIZES
jsw-sports.glb            8.55 MB
jsw-sports.mobile.glb     8.55 MB
basecolor.png             3.53 MB
basecolor_spread-2.png    3.34 MB
basecolor_spread-3.png    3.50 MB
basecolor_spread-4.png    3.42 MB
orm.png                   1.83 MB
normal.png                3.02 MB
jsw-sports.ref.png        2.27 MB

VALIDATION (both GLBs re-imported into empty scenes)
1 mesh node "jsw_book", 0.564 x 0.220 x 0.2747 m, bottom at 0, centred, 3 images at 2048, 0 missing.

OTHER
Non-manifold edges remain where the page block meets the boards (as modelled).
AgX in Blender 5.2 has no "Medium Contrast" look; reference render uses AgX Base Contrast.
jsw-sports_web-export.blend1 is Blender's automatic backup; safe to delete.
