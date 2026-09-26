"""Export a compact runtime asset, preserving the editable source textures."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/unisaurus/unisaurus-rig.blend'))
scene=bpy.context.scene
rig=bpy.data.objects['UnisaurusRig']
rig.animation_data.action=bpy.data.actions['Idle']
scene.frame_set(1)
for image in bpy.data.images:
    if image.type=='IMAGE' and image.size[0]>1024:
        image.scale(1024,1024)
        image.pack()
# glTF skinned meshes should be scene roots; preserve their world-space bind pose.
mesh=bpy.data.objects['UnisaurusMesh']
world=mesh.matrix_world.copy()
mesh.parent=None
mesh.matrix_world=world
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.context.view_layer.objects.active=mesh
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.select_all(action='DESELECT')
for name in ['Unisaurus','UnisaurusRig','UnisaurusMesh','Mouth']: bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/models/unisaurus-v1.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_anim_single_armature=True,export_skins=True,export_tangents=True,export_influence_nb=4,export_image_format='JPEG',export_jpeg_quality=85,export_image_quality=85,export_yup=True,export_extras=True)
