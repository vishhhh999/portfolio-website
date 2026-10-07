SONDE TABLET + EASEL - web export v3 (back fixed)
Source: E:\Portfolio 2026\Sonde\3D Website\sonde_web-export.blend (previous export). Working copy: sonde_web-export_v3.blend (original untouched).
Previous files kept as *_OLD08 (GLBs, textures folder, ref PNG, README).

WHAT WAS WRONG
- Tablet back was not salvageable: the old `tablet` mesh was 17.8k tris of fragmented iPad internals (868 non-manifold edges, bake atlas of ~1,000 tiny islands, flat grey back) with the brushed-metal node group replaced by a flat baked material.
- Screen sat 0.05 mm in front of the front glass (depth flicker).

WHAT CHANGED
- Tablet rebuilt (flat frame, then tilted back into the original pose, 15 deg from vertical) as ONE closed solid: aluminium back + sides with rounded edges, black glass front, camera plateau (30 x 30 mm, 2.0 mm) with main lens and flash/LiDAR disc, booleaned (exact) into the body. 1 island, 0 non-manifold, outward normals (positive volume).
- Real size: 281.6 x 215.5 x 5.1 mm body (+2.4 mm camera bump), measured from the source model.
- Materials: back/sides TABLET_SPACE_BLACK_ALU (metallic 1, roughness 0.35, base colour 0.10, directional brushed normal map brushed_n.png 1024, brush direction along the tablet width, UV 1 unit = 80 mm); front TABLET_FRONT_GLASS; lens TABLET_LENS_GLASS.
- `screen`: source rounded-rect display plane, now exactly 1.0 mm in front of the front glass (was 0.05 mm), UV0 exactly 0-1. Display 0.2648 x 0.1987 m, aspect 1.3327:1.
- `easel`: unchanged source mesh and textures (closed, 836 tris), fully behind the tablet, 0 intersections with tablet or screen (BVH test).
- Not carried over: smart-connector pins, front camera dot and internal fragments (no real artwork on the back; the old bake only held flat grey). Camera module is simplified (plateau + 2 discs).

OBJECTS: tablet (3 materials), easel (sonde_easel_mat), screen (SCREEN).
TRIANGLES: LOD0 1,756 (tablet 882, easel 836, screen 38). LOD1 1,410. Budgets 35,000 / 9,000 OK.
FILES: sonde.glb 562 KB (LOD0) | sonde.mobile.glb 251 KB (LOD1: tablet/easel decimated 0.8, easel textures 512).
NON-MANIFOLD EDGES: tablet 0, easel 0, screen 40 (single-sided flat plane by design).
SCREEN OFFSET: 1.0 mm in front of the bezel/front glass surface.
TEXTURES (textures/): brushed_n.png (1024), sonde_easel_basecolor.png + sonde_easel_orm.png (1024, source bake, unchanged), mobile copies sonde_easel.mobile_*.png (512, source). No new bake, so UV1 exists only on the easel (source).
CHECK SHEET: sonde.check-sheet.png (8 views, 4x2, 600px, 50mm, world 0.18, one soft area light, AgX 'Base Contrast' = neutral Medium Contrast look in Blender 5.2). sonde.ref.png = 3/4 view.
VALIDATION: both GLBs re-imported into an empty scene; scale (281 mm wide), origin at bottom centre (min z 0), 3 named nodes and textures correct.
NOTE: easel mobile textures are 512 (the source easel art is 1024), not 1024.

CORRECTION (final pass)
- brushed_n.png (brushed-aluminium normal) had been written blank. Regenerated and re-embedded in both GLBs.
- Final file sizes: sonde.glb 1.06 MB, sonde.mobile.glb 0.77 MB. Check sheet and ref re-rendered.
