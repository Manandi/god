"""
The Warden's Hollow: the boss arena before the Canopy Gate (Verdant Reach).

    blender -b --python first-person-verdant/tools/blender/build_arena.py -- [--out PATH.glb] [--preview PATH.png] [--tex 2048]

Built around the arena centre; the game places it at ARENA in src/world.js and
flattens the terrain under it. Blender axes: the Canopy Gate stands at +Y
(18 m out), the lantern trail enters from -X. In three.js that is gate at -Z,
trail from -X.

Pieces (object names are what the game looks up):
  Plaza      broken flagstones in rings, and a central dais with a sigil
  Menhirs    a ring of rune-cut standing stones, some broken, with gaps for
             the trail and the gate
  Roots      giant roots arching over the clearing like a nave
  GateRoots  roots grown out of the gate pillars down into the Warden's bed;
             the game withers them when the Warden is released
  Runes, Lanterns  emissive details
  COL_*      empties marking solid things: custom props r (radius), h (height)
"""
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from procedural import link, activate, apply_all, smooth, sstep, mesh_obj, join, tube, material, hexc, N, bake, root_nodes

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default): return ARGS[ARGS.index(name) + 1] if name in ARGS else default
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '../../public/arena/warden-hollow.glb')))
PREVIEW = arg('--preview', None)
TEX = int(arg('--tex', 2048))
random.seed(29)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
GATE = Vector((0, 18, 0)); BED = Vector((0, 9, 0))
ENTRANCE, GATE_ANGLE = math.pi, math.pi / 2          # trail from -X, gate at +Y
def angle_gap(a, centre, width): return abs(math.atan2(math.sin(a - centre), math.cos(a - centre))) < width

colliders = []
def collider(x, y, r, h):
    e = link(bpy.data.objects.new(f'COL_{len(colliders)}', None)); e.location = (x, y, 0)
    e['r'] = round(r, 2); e['h'] = round(h, 2); colliders.append(e)

# ------------------------------------------------------------------- plaza
def jitter(bm, verts, amount):
    for v in verts: v.co += Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-.3, 1))) * amount

def build_plaza():
    bm = bmesh.new()
    r = 2.6
    while r < 16.5:
        width = 1.5; n = int(2 * math.pi * r / 1.45); a0 = random.random()
        for i in range(n):
            a = a0 + i * 2 * math.pi / n
            if random.random() < .12 + sstep(10, 16, r) * .35: continue           # broken, grass shows through
            if angle_gap(a, GATE_ANGLE, .12) and r > 6: continue
            arc = 2 * math.pi * r / n * .9; h = random.uniform(.1, .2)
            g = bmesh.ops.create_cube(bm, size=1)
            bmesh.ops.scale(bm, vec=(arc, width * .9, h), verts=g['verts'])
            jitter(bm, g['verts'], .025)
            m = Matrix.Translation((math.cos(a) * r, math.sin(a) * r, h / 2 - .07)) @ Matrix.Rotation(a - math.pi / 2, 4, 'Z') \
                @ Matrix.Rotation(random.uniform(-.04, .04), 4, 'X') @ Matrix.Rotation(random.uniform(-.04, .04), 4, 'Y')
            bmesh.ops.transform(bm, matrix=m, verts=g['verts'])
        r += width
    # The dais: a low round stone at the centre.
    g = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=2.35, radius2=2.2, depth=.32)
    bmesh.ops.translate(bm, vec=(0, 0, .09), verts=g['verts'])
    return mesh_obj('Plaza', bm)

# ----------------------------------------------------------------- menhirs
def merge(bm, part, matrix):
    """Transform a separate bmesh and append it to bm."""
    bmesh.ops.transform(part, matrix=matrix, verts=part.verts[:])
    me = bpy.data.meshes.new('tmp'); part.to_mesh(me); part.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)

def rock(h, w, seed):
    part = bmesh.new(); bmesh.ops.create_icosphere(part, subdivisions=3, radius=1)
    for v in part.verts:
        c = v.co.copy(); d = 1 + .18 * noise.noise(c * 1.7 + Vector((seed, 0, 0))) + .06 * noise.noise(c * 5 + Vector((0, seed, 0)))
        v.co = Vector((c.x * w * d, c.y * w * .75 * d, (c.z + 1) * h / 2 * (1 + .05 * noise.noise(c * 3))))
        v.co.x *= 1 - .25 * sstep(0, h, v.co.z); v.co.y *= 1 - .25 * sstep(0, h, v.co.z)   # tapering toward the top
    return part

def build_menhirs():
    bm = bmesh.new(); runes = bmesh.new(); k = 0
    for i in range(16):
        a = i * 2 * math.pi / 16 + .1
        if angle_gap(a, ENTRANCE, .32) or angle_gap(a, GATE_ANGLE, .3): continue
        r = 20 + random.uniform(-.6, .8); x, y = math.cos(a) * r, math.sin(a) * r
        broken = k % 3 == 1; k += 1
        h = random.uniform(4.2, 6.4); w = random.uniform(.85, 1.15)
        part = rock(h, w, i * 3.1)
        if broken:
            cut = h * random.uniform(.4, .6)
            for v in part.verts: v.co.z = min(v.co.z, cut + .35 * v.co.x)
            merge(bm, rock(h * .45, w * .8, i * 7.3),   # the fallen top lies beside it
                  Matrix.Translation((x + math.cos(a + 1.6) * 2.2, y + math.sin(a + 1.6) * 2.2, .5)) @ Matrix.Rotation(1.45, 4, 'Y') @ Matrix.Rotation(a, 4, 'Z'))
            collider(x + math.cos(a + 1.6) * 2.2, y + math.sin(a + 1.6) * 2.2, 1.1, 1.2)
            h = cut
        merge(bm, part, Matrix.Translation((x, y, -.3)) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z') @ Matrix.Rotation(random.uniform(-.06, .06), 4, 'X'))
        collider(x, y, 1.0 * w + .15, h)
        # Waymaker glyphs cut into the face that looks into the clearing.
        inward = Vector((-math.cos(a), -math.sin(a), 0))
        for j in range(int(h // 1.1)):
            g = bmesh.ops.create_cube(runes, size=1)
            bmesh.ops.scale(runes, vec=(random.choice((.12, .34, .22)), .05, random.choice((.16, .3))), verts=g['verts'])
            face = Vector((x, y, 0)) + inward * (w * .78 - .08 * j) + Vector((0, 0, .9 + j * .8))
            bmesh.ops.transform(runes, matrix=Matrix.Translation(face) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z'), verts=g['verts'])
    return mesh_obj('Menhirs', bm), mesh_obj('Runes', runes)

# ------------------------------------------------------------------- roots
def arch(p0, p1, height, r0, r1, name, wobble=.8, seed=0):
    pts, rad = [], []
    for t in np.linspace(0, 1, 16):
        p = p0.lerp(p1, t); p.z += math.sin(t * math.pi) * height
        k = Vector((t * 2.2, seed, 0))
        p += Vector((noise.noise(k), noise.noise(k + Vector((0, 0, 3))), .5 * noise.noise(k + Vector((0, 0, 6))))) * wobble
        p += Vector((noise.noise(k * 3.1), noise.noise(k * 3.1 + Vector((0, 0, 9))), 0)) * wobble * .35
        flare = 1 + .7 * (sstep(.18, 0, t) + sstep(.82, 1, t))          # buttressed feet
        rad.append((r0 + (r1 - r0) * t) * (1 - .45 * math.sin(t * math.pi)) * flare); pts.append(p)
    return tube(pts, rad, name)

def build_roots():
    out = []
    for i, (a0, a1, hgt) in enumerate([(-2.2, 1.25, 15), (-1.0, 1.95, 13), (2.6, .7, 12), (-.2, 2.35, 11), (3.6, 1.6, 14)]):
        p0 = Vector((math.cos(a0) * 28, math.sin(a0) * 28, -1)); p1 = Vector((math.cos(a1) * 25, math.sin(a1) * 25, -1))
        out.append(arch(p0, p1, hgt, 1.5, 1.2, f'root{i}', 2.4, i * 1.7))
        for p in (p0, p1): collider(p.x, p.y, 1.9, 3)
        for j, (t, foot) in enumerate(((.2, p0), (.8, p1))):     # side roots splitting off toward the ground
            side = Vector((-(p1 - p0).y, (p1 - p0).x, 0)).normalized() * (1 if j else -1) * 5
            start = p0.lerp(p1, t); start.z += math.sin(t * math.pi) * hgt * .95
            out.append(arch(start, foot + side, 1.5, .7, .45, f'side{i}{j}', 1.0, i * 5 + j))
    # Lesser roots crawling over the edge of the clearing.
    for i in range(9):
        a = random.uniform(0, 2 * math.pi)
        if angle_gap(a, ENTRANCE, .4): continue
        p0 = Vector((math.cos(a) * 30, math.sin(a) * 30, -.4)); p1 = Vector((math.cos(a + .25) * 19, math.sin(a + .25) * 19, -.5))
        out.append(arch(p0, p1, 1.4, .55, .25, f'crawl{i}', .5, 20 + i))
    return join(out, 'Roots')

def build_gate_roots():
    out = []
    for i, (px, pz, ex, ey) in enumerate([(-3.2, 9, -3.8, 7), (3.2, 8, 3.6, 7.5), (-3.2, 5, -2.4, 11.5), (3.2, 4, 2.7, 12), (-3.2, 7, -4.6, 10), (3.2, 6.5, 4.8, 9.5), (0, 10, .6, 12.8)]):
        p0 = Vector((px, 18, pz)); p1 = Vector((ex, ey, -.35))
        pts, rad = [], []
        for t in np.linspace(0, 1, 10):
            p = p0.lerp(p1, t); p.z = p0.z * (1 - t) ** 1.6 + p1.z * t + math.sin(t * math.pi) * 1.2
            p += Vector((noise.noise(Vector((t * 2.5, i, 0))), noise.noise(Vector((t * 2.5, i, 4))), .4 * noise.noise(Vector((t * 2.5, i, 8))))) * 1.1
            pts.append(p); rad.append((.5 - .22 * t) * (1 + .6 * sstep(.85, 1, t)))
        out.append(tube(pts, rad, f'gate{i}'))
    return join(out, 'GateRoots')

def build_lanterns():
    posts, lights = bmesh.new(), bmesh.new()
    for side in (-1, 1):
        x, y = -19.5, side * 4.2
        g = bmesh.ops.create_cone(posts, cap_ends=True, segments=10, radius1=.2, radius2=.14, depth=2.5)
        bmesh.ops.translate(posts, vec=(x, y, 1.25), verts=g['verts'])
        g = bmesh.ops.create_icosphere(lights, subdivisions=1, radius=.36)
        bmesh.ops.scale(lights, vec=(1, 1, 1.4), verts=g['verts']); bmesh.ops.translate(lights, vec=(x, y, 2.85), verts=g['verts'])
        collider(x, y, .35, 3)
    return mesh_obj('LanternPosts', posts), mesh_obj('Lanterns', lights)

# --------------------------------------------------------------- materials
def stone_nodes(nt, bsdf):
    n = N(nt)
    big = n.noise(1.3, 5); grain = n.noise(14, 6); cracks = n.voronoi(3.2)
    up = n.node('ShaderNodeSeparateXYZ'); nt.links.new(n.node('ShaderNodeNewGeometry').outputs['Normal'], up.inputs[0])
    base = n.mix(hexc('#59604f'), hexc('#8a8c78'), n.ramp(big, 0, 1, .35, .7))
    base = n.mix(base, hexc('#3e4535'), n.ramp(grain, 0, .5, .4, .8))
    moss = n.math('MULTIPLY', n.ramp(up.outputs['Z'], 0, 1, .45, .9), n.ramp(n.noise(2.5, 4), 0, 1, .45, .62))
    base = n.mix(base, hexc('#4d6e2e'), moss)
    base = n.mix(base, hexc('#23271e'), n.ramp(cracks, .8, 0, 0, .05))
    n.out(base, bsdf.inputs['Base Color'])
    n.bump(n.math('ADD', grain, n.ramp(cracks, -1, 0, 0, .05), clamp=False), .7, bsdf, .08)

stone = material('M_Stone', stone_nodes, rough=.95)
plaza = build_plaza(); plaza.data.materials.append(stone)
menhirs, runes = build_menhirs(); menhirs.data.materials.append(stone)
runes.data.materials.append(material('M_Rune', color=hexc('#9ef0cf'), emission=hexc('#63f2c4'), strength=3, rough=.4))
roots = build_roots(); roots.data.materials.append(material('M_ArenaRoots', root_nodes, rough=.9))
gate_roots = build_gate_roots(); gate_roots.data.materials.append(material('M_GateRoots', root_nodes, rough=.9))
posts, lanterns = build_lanterns()
posts.data.materials.append(material('M_Wood', color=hexc('#4a3a28'), rough=.9))
lanterns.data.materials.append(material('M_Lantern', color=hexc('#ffe2a0'), emission=hexc('#ffd18a'), strength=6, rough=.4))
for o in (plaza, menhirs, roots, gate_roots, posts): smooth(o)
for o in (plaza,):
    for p in o.data.polygons: p.use_smooth = False

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 4
stones = join([plaza, menhirs], 'Stones')
print('BAKING…')
bake(stones, TEX); bake(roots, TEX); bake(gate_roots, TEX // 2)

tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('TRIANGLES', tris, 'COLLIDERS', len(colliders))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP', export_image_quality=84,
                          export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False, export_extras=True, export_animations=False)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')

if PREVIEW:
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.4, .5, .46, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 3; sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    ground = bpy.data.meshes.new('g'); ground.from_pydata([(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [], [(0, 1, 2, 3)])
    g = link(bpy.data.objects.new('ground', ground)); g.data.materials.append(material('M_G', color=hexc('#4f6a3a'), rough=1))
    for s in (-1, 1):   # stand-ins for the game's gate pillars
        bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 3.2, 18, 5)); bpy.context.object.scale = (2, 2, 10)
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 22
    cam.location = (-30, -22, 16); d = Vector((0, 6, 1)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = 960, 600; scene.cycles.samples = 20
    scene.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True)
