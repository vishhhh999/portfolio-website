TOO YUMM - Achaari Cashews pouch (slug too-yumm)  |  Batch 3 repair

WHAT WAS WRONG
- UV0 mapped front AND back faces onto the same 0-1 space, so the back panel showed the front art.
- Mobile GLB shipped 2048 textures; extra flavour basecolor files sat in the folder.

WHAT CHANGED
- UV0 rebuilt: front and back are separate panels in one 2048 atlas (basecolor.png). Front panel x16-1008, back panel x1040-2032, both y16-1714 px. 16 px gutters with edge-extend padding. Back panel is not mirrored. Side faces clamp to the panel edge pixels (edge colour wraps round the sides, no front art on the sides).
- Artwork: E:\Portfolio 2026\Too Yumm\Final Textures\Front.png (610x1044, upscaled to the panel) and Back.png (2597x4446, downscaled). No art redrawn.
- Geometry, clearcoat laminate (Coat 0.3, rough 0.15), ORM and normal kept unchanged. UV1 (ORM/normal) unchanged.
- Other flavour basecolor files deleted. Old files kept as *_OLD08.

NODES: TooYumm_LOD0 (desktop), TooYumm_LOD1 (mobile)
REAL SIZE: 142.5 x 75.2 x 240 mm, origin bottom centre, front -Y
TRIANGLES: LOD0 29,479 | LOD1 7,899
FILES: too-yumm.glb 5.55 MB (2048 textures) | too-yumm.mobile.glb 1.21 MB (1024 textures)
TEXTURES: basecolor.png 2048, orm.png 2048, normal.png 2048; *_1024 copies for mobile
NON-MANIFOLD EDGES: 708 per LOD (3 boundary + 705 multi-face edges from fused seal geometry). Not closable without altering the pouch shape; kept as supplied. Normals outward, 0 zero-area faces, 1 shell.
NOTES: check sheet uses AgX Base Contrast (Blender 5.2 has no Medium Contrast look).

CORRECTION (final pass)
- The first 1024 ORM and normal mobile textures were blank. orm_1024.png and normal_1024.png are rebuilt from the 2048 maps (2x2 average, normals renormalised) and re-embedded in too-yumm.mobile.glb.
- Final file sizes: too-yumm.glb 5.55 MB, too-yumm.mobile.glb 1.76 MB.
