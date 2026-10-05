"""Build Shadowmere's low-poly forest, green monkey scouts, and gorilla guardian.

Run from Blender 4.2+:
  blender --background --python tools/blender/build_shadowmere.py

The GLB is a set of named, reusable prototypes. The game places the forest at
the second realm's coordinates and animates the simple named body parts in JS.
"""
import bpy
import math
import os
import random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "public/worlds/shadowmere.glb")
BLEND = os.path.join(os.path.dirname(__file__), "shadowmere.blend")
random.seed(517)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.materials:
    bpy.data.materials.remove(block)

def mat(name, color, rough=.92, emission=None, strength=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m

pine = mat('M_ShadowPine', (.018, .095, .073))
pine_lit = mat('M_MossCanopy', (.075, .22, .13))
pine_dark = mat('M_DeepCanopy', (.025, .12, .105))
bark = mat('M_BlackRootBark', (.105, .073, .047))
soil = mat('M_BlackLoam', (.10, .12, .085))
moss = mat('M_Moss', (.14, .28, .12))
amber = mat('M_LanternSeed', (.92, .48, .12), .42, (.9, .29, .035), 2.1)
monkey_green = mat('M_MonkeyGreen', (.16, .43, .19), .82)
monkey_light = mat('M_MonkeyMoss', (.34, .59, .23), .86)
skin = mat('M_MonkeyMuzzle', (.52, .39, .25))
eye = mat('M_AmberEyes', (.95, .64, .12), .28, (.9, .36, .035), .8)
gorilla_green = mat('M_GorillaPine', (.035, .20, .145), .9)
gorilla_fur = mat('M_GorillaFur', (.075, .29, .20), .94)
gorilla_face = mat('M_GorillaFace', (.15, .17, .13))
blade = mat('M_Rootglass', (.30, .77, .56), .28, (.06, .30, .20), .65)
leather = mat('M_WornLeather', (.23, .12, .065))
seed = mat('M_GrenadePod', (.47, .29, .10))
rope = mat('M_RootCord', (.29, .21, .12))

def parent_to(obj, parent):
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

def empty(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.empty_display_type = 'CUBE'
    o.empty_display_size = .25
    return o

def ico(name, loc, scale, material, subdivisions=1, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    o.data.materials.append(material)
    if parent: parent_to(o, parent)
    return o

def cube(name, loc, scale, material, parent=None, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('Soft hand-cut edges', 'BEVEL'); mod.width = bevel; mod.segments = 1
        o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    if parent: parent_to(o, parent)
    return o

def cylinder(name, loc, radius, depth, material, parent=None, vertices=8, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=r2, depth=depth, location=loc)
    o = bpy.context.object; o.name = name; o.data.materials.append(material)
    if parent: parent_to(o, parent)
    return o

def between(name, a, b, radius, material, parent=None):
    a, b = Vector(a), Vector(b); delta=b-a
    o=cylinder(name,(a+b)/2,radius,delta.length,material,parent,8)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=delta.to_track_quat('Z','Y')
    return o

def tree(name, x, z, height, parent):
    h=height; trunk=cylinder(name+'_Trunk',(x,h*.32,z),.34*h/8,h*.68,bark,parent,7,.2*h/8)
    trunk.rotation_euler[1]=random.uniform(-.12,.12)
    for i in range(3):
        y=h*(.48+i*.20); rad=h*(.37-i*.055)
        crown=cylinder(name+f'_Canopy_{i}',(x,y,z),rad,h*.40,(pine,pine_lit,pine_dark)[(i+int(x+z))%3],parent,7,0.0)
        crown.rotation_euler[0]=random.uniform(-.04,.04)
    for i in range(3):
        angle=i*2.094+random.random()*.4
        between(name+f'_Root_{i}',(x,h*.02,z),(x+math.cos(angle)*1.6,h*.08,z+math.sin(angle)*1.6),.16,bark,parent)
    if int(x*3+z*5)%4==0:
        ico(name+'_Lantern',(x,h*.78,z),(.23,.32,.23),amber,1,parent)

# One reusable environment root. A dense, dark canopy makes the zone read as
# deep woods even while its island sits inside the larger Reach map.
forest=empty('Shadowmere_Forest')
cylinder('Shadowmere_BlackLoam',(0,-.2,0),39,.4,soil,forest,48)
for i in range(38):
    a=i*2.39996; r=10+math.sqrt(i/38)*24
    x=math.cos(a)*r; z=math.sin(a)*r
    tree(f'ShadowTree_{i:02d}',x,z,random.uniform(9,15),forest)
# Root arches, standing stones and a lantern gate mark the path into the wood.
for side in (-1,1):
    cylinder('RootGate_Post',(side*3,2.4,-31),.48,4.8,bark,forest,7,.29)
between('RootGate_Lintel',(-3,4.7,-31),(3,4.7,-31),.42,bark,forest)
for i in range(7):
    a=i*math.tau/7
    x,z=math.cos(a)*7,math.sin(a)*7
    ob=cylinder(f'OathStone_{i}',(x,1.0,z),.62,2.0+(i%3)*.45,soil,forest,5,.45)
    ob.rotation_euler[1]=a
    ico(f'OathRune_{i}',(x,2.3+(i%3)*.22,z),(.13,.13,.13),amber,1,forest)
# Fallen logs and root braids around the clearing.
for i in range(12):
    a=i*math.tau/12+.13
    x,z=math.cos(a)*12,math.sin(a)*12
    ob=between(f'FallenRoot_{i}',(x,0,z),(x+math.cos(a+1)*3,.28,z+math.sin(a+1)*3),.32,bark,forest)
    ico(f'RootMoss_{i}',(x+.2,.45,z),(.7,.18,.55),moss,1,forest)

def monkey(name, x, z, scale=1):
    root=empty(name);root.location=(x,0,z);root.scale=(scale,scale,scale)
    # Compact green primate silhouette: hunched torso, expressive block-like
    # head, long forearms, curled decorative tail, and quick feet.
    ico(name+'_Torso',(0,1.10,0),(.38,.52,.31),monkey_green,2,root)
    ico(name+'_Shoulders',(0,1.40,-.03),(.48,.27,.31),monkey_light,1,root)
    ico(name+'_Head',(0,1.91,-.02),(.34,.35,.32),monkey_green,2,root)
    ico(name+'_Muzzle',(0,1.80,.255),(.22,.14,.13),skin,1,root)
    for s in (-1,1):
        ico(name+f'_Ear_{s}',(s*.35,1.95,0),(.14,.19,.075),skin,1,root)
        ico(name+f'_Eye_{s}',(s*.14,1.96,.282),(.052,.063,.036),eye,1,root)
        arm=between(name+f'_Arm_{s}',(s*.31,1.47,0),(s*.62,.84,.18),.15,monkey_green,root)
        hand=ico(name+f'_Hand_{s}',(s*.63,.76,.2),(.15,.14,.16),skin,1,root)
        arm['swingSign']=s
        leg=between(name+f'_Leg_{s}',(s*.17,.84,-.02),(s*.34,.27,.12),.17,monkey_green,root)
        ico(name+f'_Foot_{s}',(s*.35,.16,.22),(.23,.13,.32),skin,1,root)
    # Curled tail in three readable segments.
    between(name+'_Tail_0',(0,1.08,-.27),(.02,.9,-.65),.085,monkey_green,root)
    between(name+'_Tail_1',(.02,.9,-.65),(.26,1.13,-.83),.075,monkey_green,root)
    between(name+'_Tail_2',(.26,1.13,-.83),(.4,1.39,-.72),.06,monkey_green,root)
    ico(name+'_Brow',(0,2.08,.27),(.25,.065,.04),monkey_light,1,root)
    return root

monkey('Monkey_Scout',-2,2,1)
monkey('Monkey_Slinger',2,2,1.08)

# The boss stands almost twice the player's height. Sword and seed-pod bombs
# are separate named meshes so the game can animate the swing and grenade toss.
gorilla=empty('Gorilla_Grenadier')
gorilla.scale=(1.6,1.6,1.6)
ico('Gorilla_Body',(0,1.63,0),(.79,.92,.52),gorilla_green,2,gorilla)
ico('Gorilla_Mane',(0,2.12,-.04),(.84,.55,.55),gorilla_fur,2,gorilla)
ico('Gorilla_Head',(0,2.83,.08),(.55,.58,.48),gorilla_green,2,gorilla)
ico('Gorilla_Face',(0,2.71,.48),(.4,.28,.15),gorilla_face,1,gorilla)
ico('Gorilla_Muzzle',(0,2.58,.59),(.27,.18,.14),skin,1,gorilla)
for s in (-1,1):
    ico(f'Gorilla_Eye_{s}',(s*.2,2.9,.48),(.07,.075,.04),eye,1,gorilla)
    ico(f'Gorilla_Shoulder_{s}',(s*.76,2.14,.02),(.46,.48,.43),gorilla_fur,1,gorilla)
    arm=between(f'Gorilla_Arm_{s}',(s*.76,2.1,0),(s*1.05,1.12,.18),.31,gorilla_green,gorilla)
    ico(f'Gorilla_Fist_{s}',(s*1.08,1.02,.26),(.34,.27,.34),gorilla_face,1,gorilla)
    leg=between(f'Gorilla_Leg_{s}',(s*.36,1.1,0),(s*.4,.32,.08),.28,gorilla_green,gorilla)
    ico(f'Gorilla_Foot_{s}',(s*.4,.18,.34),(.34,.19,.48),gorilla_face,1,gorilla)
# Leaf mantle and leather harness.
for i in range(7):
    a=i*math.tau/7
    leaf=ico(f'Gorilla_LeafMantle_{i}',(math.cos(a)*.62,2.38,math.sin(a)*.4),(.3,.12,.48),monkey_light,1,gorilla)
    leaf.rotation_euler[1]=a
cylinder('Gorilla_Belt',(0,1.43,0),.58,.14,leather,gorilla,12)
# Sword held in the right hand. A broad low-poly blade with root-wrapped hilt.
handle=cylinder('Gorilla_SwordHandle',(1.32,1.06,.32),.085,.62,leather,gorilla,8)
handle.rotation_euler[0]=-.38;handle.rotation_euler[2]=-.28
cross=cube('Gorilla_SwordGuard',(1.34,1.34,.34),(.52,.11,.12),rope,gorilla,.025);cross.rotation_euler[2]=-.25
bladeobj=cube('Gorilla_SwordBlade',(1.49,1.95,.36),(.36,1.15,.1),blade,gorilla,.045);bladeobj.rotation_euler[2]=-.22
tip=ico('Gorilla_SwordTip',(1.62,2.56,.36),(.17,.26,.09),blade,1,gorilla);tip.rotation_euler[2]=-.22
# Three paired pods clipped to its belt; visible as seed grenades, not firearms.
for i in range(3):
    x=-.42+i*.42
    pod=ico(f'Gorilla_SeedGrenade_{i}',(x,1.27,.46),(.16,.24,.14),seed,1,gorilla)
    pod.rotation_euler[2]=-.18
    ico(f'Gorilla_GrenadeFuse_{i}',(x,1.51,.46),(.055,.075,.055),amber,1,gorilla)
    between(f'Gorilla_GrenadeCord_{i}',(x-.13,1.34,.53),(x+.13,1.20,.53),.025,rope,gorilla)

# Save an editable Blender source and an optimized, self-contained runtime asset.
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type in {'MESH','EMPTY'}: o.select_set(True)
bpy.context.view_layer.objects.active=forest
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
print('Wrote', BLEND)
print('Wrote', OUT)
