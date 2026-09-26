"""Compact catalogue export, including valid tangents at degenerate UV corners."""
import bpy
import json
import math
import struct
from pathlib import Path

def export_catalogue(runtime: Path) -> int:
    for image in bpy.data.images:
        if image.type == 'IMAGE' and image.size[0] > 1024:
            image.scale(1024,1024)
            image.pack()
    bpy.ops.object.select_all(action='DESELECT')
    for name in ['CreatureMesh','CreatureRig','Mouth']:
        bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active=bpy.data.objects['CreatureRig']
    bpy.ops.export_scene.gltf(filepath=str(runtime),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
        export_frame_range=False,export_anim_single_armature=True,export_skins=True,
        export_tangents=True,export_influence_nb=4,export_image_format='JPEG',
        export_jpeg_quality=85,export_image_quality=85,export_yup=True)
    data=bytearray(runtime.read_bytes())
    json_length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_length])
    binary_start=20+json_length+8
    repaired=0
    visited=set()
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            index=primitive['attributes'].get('TANGENT')
            if index is None or index in visited: continue
            visited.add(index)
            tangent=doc['accessors'][index]
            normal=doc['accessors'][primitive['attributes']['NORMAL']]
            tv=doc['bufferViews'][tangent['bufferView']]
            nv=doc['bufferViews'][normal['bufferView']]
            assert tangent['componentType']==normal['componentType']==5126
            for i in range(tangent['count']):
                offset=binary_start+tv.get('byteOffset',0)+tangent.get('byteOffset',0)+i*tv.get('byteStride',16)
                x,y,z,w=struct.unpack_from('<4f',data,offset)
                if x*x+y*y+z*z > .000001: continue
                no=binary_start+nv.get('byteOffset',0)+normal.get('byteOffset',0)+i*nv.get('byteStride',12)
                nx,ny,nz=struct.unpack_from('<3f',data,no)
                # A UV-degenerate corner has no unique tangent: pick a stable
                # perpendicular direction. All normal, UV and geometry data stay intact.
                tx,ty,tz=(0,nz,-ny) if abs(nx)<.9 else (-nz,0,nx)
                length=math.sqrt(tx*tx+ty*ty+tz*tz)
                assert length>0
                struct.pack_into('<4f',data,offset,tx/length,ty/length,tz/length,-1 if w<0 else 1)
                repaired+=1
    if repaired: runtime.write_bytes(data)
    return repaired
