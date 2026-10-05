SONDE TABLET ON AN EASEL - web export (slug: sonde)
Source: E:\Portfolio 2026\Mitooshi\assets\models\ipad-pro-2024-13_...\ipad-pro-2024-13-inch-space-black_2K_...blend. sonde_hero.blend was inspected first: it contains a MacBook, an iPhone, posters, blinds and a table, but no tablet/iPad, so the iPad Pro asset was used. Working copy: sonde_web-export.blend
Nodes: tablet (iPad Pro 13in, landscape, all body parts joined), easel (modelled: two slim legs with rear feet + ledge with 5 mm front lip, matte black powder coat, 0.8 mm bevel), screen (display only)
Tablet leans back 15 deg, front faces -Y, origin bottom centre of the group.
Easel clearance: the easel sits entirely behind the tablet's back face (legs start 1 mm behind the back/camera plate) with only the ledge and 5 mm lip touching the bottom edge, 0.2 mm clearance. BVH overlap test easel vs tablet and easel vs screen: {'LOD0': {'easel_vs_tablet': 0, 'easel_vs_screen': 0}, 'LOD1': {'easel_vs_tablet': 0, 'easel_vs_screen': 0}} (0 = no intersecting triangles).
Dimensions (m): group 0.2821 W x 0.1400 D x 0.2399 H. Tablet 0.2816 x 0.2156 x 0.007 (landscape). Easel 0.270 x 0.140 x 0.1934.
LOD0: 18643 tris, 3.27 MB (sonde.glb)
LOD1: 7311 tris, 1.29 MB (sonde.mobile.glb)
Textures (textures/): sonde_tablet_basecolor/orm (2048), sonde_easel_basecolor/orm (1024); mobile: sonde_tablet.mobile_* (1024), sonde_easel.mobile_* (512). No normal maps (detail is geometry).
Screen: object 'screen', material 'SCREEN' (black, roughness 0.1, no image). UV0 maps the visible display 0-1 in landscape orientation (u to the right, v up). Physical size 0.2648 x 0.1987 m, aspect 1.3327 (w/h). Sits 0.05 mm in front of the bezel plane.
Ref render: sonde.ref.png (screen black)
Not done / caveats:
 - The source body material was a procedural brushed-metal node group; it was replaced by a plain Principled with the same base colour (0.135 / 0.092), metallic 1, roughness 0.4, so the brushing/bump micro-texture is not carried over.
 - The Apple logo plane and the 'Text' shrinkwrap object from the source were dropped (as for the Mitooshi laptop). The tiny 1-face lens glass (Material.004, transmission 0.2) was baked opaque; no real glass part remains, so no glass material is exported.
 - The first LOD0 export logged a 'mesh not valid' warning; the re-export is clean.
