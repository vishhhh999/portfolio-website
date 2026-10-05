JSW SPORTS (HARYANA STEELERS) COFFEE-TABLE BOOK - WEB EXPORT (rebuild, jsw-sports)
Source: modelled from scratch in jsw-sports_web-export.blend. Inspected 1.blend-6.blend and the earlier export: 1-3.blend are the HS book scenes (closed solid at 0.359 x 0.275 x 0.027 m / open scenes), 4-6.blend are the IIS report (not this book). Real dimensions were taken from 1.blend/3.blend; geometry is new because none of them has a hinge-ready split. Previous export kept as jsw-sports_web-export_OLD.blend.
Nodes: back_cover, pages_back, spine (static); front_cover (animated) with child pages_front. Origin = bottom centre of the closed book; front cover faces -Y (Blender) / +Z (glTF).
Size (closed): 0.359 W x 0.027 D x 0.275 H m. Boards 4 mm, page block 0.351 x 0.267 m, 3 mm spine slab, 2 mm rounded cover corners, 0.5-1.2 mm bevels, 0.2 mm clearances between parts.

MATERIALS / TEXTURES (one shared baked material, UV1 atlas, texCoord 1; UV0 holds artwork mapping)
Outside front cover: textures\HS Covers\hs_front_cover.png. Outside back cover: hs_back_cover.png. Cover edges extend the cover's edge pixels.
INSIDE faces of both boards: endpaper, plain uncoated off-white #EEEAE2, roughness 0.85, no print.
Spine: hs_sleeve.png on the spine outside face only, centred at its natural aspect (spine is 27 mm, sleeve art 21.6 mm wide, the 2.7 mm each side extends edge pixels); nowhere else.
Open spread: textures\HS\spread_1.png used (left half on pages_front, right half on pages_back). spread_2-4 not baked; to swap, re-bake with the other spread.
Page block edges: plain paper colour #EDE8DC, roughness 0.9 (no artwork).
Bake: BaseColor 2048 sRGB, ORM 2048 (R AO 128 spp baked in the OPEN pose so the spread is not occluded, G roughness, B metallic 0). No normal map (no real surface detail). Atlas: non-art islands (endpaper, page edges, hidden faces) shrunk to 20% to give the artwork islands more texels; spreads/covers are at roughly 55% of source resolution.
Files: textures\jsw-sports_basecolor.png, jsw-sports_orm.png (LOD0, 2048); jsw-sports.mobile_basecolor.png, jsw-sports.mobile_orm.png (LOD1, 1024). The GLBs embed these as JPEG (quality 88 / 85) to hit the size targets.
Gold foil: none applied (no foil mask exists); metallic 0.

ANIMATION: one action 'open', rotation only, on front_cover (pages_front follows as child). Axis: vertical Z through the hinge at the cover's outer spine corner. Frame 1 = closed (rest pose, front cover facing -Y), frame 30 = open 110 deg between the covers; Bezier auto-clamped ease in/out. Back half, spine and back cover stay put. At 110 deg the front half swings toward the camera side, so the spread is seen with the left page angled.
Checked frames 1, 10, 20, 30: zero mesh overlaps between any pair of parts in both LODs (BVH). Closed book is fully sealed from every side (all parts manifold).

Triangles: LOD0 1,948 (budget 20,000); LOD1 1,036 (budget 5,000), decimated per part (collapse), own 1024 textures.
File sizes: jsw-sports.glb 1087556 bytes (1.09 MB, target <= 4 MB); jsw-sports.mobile.glb 339620 bytes (0.34 MB, target <= 1.5 MB). Old files were 8.97 MB each.
Renders: jsw-sports.ref.png (frame 1, closed), jsw-sports.ref-open.png (frame 30).
Validation: both GLBs re-imported; 0.359 x 0.027 x 0.275 m, origin bottom centre, no missing images, action 'open' present in both.
Caveats: mesh is lightweight (page edges are smooth, no individual sheet geometry); LOD0 has far fewer triangles than the 20k budget by design.
