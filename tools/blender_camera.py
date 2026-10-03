"""
Rebuilds the web booth's cameras and staging in Blender, from tools/camera.json.

    Blender > Scripting > Open this file > Run Script
    (or: blender --python tools/blender_camera.py)

Creates, in a "BOOTH" collection:
  CAM_LINEUP_16x9, CAM_LINEUP_16x10   the home-page lineup shot (pick the one matching your render size)
  CAM_TRAY_<slug>                     the project-page tray shot for each object (16:9)
  PLINTH_<slug>                       risers with the site's chamfer, plus TRAY and PROP_SHELF
  EMPTY_BASE_<slug>                   where each object's base centre goes (parent your object to it)

Coordinate systems: three.js is Y-up with +Z towards the camera; Blender is Z-up
with -Y towards the camera in front view. Every point maps (x, y, z)three ->
(x, -z, y)blender. camera.json already stores both; this script reads the
"blender" values. Cameras are aimed with a TRACK_TO-equivalent rotation (look at
target, world Z up), so the horizon stays level exactly as on the site.

Lens: the site fixes the VERTICAL field of view (13.7°). Blender is set to
sensor_fit = VERTICAL with a 24 mm sensor height, which gives the same ~99.9 mm
focal length. Keep the render aspect equal to the shot's aspect (16:9 or 16:10).
Scene units: metres, unit scale 1.0 (glTF is metres too).
"""
import json
import math
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath)) if bpy.data.filepath else ''
CANDIDATES = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'camera.json') if '__file__' in globals() else '',
    os.path.join(HERE, 'camera.json'),
    os.path.join(HERE, 'tools', 'camera.json'),
]
path = next((p for p in CANDIDATES if p and os.path.exists(p)), None)
if not path:
    raise FileNotFoundError('camera.json not found next to this script or the .blend file')
with open(path) as f:
    data = json.load(f)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

coll = bpy.data.collections.get('BOOTH') or bpy.data.collections.new('BOOTH')
if coll.name not in scene.collection.children:
    scene.collection.children.link(coll)


def link(obj):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def replace(name):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)


lens = data['lens']


def make_camera(name, shot):
    replace(name)
    cam_data = bpy.data.cameras.new(name)
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.sensor_height = lens['sensorHeightMm']
    cam_data.lens = lens['focalLengthMm']
    cam_data.clip_start = lens['clipStart']
    cam_data.clip_end = lens['clipEnd']
    cam = link(bpy.data.objects.new(name, cam_data))
    loc = Vector(shot['blender']['location'])
    target = Vector(shot['blender']['target'])
    cam.location = loc
    # Blender cameras look down local -Z with local +Y up: aim -Z at the target, keep world Z up.
    cam.rotation_euler = (target - loc).to_track_quat('-Z', 'Y').to_euler()
    return cam


cams = {}
for key, shot in data['shots'].items():
    if key.startswith('LINEUP'):
        name = 'CAM_' + key.split(' ')[0]
        cams[name] = make_camera(name, shot)
for slug, shot in data['shots']['TRAY_16x9'].items():
    make_camera(f'CAM_TRAY_{slug}', shot)

scene.camera = cams.get('CAM_LINEUP_16x9') or next(iter(cams.values()))
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080


def chamfered_box(name, size_xyz, center):
    replace(name)
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size_xyz
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = obj.modifiers.new('chamfer', 'BEVEL')
    bev.width = data['plinthChamferMetres']
    bev.segments = 1
    bev.limit_method = 'ANGLE'
    return link(obj)


for p in data['plinths']:
    s = p['size']
    # three (w, h, d) → Blender (x = w, y = d, z = h)
    chamfered_box(f"PLINTH_{p['slug']}", (s['width_x'], s['depth'], s['height']), p['blender']['center'])
    replace(f"EMPTY_BASE_{p['slug']}")
    empty = link(bpy.data.objects.new(f"EMPTY_BASE_{p['slug']}", None))
    empty.empty_display_type = 'ARROWS'
    empty.empty_display_size = 0.05
    empty.location = p['blender']['objectBase']

tray = data['trayPlate']
replace('TRAY')
bpy.ops.mesh.primitive_plane_add(size=1, location=tray['blender']['center'])
t = bpy.context.active_object
t.name = 'TRAY'
t.scale = (tray['w'], tray['d'], 1)
link(t)

booth = data['booth']
shelf = data['props']['shelf']
back_y = -booth['backZ']  # three z = backZ  → Blender y = -backZ
chamfered_box('PROP_SHELF', (shelf['w'], shelf['d'], shelf['h']), (shelf['x'], back_y - shelf['d'] / 2, shelf['h'] / 2))

print(f"BOOTH: {len(cams)} lineup cameras, {len(data['shots']['TRAY_16x9'])} tray cameras, {len(data['plinths'])} plinths from {path}")
