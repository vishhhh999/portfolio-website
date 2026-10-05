INDO THAI - AIRCRAFT GROUND-SERVICE PUSHBACK TUG + TOW BAR (slug: indo-thai)
Source: modelled from scratch (File > New > General, saved as indo-thai_web-export.blend first). No logos, text or brand names anywhere.
Nodes: tug (wedge body, offset cab with recessed windows + separate GLASS material, bumper with black/yellow hazard-stripe band, steps + side stringer, 2 grab rails, front lights, rear lights, amber beacon on cab roof, underbody plate, axles, tow coupling with clevis ears and pin), wheels (4 chunky tyres + hubs with 5 bolts each), towbar (about 1.8 m bar + eye end + tow head, sloping down to rest on the floor).
Front faces -Y (the tow bar points toward the viewer); origin = bottom centre of the whole group (tug + wheels + towbar), so the tug sits toward +Y of the origin.
Dimensions (m): tug incl. wheels and coupling 2.226 W x 4.73 L x 1.202 H (body + bumper about 4.55 L; width includes the 5 mm hub bolts); whole group incl. tow bar 2.226 W x 6.68 L x 1.202 H.
Tow bar: about 2.0 m from the coupling eye to the tow-head front (y -2.45 to -4.40 in tug space); the head's underside is at z = 0 (resting on the floor).
LOD0: 20,276 tris, 5.41 MB (indo-thai.glb)
LOD1: 10,010 tris, 2.43 MB (indo-thai.mobile.glb)
Materials: paint_yellow (roughness 0.45, safety yellow), rubber (roughness 0.8), metal_grey (underbody, metallic 0.9, roughness 0.5), GLASS (transmission 1, roughness 0.05, IOR 1.5, windows only), amber/headlight/taillight/interior baked into the tug atlas, hazard stripes (procedural, baked).
Textures (textures/): indo-thai_tug_basecolor/orm (2048), indo-thai_wheels_basecolor/orm/normal (2048; tread normal baked from a 99k-tri tread model, lugs + centre groove), indo-thai_towbar_basecolor/orm (1024). Mobile: indo-thai_*.mobile_* at 1024 (all three sets).
Ref render: indo-thai.ref.png (framed on the front width/height, tow bar toward camera).
Validation: both GLBs re-imported into the scene: scale in metres matches, origin at bottom centre, all images present, nodes tug / wheels / towbar present, occlusion wired to the ORM textures, baked textures use TEXCOORD_1 (UV1), UV0 kept as artwork mapping (hazard band UV0 is in metres).
Not done / caveats:
 - Bevels are scaled to the vehicle (2 to 10 mm) rather than the 0.5-2 mm that fits small objects.
 - Beacon and lights carry colour only (no emissive map); the site's lamps / bloom have to make the beacon glow.
 - The wedge body is a profile extrusion with boolean wheel arches; it has no panel-gap detail or decals by design.
 - The high-poly tread tyres used for the normal bake are not kept in the working .blend.
 - LOD1 wheels are decimated, so bolts and hub-cap edges are simplified.
