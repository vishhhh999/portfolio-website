SOOK TEA BOX TRIO (slug sook)  |  Batch 3 repair

WHAT WAS WRONG
- Boxes were named after flavours, not the requested sook_box_white / sook_box_aqua / sook_box_red.
- Textures were baked on one packed UV with hidden faces squeezed into a corner; no per-face islands, art resolution low on the fronts.
- Mesh carried 20 zero-area sliver faces and a 0.04 mm bevel that merged away; UV1 islands were closer than 0.005 (needs >= 0.01).
- LOD1 was identical to LOD0.

WHAT CHANGED
- Rebuilt the box as 10 closed card panels (sleeve: front, back, left, right, top; tray: front, back, left, right, bottom) at the source dimensions, 0.4 mm 2-segment bevel, triangulated. 1,080 tris per box, 0 non-manifold, 0 loose, 0 zero-area, normals outward.
- UV0 (artwork): one island per panel face, art fills the whole face at native orientation, 16 px edge-extend padding, no overlap. Bevel and thin edge faces clamp to the face edge pixels, so no art bleed on edges. Inner (hidden) faces point at a small plain-card island.
- UV1 (ORM/AO): Smart UV, 60 islands, margin 0.02 (checked: no pair of islands closer than 0.01). AO rebaked (Cycles, 128 spp) into orm.png: R = AO, G = roughness 0.6, B = metallic 0. No normal map (flat print).
- Atlas 2048 basecolor per box. Sleeve front 1200x1061 px (about 12.6 px/mm), sleeve back/left/right 608x538, top 500x500, tray panels 267x303, tray bottom 230x230. Mobile copies at 1024.
- LOD1: Decimate (collapse, ratio 0.5) per box, 1024 textures.
- Old outputs kept as *_OLD08. Source .blend untouched; work file sook_web-export_v3.blend.

NODE NAMES / POSITIONS (8 mm gaps, each origin at its own bottom centre)
sook_box_white  x = -0.1032 m   = GARDEN FRESH (white sleeve, green tray)
sook_box_aqua   x =  0.0   m    = BERRY BLOOM (aqua sleeve)
sook_box_red    x = +0.1032 m   = SUMMER SUN (white sleeve, orange/red tray)
Naming assumption: the brief gave white / aqua / red for the three flavours; I read it as Garden Fresh / Berry Bloom / Summer Sun in that order (by sleeve and tray colour). Rename if you meant otherwise.
REAL SIZE per box 95.2 x 95.2 x 101.2 mm; group 301.6 x 95.2 x 101.2 mm.

FACE MAPPING (files in E:\Portfolio 2026\SOOK\textures\<flavour>\ "Instagram post - N.png"; face identified by looking at each file, same layout as the gold box)
Sleeve: front = logo + illustration + product name; back = nutrition facts / barcode; right (+X) = ABOUT THE TEA text; left (-X) = serving + brewing instructions; top = SOOK logo.
Tray: front = illustration on flavour colour; back = lorem text panel; left/right = cloud panels; bottom = plain flavour colour.
  Berry Bloom (aqua):  sleeve front 25, back 26, right 27, left 28, top 29. Tray: no artwork supplied - plain card colour (0.95/0.94/0.92). The folder also holds a white-sleeve set (42-46); not used.
  Garden Fresh (white): sleeve front 36, back 5, right 2, left 3, top 4. Tray front 14, back 15, left 16, right 17, bottom 18.
  Summer Sun (red):    sleeve front 169, back 170, right 171, left 172, top 176. Tray front 168, back 173, left 174, right 175, bottom 177.
Nothing rotated, redrawn or recoloured. A 1-2 px transparent edge on some tray PNGs was cropped.

TRIANGLES: LOD0 1,080 per box (3,240 total) | LOD1 540 per box (1,620 total)
FILES: sook.glb 3.66 MB | sook.mobile.glb 1.32 MB
TEXTURES (textures\): sook_box_<white|aqua|red>_basecolor.png 2048 and _1024.png; sook_box_orm.png 2048 and _1024.png

NOT FIXABLE / NOTES
- Berry Bloom tray has no artwork in the supplied files.
- Card panels overlap by about 0.9 mm where sleeve and tray panels meet (as in the source); the overlapped parts are hidden. No coincident faces.
- Tray left/right (cloud) faces and the tray bottom are barely visible when closed, so their orientation was not separately checked on the sheet.
- Check sheet uses AgX Base Contrast (no Medium Contrast look in Blender 5.2).
