HOUSE OF HEX PHONE + STAND - web export v3 (screen flicker fix)
Source: E:\Portfolio 2026\House of Hex\3D Website\house-of-hex_web-export.blend. Working copy: house-of-hex_web-export_v3.blend (original untouched).
Previous files kept as *_OLD08 (GLBs, textures folder, ref PNG, README).

WHAT WAS WRONG
- `screen` sat 0.01-0.08 mm from the front glass: three layers were effectively coplanar (phone front panel at y'=-0.04900, glass sheet at -0.04902, screen at -0.04903 in the phone frame). At booth scale this causes depth flicker.

WHAT CHANGED
- The front glass sheet was exactly the display region (226 faces, 113.4 cm2 = display area, free-floating, no bezel ring). All 226 faces deleted, so the display area has one surface: the screen.
- `screen` moved to 1.0 mm in front of the former glass plane, along the phone's face normal (12 deg back-tilt). The phone's own front panel is now 1.1 mm behind the screen. UV0 re-fitted to exactly 0-1.
- Hygiene on `phone`: merged by distance 0.0001 (273 verts), no loose verts/edges, no zero-area faces.
- Everything else as before: pose, sizes, materials, textures, node names, UV maps, LOD ratios. Stand untouched (closed, 332 tris).

DISPLAY: 73.01 x 158.01 mm, aspect 0.4621:1.
SCREEN OFFSET: 1.0 mm in front of the glass surface (was ~0.01-0.08 mm).

OBJECTS: phone (house-of-hex_phone_mat + GLASS for lenses/camera), stand (house-of-hex_stand_mat), screen (SCREEN).
DIMENSIONS (assembled): 90 x 130 x 175.8 mm (stand footprint 90 x 130; phone body 79.1 mm wide).
TRIANGLES: LOD0 22,671 (phone 22,265, stand 332, screen 74). LOD1 7,084 (phone decimated 0.3, textures 1024 / stand 512).
FILES: house-of-hex.glb 3.37 MB (LOD0) | house-of-hex.mobile.glb 1.27 MB (LOD1).

NON-MANIFOLD EDGES: stand 0; screen 76 (single-sided flat plane by design); phone 2,728 (1,887 open boundary + 841 edges shared by >2 faces).
- Phone cannot be closed without remodelling: it is 47 touching source shells (frame, buttons, lens rings, camera, internals) that share edges and have open interiors. Normal recalculation was NOT applied: it would flip 2,556 faces of those open shells wrongly. Normals were checked visually on all 8 views: no flipped/black faces, no holes, no see-through areas from the back, sides or top.
- Stand viewed from all sides: closed solid, backrest back face reads dark (source material), no holes.

TEXTURES (textures/, unchanged from the previous export): house-of-hex_phone_basecolor.png + _orm.png (2048), house-of-hex_phone.mobile_* (1024), house-of-hex_stand_* (1024), house-of-hex_stand.mobile_* (512; the stand art is 1024).
UV: UVMap(UV0)/UV1 on phone and stand as before; no new bake.
CHECK SHEET: house-of-hex.check-sheet.png (8 views, 4x2, 600px, 50mm, world 0.18, one soft area light, AgX 'Base Contrast' = neutral Medium Contrast look in Blender 5.2). house-of-hex.ref.png = 3/4 view.
VALIDATION: both GLBs re-imported into an empty scene; scale, origin at bottom centre (min z=0), 3 named nodes and textures correct.
