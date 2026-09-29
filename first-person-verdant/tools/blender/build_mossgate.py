"""
Mossgate set dressing: props that fill the ChatGPT-designed town without
changing it (its houses, square, palisade, stalls and NPCs stay as they are).

    blender -b --python first-person-verdant/tools/blender/build_mossgate.py -- [--out PATH.glb] [--preview PATH.png]

Flat-shaded, blocky and in the town's own palette (timber, plaster, moss-green
roofs, bronze lamps) so they sit beside the block houses and block NPCs.
Every prop is one object at the origin, named for the game to clone:
  Barrel Crate CrateStack Sacks Firewood Planter Bench Well Signpost
  LanternPost Cart StallCounter WindowBox Chimney Bunting
Axes (Blender): Z up; a prop's front faces +X. 1 unit = 1 m.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from procedural import link, mesh_obj, join, material, hexc

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default): return ARGS[ARGS.index(name) + 1] if name in ARGS else default
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '../../public/sites/mossgate-props.glb')))
PREVIEW = arg('--preview', None)
random.seed(5)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def T(x, y, z): return Matrix.Translation((x, y, z))
def Rz(a): return Matrix.Rotation(a, 4, 'Z')
def Rx(a): return Matrix.Rotation(a, 4, 'X')
def Ry(a): return Matrix.Rotation(a, 4, 'Y')

# The town's palette (world.js buildCity), plus a few goods colours.
MAT = {k: material(f'MG_{k}', color=hexc(c), rough=r, emission=hexc(e) if e else None, strength=s) for k, (c, r, e, s) in {
    'timber': ('#695b45', .95, None, 0), 'dark': ('#43382a', .95, None, 0), 'plaster': ('#b3ad91', .95, None, 0), 'roof': ('#3f5d4b', .95, None, 0),
    'stone': ('#8d8a78', .95, None, 0), 'iron': ('#3b3a36', .6, None, 0), 'bronze': ('#b89554', .6, '#6d4a21', .6),
    'glow': ('#ffe2a0', .4, '#ffc870', 4), 'window': ('#e8c27a', .4, '#d69a45', 1.2), 'soil': ('#3c2d20', 1, None, 0),
    'leaf': ('#4f7a3a', .9, None, 0), 'petal_w': ('#ece6cf', .8, None, 0), 'petal_y': ('#e6c14e', .8, None, 0), 'petal_v': ('#8f6fb5', .8, None, 0),
    'apple': ('#b0412e', .6, None, 0), 'orange': ('#d98a36', .6, None, 0), 'cabbage': ('#8fb45a', .8, None, 0), 'sack': ('#c2ad84', 1, None, 0),
    'cloth_r': ('#9a4b36', 1, None, 0), 'cloth_g': ('#66815a', 1, None, 0), 'cloth_y': ('#c9a54a', 1, None, 0), 'water': ('#3f8e8f', .2, None, 0)}.items()}

class Proto:
    """One prop: parts per material, joined into a single multi-material object."""
    def __init__(self, name): self.name = name; self.parts = {}
    def bm(self, mat): return self.parts.setdefault(mat, bmesh.new())
    def box(self, mat, sx, sy, sz, m):
        g = bmesh.ops.create_cube(self.bm(mat), size=1)['verts']
        bmesh.ops.scale(self.bm(mat), vec=(sx, sy, sz), verts=g); bmesh.ops.transform(self.bm(mat), matrix=m, verts=g)
    def cyl(self, mat, r1, r2, h, m, segs=8):
        g = bmesh.ops.create_cone(self.bm(mat), cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=h)['verts']
        bmesh.ops.transform(self.bm(mat), matrix=m @ T(0, 0, h / 2), verts=g)
    def ball(self, mat, r, m, sub=1):
        g = bmesh.ops.create_icosphere(self.bm(mat), subdivisions=sub, radius=r)['verts']; bmesh.ops.transform(self.bm(mat), matrix=m, verts=g)
    def build(self):
        objs = []
        for mat, bm in self.parts.items():
            o = mesh_obj(f'{self.name}_{mat}', bm); o.data.materials.append(MAT[mat]); objs.append(o)
        if len(objs) > 1: return join(objs, self.name)
        objs[0].name = objs[0].data.name = self.name; return objs[0]

def flowers(p, x, y, z, w, d, n=10):
    for i in range(n):
        px, py = x + random.uniform(-w / 2, w / 2), y + random.uniform(-d / 2, d / 2)
        p.cyl('leaf', .03, .02, .22, T(px, py, z), 4)
        p.ball(random.choice(('petal_w', 'petal_y', 'petal_v')), .07, T(px, py, z + .25), 0)
        p.box('leaf', .16, .06, .02, T(px, py, z + .1) @ Rz(random.uniform(0, 3)))

def barrel(p, m=Matrix()):
    p.cyl('timber', .38, .42, .5, m, 10); p.cyl('timber', .42, .38, .5, m @ T(0, 0, .5), 10)
    for z in (.12, .5, .88): p.cyl('iron', .43, .43, .06, m @ T(0, 0, z - .03), 10)
    p.cyl('dark', .36, .36, .03, m @ T(0, 0, 1.0), 10)

def crate(p, m=Matrix(), s=.8):
    p.box('timber', s, s, s, m @ T(0, 0, s / 2))
    for sx in (-1, 1):
        for sy in (-1, 1): p.box('dark', .08, .08, s + .02, m @ T(sx * s / 2, sy * s / 2, s / 2))
    for z in (.02, s - .02):
        for sx in (-1, 1): p.box('dark', .08, s, .08, m @ T(sx * s / 2, 0, z)); p.box('dark', s, .08, .08, m @ T(0, sx * s / 2, z))

def sack(p, m):
    p.ball('sack', .32, m @ T(0, 0, .3) @ Matrix.Diagonal((1, .9, 1.1, 1))); p.cyl('sack', .12, .06, .18, m @ T(0, 0, .6), 6)

def build_all():
    out = []
    p = Proto('Barrel'); barrel(p); out.append(p.build())
    p = Proto('Crate'); crate(p); out.append(p.build())
    p = Proto('CrateStack'); crate(p, T(-.45, 0, 0)); crate(p, T(.45, .05, 0) @ Rz(.1)); crate(p, T(0, 0, .8) @ Rz(.35), .7); out.append(p.build())
    p = Proto('Sacks'); sack(p, T(0, 0, 0)); sack(p, T(.5, .2, 0) @ Rz(.8)); sack(p, T(.2, -.45, 0) @ Rz(2)); sack(p, T(.25, -.05, .45) @ Ry(.9)); out.append(p.build())
    p = Proto('Firewood')
    for row in range(4):
        for k in range(5 - row):
            p.cyl('timber', .13, .13, 1.2, T(-.6, (k - (4 - row) / 2) * .27, .13 + row * .23) @ Ry(math.pi / 2), 7)
    for s in (-1, 1): p.box('dark', .1, .1, 1.1, T(0, s * .78, .55))
    out.append(p.build())
    p = Proto('Planter'); p.box('timber', 1.5, .62, .45, T(0, 0, .225)); p.box('dark', 1.58, .7, .08, T(0, 0, .45)); p.box('soil', 1.36, .5, .05, T(0, 0, .46))
    flowers(p, 0, 0, .48, 1.2, .4, 12); out.append(p.build())
    p = Proto('Bench'); p.box('timber', .5, 2.0, .1, T(0, 0, .48)); p.box('timber', .1, 2.0, .45, T(-.24, 0, .8) @ Ry(-.12))
    for s in (-1, 1): p.box('dark', .45, .12, .45, T(0, s * .8, .22))
    out.append(p.build())
    # The well: a stone ring, two posts, a winch and a little moss-green roof.
    p = Proto('Well')
    for i in range(12):
        a = i / 12 * math.tau
        for k in range(2): p.box('stone', .52, .3, .38, T(math.cos(a + k * .26) * .95, math.sin(a + k * .26) * .95, .19 + k * .38) @ Rz(a + k * .26 + math.pi / 2))
    p.cyl('water', .82, .82, .02, T(0, 0, .5), 16)
    for s in (-1, 1): p.box('timber', .16, .16, 2.2, T(0, s * 1.05, 1.1))
    p.cyl('dark', .09, .09, 2.2, T(0, -1.1, 1.75) @ Rx(-math.pi / 2), 8); p.box('dark', .06, .06, .35, T(0, 1.25, 1.62))
    p.cyl('iron', .02, .02, .5, T(0, 0, 1.25), 4); barrel_bucket = T(0, 0, .95)
    p.cyl('timber', .17, .2, .3, barrel_bucket, 8); p.cyl('iron', .21, .21, .04, barrel_bucket @ T(0, 0, .22), 8)
    for s in (-1, 1): p.box('roof', 1.25, 2.6, .1, T(s * .5, 0, 2.45) @ Ry(s * .6))
    p.box('dark', .12, 2.7, .12, T(0, 0, 2.78)); out.append(p.build())
    p = Proto('Signpost'); p.box('timber', .16, .16, 2.9, T(0, 0, 1.45)); p.box('dark', .24, .24, .12, T(0, 0, 2.95))
    for k, (z, a) in enumerate(((2.45, .3), (2.05, 2.2), (1.65, -1.1))):
        p.box('plaster', 1.0, .07, .26, Rz(a) @ T(.55, 0, z)); p.box('plaster', .18, .07, .18, Rz(a) @ T(1.1, 0, z) @ Ry(math.pi / 4))
    out.append(p.build())
    p = Proto('LanternPost'); p.box('timber', .18, .18, 3.1, T(0, 0, 1.55)); p.box('timber', .9, .1, .1, T(.4, 0, 3.0)); p.box('dark', .3, .3, .3, T(0, 0, .15))
    p.cyl('iron', .015, .015, .25, T(.78, 0, 2.7), 4); p.box('bronze', .3, .3, .06, T(.78, 0, 2.68)); p.box('glow', .22, .22, .3, T(.78, 0, 2.47))
    p.box('bronze', .3, .3, .06, T(.78, 0, 2.3)); p.cyl('bronze', .2, .02, .14, T(.78, 0, 2.71), 4)
    out.append(p.build())
    p = Proto('Cart'); p.box('timber', 2.2, 1.3, .12, T(0, 0, .75))
    for s in (-1, 1): p.box('timber', 2.2, .08, .4, T(0, s * .63, .99)); p.box('timber', .08, 1.3, .4, T(s * 1.06, 0, .99))
    for s in (-1, 1):
        p.cyl('dark', .5, .5, .1, T(-.25, s * .75, .5) @ Rx(math.pi / 2) @ T(0, 0, -.05), 12); p.cyl('iron', .12, .12, .14, T(-.25, s * .78, .5) @ Rx(math.pi / 2) @ T(0, 0, -.07), 6)
        p.box('timber', 1.6, .08, .08, T(1.9, s * .45, .72) @ Ry(.18))
    sack(p, T(-.4, -.2, .8)); sack(p, T(.3, .25, .8) @ Rz(1)); crate(p, T(.55, -.25, .8), .5); out.append(p.build())
    p = Proto('StallCounter'); p.box('timber', 2.5, .9, .08, T(0, 0, .92)); p.box('cloth_r', 2.52, .05, .5, T(0, .45, .68))
    for sx in (-1, 1):
        for sy in (-1, 1): p.box('dark', .1, .1, .9, T(sx * 1.15, sy * .38, .45))
    for i, (x, goods) in enumerate(((-.8, 'apple'), (0, 'cabbage'), (.8, 'orange'))):
        p.cyl('timber', .28, .34, .18, T(x, 0, .96), 10)
        for k in range(7): p.ball(goods, .09 if goods != 'cabbage' else .13, T(x + random.uniform(-.17, .17), random.uniform(-.17, .17), 1.16 + (k > 4) * .08), 0)
    crate(p, T(-.6, -.9, 0), .6); barrel(p, T(.9, -.95, 0)); out.append(p.build())
    # A shuttered window with a flower box, for the house walls (front faces +X).
    p = Proto('WindowBox'); p.box('window', .04, .9, .8, T(0, 0, 0)); p.box('dark', .1, 1.05, .1, T(.03, 0, .45)); p.box('dark', .1, 1.05, .1, T(.03, 0, -.45))
    for s in (-1, 1): p.box('dark', .1, .1, .95, T(.03, s * .5, 0)); p.box('roof', .06, .5, .95, T(.18, s * .78, 0) @ Rz(s * .5))
    p.box('dark', .06, .06, .8, T(.03, 0, 0)); p.box('timber', .32, 1.0, .24, T(.17, 0, -.58)); p.box('soil', .26, .92, .04, T(.17, 0, -.45))
    flowers(p, .17, 0, -.46, .2, .85, 8); out.append(p.build())
    p = Proto('Chimney'); p.box('stone', .75, .75, 2.8, T(0, 0, 1.4)); p.box('stone', .9, .9, .16, T(0, 0, 2.86)); p.box('dark', .5, .5, .05, T(0, 0, 2.95))
    out.append(p.build())
    # Bunting: pennants on a sagging line, 9 m end to end along +Y.
    p = Proto('Bunting'); span = 9; n = 20
    for i in range(n + 1):
        t = i / n; y = -span / 2 + span * t; z = -math.sin(t * math.pi) * .9
        if i < n: p.box('iron', .02, span / n * 1.02, .02, T(0, y + span / n / 2, -math.sin((t + .5 / n) * math.pi) * .9))
        if 0 < i < n:
            bm = p.bm(('cloth_r', 'cloth_g', 'cloth_y')[i % 3]); a = bm.verts.new((0, y - .17, z)); b = bm.verts.new((0, y + .17, z)); c = bm.verts.new((0, y, z - .42))
            bm.faces.new((a, b, c))   # one-sided mesh; the material is double-sided
    out.append(p.build())
    return out

props = build_all()
for o in props:
    for poly in o.data.polygons: poly.use_smooth = False
tris = sum(len(p.vertices) - 2 for o in props for p in o.data.polygons)
print('PROPS', [o.name for o in props], 'TRIANGLES', tris)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in props: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_normals=True, export_texcoords=False,
                          export_cameras=False, export_lights=False, export_extras=True, export_animations=False)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')

if PREVIEW:   # the whole kit laid out in a row
    x = 0
    for o in props: o.location = (0, x, 0); x += 3.2
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.45, .52, .5, 1)
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(60))
    ground = bpy.data.meshes.new('g'); ground.from_pydata([(-30, -10, 0), (30, -10, 0), (30, 60, 0), (-30, 60, 0)], [], [(0, 1, 2, 3)])
    g = link(bpy.data.objects.new('ground', ground)); g.data.materials.append(material('M_G', color=hexc('#5d6e45'), rough=1))
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 24
    cam.location = (15, x / 2, 8); d = Vector((0, x / 2, 1)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 16; scene.render.resolution_x, scene.render.resolution_y = 1280, 480
    scene.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True); print('PREVIEW', PREVIEW)
