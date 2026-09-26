"""Re-export existing editable catalogue rigs without regenerating or rendering."""
import bpy
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalogue_export import export_catalogue
ids=sys.argv[sys.argv.index('--')+1:]
for pair_id in ids:
    out=ROOT/'art/catalogue'/pair_id
    bpy.ops.wm.open_mainfile(filepath=str(out/'creature-rig.blend'))
    bpy.data.objects['CreatureRig'].animation_data.action=bpy.data.actions['Idle']
    bpy.context.scene.frame_set(1)
    runtime=ROOT/'public/assets/models'/f'{pair_id}-v1.glb'
    repaired=export_catalogue(runtime)
    report=json.loads((out/'rig-report.json').read_text())
    report.update(runtimeBytes=runtime.stat().st_size,repairedDegenerateTangents=repaired)
    (out/'rig-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('EXPORTED',pair_id,'repaired tangent corners',repaired,flush=True)
