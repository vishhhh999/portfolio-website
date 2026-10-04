TOO YUMM POUCH - WEB EXPORT
Generated 2026-10-04 from TooYumm_web-export.blend (copy of 1.blend; original untouched)

HERO POUCH
Pouch_1 - Achaari Cashews (texture Frame 290930.png).
No Peri Peri peanuts pouch exists in the scene. All three pouches share identical mesh/UVs;
Pouch_1 is the original imported asset (the other two are duplicates) and the centre pouch of the layout.

REAL DIMENSIONS (metres, after glTF Y-up)
LOD0: 0.1425 W x 0.2400 H x 0.0752 D
LOD1: 0.1425 W x 0.2401 H x 0.0753 D
Source scene was metric but the pouch was modelled ~4.2x oversize. Uniform scale 0.2372 applied so height = 0.24 m;
modelled proportions kept (incl. the existing 0.9055 X scale), so width is 0.1425 rather than 0.16.
Origin at bottom centre. Front faces -Y in Blender = +Z in glTF. Transforms applied (identity).

GEOMETRY
Source mesh: 165,888 tris (157,162 after merge by distance 0.0001 m). No modifiers existed to apply.
LOD0 (too-yumm.glb):         29,479 tris  - max deviation from source 0.044 mm
LOD1 (too-yumm.mobile.glb):   7,899 tris  - max deviation from source 0.206 mm (silhouette + crimps intact)
Decimate (collapse), shade smooth by angle 30 deg, normals recalculated outward, no loose verts.

UV MAPS
UV0 (TEXCOORD_0): original artwork mapping, untouched.
UV1 (TEXCOORD_1): Smart UV Project, island margin 0.02, non-overlapping. Made on the source mesh before
decimation so LOD0 and LOD1 share one layout and the same textures.

TEXTURES (2048x2048 PNG, 8-bit RGB)
basecolor.png   sRGB        UV0  diffuse colour bake, no lighting (= Achaari Cashews)
orm.png         Non-Color   UV1  R = AO (128 samples), G = roughness (0.303 constant), B = metallic (0, no foil)
normal.png      Non-Color   UV1  OpenGL tangent space, baked from 157k source onto LOD0
Material TooYumm_Pouch: Principled BSDF, ORM -> Separate Color, R -> glTF Material Output Occlusion,
clearcoat 0.3 / clearcoat roughness 0.15 (exports as KHR_materials_clearcoat). Shared by both LODs.

FLAVOUR VARIANTS (swap baseColor map only; same mesh/UV0)
basecolor_achaari-cashews.png (identical to basecolor.png)
basecolor_coffee-almonds.png
basecolor_salted-cashews.png

FILE SIZES
too-yumm.glb                 5.06 MB
too-yumm.mobile.glb          4.30 MB
basecolor.png                2.09 MB
orm.png                      0.97 MB
normal.png                   0.87 MB
basecolor_achaari-cashews.png 2.09 MB
basecolor_coffee-almonds.png 2.12 MB
basecolor_salted-cashews.png 1.82 MB
too-yumm.ref.png             2.11 MB

VALIDATION (both GLBs re-imported into empty scenes)
Scale correct in metres, origin (0,0,0) at bottom centre, 1 mesh object, no cameras/lights/animation,
3 images embedded (basecolor, orm, normal), 0 missing. Attributes: POSITION, NORMAL, TEXCOORD_0, TEXCOORD_1, TANGENT.

DEVIATIONS FROM SPEC / COULD NOT DO
1. ORM and normal live on UV1, not UV0. UV0 maps the front and back panels onto the same full 0-1 image
   (both sides overlap completely), so AO and normals baked to UV0 would corrupt each other. glTF texCoord=1
   handles this natively; three.js GLTFLoader (r152+) reads it automatically. Tangents are computed from UV1 to match.
2. Non-manifold: 705 edges along the three zip tracks are 3-face junctions (front skin, back skin and zip ridge
   meet on one edge), plus 3 open edges on the zip fins. That is how the zip is modelled; fixing it means
   remodelling the zip. Harmless for three.js rendering and meshopt.
3. Source label art is only 611x1044 px. The 2048 maps are upsampled and carry no extra detail. Export the label
   from Figma at 2048+ px and re-bake if you want genuinely sharp type up close.
4. AgX has no "Medium Contrast" look in Blender 5.2. Used AgX "Base Contrast" (the neutral middle, equivalent to
   Filmic Medium Contrast).
5. Material exports doubleSided: true (Blender default). The pouch is closed; set side = FrontSide in three.js if you
   want the fill-rate saving.
6. Both GLBs embed the full 2048 textures. For mobile, compress with KTX2 at 1024 (no visible loss given the 611 px source).

REF RENDER
too-yumm.ref.png: 1600x1600, 50 mm perspective, straight-on front at mid-height, grey world 0.18 / 1.0,
one disc area light front-top-left, AgX Base Contrast, LOD0 + baked material only.

REUSE (SOOK / SHUNYA / JSW): same pipeline; swap object, real size and export folder.
