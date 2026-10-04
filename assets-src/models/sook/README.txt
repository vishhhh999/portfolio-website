SOOK BOX TRIO - WEB EXPORT
Generated 2026-10-04 (rebuilt with the flavour textures). Working copy: sook_web-export.blend (original untouched).

SOURCE
- Geometry: "3D Box.blend" (the brief named "3D Model.blend", which does not exist). One lid-and-base box: outer sleeve
  (4 sides + top) over an inner tray (4 sides + bottom), 10 card panels. All three nodes share this mesh.
- Artwork: E:\Portfolio 2026\SOOK\textures\<flavour>. Each image was matched to its panel by aspect ratio and by layout
  against your gold box (which panel each gold image sits on). All matched at their native orientation; nothing rotated,
  cropped or redrawn.

NODES (side by side, 8 mm gaps, each origin at its own bottom centre; group origin at the group's bottom centre)
sook_box_garden-fresh   x = -0.1032   white sleeve (posts 36, 5, 2, 3, top 4)   over green tray (14, 15, 16, 17, bottom 18)
sook_box_berry-bloom    x =  0.0      aqua sleeve  (posts 25, 26, 27, 28, top 29) over plain white tray (see below)
sook_box_summer-sun     x = +0.1032   white sleeve (posts 169-172, top 176)     over orange tray (168, 173-175, bottom 177)
Each box: 0.0952 W x 0.0951 D x 0.1012 H m.  Group: 0.3016 x 0.0951 x 0.1012 m.
Triangles: LOD0 1,060 per box (3,180 total; budget 6,000 per box). LOD1 = LOD0 (already under the 1,500 per box budget).

GAPS IN THE ARTWORK
- Berry-Bloom has two complete sleeve sets (aqua 25-29 and white 42-46) but no tray artwork (no portrait panels).
  The node uses the aqua sleeve; its tray is plain white card (0.9) as a placeholder. Only the strip of tray below the
  lid (~17 mm) and the base show when closed. The white-sleeve version is baked as basecolor_berry-bloom-white.png.
- A few panel PNGs (Garden 15, 18; Summer 173, 177) have 0.2-0.5% transparent edge pixels that bake as thin dark edges.

SCALE (assumption, unchanged from the first export - please confirm)
Modelled ~1.9 m wide; uniform 0.05 scale applied (-> 95 x 95 x 101 mm). Scale all three nodes uniformly if wrong.

MATERIALS / TEXTURES (2048 PNG on UV1; hidden interior faces packed into a small corner)
basecolor_garden-fresh.png, basecolor_berry-bloom.png, basecolor_summer-sun.png   one per node
basecolor_berry-bloom-white.png   swap-in: Berry-Bloom with the white sleeve
basecolor_gold.png                swap-in: the gold "Thrice Spiced" box from 3D Box.blend
orm.png (shared)   R = AO 128 spp, G = roughness 0.6 (card, per brief), B = metallic 0 (no foil in any artwork)
No normal map: the panels are flat print with no emboss/deboss.
Geometry: 0.8 mm 2-segment bevel on every edge, Smooth by Angle 30, merged at 0.0001, triangulated. ~71 non-manifold edges
remain where the separate card panels butt at the corners (modelled as slabs, not a folded net).

FILE SIZES
sook.glb          1.87 MB
sook.mobile.glb   1.87 MB
basecolor_berry-bloom-white.png   0.29 MB
basecolor_berry-bloom.png         0.30 MB
basecolor_garden-fresh.png        0.38 MB
basecolor_gold.png                0.45 MB
basecolor_summer-sun.png          0.40 MB
orm.png                           0.57 MB
sook.ref.png                      2.03 MB

VALIDATION (both GLBs re-imported into empty scenes)
3 mesh nodes with the right names, group 0.3016 x 0.0951 x 0.1012 m, bottom at 0, centred, 4 images at 2048, 0 missing.

OTHER
AgX in Blender 5.2 has no "Medium Contrast" look; reference render uses AgX Base Contrast.
sook_web-export.blend1 is Blender's automatic backup; safe to delete.
