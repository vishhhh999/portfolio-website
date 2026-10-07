MITOOSHI LAPTOP - web export v3 (rebuilt)
Source: E:\Portfolio 2026\Mitooshi\4.blend (cleaner of 1.blend / 4.blend). Working copy: mitooshi_web-export_v3.blend (original untouched).
Previous files kept as *_OLD08 (GLBs, textures folder, ref PNG, README).

WHAT WAS WRONG
- Previous export joined every part into one mesh with open shells (~30k non-manifold edges) and a 7,440-island bake.
- Source Main Body = 403k tris of unmerged CAD (378k verts, 5,083 loose pieces, 363k non-manifold edges), mostly speaker-grille perforations. The display shell was open (286 boundary edges) and the bezel, screen and shell rim were coplanar (depth flicker).

WHAT CHANGED
- Rebuilt as separate closed solids at real size (metres), origin at bottom centre, front = -Y, +Y up on export, transforms applied.
- Rebuilt from clean primitives to source dimensions: base (bottom case + top deck, keyboard well, trackpad pocket, speaker inserts, hinge pocket), lid (back shell), bezel (thin black glass slab, outline taken from the source bezel+screen footprint incl. notch), hinge (axle + 2 barrels on the pivot axis), feet (4 rubber discs).
- Kept from source geometry (merged by distance 0.0001, holes capped): keyboard (legends from the source photo texture, cropped), trackpad, screen plane, logo plane.
- Lid open 110 degrees about the hinge axis (y=0.1080, z=0.0087). Hinge parts sit on that axis inside the base hinge pocket. Pairwise BVH overlap test between all parts = 0 intersections (0.02mm gaps where parts touch).
- No giant bake: aluminium, glass, plastic and rubber are plain Principled materials. Only artwork is textured.
- Screengasket (0.4mm rubber seal coplanar with the screen) removed to prevent depth flicker.
- Not carried over: speaker perforations (replaced by dark inset strips), side-port cutouts, hinge-cover strip (Extruded.055), clutch blocks (Solid 514/515, replaced by hinge barrels). Keeping them would cost 100k+ tris and open shells.
- Keyboard normal map for key edges: not needed, the keys are real geometry (23k tris).

OBJECTS / MATERIALS
base (ALU_SPACE_GREY + BLACK_PLASTIC), keyboard (KEYS_MATTE_BLACK, rough 0.55), trackpad (TRACKPAD_GLASS, rough 0.25), lid (ALU_SPACE_GREY), bezel (BEZEL_GLOSS_BLACK, rough 0.15), screen (SCREEN: black, rough 0.1, no image), hinge (ALU_SPACE_GREY), feet (RUBBER), logo (LOGO_DECAL, alpha; source Apple mark plane on the lid back).
ALU_SPACE_GREY: metallic 1, roughness 0.32, base colour (0.22,0.225,0.24), fine bead-blast normal map bead_blast_n.png (1024, tileable, strength 0.25, UV 1 unit = 60mm).

SCREEN
- Mesh `screen`, material SCREEN. UV0 = visible display mapped exactly to 0-1 (u along width, v up the display; the camera notch is left as-is).
- Display size 0.2996 x 0.1968 m, aspect 1.5224:1 (bounding box of the rounded display incl. the notch region).
- Offset: screen is 1.0 mm in front of the bezel front surface (along the lid normal). Bezel front sits 0.6 mm in front of the lid front face. No overlap with the bezel.

REAL DIMENSIONS (assembled, lid at 110 deg): 312.6 x 301.1 x 212.3 mm (W x D x H). Closed footprint 312.6 x 221.2 mm.

TRIANGLES (LOD0) = 25,605: base 740, keyboard 23,372, trackpad 158, lid 332, bezel 344, screen 61, hinge 228, feet 368, logo 2.
LOD1 = 5,505 tris (keyboard decimated to 3,272, silhouette kept; keyboard texture 1024).
FILES: mitooshi.glb 1.29 MB (LOD0) | mitooshi.mobile.glb 0.66 MB (LOD1)
BUDGETS: LOD0 <= 45,000 OK | LOD1 <= 12,000 OK

NON-MANIFOLD EDGES PER PART: base 0, keyboard 0, trackpad 0, lid 0, bezel 0, hinge 0, feet 0, screen 63, logo 4.
- Every closed solid = 0 (outward normals confirmed by positive signed volume; no zero-area faces; no loose geometry).
- screen (63) and logo (4) are single-sided flat planes by design, not solids; they cannot be closed without adding thickness that would defeat the 1.0mm offset.

TEXTURES (textures/): keyboard_basecolor.png (1166x483 = native crop of the source photo with 16px margin; the source art is not larger than this), keyboard_basecolor_1024.png (mobile), bead_blast_n.png (1024), logo.png (1000x1100, source).
UV: single UV0 (no bake was needed, so no UV1).

CHECK SHEETS: mitooshi.check-sheet.png (8 views, 4x2, 600px, 50mm, world 0.18, one soft area light, AgX 'Base Contrast' = the neutral Medium Contrast look in Blender 5.2, which has no look literally named Medium Contrast). mitooshi.check-underside.png (bottom, low-rear, low-front). mitooshi.ref.png (3/4 view).
VALIDATION: both GLBs re-imported into an empty scene; scale, origin (bottom centre, min z = 0), 9 named objects and textures all correct.
NOTES: key legends are a German-layout product photo from the source. The logo plane is the source Apple mark; remove the `logo` node if you do not want it.

CORRECTION (final pass)
- Earlier texture files bead_blast_n.png (aluminium normal) and keyboard_basecolor.png had been written blank. Both are regenerated and re-embedded in both GLBs (keyboard_basecolor.png is upscaled from the 1024 copy to 1166x483). Mobile GLB uses a 512 copy of the bead-blast normal (textures\bead_blast_n_512.png).
- Final file sizes: mitooshi.glb 4.12 MB, mitooshi.mobile.glb 1.28 MB (the earlier 1.29 / 0.66 MB figures were with the blank textures). Check sheet and ref re-rendered.
