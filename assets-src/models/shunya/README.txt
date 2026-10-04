SHUNYA RANGE - WEB EXPORT
Generated 2026-10-04 from shunya_web-export.blend (copy of SHUNYA_Master.blend; original untouched)

SOURCE NOTES
- All 55 image textures in the source pointed to E:\Projects\SHUNYA\... (folder no longer exists). Relinked to the
  same filenames under E:\Portfolio 2026\SHUNYA. Nothing missing after relink.
- Layout taken from the S01_RangeHero scene (collection instances): Ritual Set behind, Bhimseni jar and Air tin in
  front, Pooja carton to the left. Checked for intersections: none (tightest gap ~5 mm, Air tin to Ritual Set).
- The three loose camphor tablets in the hero shot were not requested and are not exported.
- Front faces -Y in Blender (hero camera side) = +Z in glTF.

NODES (one GLB, four named nodes; each node origin at its own bottom centre, group origin at the group's bottom centre)
                         W x D x H (m)              LOD0 tris   LOD1 tris
shunya_ritual_set        0.2305 x 0.1749 x 0.0600       440         440   (box + telescoping lid)
shunya_bhimseni_jar      0.0657 x 0.0658 x 0.0905    13,562       4,000   (glass 8,496 / label+cork+crystals 5,066)
shunya_air_tin           0.0816 x 0.0816 x 0.0306    27,000       6,600   (tin, beads, pierced lid, 19 camphor cubes inside)
shunya_pooja_carton      0.0647 x 0.0454 x 0.0900       188         188
GROUP                    0.2932 x 0.3003 x 0.0905    41,190      11,228   (budgets 45,000 / 12,000)
Camphor crystal in the jar: 120 crystals merged into one mesh, decimated 3,208 -> 2,800 tris.
Ritual Set and Pooja carton are already low-poly with bevels; decimating them would only damage the edges, so LOD1 = LOD0.

MATERIALS
shunya_ritual_set / shunya_pooja_carton / shunya_bhimseni_jar (label, cork, crystals): baked Principled, opaque.
shunya_air_tin: baked Principled, alphaMode MASK (pierced lid holes are alpha cut-outs).
shunya_glass: Transmission 1, roughness 0.05, IOR 1.5, thickness 0.002 m -> KHR_materials_transmission + KHR_materials_volume.
Copper foil: metallic = 1 in the ORM blue channel only where the artwork's foil mask is (Ritual lid ~1k px, Pooja ~3k px).
Bhimseni label: no foil in its mask, so metallic 0.
Tin: bare tin parts metallic 1, roughness 0.25-0.30 as set in your file (spec said ~0.35; kept the file's values).
Printed tin band / lid top: painted white, non-metal, as in your file.

TEXTURES (2048 PNG each, all mapped on UV1 = per-node atlas)
basecolor_<node>.png (sRGB; air-tin has alpha), orm_<node>.png (R AO 128spp, G roughness, B metallic), normal_<node>.png (OpenGL)
nodes: ritual-set, bhimseni-jar, air-tin, pooja-carton
Normals carry the debossed grids / raised wordmarks (from your _H height maps), paper grain and cork brand bump.

FILE SIZES
shunya.glb          30.58 MB
shunya.mobile.glb   29.12 MB
shunya.ref.png      1.89 MB
basecolor_air-tin.png       0.37 MB
basecolor_bhimseni-jar.png  1.73 MB
basecolor_pooja-carton.png  1.12 MB
basecolor_ritual-set.png    1.99 MB
normal_air-tin.png          2.74 MB
normal_bhimseni-jar.png     2.71 MB
normal_pooja-carton.png     4.19 MB
normal_ritual-set.png       5.67 MB
orm_air-tin.png             1.64 MB
orm_bhimseni-jar.png        1.60 MB
orm_pooja-carton.png        2.11 MB
orm_ritual-set.png          2.26 MB

VALIDATION (both GLBs re-imported into empty scenes)
4 mesh nodes with the right names, group bbox 0.2932 x 0.3003 x 0.0905 m, bottom at y=0 (glTF), centred on x/z,
12 images embedded at 2048, 0 missing. Attributes: POSITION, NORMAL, TEXCOORD_0, TEXCOORD_1, TANGENT.

DEVIATIONS / COULD NOT DO
1. BaseColor is on UV1 (the atlas), not UV0. Each node mixes several artwork images on overlapping UV0 maps
   (front, back, sides, top each fill 0-1), so one texture can only live on a non-overlapping atlas. UV0 is kept untouched
   in the mesh (exported as TEXCOORD_0) but unused by the materials.
2. Atlas resolution vs source art: the Ritual lid art is 5197 px and the tin band 5937 px; at 2048 per node they land at
   roughly 1,100-1,300 px. Lid top of the tin was given extra atlas space so the pierced grid survives, but the smallest
   holes still close up below one texel (about a third of the holes stay open as cut-outs).
3. Inner faces of the closed Ritual box (never visible) had inverted normals in the bake; those texels were set flat.
4. Non-manifold: label and cork brand are single-sided/shell decals as modelled (solidify shells), left as is.
5. AgX in Blender 5.2 has no "Medium Contrast" look; reference render uses AgX Base Contrast.
6. Both GLBs embed the same twelve 2048 textures (~30 MB as PNG). KTX2 at 1024 for mobile will cut this ~10x.
7. shunya_web-export.blend1 is Blender's automatic backup of the working copy; safe to delete.
