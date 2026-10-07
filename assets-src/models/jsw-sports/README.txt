JSW SPORTS - Haryana Steelers book (slug jsw-sports)  |  Batch 3 repair

WHAT WAS WRONG
- hs_sleeve.png (a 104x1298 sleeve strip) was baked onto the spine outside face.
- Cover edges carried the cover's edge pixels (yellow / navy border art) and the spine's inner and thin faces carried artwork, so in the open view art showed at the hinge and along the board edges from the tray angle and from 30 deg left/right.
- UV0 and UV1 were not separated cleanly (UV1 atlas doubled as the artwork map).

WHAT CHANGED
- hs_sleeve.png removed completely (no file, no node, no bake).
- Spine treatment: the cover is NOT a wrap (hs_front_cover.png and hs_back_cover.png are two separate images), so the spine outside face is the DOMINANT EDGE COLOUR of the front cover's spine-side edge: flat sRGB (0.894, 0.710, 0.078) = #E4B514 yellow. Nothing is stretched or redrawn.
- New atlas, 2048 (mobile 1024). UV0 = artwork: one island per face, 16 px edge-extend padding:
  front cover outside = hs_front_cover.png (992x770 px)
  back cover outside  = hs_back_cover.png (992x770 px)
  spread left half (pages_front) and right half (pages_back) = spread_1.png split at the gutter (992x770 px each)
  endpaper (board insides, board edges, bevels, spine inner/thin faces) = plain #EEEAE2
  page block hidden faces and page-block edges = plain #EDE8DC
  spine outside = flat #E4B514
- UV1 = AO/ORM map, 31 islands, margin 0.02 (checked: no islands closer than 0.01). AO baked (Cycles 128 spp) in the OPEN pose (frame 30). ORM: R = AO, G = roughness (cover outside 0.45, spread 0.8, endpaper 0.85, page edges 0.9), B = metallic 0. No normal map.
- Geometry, node names, sizes, hierarchy and the animation were not touched. Action 'open' unchanged: frame 1 closed, frame 30 open 110 deg, on front_cover (pages_front is its child). Present in both GLBs (frame range 1-30).
- Open view (frames 20-30): from the tray angle (about 42 deg above, straight on) and from 30 deg left and right only spread pages, plain endpaper and page-block edges are visible (see jsw-sports.check-open-angles.png). The only other surface that shows is the flat yellow spine outside, as a 3 mm sliver at 30 deg left; it carries no art and is physical (the spine slab sits at the hinge).
- Board edges are now plain endpaper colour instead of cover-edge pixels (that is what removed the art from the board rims in the open view). In the closed pose this shows as a thin pale rim around each cover. To bring the old look back, repoint the 'end' island of UV0 for the board edge faces.

NODES: back_cover, front_cover (animated), pages_front (child of front_cover), pages_back, spine
REAL SIZE (closed): 359 x 27 x 275 mm. Origin bottom centre of the closed book, front cover faces -Y (Blender) / +Z (glTF).
TRIANGLES: LOD0 1,948 (back_cover 444, front_cover 444, pages_back 380, pages_front 380, spine 300) | LOD1 974 (Decimate collapse 0.5, 1024 textures)
FILES: jsw-sports.glb 5.37 MB | jsw-sports.mobile.glb 1.65 MB (PNG textures, images Automatic; the later meshopt/KTX2 pass will shrink both)
TEXTURES: textures\jsw-sports_basecolor.png 2048, jsw-sports_orm.png 2048, jsw-sports.mobile_basecolor.png 1024, jsw-sports.mobile_orm.png 1024
NON-MANIFOLD EDGES: 0 on every part (all closed solids, 0 loose, 0 zero-area, normals outward).
RENDERS: jsw-sports.check-sheet.png (frame 30, 8 views in 4x2, plus one row at frame 1: front, back, left, right), jsw-sports.check-open-angles.png (frame 30 from tray, 30 deg left, 30 deg right, low left), jsw-sports.ref.png (frame 1), jsw-sports.ref-open.png (frame 30, tray angle). AgX Base Contrast (no Medium Contrast in Blender 5.2).

NOTES
- Only spread_1.png is baked; spread_2-4 are not used.
- Spread halves fill the page faces edge to edge (face ratio 1.315 vs art 1.289, about 2% horizontal stretch).
- Resolution: covers and spreads are at about 59% of source width (992 px of 1673).
- Gold foil: none (no foil mask exists).
