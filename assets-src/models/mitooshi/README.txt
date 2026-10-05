MITOOSHI LAPTOP - web export (slug: mitooshi)
Source: E:\Portfolio 2026\Mitooshi\4.blend (identical laptop to 1.blend; 4.blend used, it has the 10-material clean version). Working copy: mitooshi_web-export.blend
Objects included: laptop (body, keyboard, trackpad, lid shell, gasket, feet, hinge parts joined), screen (display surface only)
Removed: plinth, lights, camera, Apple logo plane, lid animation. Lid posed open ~110 degrees (20 deg back from vertical).
Dimensions (m): 0.3152 W x 0.3035 D x 0.2125 H, origin bottom centre, front -Y
LOD0: 32,884 tris, 5.48 MB (mitooshi.glb)
LOD1: 9,273 tris, 1.96 MB (mitooshi.mobile.glb)
Textures (textures/): mitooshi_basecolor.png, mitooshi_orm.png, mitooshi_normal.png (2048); mitooshi.mobile_*.png (1024). Normal map baked from the 465k-tri original (keyboard/trackpad detail).
Screen: object 'screen', material 'SCREEN' (black, roughness 0.1, no image). UV0 maps the visible display 0-1. Physical size 0.2996 x 0.1968 m, aspect 1.5224 (w/h).
Ref render: mitooshi.ref.png (screen black)
Not done / caveats:
 - Body is a joined multi-part mesh with open shells from the source CAD; ~30k non-manifold edges remain (internal faces of parts), not visible.
 - LOD1 silhouette drifts slightly (bbox 0.3204 x 0.3003 x 0.2153 vs 0.3152 x 0.3035 x 0.2125).
 - Bake used a single 2048 atlas for all parts, Smart UV Project UV1 (UV0 is the source UV where it existed).

RE-BAKE NOTE (final pass): the first bake left BaseColor/ORM empty because three metal materials in the source are node groups without a Principled node, and UV1 was badly packed. Fixed: UV1 re-unwrapped (Smart UV, 7,440 islands packed at ~2000 px/m, 0.0015 gap instead of 0.02 because of the island count), the three metals replaced by Principled (metallic 1, roughness 0.35, source greys 0.12 / 0.01 / 0.28), and base/roughness/metal/AO/normal re-baked from the original-material hi-poly copy. LOD1 vertices more than 1.5 mm off the LOD0 surface were snapped back after decimation.
Source mesh has open shells (original multi-part model), so the non-manifold/loose rule could not be met for this laptop.
ref render saved as 8-bit PNG in the repo copy.
