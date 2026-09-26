"""Inspect the imported Meshy asset and render reproducible orthographic views."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / "art/unisaurus/meshy-original.glb"
output = root / "art/unisaurus"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
report = []
for obj in meshes:
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    report.append({"name": obj.name, "vertices":len(coords), "triangles":sum(len(p.vertices)-2 for p in obj.data.polygons), "min":[min(v[i] for v in coords) for i in range(3)], "max":[max(v[i] for v in coords) for i in range(3)],"materials":[m.name for m in obj.data.materials]})
(output / "mesh-inspection.json").write_text(json.dumps(report, indent=2))
print("MESH_REPORT", json.dumps(report))
scene = bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=24
scene.render.resolution_x=720
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.world.color=(.5,.5,.5)
scene.view_settings.view_transform="Standard"
coords = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
low=Vector([min(v[i] for v in coords) for i in range(3)])
high=Vector([max(v[i] for v in coords) for i in range(3)])
center=(low+high)/2
size=max(high-low)
for location, power in [((3,-4,5),450),((-3,-2,2),250),((0,4,4),450)]:
    bpy.ops.object.light_add(type="AREA",location=Vector(location)*size)
    light=bpy.context.object
    light.data.energy=power*size*size
    light.data.shape="DISK"
    light.data.size=size*4
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
camera=bpy.context.object
scene.camera=camera
camera.data.type="ORTHO"
camera.data.ortho_scale=size*1.25
for name,direction in [("front",(0,-1,.12)),("back",(0,1,.12)),("side",(1,0,.12)),("three-quarter",(1,-1,.55))]:
    camera.location=center+Vector(direction).normalized()*size*4
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(output/f"inspect-{name}.png")
    bpy.ops.render.render(write_still=True)
