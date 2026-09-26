"""Add grounded side-rest clips to copies; original source and runtime stay intact."""
import bpy
import json
import math
import sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalogue_export import export_catalogue
manifest = json.loads((ROOT / 'public/assets/models/creatures.json').read_text())
for key, entry in manifest.items():
    pair = Path(entry['url']).stem.removesuffix('-v1')
    if '--' in sys.argv and pair not in sys.argv[sys.argv.index('--')+1:]: continue
    is_uni = pair == 'unisaurus'
    folder = ROOT / ('art/unisaurus' if is_uni else 'art/catalogue/' + pair)
    bpy.ops.wm.open_mainfile(filepath=str(folder / ('unisaurus-rig.blend' if is_uni else 'creature-rig.blend')))
    rig = bpy.data.objects['UnisaurusRig' if is_uni else 'CreatureRig']
    mesh = bpy.data.objects['UnisaurusMesh' if is_uni else 'CreatureMesh']
    scene = bpy.context.scene
    rig.animation_data.action = bpy.data.actions['Idle']
    scene.frame_set(1)
    rest = {b.name: (b.rotation_euler.copy(), b.location.copy(), b.scale.copy()) for b in rig.pose.bones}
    action = bpy.data.actions.new('Sleep')
    action.use_fake_user = True
    rig.animation_data.action = action
    for frame in range(1,512,3):
        t = (frame-1)/30
        amount = min(1, t/1.5) if t < 14 else max(0, 1-(t-14)/3)
        amount = amount*amount*(3-2*amount)
        for b in rig.pose.bones:
            rotation, location, scale = rest[b.name]
            b.rotation_mode='XYZ'
            b.rotation_euler=rotation; b.location=location; b.scale=scale
        rig.pose.bones['Root'].rotation_euler.z = 1.48 * amount
        rig.pose.bones['Leg_L'].rotation_euler.x = .18 * amount
        rig.pose.bones['Leg_R'].rotation_euler.x = .22 * amount
        rig.pose.bones['Head'].rotation_euler.z += -.10 * amount
        rig.pose.bones['Spine'].scale.y *= 1 + .006 * math.sin(t*2) * amount
        for b in rig.pose.bones:
            for channel in ['rotation_euler','location','scale']:
                b.keyframe_insert(data_path=channel,frame=frame,group=b.name)
        scene.frame_set(frame)
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        floor=min((evaluated.matrix_world @ v.co).z for v in evaluated.data.vertices)
        correction = (rig.matrix_world.to_3x3() @ rig.data.bones['Root'].matrix_local.to_3x3()).inverted() @ Vector((0,0,-floor))
        rig.pose.bones['Root'].location += correction
        rig.pose.bones['Root'].keyframe_insert(data_path='location',frame=frame,group='Root')
    action.use_frame_range=True; action.frame_start=1; action.frame_end=511
    rig.animation_data.action=bpy.data.actions['Idle']; scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/'world-rig.blend'))
    runtime=ROOT/'public/assets/models'/f'{pair}-world.glb'
    if is_uni:
        world=mesh.matrix_world.copy(); mesh.parent=None; mesh.matrix_world=world
        bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active=mesh
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        mesh.name='CreatureMesh'; rig.name='CreatureRig'
    export_catalogue(runtime)
    print('WORLD_EXPORTED',pair,flush=True)
print('WORLD_COMPLETE',flush=True)
