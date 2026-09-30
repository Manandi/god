"""Build visibly distinct customization concept meshes in Blender.

Run:
  blender -b --python tools/blender/build_customization.py

This source file is intentionally kept beside the game even though the runtime uses
bone-mounted equivalents in src/avatar.js. It gives artists a real Blender starting
point for replacing the procedural meshes with exported GLBs later.
"""
import bpy, math
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    return m
HAIR=mat('Hair',(0.08,.06,.045))
CLOTH=mat('Cloth',(.16,.31,.22))
LEATHER=mat('Leather',(.18,.13,.09))
ARMOR=mat('Armor',(.24,.3,.27))
TRIM=mat('Trim',(.48,.37,.18))

def cube(name, loc, scale, material, bevel=.04, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft edges','BEVEL');b.width=bevel;b.segments=3
    o.data.materials.append(material);return o

def uv(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material);return o

# Five hairstyles spaced across X for easy visual inspection.
for idx,name in enumerate(('short','curly','swept','tied','braid')):
    x=(idx-2)*1.25
    cube('head_'+name,(x,0,1.7),(.19,.175,.215),mat('skin_'+name,(.58,.38,.25)),.055)
    if name=='short':
        cube('hair_short',(x,-.005,1.93),(.205,.19,.07),HAIR,.045)
    elif name=='curly':
        for i in range(28):
            a=i/14*math.tau;r=.16+(i//14)*.035
            uv('curl',(x+math.cos(a)*r,math.sin(a)*r,1.91+(i%4)*.035),(.055,.055,.055),HAIR)
    elif name=='swept':
        cube('swept_crown',(x-.02,0,1.94),(.22,.19,.08),HAIR,.045,rot=(0,0,-.12))
        for i in range(5): cube('swept_lock',(x-.18+i*.08,-.18,1.86+i*.03),(.07,.055,.05),HAIR,.025,rot=(0,0,-.4+i*.07))
    elif name=='tied':
        cube('tied_cap',(x,0,1.93),(.205,.19,.065),HAIR,.04)
        uv('bun',(x,.22,1.88),(.12,.09,.11),HAIR)
        for s in (-1,1): cube('side_lock',(x+s*.17,.05,1.72),(.045,.05,.18),HAIR,.025,rot=(0,0,-s*.08))
    else:
        cube('braid_cap',(x,0,1.93),(.205,.19,.065),HAIR,.04)
        for i in range(8): uv('braid',(x+(-.018 if i%2 else .018),.2,1.77-i*.1),(.055,.05,.065),HAIR)
        cube('braid_cuff',(x,.2,1.02),(.035,.035,.06),TRIM,.015)

# Four outfit torsos, again spaced for side-by-side comparison.
for idx,name in enumerate(('ranger','warden','wanderer','sentinel')):
    x=(idx-1.5)*1.55;y=2.1
    cube('torso_'+name,(x,y,1.2),(.3,.18,.32),CLOTH,.05)
    if name=='ranger':
        cube('ranger_harness',(x,y-.19,1.22),(.055,.025,.35),LEATHER,.015,rot=(0,-.5,0))
        for s in (-1,1): cube('ranger_tail',(x+s*.13,y+.12,.75),(.11,.035,.3),CLOTH,.02,rot=(0,s*.08,0))
    elif name=='warden':
        cube('warden_plate',(x,y-.2,1.25),(.29,.05,.24),ARMOR,.025)
        for s in (-1,1): cube('pauldron',(x+s*.36,y,1.45),(.18,.21,.09),ARMOR,.04)
    elif name=='wanderer':
        cube('poncho',(x,y,1.43),(.4,.24,.12),CLOTH,.055)
        for s in (-1,1): cube('coat_panel',(x+s*.14,y+.12,.72),(.12,.04,.38),CLOTH,.025,rot=(0,s*.1,0))
    else:
        cube('sentinel_plate',(x,y-.21,1.25),(.34,.06,.27),ARMOR,.03)
        cube('sentinel_collar',(x,y,1.58),(.25,.2,.11),ARMOR,.04)
        for s in (-1,1): cube('hip_guard',(x+s*.32,y, .9),(.12,.18,.22),ARMOR,.035)

bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//customization_concepts.blend'))
print('Saved customization_concepts.blend')
