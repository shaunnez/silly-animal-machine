"""Rebuild Unisaurus' reviewed rig and six reusable clips from its immutable Meshy GLB.

Landmarks and skin masks are specific to this mesh, not a universal auto-rigger.
Run with Blender 5.2 in background mode. Outputs editable source, runtime GLB,
inspection frames and a deformation report without changing the Meshy source.
"""
import bpy
import json
import hashlib
import math
from pathlib import Path
from mathutils import Vector
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from creature_clips import build_clips, CLIP_SECONDS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art/unisaurus"
RUNTIME = ROOT / "public/assets/models/unisaurus-v1.glb"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
source = OUT / "meshy-original.glb"
assert hashlib.sha256(source.read_bytes()).hexdigest() == "384aaec4ec860bbec9cfec659de68e346774b688fcf49ef306e8049708bdafe8", "Source geometry changed; inspect and refit the rig before rebuilding"
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assert len(meshes) == 1, "Inspect changed Meshy geometry before rebuilding this rig"
mesh = meshes[0]
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.name = "UnisaurusMesh"
# Keep original coordinates for explicit skin masks; normalize the finished asset below.
landmarks = {
    "Root": ((0,0,-.33594),(0,0,-.24),None),
    "Pelvis": ((0,0,-.21),(0,0,-.10),"Root"),
    "Spine": ((0,-.01,-.15),(0,-.24,-.015),"Pelvis"),
    "Head": ((0,-.24,-.005),(0,-.27,.20),"Spine"),
    "Arm_L": ((.10,-.235,-.06),(.16,-.34,-.145),"Spine"),
    "Arm_R": ((-.10,-.235,-.06),(-.16,-.34,-.145),"Spine"),
    "Leg_L": ((.125,.005,-.16),(.135,-.035,-.32),"Pelvis"),
    "Leg_R": ((-.125,.005,-.16),(-.135,-.035,-.32),"Pelvis"),
    "Foot_L": ((.135,-.035,-.285),(.135,-.12,-.315),"Leg_L"),
    "Foot_R": ((-.135,-.035,-.285),(-.135,-.12,-.315),"Leg_R"),
    "Jaw": ((0,-.36,.087),(0,-.46,.087),"Head"),
    "Eye_L": ((.071,-.38,.146),(.071,-.38,.186),"Head"),
    "Eye_R": ((-.066,-.38,.152),(-.066,-.38,.192),"Head"),
    "Tail": ((0,.07,-.13),(0,.28,-.015),"Pelvis"),
    "TailTip": ((0,.28,-.015),(0,.46,.065),"Tail"),
}
armature = bpy.data.armatures.new("UnisaurusSkeleton")
rig = bpy.data.objects.new("UnisaurusRig",armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name,(head,tail,parent) in landmarks.items():
    bone=armature.edit_bones.new(name)
    bone.head=head;bone.tail=tail
    if parent: bone.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
rig.show_in_front=True
armature.display_type="STICK"
for name in landmarks: mesh.vertex_groups.new(name=name)

def smooth(low,high,value):
    t=max(0,min(1,(value-low)/(high-low)))
    return t*t*(3-2*t)

def skin(co):
    x,y,z=co
    tail=smooth(.055,.19,y)
    head=smooth(-.025,.065,z)*(1-tail)
    arm=smooth(.075,.135,abs(x))*smooth(.205,.28,-y)*smooth(-.225,-.17,z)*(1-smooth(-.04,.03,z))*(1-tail)*(1-head)
    leg=smooth(.015,.055,abs(x))*(1-smooth(-.23,-.09,z))*smooth(-.28,-.22,y)*(1-tail)*(1-head)*(1-arm)
    # Priority masks prevent head and tail vertices bleeding into the limbs.
    weights={"Head":head,"Tail":tail*(1-smooth(.25,.37,y)),"TailTip":tail*smooth(.25,.37,y),"Arm_L" if x>=0 else "Arm_R":arm,"Leg_L" if x>=0 else "Leg_R":leg}
    foot = 1-smooth(-.315,-.24,z)
    leg_name = "Leg_L" if x>=0 else "Leg_R"
    weights["Foot_L" if x>=0 else "Foot_R"] = weights[leg_name]*foot
    weights[leg_name] *= 1-foot
    # Separate soft masks for the lower jaw and two eyes, fitted to source coordinates.
    jaw = (1-smooth(.071,.102,z))*smooth(.345,.41,-y)*(1-smooth(.055,.10,abs(x)))*smooth(.005,.035,z)
    eye_x, eye_z = (.071,.146) if x>=0 else (-.066,.152)
    eye_radius = ((x-eye_x)/.048)**2 + ((z-eye_z)/.050)**2
    eye = (1-smooth(.55,1.5,eye_radius))*smooth(.30,.35,-y)
    weights["Jaw"] = head*jaw
    weights["Eye_L" if x>=0 else "Eye_R"] = head*(1-jaw)*eye
    weights["Head"] = head*(1-jaw)*(1-eye)
    assigned=sum(weights.values())
    if assigned>1: weights={k:v/assigned for k,v in weights.items()}; assigned=1
    spine=smooth(-.19,-.06,z)
    weights["Spine"]=(1-assigned)*spine
    weights["Pelvis"]=(1-assigned)*(1-spine)
    selected=sorted(((k,v) for k,v in weights.items() if v>.0001),key=lambda kv:kv[1],reverse=True)[:4]
    total=sum(v for _,v in selected)
    return {k:v/total for k,v in selected}

for vertex in mesh.data.vertices:
    for name,weight in skin(vertex.co).items(): mesh.vertex_groups[name].add([vertex.index],weight,"REPLACE")
modifier=mesh.modifiers.new("CreatureSkin","ARMATURE")
modifier.object=rig
mesh.parent=rig
# A real exported attachment follows the head, with a known forward direction (-Y in Blender).
mouth=bpy.data.objects.new("Mouth",None)
bpy.context.collection.objects.link(mouth)
mouth.location=(0,-.489,.083)
world=mouth.matrix_world.copy()
bpy.context.view_layer.update()
world=mouth.matrix_world.copy()
mouth.parent=rig;mouth.parent_type="BONE";mouth.parent_bone="Head"
bpy.context.view_layer.update()
mouth.matrix_world=world
# Asset-wide transform: preserve the rig/mesh relationship and put feet at z=0.
container=bpy.data.objects.new("Unisaurus",None)
bpy.context.collection.objects.link(container)
rig.parent=container
container.scale=(3.8,3.8,3.8)
container.location.z=.33594*3.8
scene=bpy.context.scene
scene.render.fps=30
scene.frame_start=1
scene.frame_end=97
rig.animation_data_create()

clips=build_clips(rig)
# Ground the lowest foot in the walk cycle after skinning. The translation lives
# on Root, so fitted creatures can perform the same step without hovering.
rig.animation_data.action=bpy.data.actions['Walk']
for frame in range(1,38):
    scene.frame_set(frame)
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    lowest=min(vertex.co.z for vertex in evaluated.data.vertices)
    root_bone=rig.pose.bones['Root']
    root_bone.location.y += -.335938-lowest
    root_bone.keyframe_insert(data_path='location',frame=frame,group='Root')
# Keep source actions editable, and make every action available to glTF export.
rig.animation_data.action=clips[0]
scene.frame_set(1)
bpy.context.view_layer.update()
# Runtime textures embedded as JPEG; PBR maps stay in their proper color spaces.
for image in bpy.data.images:
    if image.size[0]>2048 or image.size[1]>2048: image.scale(2048,2048)
    if image.source=="FILE": image.pack()
RUNTIME.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in [container,rig,mesh,mouth]: obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(RUNTIME),export_format="GLB",use_selection=True,export_animations=True,export_animation_mode="ACTIONS",export_force_sampling=True,export_frame_range=False,export_anim_single_armature=True,export_skins=True,export_tangents=True,export_influence_nb=4,export_image_format="JPEG",export_jpeg_quality=90,export_yup=True,export_extras=True)
# Validate weights and record deformation extents for each animation.
report={"source":"meshy-original.glb","bones":list(landmarks),"clips":[],"vertices":len(mesh.data.vertices),"triangles":sum(len(p.vertices)-2 for p in mesh.data.polygons),"unweighted_vertices":0,"weight_sum_max_error":0}
for vertex in mesh.data.vertices:
    weights=[g.weight for g in vertex.groups]
    if not weights: report["unweighted_vertices"]+=1
    report["weight_sum_max_error"]=max(report["weight_sum_max_error"],abs(sum(weights)-1))
for action in clips:
    rig.animation_data.action=action
    extent=[]
    for frame in sorted(set(round(1+i*(action.frame_end-1)/8) for i in range(9))):
        scene.frame_set(frame)
        deps=bpy.context.evaluated_depsgraph_get()
        evaluated=mesh.evaluated_get(deps)
        coords=[evaluated.matrix_world@v.co for v in evaluated.data.vertices]
        extent.append({"frame":frame,"min":[min(v[i] for v in coords) for i in range(3)],"max":[max(v[i] for v in coords) for i in range(3)]})
    report["clips"].append({"name":action.name,"duration_seconds":CLIP_SECONDS[action.name],"samples":extent})
(OUT/"rig-report.json").write_text(json.dumps(report,indent=2))
# Source includes a lighting/camera setup for reviewing deformation.
scene.render.engine="CYCLES";scene.cycles.samples=12
scene.render.resolution_x=840;scene.render.resolution_y=840;scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35)
scene.view_settings.view_transform="AgX"
center=Vector((0,0,1.35))
for location,power in [((4,-5,7),650),((-4,-3,3),350),((0,5,6),800)]:
    bpy.ops.object.light_add(type="AREA",location=location)
    light=bpy.context.object;light.name="ReviewLight";light.data.energy=power;light.data.shape="DISK";light.data.size=5
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,-7,4))
camera=bpy.context.object;camera.name="ReviewCamera";scene.camera=camera
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type="ORTHO";camera.data.ortho_scale=4.4
for action in clips:
    rig.animation_data.action=action
    scene.frame_set(round(1 + (action.frame_end-1)*.375))
    scene.render.filepath=str(OUT/f"rig-{action.name.lower()}.png")
    bpy.ops.render.render(write_still=True)
# Close-up blink and bite evidence at exact keyed moments.
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(97)
scene.render.filepath=str(OUT/'rig-blink.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Eat'];scene.frame_set(31)
scene.render.filepath=str(OUT/'rig-bite.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=clips[0];scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"unisaurus-rig.blend"))
print("RIG_COMPLETE",json.dumps({"glb":str(RUNTIME),"blend":str(OUT/"unisaurus-rig.blend"),"clips":[a.name for a in clips]}))
