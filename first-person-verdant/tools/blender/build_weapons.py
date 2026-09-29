"""
The explorer's weapons (The Hollow Roots, Verdant Reach).

    blender -b --python first-person-verdant/tools/blender/build_weapons.py -- [--out PATH.glb] [--preview PATH.png]

  Groveblade    a living-wood sword: a leaf-shaped heartwood blade with a
                glowing sap vein, a crossguard of two curling roots around a
                seed gem, a leather-wrapped grip and an acorn pommel
  Stonebreaker  a maul: a hewn stone head bound with bronze straps and roots,
                a glowing rune on each striking face, on a long
                root-bound haft with bronze collars

Each weapon is one object with its grip centred on the origin and its business
end toward -Z (the game's -Y: out of the fist along the hand bone). Empties
WeaponBase and WeaponTip (children) mark the striking segment, which the game
uses as the hitbox, so what you see is what hits. 1 unit = 1 m.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from procedural import link, mesh_obj, join, material, hexc, tube

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default): return ARGS[ARGS.index(name) + 1] if name in ARGS else default
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '../../public/characters/weapons/weapons.glb')))
PREVIEW = arg('--preview', None)
random.seed(3)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
def T(x, y, z): return Matrix.Translation((x, y, z))
def R(a, axis): return Matrix.Rotation(a, 4, axis)

MAT = {
    'heartwood': material('W_Heartwood', color=hexc('#d9cfa4'), rough=.45, metallic=.15),
    'vein': material('W_Vein', color=hexc('#9ef0cf'), emission=hexc('#5ff0c0'), strength=3.5, rough=.3),
    'root': material('W_Root', color=hexc('#5b4630'), rough=.85),
    'leather': material('W_Leather', color=hexc('#3a2a1e'), rough=.9),
    'gem': material('W_Seed', color=hexc('#b8ffe4'), emission=hexc('#63f2c4'), strength=5, rough=.15),
    'stone': material('W_Stone', color=hexc('#7d8374'), rough=.95),
    'bronze': material('W_Bronze', color=hexc('#b89554'), rough=.4, metallic=.8),
    'rune': material('W_Rune', color=hexc('#ffd79a'), emission=hexc('#ffb54f'), strength=4, rough=.4),
    'haft': material('W_Haft', color=hexc('#6b5238'), rough=.8),
}

class Part:
    def __init__(self, name): self.name = name; self.bms = {}
    def bm(self, m): return self.bms.setdefault(m, bmesh.new())
    def add(self, m, part, matrix=Matrix()):
        bmesh.ops.transform(part, matrix=matrix, verts=part.verts[:])
        me = bpy.data.meshes.new('t'); part.to_mesh(me); part.free(); self.bm(m).from_mesh(me); bpy.data.meshes.remove(me)
    def obj(self, m, o): o.data.materials.clear(); o.data.materials.append(MAT[m]); return o
    def build(self, extra=()):
        objs = [self.obj(m, mesh_obj(f'{self.name}_{m}', bm)) for m, bm in self.bms.items()] + list(extra)
        o = join(objs, self.name)
        for p in o.data.polygons: p.use_smooth = True
        return o

def cyl(r1, r2, h, segs=12):
    b = bmesh.new(); bmesh.ops.create_cone(b, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=h); return b
def cube(sx, sy, sz):
    b = bmesh.new(); bmesh.ops.create_cube(b, size=1); bmesh.ops.scale(b, vec=(sx, sy, sz), verts=b.verts[:]); return b
def marker(parent, name, co):
    e = link(bpy.data.objects.new(name, None)); e.location = co; e.parent = parent; e.empty_display_size = .03

# ---------------------------------------------------------------- Groveblade
def leaf_blade(length=.98, width=.18, thick=.04, base=-.13):   # chunky, to sit with the block hands
    """A diamond-section leaf blade from z=base down to z=base-length, gently curved."""
    b = bmesh.new(); rows = []
    for i in range(24):
        t = i / 23; z = base - t * length
        w = width * (math.sin(min(1, t * 1.25) * math.pi * .62 + .35) * (1 - t ** 3)) + .012 * (1 - t)
        w *= 1 + .05 * math.sin(t * 40) * t          # a faint leaf serration toward the tip
        bend = .05 * math.sin(t * math.pi) * t        # curve toward the edge
        rows.append([b.verts.new((w / 2 + bend, 0, z)), b.verts.new((bend, thick / 2, z)), b.verts.new((-w / 2 + bend, 0, z)), b.verts.new((bend, -thick / 2, z))])
    tip = b.verts.new((.02, 0, base - length - .07))
    for r0, r1 in zip(rows, rows[1:]):
        for k in range(4): b.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    for k in range(4): b.faces.new((rows[-1][k], rows[-1][(k + 1) % 4], tip))
    b.faces.new(rows[0][::-1])
    return b

def build_groveblade():
    p = Part('Groveblade')
    p.add('heartwood', leaf_blade())
    # The sap vein: a thin glowing inlay on both faces.
    for s in (1, -1):
        v = bmesh.new(); pts = []
        for i in range(16):
            t = i / 15; z = -.16 - t * .78; bend = .05 * math.sin(t * math.pi) * t
            pts.append(v.verts.new((bend - .008, s * .0212, z))); pts.append(v.verts.new((bend + .008, s * .0212, z)))
        for i in range(0, len(pts) - 2, 2): v.faces.new((pts[i], pts[i + 1], pts[i + 3], pts[i + 2]) if s > 0 else (pts[i + 2], pts[i + 3], pts[i + 1], pts[i]))
        p.add('vein', v)
    # Grip: leather wraps in a spiral of rings, and an acorn pommel.
    p.add('leather', cyl(.034, .036, .24, 10), T(0, 0, .0))
    for i in range(6): p.add('leather', cyl(.04, .04, .02, 10), T(0, 0, -.1 + i * .04) @ R(.25 * (i % 2 - .5), 'X'))
    p.add('root', cyl(.038, .02, .05, 10), T(0, 0, .145))
    acorn = bmesh.new(); bmesh.ops.create_uvsphere(acorn, u_segments=12, v_segments=8, radius=.034); p.add('heartwood', acorn, T(0, 0, .185) @ Matrix.Diagonal((1, 1, 1.3, 1)))
    # Crossguard: two roots curling toward the blade around a seed.
    roots = []
    for s in (1, -1):
        pts = [Vector((s * .02, 0, -.12)), Vector((s * .09, .0, -.115)), Vector((s * .135, .01, -.15)), Vector((s * .12, .0, -.2)), Vector((s * .085, -.01, -.19))]
        roots.append(tube(pts, [.022, .02, .016, .011, .006], f'guard{s}'))
    for o in roots: o.data.materials.append(MAT['root'])
    gem = bmesh.new(); bmesh.ops.create_icosphere(gem, subdivisions=1, radius=.026); p.add('gem', gem, T(0, 0, -.125) @ Matrix.Diagonal((1, .7, 1.25, 1)))
    p.add('root', cube(.06, .045, .03), T(0, 0, -.125))
    o = p.build(roots)
    marker(o, 'WeaponBase', (0, 0, -.16)); marker(o, 'WeaponTip', (.02, 0, -1.16))
    return o

# -------------------------------------------------------------- Stonebreaker
def build_stonebreaker():
    p = Part('Stonebreaker')
    # The haft runs from the pommel (+z) past the fist to the head (-z).
    p.add('haft', cyl(.04, .046, 1.02, 10), T(0, 0, -.33))
    for z in (.16, -.62): p.add('bronze', cyl(.054, .054, .05, 10), T(0, 0, z))
    p.add('bronze', cyl(.06, .04, .07, 8), T(0, 0, .2))
    for i in range(5): p.add('leather', cyl(.049, .049, .024, 10), T(0, 0, -.09 + i * .045))
    # The head: a hewn stone block, rough and chipped.
    head = cube(.5, .28, .28); bmesh.ops.subdivide_edges(head, edges=head.edges[:], cuts=3, use_grid_fill=True)
    for v in head.verts:
        c = v.co.copy(); v.co += Vector((noise.noise(c * 9), noise.noise(c * 9 + Vector((3, 0, 0))), noise.noise(c * 9 + Vector((0, 5, 0))))) * .014
    p.add('stone', head, T(0, 0, -.9))            # across the haft: both ends strike
    # Bronze straps around the head, and roots binding it to the haft.
    for x in (-.14, .14): p.add('bronze', cube(.04, .3, .3), T(x, 0, -.9))
    p.add('bronze', cube(.1, .1, .07), T(0, 0, -.74))
    # A glowing rune set in each striking face, a spike at the back.
    for s in (1, -1):
        r = bmesh.new(); bmesh.ops.create_circle(r, cap_ends=True, segments=6, radius=.07)
        p.add('rune', r, T(s * .252, 0, -.9) @ R(s * math.pi / 2, 'Y'))
    roots = []
    for s in (1, -1):
        pts = [Vector((s * .03, .0, -.55)), Vector((s * .05, .06 * s, -.68)), Vector((s * .09, .1, -.8)), Vector((s * .05, .14, -.95))]
        roots.append(tube(pts, [.018, .02, .016, .01], f'bind{s}'))
    for o in roots: o.data.materials.append(MAT['root'])
    o = p.build(roots)
    for q in o.data.polygons:   # the stone and bronze stay faceted
        if o.data.materials[q.material_index].name in ('W_Stone', 'W_Bronze', 'W_Rune'): q.use_smooth = False
    marker(o, 'WeaponBase', (0, 0, -.62)); marker(o, 'WeaponTip', (0, 0, -1.02))
    return o

weapons = [build_groveblade(), build_stonebreaker()]
tris = sum(len(p.vertices) - 2 for o in weapons for p in o.data.polygons)
print('WEAPONS', [o.name for o in weapons], 'TRIANGLES', tris)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_normals=True, export_texcoords=False,
                          export_cameras=False, export_lights=False, export_extras=True, export_animations=False)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')

if PREVIEW:
    weapons[0].location = (-.25, 0, 1.3); weapons[1].location = (.25, 0, 1.3)
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.3, .36, .34, 1)
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(40), 0, math.radians(30))
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 50
    cam.location = (0, -2.6, .85); d = Vector((0, 0, .8)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.render.resolution_x, scene.render.resolution_y = 700, 800
    scene.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True); print('PREVIEW', PREVIEW)
