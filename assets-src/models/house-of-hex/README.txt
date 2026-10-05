HOUSE OF HEX PHONE ON A STAND - web export (slug: house-of-hex)
Source: E:\Portfolio 2026\House of Hex\assets\models\iphone-17-pro-ma_...\iphone-17-pro-max_2K_...blend (original asset). 3.blend inspected: it holds the same phone twice inside a scene with backdrop, rails and video/PNG screen textures, not a standalone set-up phone, so the original asset was used. Working copy: house-of-hex_web-export.blend
Nodes: phone (body + camera + separate GLASS material on the glass faces), stand (modelled: 5 mm angled back plate at 12 deg, front lip, flat foot, matte dark-grey aluminium, 0.8 mm bevel), screen (display only)
Phone leans back 12 deg; front faces -Y; origin bottom centre of the group (foot underside).
Dimensions (m): group 0.0900 W x 0.1300 D x 0.1758 H. Phone 0.0785 x 0.163 x 0.0135. Stand 0.090 x 0.130 x 0.1624.
LOD0: 22975 tris, 3.22 MB (house-of-hex.glb)
LOD1: 7196 tris, 1.22 MB (house-of-hex.mobile.glb)
Textures (textures/): house-of-hex_phone_basecolor/orm (2048), house-of-hex_stand_basecolor/orm (1024); mobile: house-of-hex_phone.mobile_* (1024), house-of-hex_stand.mobile_* (512). No normal maps: the phone's detail is geometry; the source normal was a 1024 brushed-metal jpg that did not need re-baking.
Screen: object 'screen', material 'SCREEN' (black, roughness 0.1, no image). UV0 maps the visible display (rounded-rect n-gon) 0-1 by its bounding box: 0.0730 x 0.1580 m, aspect 0.4621 (w/h), portrait. The surface sits 0.08 mm in front of the bezel glass to avoid z-fighting.
Ref render: house-of-hex.ref.png (screen black)
Not done / caveats:
 - Merge-by-distance at 0.0001 removed ~3.3k sub-0.1 mm faces from the source (30,032 -> ~22.6k tris phone), no visible change expected.
 - Camera lens glass is baked into the atlas (dark lens), only the 442-tri GLASS part uses transmission.
 - Stand foot and plate are one extruded mesh; phone and stand AO were baked separately so there is no contact shadow between them in the ORM map (the site lamps/AO should handle it).
 - Export logged a one-off 'mesh not valid' warning on the first LOD0 export; mesh.validate() found nothing to fix and the re-export was clean.
