BENGAL T20 LEAGUE — folded flag + jersey swatch + match ticket (bengal-t20)
Source: modelled from scratch (bengal-t20_web-export.blend). Textures only from cropped case-study frames in E:\Portfolio 2026\Bengal T20 League\New folder; nothing redrawn.
Nodes: ['flag', 'jersey', 'ticket'] (LOD0), ['flag', 'jersey', 'ticket'] (LOD1)
Footprint 0.300 x 0.200 m, total height 0.0282 m. Origin bottom centre, front faces -Y, metres.
flag: ~0.30 x 0.20 m, ~2.0-2.3 cm thick, rounded edges (9 mm radius profile), shallow fold ridges sculpted procedurally and applied (not a cloth sim; folds are gentle, ~3 mm relief). Sheen 0.4, baked roughness.
jersey: 0.22 x 0.16 m swatch, 3 mm thick, rotated 7 deg, draped on the flag top. Knit stitch pattern baked into the normal map from a 450k-quad displaced hi-poly.
ticket: 0.18 x 0.07 m, 0.4 mm card, 2 mm rounded corners, perforation line of 24 holes 35 mm from the stub end, rotated -10 deg, rests flat on the jersey. Satin card roughness 0.5. No bevel on the 0.4 mm edge (thinner than the minimum bevel).

TEXTURE CROPS (image -> crop rectangle x0,y0,x1,y1 in px, y from top; output size):
flag: Frame 1000002260.png -> 340,0,1270,620 -> textures\bengal-t20_crop_flag.png (1536x1024, aspect 1.5)
jersey: Frame 1000002262.png -> 0,0,881,640 -> textures\bengal-t20_crop_jersey.png (1408x1024, aspect 1.375)
ticket: Frame 1000002263.png -> 370,343,1756,882 -> textures\bengal-t20_crop_ticket.png (2048x796, aspect 2.571)
Each crop is a straight rectangular crop with a resize; no perspective correction was needed.
Underside of the flag and ticket reuse the same artwork mirrored; flag sides show stretched edge pixels.

Triangles: LOD0 13,468 (flag 8,960 / jersey 3,536 / ticket 972); LOD1 4,606 (2,910 / 1,066 / 630). Budgets 20,000 / 5,000.
File sizes: bengal-t20.glb 18619880 bytes (18.62 MB); bengal-t20.mobile.glb 5469136 bytes (5.47 MB). Textures are uncompressed PNG; meshopt/KTX2 later will shrink them.
Textures LOD0 (2048): flag_basecolor/orm, jersey_basecolor/orm/normal, ticket_basecolor/orm. LOD1 (1024): bengal-t20_<part>.mobile_*.
Textures read UV1 (texCoord 1); UV0 holds the artwork mapping. ORM: R=AO, G=roughness, B=metallic; occlusion wired via glTF Material Output.
Reference renders: bengal-t20.ref.png (front, mid-height per spec: reads edge-on because the stack is flat), bengal-t20.ref-angled.png (extra, 50 deg tilt for review).
Validation: both GLBs re-imported; dimensions 0.3 x 0.2 x 0.0282 m, min z 0, no missing images, no overlaps between parts (BVH).
Not done / caveats: fold relief is subtle (reads as a folded slab); no cloth simulation; screen N/A; no animation.
