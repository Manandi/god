"""
Mycel, keeper of the Heartseed: the narrator of the intro (The Hollow Roots).

    blender -b --python first-person-verdant/tools/blender/build_mycel.py -- [--out PATH.glb] [--preview PATH.png]

A floating mushroom spirit: a deep-teal cap with glowing spots and luminous
gills, a pale stem-body with a leafy collar, big glowing eyes, root arms that
gesture, and root tendrils trailing where legs would be. The Heartseed, a
glowing seed, orbits him.

The face parts and limbs are separate objects with their origins at their
pivots, so the game animates them directly (no rig):
  Mycel (root) > Body > Cap (> Spots, Gills), EyeL, EyeR, BrowL, BrowR, Mouth, ArmL, ArmR
  Heartseed (separate)
He faces -Y (the game's +Z, toward its camera). About 1.4 m tall.
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
    'cap': material('MY_Cap', color=hexc('#376d63'), rough=.6),
    'rim': material('MY_Rim', color=hexc('#b3cf9b'), rough=.68),
    'spots': material('MY_Spots', color=hexc('#d9ffb0'), emission=hexc('#c6f48a'), strength=3, rough=.4),
    'gills': material('MY_Gills', color=hexc('#8fe8c8'), emission=hexc('#5fe0b8'), strength=1.4, rough=.5),
    'stem': material('MY_Stem', color=hexc('#d6cfae'), rough=.75),
    'moss': material('MY_Moss', color=hexc('#4f7a3a'), rough=.9),
    'root': material('MY_Root', color=hexc('#6a5238'), rough=.85),
    'eye': material('MY_Eye', color=hexc('#e8ffd8'), emission=hexc('#c8f7a8'), strength=4, rough=.2),
    'dark': material('MY_Mouth', color=hexc('#15241d'), rough=.8),
    'brow': material('MY_Brow', color=hexc('#9fd488'), rough=.6),
    'blush': material('MY_Blush', color=hexc('#eaa08e'), emission=hexc('#c86e63'), strength=.18, rough=.82),
    'pupil': material('MY_Pupil', color=hexc('#24372f'), rough=.25),
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

# --- the stem-body: a lathe with a soft belly, narrowing into the tendrils.
b = bmesh.new(); prof = [(.32, .18), (.23, .255), (.08, .285), (-.08, .29), (-.24, .255), (-.38, .19), (-.48, .105)]
rings = []
for z, r in prof:
    ring = []
    for i in range(24):
        a = i / 24 * math.tau; k = 1 + .03 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, z * 4)))
        ring.append(b.verts.new((math.cos(a) * r * k, math.sin(a) * r * k * .92, z)))
    rings.append(ring)
for r0, r1 in zip(rings, rings[1:]):
    for i in range(24): b.faces.new((r1[i], r1[(i + 1) % 24], r0[(i + 1) % 24], r0[i]))
b.faces.new(rings[-1]); b.faces.new(rings[0][::-1])
body = obj_from(b, 'Body', 'stem'); parent(body, root)
# Leafy collar and trailing tendrils belong to the body.
parts = []
leaves = bmesh.new()
for i in range(9):
    a = i / 9 * math.tau + .2; leaf = ellipsoid(.13, .06, .018, 10, 6)
    bmesh.ops.transform(leaf, matrix=Matrix.Translation((math.cos(a) * .24, math.sin(a) * .22, -.06)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(-.55, 4, 'Y') @ Matrix.Translation((.09, 0, 0)), verts=leaf.verts[:])
    me = bpy.data.meshes.new('t'); leaf.to_mesh(me); leaf.free(); leaves.from_mesh(me); bpy.data.meshes.remove(me)
collar = obj_from(leaves, 'Collar', 'moss')
for i in range(6):
    a = i / 6 * math.tau + .3; start = Vector((math.cos(a) * .1, math.sin(a) * .09, -.46))
    pts = [start + Vector((math.cos(a + t * 2.2) * .08 * t + math.cos(a) * .12 * t, math.sin(a + t * 2.2) * .08 * t + math.sin(a) * .1 * t, -t * random.uniform(.45, .6))) for t in np.linspace(0, 1, 9)]
    o = tube(pts, [.05 * (1 - t * .85) for t in np.linspace(0, 1, 9)], f'tendril{i}'); o.data.materials.append(M['root']); parts.append(o)
extra = join([collar] + parts, 'BodyExtras'); parent(extra, body)
for p in extra.data.polygons: p.use_smooth = True

# --- the cap: a dome with a wavy, rolled rim; glowing spots; gills beneath.
CAP_Z = .42
b = bmesh.new(); rings = []
for k, t in enumerate(np.linspace(0, 1, 14)):
    phi = t * math.pi * .5; ring = []
    for i in range(40):
        a = i / 40 * math.tau; wave = 1 + .045 * math.sin(a * 7) * t ** 3
        r = math.sin(phi) * .68 * wave; z = math.cos(phi) * .30
        if t > .88: z -= (t - .88) * .5; r *= 1 - (t - .88) * .25                                   # the rim rolls under
        ring.append(b.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
    rings.append(ring)
top = b.verts.new((0, 0, .34))
for r0, r1 in zip(rings[1:], rings[2:]):
    for i in range(40): b.faces.new((r0[i], r1[i], r1[(i + 1) % 40], r0[(i + 1) % 40]))
for i in range(40): b.faces.new((top, rings[1][i], rings[1][(i + 1) % 40]))
under = b.verts.new((0, 0, .02))
for i in range(40): b.faces.new((rings[-1][(i + 1) % 40], rings[-1][i], under))
bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
cap = obj_from(b, 'Cap', 'cap', (0, 0, CAP_Z))
cap.data.materials.append(M['rim'])
for p in cap.data.polygons:                                          # the lower band is the pale rim
    if (sum((cap.data.vertices[v].co.z for v in p.vertices)) / len(p.vertices)) < .035: p.material_index = 1
parent(cap, body)
spots = bmesh.new()
for i in range(13):
    t = random.uniform(.2, .78); a = random.uniform(0, math.tau); phi = t * math.pi * .5
    n = Vector((math.sin(phi) * math.cos(a), math.sin(phi) * math.sin(a), math.cos(phi))).normalized()
    co = Vector((math.cos(a) * math.sin(phi) * .62, math.sin(a) * math.sin(phi) * .62, math.cos(phi) * .36)) + n * .004
    s = random.uniform(.035, .075); d = ellipsoid(s, s, .012, 10, 6)
    bmesh.ops.transform(d, matrix=Matrix.Translation(co) @ n.to_track_quat('Z', 'Y').to_matrix().to_4x4(), verts=d.verts[:])
    me = bpy.data.meshes.new('t'); d.to_mesh(me); d.free(); spots.from_mesh(me); bpy.data.meshes.remove(me)
sp = obj_from(spots, 'Spots', 'spots', (0, 0, CAP_Z)); parent(sp, cap)
gills = bmesh.new()
for i in range(36):
    a = i / 36 * math.tau; g = bmesh.new(); bmesh.ops.create_cube(g, size=1); bmesh.ops.scale(g, vec=(.36, .006, .06), verts=g.verts[:])
    bmesh.ops.transform(g, matrix=Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((.36, 0, -.005)), verts=g.verts[:])
    me = bpy.data.meshes.new('t'); g.to_mesh(me); g.free(); gills.from_mesh(me); bpy.data.meshes.remove(me)
gl = obj_from(gills, 'Gills', 'gills', (0, 0, CAP_Z), False); parent(gl, cap)

# --- the face (on the front of the stem, -Y), each part at its pivot.
for s, name in ((1, 'L'), (-1, 'R')):
    eye = obj_from(ellipsoid(.072, .032, .092, 16, 10), f'Eye{name}', 'eye', (s * .10, -.267, .10)); parent(eye, body)
    pupil = obj_from(ellipsoid(.027, .009, .04, 12, 8), f'Pupil{name}', 'pupil', (s * .10, -.298, .095)); parent(pupil, body)
    cheek = obj_from(ellipsoid(.052, .009, .025, 12, 8), f'Cheek{name}', 'blush', (s * .19, -.286, .005)); parent(cheek, body)
    bb = bmesh.new(); bmesh.ops.create_cube(bb, size=1); bmesh.ops.scale(bb, vec=(.085, .025, .022), verts=bb.verts[:])
    brow = obj_from(bb, f'Brow{name}', 'brow', (s * .10, -.275, .225)); parent(brow, body)
mouth = obj_from(ellipsoid(.05, .012, .026, 14, 8), 'Mouth', 'dark', (0, -.296, -.015)); parent(mouth, body)

# --- root arms, pivoting at the shoulder; three rootlet fingers each.
for s, name in ((1, 'L'), (-1, 'R')):
    shoulder = Vector((s * .2, -.02, .02))
    pts = [Vector((0, 0, 0)), Vector((s * .08, -.02, -.03)), Vector((s * .15, -.05, -.10)), Vector((s * .19, -.08, -.17))]
    arm = tube(pts, [.052, .047, .04, .034], f'arm{name}'); arm.data.materials.append(M['root'])
    fingers = []
    for k, off in enumerate((-.03, 0, .03)):
        tip = pts[-1] + Vector((s * .05 + off * .5, -.03 + off, -.07 - abs(off)))
        f = tube([pts[-1], pts[-1].lerp(tip, .5) + Vector((0, -.01, 0)), tip], [.022, .016, .006], f'f{name}{k}'); f.data.materials.append(M['root']); fingers.append(f)
    leaf = obj_from(ellipsoid(.06, .03, .012, 10, 6), f'wl{name}', 'moss', (s * .12, -.03, -.06))
    a = join([arm] + fingers + [leaf], f'Arm{name}')
    for p in a.data.polygons: p.use_smooth = True
    a.location = shoulder; parent(a, body)

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

