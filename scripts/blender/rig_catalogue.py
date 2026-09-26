"""Fit the curated upright catalogue; preserve immutable Meshy geometry and editable rigs.

Per-model landmarks in fitting.json are normalized to source height. This is a
bounded template for these reviewed biped references, not a general auto-rigger.
"""
import bpy
import json
import hashlib
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from creature_clips import build_clips
from catalogue_export import export_catalogue

pair_id = sys.argv[sys.argv.index('--') + 1]
OUT = ROOT / 'art/catalogue' / pair_id
receipt = json.loads((OUT / 'receipt.json').read_text())
source = OUT / 'meshy-original.glb'
assert hashlib.sha256(source.read_bytes()).hexdigest() == receipt['sha256']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
mesh = bpy.context.object
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.name = 'CreatureMesh'
low = min(v.co.z for v in mesh.data.vertices)
height = max(v.co.z for v in mesh.data.vertices) - low
for v in mesh.data.vertices:
    v.co /= height
    v.co.z -= low / height
# Meshy's origin stays at the body center, independent of an asymmetric tail.
fit_path = OUT / 'fitting.json'
fit = json.loads(fit_path.read_text()) if fit_path.exists() else {
    'neck': .56, 'hip': .25, 'shoulder': .49, 'arm_x': .15,
    'hand_x': .26, 'hand_z': .34, 'leg_x': .095, 'ankle': .07,
    'eye_x': .09, 'eye_z': .74, 'eye_y': -.13, 'eye_radius': .052,
    'mouth_z': .665, 'mouth_y': -.19, 'jaw_y': -.125,
    'body_back': .12, 'tail_start': .17, 'tail_end': .34,
}
fit_path.write_text(json.dumps(fit, indent=2) + '\n')
f = fit
landmarks = {
    'Root': ((0,0,0),(0,0,.10),None),
    'Pelvis': ((0,0,f['hip']),(0,0,f['hip']+.10),'Root'),
    'Spine': ((0,0,f['hip']+.06),(0,0,f['neck']),'Pelvis'),
    'Head': ((0,0,f['neck']),(0,0,f['eye_z']+.08),'Spine'),
    'Jaw': ((0,f['jaw_y'],f['mouth_z']),(0,f['jaw_y']-.10,f['mouth_z']),'Head'),
    'Tail': ((0,f['body_back'],f['hip']),(0,f['tail_start']+.1,f['hip']+.03),'Pelvis'),
    'TailTip': ((0,f['tail_start']+.1,f['hip']+.03),(0,f['tail_end']+.1,f['hip']+.12),'Tail'),
}
for side, sign in [('L',1),('R',-1)]:
    landmarks['Arm_'+side] = ((sign*f['arm_x'],0,f['shoulder']),(sign*f['hand_x'],-.02,f['hand_z']),'Spine')
    landmarks['Leg_'+side] = ((sign*f['leg_x'],0,f['hip']),(sign*f['leg_x'],0,f['ankle']),'Pelvis')
    landmarks['Foot_'+side] = ((sign*f['leg_x'],0,f['ankle']),(sign*f['leg_x'],-.10,.025),'Leg_'+side)
    landmarks['Eye_'+side] = ((sign*f['eye_x'],f['eye_y'],f['eye_z']),(sign*f['eye_x'],f['eye_y'],f['eye_z']+.04),'Head')
armature = bpy.data.armatures.new('CreatureSkeleton')
rig = bpy.data.objects.new('CreatureRig', armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, (head, tail, parent) in landmarks.items():
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = head, tail
    if parent: bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for name in landmarks: mesh.vertex_groups.new(name=name)

def smooth(a: float, b: float, x: float) -> float:
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)

for vertex in mesh.data.vertices:
    x,y,z = vertex.co
    side = 'L' if x >= 0 else 'R'
    head = smooth(f['neck']-.035, f['neck']+.035, z)
    tail = smooth(f['body_back'], f['tail_start'], y) * (1-head)
    reach = max(0, min(1, (f['shoulder']-z)/(f['shoulder']-f['hand_z'])))
    arm_boundary = f['arm_x'] + (f['hand_x']-f['arm_x'])*reach - .035
    arm = smooth(arm_boundary-.015, arm_boundary+.045, abs(x)) * smooth(f['hand_z']-.035, f['hand_z'], z) * (1-head) * (1-tail)
    leg = (1-smooth(f['hip']-.03, f['hip']+.055,z)) * (1-tail) * (1-arm) * (1-head)
    foot = 1-smooth(f['ankle']-.025,f['ankle']+.055,z)
    eye_r = ((abs(x)-f['eye_x'])/f['eye_radius'])**2 + ((z-f['eye_z'])/f['eye_radius'])**2
    eye = (1-smooth(.45,1.3,eye_r)) * (1-smooth(f['eye_y']+.01,f['eye_y']+.055,y))
    jaw = (1-smooth(f['mouth_z']-.012,f['mouth_z']+.012,z)) * smooth(f['mouth_z']-.09,f['mouth_z']-.035,z) * (1-smooth(.055,.11,abs(x))) * (1-smooth(f['jaw_y']-.015,f['jaw_y']+.035,y))
    weights = {'Head': head*(1-eye)*(1-jaw), 'Eye_'+side: head*eye*(1-jaw), 'Jaw':head*jaw,
        'Tail':tail*(1-smooth(f['tail_start']+.04,f['tail_end'],y)), 'TailTip':tail*smooth(f['tail_start']+.04,f['tail_end'],y),
        'Arm_'+side:arm, 'Leg_'+side:leg*(1-foot), 'Foot_'+side:leg*foot}
    remaining = max(0,1-sum(weights.values()))
    spine = smooth(f['hip'],f['neck']-.04,z)
    weights['Spine'], weights['Pelvis'] = remaining*spine, remaining*(1-spine)
    weights = sorted([(n,w) for n,w in weights.items() if w>.00001], key=lambda nw:nw[1], reverse=True)[:4]
    total = sum(w for _,w in weights)
    assert total > 0
    for name, weight in weights: mesh.vertex_groups[name].add([vertex.index],weight/total,'REPLACE')
modifier = mesh.modifiers.new('CreatureSkin','ARMATURE')
modifier.object = rig
# Mesh stays at scene root for correct glTF skin binding.
mouth = bpy.data.objects.new('Mouth',None)
bpy.context.collection.objects.link(mouth)
mouth.location = (0,f['mouth_y'],f['mouth_z'])
bpy.context.view_layer.update()
world = mouth.matrix_world.copy()
mouth.parent = rig
mouth.parent_type = 'BONE'
mouth.parent_bone = 'Head'
bpy.context.view_layer.update()
mouth.matrix_world = world
scene = bpy.context.scene
scene.render.fps = 30
rig.animation_data_create()
clips = build_clips(rig, closed_jaw=0, motion_scale=.65, jaw_motion=.08)
# Keep the source's closed-mouth bind pose. Lower jaw motion is a soft expression,
# not a newly cut mouth cavity. Each face must still be checked in the renders.
rig.animation_data.action = bpy.data.actions['Walk']
for frame in range(1,38):
    scene.frame_set(frame)
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    floor = min(v.co.z for v in evaluated.data.vertices)
    rig.pose.bones['Root'].location.y -= floor
    rig.pose.bones['Root'].keyframe_insert(data_path='location', frame=frame, group='Root')
rig.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(1)
for image in bpy.data.images:
    if image.source == 'FILE': image.pack()
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.render.resolution_x = 480
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.world.color = (.35,.35,.35)
scene.view_settings.view_transform = 'AgX'
center = Vector((0,0,.5))
for loc,power in [((2,-3,4),95),((-2,-2,2),65),((0,3,3),110)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object
    light.data.energy=power
    light.data.size=3
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1.3,-3,1.1))
camera=bpy.context.object
scene.camera=camera
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=1.25
for name,frame in [('Idle',1),('Walk',10),('Eat',19),('Play',15),('Magic',49),('Celebrate',25)]:
    rig.animation_data.action=bpy.data.actions[name]
    scene.frame_set(frame)
    scene.render.filepath=str(OUT/f'rig-{name.lower()}.png')
    bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle']
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'creature-rig.blend'))
runtime=ROOT/'public/assets/models'/f'{pair_id}-v1.glb'
repaired_tangents=export_catalogue(runtime)
report={'id':pair_id,'sourceSha256':receipt['sha256'],'bones':list(landmarks),'clips':[a.name for a in clips],
    'vertices':len(mesh.data.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),
    'weightSumMaxError':max(abs(sum(g.weight for g in v.groups)-1) for v in mesh.data.vertices),
    'runtimeBytes':runtime.stat().st_size,'repairedDegenerateTangents':repaired_tangents,'status':'rigged-awaiting-visual-review'}
(OUT/'rig-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('RIG_COMPLETE',json.dumps(report))
