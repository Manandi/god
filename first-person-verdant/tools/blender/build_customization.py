"""Export five hairstyles and four outfits as a runtime GLB.

Run: blender -b --python first-person-verdant/tools/blender/build_customization.py
Outfit child names start with the humanoid bone they attach to, then ``__``.
"""
import bpy, math, os, sys
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name,default): return ARGS[ARGS.index(name)+1] if name in ARGS else default
HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.abspath(arg('--out',os.path.join(HERE,'../../public/characters/customization/customization.glb')))
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name,color,metal=0,rough=.8):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.metallic=metal;m.roughness=rough;return m
HAIR=material('Customization_Hair',(.06,.075,.065),0,.95);CLOTH=material('Customization_Cloth',(.12,.28,.19),0,1)
DARK=material('Customization_DarkCloth',(.07,.16,.12),0,1);LEATHER=material('Customization_Leather',(.20,.15,.10),0,.92)
ARMOR=material('Customization_Armor',(.25,.31,.28),.18,.68);TRIM=material('Customization_Trim',(.55,.42,.20),.08,.72)
def empty(name):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def cube(parent,name,loc,scale,mat,bevel=.025,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Soft_block_edges','BEVEL');b.width=bevel;b.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
    o.data.materials.append(mat);o.parent=parent;return o
def orb(parent,name,loc,scale,mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);o.parent=parent;return o

g=empty('Hair_short');cube(g,'Short_Crown',(0,.18,.02),(.205,.06,.19),HAIR,.04);cube(g,'Short_Fringe',(0,.11,-.17),(.17,.038,.045),HAIR,.018)
g=empty('Hair_curly')
for i in range(38):
    ring=i%19;a=ring/19*math.tau;r=.13+(.035 if i>=19 else 0);y=.15+(i%5)*.026;orb(g,f'Curl_{i:02}',(math.cos(a)*r,y,math.sin(a)*r),(.052,.046,.052),HAIR)
for i in range(9):orb(g,f'CrownCurl_{i}',((i%3-1)*.09,.27+(i//3)*.035,(i%2-.5)*.08),(.055,.05,.055),HAIR)
g=empty('Hair_swept');cube(g,'Swept_Crown',(-.015,.19,.02),(.215,.075,.19),HAIR,.04,rot=(0,0,-.08))
for i in range(5):cube(g,f'Swept_Lock_{i}',(-.16+i*.075,.13+i*.025,-.17),(.065,.04,.06),HAIR,.022,rot=(0,0,-.38+i*.06))
cube(g,'Swept_Side',(-.18,.08,.035),(.05,.125,.15),HAIR,.028,rot=(0,0,-.08))
g=empty('Hair_tied');cube(g,'Tied_Crown',(0,.18,.02),(.205,.06,.19),HAIR,.04)
for s,n in ((-1,'L'),(1,'R')):cube(g,f'Tied_Side_{n}',(s*.16,.035,.08),(.048,.16,.05),HAIR,.025,rot=(0,0,-s*.08))
orb(g,'Tied_Bun',(0,.13,.20),(.105,.095,.084),HAIR)
g=empty('Hair_braid');cube(g,'Braid_Crown',(0,.18,.02),(.205,.06,.19),HAIR,.04);cube(g,'Braid_Nape',(0,.06,.18),(.05,.1,.045),HAIR,.02)
for i in range(7):orb(g,f'Braid_Link_{i}',((-.018 if i%2 else .018),-.04-i*.09,.19),(.048-i*.0025,.062-i*.003,.045-i*.0025),HAIR)
cube(g,'Braid_Cuff',(0,-.64,.19),(.028,.065,.028),TRIM,.012)

def outfit(name):return empty('Outfit_'+name)
g=outfit('ranger');cube(g,'Chest__Scarf',(0,.23,.02),(.335,.06,.21),DARK,.035);cube(g,'Spine__Harness',(.03,.22,-.19),(.045,.275,.02),LEATHER,.012,rot=(0,0,-.55))
for s,n in ((-1,'L'),(1,'R')):cube(g,f'Hips__Cape_{n}',(s*.13,-.12,.17),(.11,.24,.028),DARK,.018,rot=(0,0,s*.08))
g=outfit('warden');cube(g,'Chest__Plate',(0,.08,-.20),(.29,.19,.04),ARMOR,.025);cube(g,'Spine__Belt',(0,.02,0),(.23,.06,.195),TRIM,.025)
for s,n in ((-1,'Left'),(1,'Right')):cube(g,f'{n}Shoulder__Pauldron',(s*.11,-.02,0),(.17,.08,.20),ARMOR,.038,rot=(0,0,-s*.12))
g=outfit('wanderer');cube(g,'Chest__Poncho',(0,.17,.015),(.39,.09,.24),CLOTH,.045);cube(g,'Neck__Cowl',(0,-.01,.01),(.23,.08,.20),LEATHER,.035)
for s,n in ((-1,'L'),(1,'R')):cube(g,f'Hips__Coat_{n}',(s*.14,-.19,.17),(.125,.31,.04),CLOTH,.022,rot=(0,0,s*.12))
g=outfit('sentinel');cube(g,'Chest__Breastplate',(0,.08,-.21),(.35,.21,.05),ARMOR,.028);cube(g,'Neck__HighCollar',(0,-.02,.03),(.24,.10,.20),ARMOR,.038)
for s,n in ((-1,'Left'),(1,'Right')):
    cube(g,f'Hips__Guard_{n}',(s*.25,.02,0),(.10,.19,.18),ARMOR,.03);cube(g,f'{n}ForeArm__Bracer',(s*.02,-.12,0),(.14,.17,.15),ARMOR,.03)

os.makedirs(os.path.dirname(OUT),exist_ok=True);bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_texcoords=False,export_cameras=False,export_lights=False,export_animations=False)
print('EXPORTED',OUT,os.path.getsize(OUT)//1024,'KB')

