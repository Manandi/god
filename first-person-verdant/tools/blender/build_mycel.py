"""
Mycel, keeper of the Heartseed: the narrator of the intro (The Hollow Roots).

    blender -b --python first-person-verdant/tools/blender/build_mycel.py -- [--out PATH.glb] [--preview PATH.png]

A cute, squishy mushroom spirit (the owner asked for "cute and squishy"): a
soft dumpling body with tiny feet, a big puffy mint cap with pastel spots and
a sprout on top, huge glossy eyes with sparkles, rosy cheeks, a tiny mouth and
stubby nub arms. The game squashes and stretches him as he bobs. The
Heartseed, a glowing seed, orbits him.

The face parts and limbs are separate objects with their origins at their
pivots, so the game animates them directly (no rig):
  Mycel (root) > Body > Cap (> Spots, Sprout), EyeL (> sparkles), EyeR, BrowL, BrowR, Mouth, ArmL, ArmR, CheekL/R, Feet
  Heartseed (separate)
He faces -Y (the game's +Z, toward its camera). About 1.1 m tall.
"""
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from procedural import link, mesh_obj, join, material, hexc, tube

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default): return ARGS[ARGS.index(name) + 1] if name in ARGS else default
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '../../public/characters/mycel/mycel.glb')))
PREVIEW = arg('--preview', None)
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

M = {
    'cap': material('MY_Cap', color=hexc('#6cc3a6'), rough=.55),
    'rim': material('MY_Rim', color=hexc('#f3e6c8'), rough=.7),
    'spots': material('MY_Spots', color=hexc('#fff6dc'), emission=hexc('#fff1c2'), strength=.6, rough=.5),
    'gills': material('MY_Gills', color=hexc('#8fe8c8'), emission=hexc('#5fe0b8'), strength=1.4, rough=.5),
    'stem': material('MY_Stem', color=hexc('#f6ecd2'), rough=.62),
    'moss': material('MY_Moss', color=hexc('#7cc46a'), rough=.75),
    'root': material('MY_Root', color=hexc('#6a5238'), rough=.85),
    'eye': material('MY_Eye', color=hexc('#ffffff'), emission=hexc('#ffffff'), strength=2.5, rough=.2),
    'dark': material('MY_Mouth', color=hexc('#15241d'), rough=.8),
    'brow': material('MY_Brow', color=hexc('#a98a62'), rough=.7),
    'blush': material('MY_Blush', color=hexc('#f4a0a0'), emission=hexc('#e9787c'), strength=.25, rough=.85),
    'pupil': material('MY_Pupil', color=hexc('#1c2420'), rough=.12),
    'seed': material('MY_Heartseed', color=hexc('#fff0b8'), emission=hexc('#ffd774'), strength=6, rough=.2),
}

def obj_from(bm, name, mat, loc=(0, 0, 0), smooth=True):
    o = mesh_obj(name, bm); o.data.materials.append(M[mat]); o.location = loc
    for p in o.data.polygons: p.use_smooth = smooth
    return o
def parent(child, par):
    bpy.context.view_layer.update()      # so the parent's matrix_world is current
    child.parent = par; child.matrix_parent_inverse = par.matrix_world.inverted()
def ellipsoid(rx, ry, rz, u=20, v=12):
    b = bmesh.new(); bmesh.ops.create_uvsphere(b, u_segments=u, v_segments=v, radius=1)
    bmesh.ops.scale(b, vec=(rx, ry, rz), verts=b.verts[:]); return b

root = link(bpy.data.objects.new('Mycel', None))

def lathe(prof, n=32, squash_y=.94):
    """A round body of revolution from (z, r) pairs, bottom to top, closed at both ends."""
    b = bmesh.new(); rings = []
    for z, r in prof:
        rings.append([b.verts.new((math.cos(i / n * math.tau) * r, math.sin(i / n * math.tau) * r * squash_y, z)) for i in range(n)])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(n): b.faces.new((r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]))
    bot = b.verts.new((0, 0, prof[0][0] - .01)); top = b.verts.new((0, 0, prof[-1][0] + .01))
    for i in range(n):
        b.faces.new((rings[0][(i + 1) % n], rings[0][i], bot)); b.faces.new((rings[-1][i], rings[-1][(i + 1) % n], top))
    bmesh.ops.recalc_face_normals(b, faces=b.faces[:]); return b
def add(bm_target, piece, matrix):
    bmesh.ops.transform(piece, matrix=matrix, verts=piece.verts[:])
    me = bpy.data.meshes.new('t'); piece.to_mesh(me); piece.free(); bm_target.from_mesh(me); bpy.data.meshes.remove(me)

# --- the body: a soft dumpling, widest low down, like a mochi that has just sat down.
prof = [(-.42, .05), (-.40, .20), (-.35, .30), (-.25, .365), (-.12, .385), (0, .375), (.10, .345), (.18, .30), (.24, .24)]
body = obj_from(lathe(prof), 'Body', 'stem'); parent(body, root)
# Two tiny feet peeking out underneath.
feet = bmesh.new()
for s in (1, -1): add(feet, ellipsoid(.085, .1, .05, 14, 8), Matrix.Translation((s * .14, -.08, -.41)))
f = obj_from(feet, 'Feet', 'stem'); parent(f, body)

# --- the cap: a big puffy bun with a thick soft rim, tipped jauntily, pastel spots and a sprout.
CAP_Z = .30
b = bmesh.new(); rings = []; N = 40
for t in np.linspace(0, 1, 16):
    phi = t * math.pi * .56; ring = []
    for i in range(N):
        a = i / N * math.tau
        r = math.sin(phi) * .56; z = math.cos(phi) * .34 - .06
        if t > .82: k = (t - .82) / .18; r = .56 * math.sin(math.pi * .56 * .82) + .05 * math.sin(k * math.pi); z -= k * .09   # rolled, pillowy rim
        ring.append(b.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
    rings.append(ring)
top = b.verts.new((0, 0, .29))
for r0, r1 in zip(rings[1:], rings[2:]):
    for i in range(N): b.faces.new((r0[i], r1[i], r1[(i + 1) % N], r0[(i + 1) % N]))
for i in range(N): b.faces.new((top, rings[1][i], rings[1][(i + 1) % N]))
under = b.verts.new((0, 0, -.08))
for i in range(N): b.faces.new((rings[-1][(i + 1) % N], rings[-1][i], under))
bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
cap = obj_from(b, 'Cap', 'cap', (0, 0, CAP_Z)); cap.rotation_euler = (math.radians(-6), math.radians(7), 0)
cap.data.materials.append(M['rim'])
for p in cap.data.polygons:
    if (sum(cap.data.vertices[v].co.z for v in p.vertices) / len(p.vertices)) < -.125: p.material_index = 1
parent(cap, body)
spots = bmesh.new()
for a, t, s in ((.4, .45, .09), (1.9, .55, .07), (3.0, .35, .06), (4.1, .6, .085), (5.3, .4, .065), (2.5, .15, .055)):
    phi = t * math.pi * .5; n = Vector((math.sin(phi) * math.cos(a), math.sin(phi) * math.sin(a), math.cos(phi))).normalized()
    co = Vector((math.cos(a) * math.sin(phi) * .54, math.sin(a) * math.sin(phi) * .54, math.cos(phi) * .33 - .06)) + n * .006
    add(spots, ellipsoid(s, s, .016, 14, 8), Matrix.Translation(co) @ n.to_track_quat('Z', 'Y').to_matrix().to_4x4())
sp = obj_from(spots, 'Spots', 'spots', (0, 0, CAP_Z)); parent(sp, cap)
sprout = bmesh.new()
add(sprout, ellipsoid(.018, .018, .07, 8, 6), Matrix.Translation((0, 0, .33)))
for s in (1, -1): add(sprout, ellipsoid(.075, .035, .012, 12, 6), Matrix.Translation((s * .06, 0, .40)) @ Matrix.Rotation(s * .5, 4, 'Y'))
spr = obj_from(sprout, 'Sprout', 'moss', (0, 0, CAP_Z)); parent(spr, cap)

# --- the face: huge glossy eyes with sparkles, rosy cheeks, a tiny mouth, soft brows.
FACE_Y = -.355
for s, name in ((1, 'L'), (-1, 'R')):
    eye = obj_from(ellipsoid(.075, .03, .095, 18, 12), f'Eye{name}', 'pupil', (s * .13, FACE_Y, .02)); parent(eye, body)
    for k, (dx, dz, r) in enumerate(((-.022, .035, .024), (.02, -.03, .011))):
        hl = obj_from(ellipsoid(r, .006, r, 10, 6), f'Sparkle{name}{k}', 'eye', (s * .13 + dx, FACE_Y - .03, .02 + dz)); parent(hl, eye)
    cheek = obj_from(ellipsoid(.06, .012, .034, 14, 8), f'Cheek{name}', 'blush', (s * .235, FACE_Y + .04, -.09)); parent(cheek, body)
    bb = ellipsoid(.05, .014, .014, 10, 6)
    brow = obj_from(bb, f'Brow{name}', 'brow', (s * .13, FACE_Y + .01, .145)); parent(brow, body)
mouth = obj_from(ellipsoid(.034, .012, .022, 14, 8), 'Mouth', 'dark', (0, FACE_Y - .012, -.085)); parent(mouth, body)

# --- stubby little arms (round nubs), pivoting at the shoulder.
for s, name in ((1, 'L'), (-1, 'R')):
    nub = ellipsoid(.075, .07, .11, 14, 10)
    bmesh.ops.transform(nub, matrix=Matrix.Translation((s * .06, 0, -.08)) @ Matrix.Rotation(s * .35, 4, 'Y'), verts=nub.verts[:])
    a = obj_from(nub, f'Arm{name}', 'stem', (s * .33, -.04, -.04)); parent(a, body)

# --- the Heartseed.
seed = obj_from(ellipsoid(.06, .06, .075, 14, 10), 'Heartseed', 'seed', (.45, -.2, .3))

tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('MYCEL TRIANGLES', tris)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_normals=True, export_texcoords=False,
                          export_cameras=False, export_lights=False, export_extras=True, export_animations=False)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')

if PREVIEW:
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.03, .08, .07, 1)
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 2.5; sun.rotation_euler = (math.radians(55), 0, math.radians(-25))
    fill = link(bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'POINT'))); fill.data.energy = 60; fill.location = (-1, -1.5, .4)
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 55
    cam.location = (.9, -3.2, .5); d = Vector((0, 0, .05)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 32; scene.render.resolution_x, scene.render.resolution_y = 700, 800
    scene.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True); print('PREVIEW', PREVIEW)

