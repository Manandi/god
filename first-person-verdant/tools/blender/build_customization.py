"""Export five hairstyles and four outfits as a runtime GLB.

Run: blender -b --python first-person-verdant/tools/blender/build_customization.py
Outfit child names start with the humanoid bone they attach to, then ``__``.

Every position below is written in the game's (three.js) space: +Y up, the face
toward -Z, the explorer's right hand on +X, metres. ``to_blender`` turns that
into Blender's Z-up space, so after the glTF exporter converts back, each piece
lands exactly where it is written here. (The first version skipped this, which
put the hair in front of the face and the outfits sideways.)

Hair pieces are in the head's hair frame (avatar.js `hairGroup`): the block head
spans x ±0.19, y -0.245..0.185 and z -0.15 (face) .. 0.2 (back); the brows sit at
y ≈ 0.1, so nothing hangs below y 0.12 at the front. Outfit pieces are given in
the figure's rest space and converted to their bone's local space (BONES in
src/humanoid.js).
"""
import bpy, math, os, sys
from mathutils import Matrix, Vector
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name,default): return ARGS[ARGS.index(name)+1] if name in ARGS else default
HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.abspath(arg('--out',os.path.join(HERE,'../../public/characters/customization/customization.glb')))
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name,color,metal=0,rough=.8):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Metallic'].default_value=metal;bsdf.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*color,1);return m
# Cloth and DarkCloth follow the shirt colour the player picks (avatar.js maps them by name).
HAIR=material('Customization_Hair',(.06,.075,.065),0,.95)
CLOTH=material('Customization_Cloth',(.12,.28,.19),0,1)
DARK=material('Customization_DarkCloth',(.07,.16,.12),0,1)
LEATHER=material('Customization_Leather',(.20,.13,.07),0,.9)
ARMOR=material('Customization_Armor',(.42,.46,.45),.55,.42)
TRIM=material('Customization_Trim',(.62,.45,.17),.6,.38)
SCARF=material('Customization_Scarf',(.52,.16,.10),0,1)
CAPE=material('Customization_Cape',(.10,.12,.07),0,1)
FLETCH=material('Customization_Fletching',(.85,.82,.72),0,.9)

# Game space (x, y, z) → Blender (x, -z, y) is a +90° turn about X.
B=Matrix.Rotation(math.pi/2,4,'X');BI=B.inverted()
def to_blender(m): return B@m@BI
def rot3(r):
    """A three.js Euler (order XYZ: the matrix is Rx·Ry·Rz)."""
    return Matrix.Rotation(r[0],4,'X')@Matrix.Rotation(r[1],4,'Y')@Matrix.Rotation(r[2],4,'Z')

def empty(name):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def shape(kind,parent,name,loc,half,mat,rot=(0,0,0),bevel=.02,origin=(0,0,0)):
    """A box or ball with half-extents `half`, centred at `loc` (game space) minus `origin`."""
    if kind=='box':bpy.ops.mesh.primitive_cube_add(size=2)
    else:bpy.ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=9,radius=1)
    o=bpy.context.object;o.name=name
    o.scale=(half[0],half[2],half[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if kind=='box' and bevel:
        b=o.modifiers.new('Soft_block_edges','BEVEL');b.width=min(bevel,min(half)*.9);b.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
    if kind=='ball':
        for p in o.data.polygons:p.use_smooth=True
    o.data.materials.append(mat);o.parent=parent
    local=Vector(loc)-Vector(origin)
    o.matrix_basis=to_blender(Matrix.Translation(local)@rot3(rot));return o
box=lambda *a,**k:shape('box',*a,**k)
ball=lambda *a,**k:shape('ball',*a,**k)
def jitter(i,k):return math.sin(i*12.9898+k*78.233)*.5  # repeatable -0.5..0.5

# ---------------------------------------------------------------- hair
def scalp(g,prefix,top=.04):
    """Close-cropped base every style shares: crown, back, sides and a hairline above the brows."""
    box(g,prefix+'_Crown',(0,.185+top*.5,.025),(.205,.02+top*.5,.195),HAIR,bevel=.03)
    box(g,prefix+'_Back',(0,.005,.212),(.2,.185,.026),HAIR,bevel=.02)
    for s,n in ((-1,'L'),(1,'R')):box(g,f'{prefix}_Side_{n}',(s*.205,.1,.075),(.02,.085,.13),HAIR,bevel=.012)
    box(g,prefix+'_Hairline',(0,.16,-.162),(.2,.032,.02),HAIR,bevel=.012)

g=empty('Hair_short');scalp(g,'Short',.05)
for i,(x,z) in enumerate(((-.1,-.08),(.06,-.1),(.13,.04),(-.12,.1),(.02,.06))):
    box(g,f'Short_Tuft_{i}',(x,.245,z),(.06,.022,.06),HAIR,rot=(0,i*.5,jitter(i,1)*.2),bevel=.015)
box(g,'Short_Fringe',(-.04,.17,-.178),(.15,.03,.016),HAIR,rot=(0,0,-.12),bevel=.01)

g=empty('Hair_curly');scalp(g,'Curly',.02);n=0
def curl(x,y,z,r=.068):
    global n;ball(g,f'Curl_{n:02}',(x+jitter(n,1)*.02,y+jitter(n,2)*.02,z+jitter(n,3)*.02),(r,r*.92,r),HAIR);n+=1
for x in (-.15,-.075,0,.075,.15):
    for z in (-.13,-.05,.03,.11,.19):curl(x,.215+abs(jitter(n,4))*.03,z)
for x in (-.15,-.05,.05,.15):
    for y in (-.07,.03,.13):curl(x,y,.235)
for s in (-1,1):
    for z in (-.07,.03,.13):
        for y in (.03,.12):curl(s*.225,y,z,.06)
for x in (-.15,-.075,0,.075,.15):curl(x,.17,-.165,.058)
for x,z in ((-.08,-.04),(.08,-.02),(0,.08),(-.1,.13),(.1,.12)):curl(x,.285,z,.075)

g=empty('Hair_swept');scalp(g,'Swept',.05)
box(g,'Swept_Quiff',(-.02,.255,-.08),(.18,.055,.1),HAIR,rot=(.25,0,.12),bevel=.03)
for i,(x,y) in enumerate(((-.13,.165),(-.02,.19),(.1,.215))):
    box(g,f'Swept_Lock_{i}',(x,y,-.175),(.08,.035,.024),HAIR,rot=(0,0,.32-i*.04),bevel=.012)
box(g,'Swept_Side_Long',(.215,.07,.02),(.025,.11,.15),HAIR,bevel=.015)

g=empty('Hair_tied');scalp(g,'Tied',.03)
box(g,'Tied_Tie',(0,.13,.255),(.055,.04,.035),TRIM,bevel=.012)
for i,(y,z,r) in enumerate(((.07,.29,.07),(-.04,.305,.064),(-.15,.31,.056),(-.26,.305,.047),(-.35,.295,.036))):
    ball(g,f'Tied_Tail_{i}',(0,y,z),(r,r*1.25,r*.9),HAIR)

g=empty('Hair_braid');scalp(g,'Braid',.03)
box(g,'Braid_Nape',(0,-.06,.24),(.06,.06,.03),HAIR,bevel=.015)
for i in range(7):
    r=.05-i*.003;ball(g,f'Braid_Link_{i}',((-.018 if i%2 else .018),-.13-i*.07,.25),(r,r*1.25,r*.9),HAIR)
box(g,'Braid_Tie',(0,-.6,.25),(.03,.03,.03),TRIM,bevel=.01)
ball(g,'Braid_Tip',(0,-.66,.25),(.032,.05,.03),HAIR)

# ---------------------------------------------------------------- outfits
BONES={'Hips':(0,1.0,0),'Spine':(0,1.16,0),'Chest':(0,1.36,0),'Neck':(0,1.6,0),'Head':(0,1.735,0)}
for side,s in (('Left',-1),('Right',1)):
    BONES.update({side+'Shoulder':(s*.1,1.5,0),side+'Arm':(s*.28,1.525,0),side+'ForeArm':(s*.341,1.135,-.007),side+'Hand':(s*.394,.9,-.012),
                  side+'UpLeg':(s*.14,.985,0),side+'Leg':(s*.14,.545,.005),side+'Foot':(s*.14,.13,0)})
def piece(g,bone,name,loc,half,mat,rot=(0,0,0),bevel=.02,kind='box'):
    return shape(kind,g,f'{bone}__{name}',loc,half,mat,rot=rot,bevel=bevel,origin=BONES[bone])
def outfit(name):return empty('Outfit_'+name)
SIDES=((-1,'Left'),(1,'Right'))

# Ranger: a light scout. Hood down over a short cape, a quiver on the back, a
# strap across the chest, belt pouches and one archer's shoulder guard.
g=outfit('ranger')
piece(g,'Neck','Cowl',(0,1.585,.01),(.215,.065,.18),CAPE,bevel=.05)
piece(g,'Chest','Hood',(0,1.6,.215),(.17,.09,.06),CAPE,rot=(-.3,0,0),bevel=.05)
piece(g,'Chest','Cape',(0,1.29,.215),(.29,.3,.018),CAPE,rot=(-.08,0,0),bevel=.012)
for s,n in SIDES:piece(g,'Chest',f'Clasp_{n}',(s*.2,1.6,-.175),(.035,.035,.02),TRIM,bevel=.01)
piece(g,'Chest','Strap',(0,1.4,-.195),(.035,.3,.012),LEATHER,rot=(0,0,.7),bevel=.008)
piece(g,'Chest','Quiver',(.12,1.42,.275),(.06,.2,.06),LEATHER,rot=(0,0,-.35),bevel=.02)
for i,dx in enumerate((-.03,0,.03)):piece(g,'Chest',f'Fletching_{i}',(.2+dx,1.67,.275),(.014,.05,.03),FLETCH,rot=(0,0,-.35),bevel=.006)
piece(g,'Hips','Belt',(0,1.06,0),(.255,.04,.172),LEATHER,bevel=.015)
piece(g,'Hips','Buckle',(0,1.06,-.176),(.04,.032,.012),TRIM,bevel=.008)
piece(g,'Hips','Pouch_L',(-.17,1.0,-.155),(.055,.06,.04),LEATHER,bevel=.015)
piece(g,'Hips','Sheath',(.255,.95,0),(.025,.11,.035),LEATHER,rot=(0,0,.2),bevel=.01)
piece(g,'LeftArm','Guard',(-.35,1.53,0),(.12,.035,.14),LEATHER,rot=(0,0,.3),bevel=.015)

# Warden: a heavy guardian. Breast and back plates with a ridge, layered
# pauldrons, a gorget, vambraces, a wide belt and a cloth tabard.
g=outfit('warden')
piece(g,'Chest','Breastplate',(0,1.44,-.195),(.29,.17,.03),ARMOR,bevel=.025)
piece(g,'Chest','Ridge',(0,1.44,-.226),(.025,.15,.012),TRIM,bevel=.008)
piece(g,'Chest','Backplate',(0,1.44,.195),(.29,.17,.03),ARMOR,bevel=.025)
piece(g,'Neck','Gorget',(0,1.6,0),(.2,.06,.19),ARMOR,bevel=.03)
for s,n in SIDES:
    piece(g,n+'Arm','Pauldron',(s*.36,1.58,0),(.16,.05,.19),ARMOR,rot=(0,0,-s*.35),bevel=.03)
    piece(g,n+'Arm','Pauldron_Lower',(s*.41,1.5,0),(.13,.04,.17),ARMOR,rot=(0,0,-s*.5),bevel=.025)
    piece(g,n+'Arm','Pauldron_Rim',(s*.44,1.535,0),(.02,.02,.19),TRIM,rot=(0,0,-s*.35),bevel=.008)
    piece(g,n+'ForeArm','Vambrace',(s*.36,1.02,0),(.13,.12,.14),ARMOR,bevel=.025)
piece(g,'Hips','Belt',(0,1.08,0),(.262,.05,.178),LEATHER,bevel=.015)
piece(g,'Hips','Buckle',(0,1.08,-.184),(.06,.045,.012),TRIM,bevel=.01)
for z,n in ((-.17,'Front'),(.17,'Back')):
    piece(g,'Hips','Tabard_'+n,(0,.86,z),(.13,.2,.015),CLOTH,bevel=.008)
    piece(g,'Hips','Tabard_Hem_'+n,(0,.67,z*1.01),(.13,.02,.016),TRIM,bevel=.006)

# Wanderer: a traveller. A long coat with lapels and tails, a scarf with a
# trailing end, a sash and a satchel on a cross-body strap.
g=outfit('wanderer')
piece(g,'Neck','Scarf',(0,1.59,-.01),(.215,.07,.185),SCARF,bevel=.05)
piece(g,'Chest','Scarf_Tail',(-.12,1.38,-.205),(.05,.16,.015),SCARF,rot=(0,0,.15),bevel=.01)
for s,n in SIDES:
    piece(g,'Chest','Lapel_'+n,(s*.12,1.47,-.192),(.07,.13,.012),DARK,rot=(0,0,s*.3),bevel=.008)
    piece(g,'Hips','Coat_'+n,(s*.17,.84,-.15),(.09,.25,.02),CLOTH,rot=(.06,-s*.15,0),bevel=.01)
piece(g,'Hips','Coat_Back',(0,.82,.172),(.25,.27,.02),CLOTH,rot=(-.08,0,0),bevel=.01)
piece(g,'Hips','Sash',(0,1.05,0),(.258,.045,.175),SCARF,bevel=.015)
piece(g,'Hips','Satchel',(.27,1.0,.04),(.045,.1,.12),LEATHER,bevel=.025)
piece(g,'Hips','Satchel_Flap',(.3,1.06,.04),(.02,.05,.122),LEATHER,bevel=.01)
piece(g,'Chest','Strap_Front',(0,1.38,-.193),(.03,.32,.012),LEATHER,rot=(0,0,-.7),bevel=.008)
piece(g,'Chest','Strap_Back',(0,1.38,.193),(.03,.32,.012),LEATHER,rot=(0,0,.7),bevel=.008)
for s,n in SIDES:piece(g,n+'ForeArm','Wrap',(s*.36,.93,0),(.122,.04,.132),FLETCH,bevel=.012)

# Sentinel: a knight in full plate. Cuirass, gorget, round pauldrons, faulds
# and tassets, vambraces, knee cops and greaves, with a brass emblem.
g=outfit('sentinel')
for z,n in ((-.19,'Front'),(.19,'Back')):piece(g,'Chest','Cuirass_'+n,(0,1.42,z),(.31,.2,.035),ARMOR,bevel=.03)
piece(g,'Chest','Emblem',(0,1.46,-.23),(.055,.055,.01),TRIM,rot=(0,0,math.pi/4),bevel=.006)
piece(g,'Spine','Plackart',(0,1.25,-.183),(.27,.09,.03),ARMOR,bevel=.025)
piece(g,'Neck','Gorget',(0,1.62,0),(.21,.08,.195),ARMOR,bevel=.035)
for z,n in ((-1,'Front'),(1,'Back')):
    piece(g,'Hips','Fauld_'+n,(0,.98,z*.172),(.25,.08,.02),ARMOR,rot=(-z*.15,0,0),bevel=.012)
    piece(g,'Hips','Fauld_Lower_'+n,(0,.88,z*.185),(.23,.06,.02),ARMOR,rot=(-z*.2,0,0),bevel=.012)
for s,n in SIDES:
    piece(g,n+'Arm','Pauldron',(s*.35,1.55,0),(.17,.12,.18),ARMOR,kind='ball')
    piece(g,n+'Arm','Pauldron_Band',(s*.37,1.49,0),(.16,.025,.17),TRIM,rot=(0,0,-s*.2),bevel=.01)
    piece(g,n+'ForeArm','Vambrace',(s*.36,1.02,0),(.135,.13,.145),ARMOR,bevel=.025)
    piece(g,'Hips','Tasset_'+n,(s*.235,.92,0),(.04,.11,.15),ARMOR,rot=(0,0,-s*.12),bevel=.012)
    piece(g,n+'Leg','Knee',(s*.14,.55,-.17),(.1,.07,.03),ARMOR,bevel=.02)
    piece(g,n+'Leg','Greave',(s*.14,.32,-.155),(.12,.17,.025),ARMOR,bevel=.015)

os.makedirs(os.path.dirname(OUT),exist_ok=True);bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_texcoords=False,export_cameras=False,export_lights=False,export_animations=False)
print('EXPORTED',OUT,os.path.getsize(OUT)//1024,'KB')
