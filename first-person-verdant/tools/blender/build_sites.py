"""
The three memory sites of the Verdant Reach (The Hollow Roots).

    blender -b --python first-person-verdant/tools/blender/build_sites.py -- \
        [--out PATH.glb] [--preview PREFIX (renders PREFIX_<site>.png)] [--tex 1024]

One GLB with a root object per site, each built around its own centre:
  Rootwell   the oldest spring: a ring of mossy boulders, a shallow stone-lipped
             pool with lily pads and reeds, a rune-ringed spring stone, and
             three great roots arching over it where the memory hangs
  Mosswatch  the fallen watch-hall: a broken flagstone floor, a colonnade of
             fluted columns (some standing under arches, some fallen), a ruined
             wall with arched windows, two stone sentinels at the dais, ivy
  Shrine     the Canopy Shrine's great tree: flared buttress roots, a twisting
             trunk split by a cleft into the hollow where the memory glows,
             limbs that carry the forest's leaf crowns, and stone lanterns
Each site's approach (the side the player arrives from) is local +X; the game
turns the site to face its road. Also exported, as children of each site:
  COL_*      empties marking solid things: custom props r (radius), h (height)
  CROWN_*    (Shrine) where the game hangs its leaf crowns, at the limb tips
Axes (Blender): Z up; the game's Y. 1 unit = 1 m.
"""
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from procedural import link, activate, apply_all, smooth, sstep, mesh_obj, join, tube, material, hexc, bake, root_nodes, stone_nodes, arch

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default): return ARGS[ARGS.index(name) + 1] if name in ARGS else default
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '../../public/sites/memory-sites.glb')))
PREVIEW = arg('--preview', None)
TEX = int(arg('--tex', 1024))
random.seed(23)
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def T(x, y, z): return Matrix.Translation((x, y, z))
def Rz(a): return Matrix.Rotation(a, 4, 'Z')
def Rx(a): return Matrix.Rotation(a, 4, 'X')
def Ry(a): return Matrix.Rotation(a, 4, 'Y')
def gap(a, centre, width): return abs(math.atan2(math.sin(a - centre), math.cos(a - centre))) < width

def merge(bm, part, matrix):
    """Transform a separate bmesh and append it to bm."""
    bmesh.ops.transform(part, matrix=matrix, verts=part.verts[:])
    me = bpy.data.meshes.new('tmp'); part.to_mesh(me); part.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)

def rock(h, w, seed, taper=.25, depth=.75):
    part = bmesh.new(); bmesh.ops.create_icosphere(part, subdivisions=3, radius=1)
    for v in part.verts:
        c = v.co.copy(); d = 1 + .18 * noise.noise(c * 1.7 + Vector((seed, 0, 0))) + .06 * noise.noise(c * 5 + Vector((0, seed, 0)))
        v.co = Vector((c.x * w * d, c.y * w * depth * d, (c.z + 1) * h / 2 * (1 + .05 * noise.noise(c * 3))))
        v.co.x *= 1 - taper * sstep(0, h, v.co.z); v.co.y *= 1 - taper * sstep(0, h, v.co.z)
    return part

def box(sx, sy, sz, jitter=0):
    part = bmesh.new(); bmesh.ops.create_cube(part, size=1)
    bmesh.ops.scale(part, vec=(sx, sy, sz), verts=part.verts[:])
    for v in part.verts: v.co += Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * jitter
    return part

def cyl(r1, r2, h, segs=12, flute=0):
    part = bmesh.new(); bmesh.ops.create_cone(part, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=h)
    if flute:
        for v in part.verts:
            a = math.atan2(v.co.y, v.co.x); k = 1 - flute * (.5 + .5 * math.cos(a * segs / 2))
            v.co.x *= k; v.co.y *= k
    bmesh.ops.translate(part, vec=(0, 0, h / 2), verts=part.verts[:])
    return part

class Site:
    """A site under construction: its root, its colliders and its markers."""
    def __init__(self, name):
        self.root = link(bpy.data.objects.new(name, None)); self.name = name; self.n = 0
    def own(self, obj): obj.parent = self.root; return obj
    def collider(self, x, y, r, h):
        e = self.own(link(bpy.data.objects.new(f'COL_{self.name}_{self.n}', None))); self.n += 1
        e.location = (x, y, 0); e['r'] = round(r, 2); e['h'] = round(h, 2)
    def marker(self, name, co):
        e = self.own(link(bpy.data.objects.new(name, None))); e.location = co

# --------------------------------------------------------------- materials
M = {
    'stone': material('M_SiteStone', stone_nodes, rough=.95),
    'root': material('M_SiteRoots', root_nodes, rough=.9),
    'rune': material('M_SiteRune', color=hexc('#9ef0cf'), emission=hexc('#63f2c4'), strength=3, rough=.4),
    'lily': material('M_Lily', color=hexc('#4f7f3a'), rough=.7),
    'reed': material('M_Reed', color=hexc('#7d8c4a'), rough=.9),
    'glowcap': material('M_Glowcap', color=hexc('#bfe8d8'), emission=hexc('#7fe0c0'), strength=2.2, rough=.5),
    'ivy': material('M_Ivy', color=hexc('#3f6a2c'), rough=.85),
    'lamp': material('M_SiteLamp', color=hexc('#ffe2a0'), emission=hexc('#ffd18a'), strength=5, rough=.4),
    'cloth': material('M_Ribbon', color=hexc('#a8553a'), rough=.95),
}
def finish(bm, name, mat, site, shade_smooth=True):
    o = site.own(mesh_obj(name, bm)); o.data.materials.append(M[mat])
    if shade_smooth: smooth(o)
    return o

# ================================================================ ROOTWELL
def build_rootwell():
    site = Site('Rootwell'); stones = bmesh.new(); runes = bmesh.new(); lily = bmesh.new(); reeds = bmesh.new(); caps = bmesh.new()
    # The rim: two courses of boulders, open toward the road (+X).
    for i in range(24):
        a = i / 24 * TAU + .05
        if gap(a, 0, .4): continue
        r = 7.25 + random.uniform(-.25, .3); h = random.uniform(1.3, 2.5); w = random.uniform(.95, 1.3)
        merge(stones, rock(h, w, i * 1.3), T(math.cos(a) * r, math.sin(a) * r, -.3) @ Rz(a + math.pi / 2) @ Rx(random.uniform(-.08, .08)))
        if i % 3 == 0:   # a capstone laid across the lower boulders
            merge(stones, rock(.55, .8, i * 4.1, .1, .6), T(math.cos(a + .13) * (r + .1), math.sin(a + .13) * (r + .1), h * .72) @ Rz(a))
        site.collider(math.cos(a) * r, math.sin(a) * r, 1.02, 2.8)
    # The lip the water meets: flat dressed stones in a ring, open at the entrance.
    n = 30
    for i in range(n):
        a = i / n * TAU
        if gap(a, 0, .3): continue
        s = box(2 * math.pi * 6.35 / n * .92, .75, .28, .02)
        merge(stones, s, T(math.cos(a) * 6.35, math.sin(a) * 6.35, .1) @ Rz(a + math.pi / 2) @ Rx(random.uniform(-.05, .05)))
    # Stepping stones through the entrance and into the pool.
    for k, (x, y) in enumerate([(8.2, .3), (7.1, -.4), (6.0, .35), (4.9, -.2), (3.7, .25)]):
        merge(stones, rock(.26, .55, 40 + k, .05, .85), T(x, y, -.05) @ Rz(random.uniform(0, 3)))
    # The spring stone at the centre, ringed with runes, where the water wells up.
    merge(stones, rock(1.0, 1.35, 7.7, .35), T(0, 0, -.2))
    site.collider(0, 0, 1.25, .9)
    for i in range(12):
        a = i / 12 * TAU; g = box(random.choice((.16, .34)), .06, random.choice((.12, .24)))
        merge(runes, g, T(math.cos(a) * 1.28, math.sin(a) * 1.28, .45 + .12 * math.sin(a * 3)) @ Rz(a + math.pi / 2) @ Rx(-.35))
    ring = bmesh.new(); bmesh.ops.create_circle(ring, cap_ends=False, segments=48, radius=1.95)
    merge(runes, ring, T(0, 0, .16))
    # Standing runestones out on the grass, carved on the side facing the spring.
    for i, a in enumerate((1.05, 2.3, 3.6, 4.9)):
        r = 10.6; x, y = math.cos(a) * r, math.sin(a) * r; h = random.uniform(2.2, 3.0)
        merge(stones, rock(h, .7, 60 + i, .35, .6), T(x, y, -.25) @ Rz(a + math.pi / 2))
        for j in range(3):
            g = box(random.choice((.12, .28)), .05, random.choice((.14, .26)))
            merge(runes, g, T(x - math.cos(a) * .42, y - math.sin(a) * .42, .8 + j * .55) @ Rz(a + math.pi / 2))
        site.collider(x, y, .75, h)
    # Lily pads with a notch, and a few pale flowers.
    for i in range(26):
        a = random.uniform(0, TAU); r = random.uniform(2.1, 5.6)
        if gap(a, 0, .25) and r > 3.4: continue
        pad = bmesh.new(); rr = random.uniform(.28, .55)
        bmesh.ops.create_cone(pad, cap_ends=True, segments=14, radius1=rr, radius2=rr, depth=.02)
        bmesh.ops.delete(pad, geom=[v for v in pad.verts if math.atan2(v.co.y, v.co.x) > -.18 and math.atan2(v.co.y, v.co.x) < .18 and v.co.length > .05], context='VERTS')
        merge(lily, pad, T(math.cos(a) * r, math.sin(a) * r, .17) @ Rz(random.uniform(0, TAU)))
        if i % 5 == 0:
            f = bmesh.new(); bmesh.ops.create_cone(f, cap_ends=True, segments=6, radius1=.12, radius2=.05, depth=.12)
            merge(caps, f, T(math.cos(a) * r + .1, math.sin(a) * r, .24))
    # Reeds in clumps against the lip.
    for c in range(9):
        a = random.uniform(0, TAU)
        if gap(a, 0, .5): continue
        cx, cy = math.cos(a) * 5.7, math.sin(a) * 5.7
        for k in range(9):
            h = random.uniform(.9, 1.7); blade = bmesh.new()
            bmesh.ops.create_cone(blade, cap_ends=False, segments=4, radius1=.035, radius2=.004, depth=h)
            merge(reeds, blade, T(cx + random.uniform(-.4, .4), cy + random.uniform(-.4, .4), h / 2 + .1) @ Rx(random.uniform(-.2, .2)) @ Ry(random.uniform(-.2, .2)))
    # Glowing caps nestled at the foot of the rim.
    for i in range(18):
        a = random.uniform(0, TAU)
        if gap(a, 0, .45): continue
        r = random.uniform(7.9, 8.6); s = random.uniform(.6, 1.2)
        stem = cyl(.05 * s, .04 * s, .25 * s, 6); merge(caps, stem, T(math.cos(a) * r, math.sin(a) * r, 0))
        cap = bmesh.new(); bmesh.ops.create_uvsphere(cap, u_segments=10, v_segments=5, radius=.16 * s)
        bmesh.ops.delete(cap, geom=[v for v in cap.verts if v.co.z < -.01], context='VERTS')
        merge(caps, cap, T(math.cos(a) * r, math.sin(a) * r, .24 * s))
    # Three great roots arch over the pool and cradle the memory above it.
    roots = []
    for i, (a0, a1, hgt) in enumerate([(.75, 3.89, 7.4), (1.65, 4.79, 6.6), (2.5, 5.64, 7.9)]):   # feet clear of the entrance
        p0 = Vector((math.cos(a0) * 9.6, math.sin(a0) * 9.6, -.6)); p1 = Vector((math.cos(a1) * 9.6, math.sin(a1) * 9.6, -.6))
        roots.append(arch(p0, p1, hgt, .8, .7, f'wellroot{i}', 1.0, i * 2.3))
        for p in (p0, p1): site.collider(p.x, p.y, 1.2, 2.4)
        top = p0.lerp(p1, .5); top.z += hgt - .6
        for k in range(4):   # tendrils hanging toward the water
            s = Vector((random.uniform(-1.2, 1.2), random.uniform(-1.2, 1.2), 0)); drop = random.uniform(1.6, 3.2)
            pts = [top + s * t + Vector((.15 * math.sin(t * 7 + k), .1 * math.cos(t * 5), -drop * t)) for t in np.linspace(0, 1, 7)]
            roots.append(tube(pts, [.09 * (1 - t * .7) for t in np.linspace(0, 1, 7)], f'tendril{i}{k}'))
    root = site.own(join(roots, 'RootwellRoots')); root.data.materials.append(M['root']); smooth(root)
    out = [finish(stones, 'RootwellStones', 'stone', site), finish(runes, 'RootwellRunes', 'rune', site, False), finish(lily, 'RootwellLilies', 'lily', site, False),
           finish(reeds, 'RootwellReeds', 'reed', site, False), finish(caps, 'RootwellGlowcaps', 'glowcap', site)]
    return site, [out[0], root]

# =============================================================== MOSSWATCH
def column(bm, x, y, h, broken, seed):
    merge(bm, box(1.5, 1.5, .42, .02), T(x, y, .21))
    merge(bm, cyl(.62, .66, .22, 16), T(x, y, .42))
    shaft = cyl(.5, .44, h, 16, flute=.06)
    if broken:
        for v in shaft.verts:
            if v.co.z > h * .5: v.co.z = min(v.co.z, h - .45 + .45 * noise.noise(Vector((v.co.x * 3, v.co.y * 3, seed))) + .3 * v.co.x)
    merge(bm, shaft, T(x, y, .64))
    if not broken:
        merge(bm, cyl(.5, .7, .3, 16), T(x, y, .64 + h))
        merge(bm, box(1.55, 1.55, .32, .02), T(x, y, .94 + h + .16))

def sentinel(bm, x, y, face, broken):
    """A stone sentinel: an armoured warden with its sword point-down before it."""
    M0 = T(x, y, 0) @ Rz(face)
    parts = [(box(1.35, 1.35, .8, .02), (0, 0, .4)), (box(.34, .42, 1.25), (0, .22, 1.43)), (box(.34, .42, 1.25), (0, -.22, 1.43)),
             (box(.5, .95, .5), (0, 0, 2.15)), (box(.62, 1.05, 1.0), (0, 0, 2.8)), (box(.5, .5, .38), (0, .72, 3.2)), (box(.5, .5, .38), (0, -.72, 3.2)),
             (box(.3, .3, 1.0), (.2, .62, 2.62)), (box(.3, .3, 1.0), (.2, -.62, 2.62)),
             (box(.1, .26, 1.9), (.62, 0, 1.55)), (box(.14, .9, .12), (.62, 0, 2.55)), (box(.16, .16, .32), (.62, 0, 2.75))]   # blade, guard, grip
    if not broken: parts += [(box(.46, .44, .5), (0, 0, 3.55)), (box(.5, .14, .2), (0, 0, 3.9)), (box(.08, .5, .18), (.24, 0, 3.52))]
    for p, (px, py, pz) in parts: merge(bm, p, M0 @ T(px, py, pz))
    if broken:   # the head lies in the grass beside the plinth
        merge(bm, box(.46, .44, .5), M0 @ T(-.4, 1.4, .25) @ Rx(1.2) @ Ry(.4))

def build_mosswatch():
    site = Site('Mosswatch'); stones = bmesh.new(); runes = bmesh.new()
    # A broken flagstone floor.
    r = 2.9
    while r < 11.5:
        width = 1.3; n = int(TAU * r / 1.3); a0 = random.random()
        for i in range(n):
            a = a0 + i * TAU / n
            if random.random() < .1 + sstep(8, 11.5, r) * .45: continue
            arc = TAU * r / n * .9; h = random.uniform(.1, .2)
            merge(stones, box(arc, width * .9, h, .02), T(math.cos(a) * r, math.sin(a) * r, h / 2 - .08) @ Rz(a - math.pi / 2) @ Rx(random.uniform(-.04, .04)))
        r += width
    # The dais: two low round steps.
    merge(stones, cyl(3.1, 3.0, .2, 32), T(0, 0, -.02)); merge(stones, cyl(2.1, 2.0, .2, 32), T(0, 0, .18))
    for i in range(16):   # runes inlaid in the upper step
        a = i / 16 * TAU; merge(runes, box(random.choice((.14, .3)), .07, .04), T(math.cos(a) * 1.6, math.sin(a) * 1.6, .39) @ Rz(a))
    # The colonnade (the same ring the old watch-hall stood in).
    heights = [6.2, 3.1, 6.2, 6.2, 2.4, 6.2, 6.2, 3.6]
    pos = []
    for i in range(8):
        a = i * TAU / 8 + TAU / 16; x, y = math.cos(a) * 10, math.sin(a) * 8; broken = heights[i] < 5
        column(stones, x, y, heights[i], broken, i); pos.append((x, y)); site.collider(x, y, .95, heights[i] + 1)
        if broken:   # its fallen drums
            for k in range(2):
                d = cyl(.5, .5, 1.1, 16, flute=.06); ang = a + .6 + k * .3
                merge(stones, d, T(x + math.cos(ang) * (2 + k * 1.3), y + math.sin(ang) * (2 + k * 1.3), .5) @ Rz(ang + 1) @ Ry(math.pi / 2))
            site.collider(x + math.cos(a + .6) * 2.6, y + math.sin(a + .6) * 2.6, .9, 1)
    # Arches still standing between the whole columns.
    for i, j in ((2, 3), (5, 6)):
        (x0, y0), (x1, y1) = pos[i], pos[j]; top = 6.2 + 1.26
        span = math.hypot(x1 - x0, y1 - y0); ang = math.atan2(y1 - y0, x1 - x0)
        for k in range(13):
            t = k / 12; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t; z = top + math.sin(t * math.pi) * span * .28
            merge(stones, box(span / 12 * 1.05, .7, .55, .01), T(x, y, z) @ Rz(ang) @ Ry(-math.cos(t * math.pi) * .6))
    # The ruined wall at the far side, with two arched windows.
    for k in range(26):
        a = math.pi + (k - 12.5) * .052; rr = 12.6; x, y = math.cos(a) * rr, math.sin(a) * rr
        edge = min(k, 25 - k); hmax = 2.2 + edge * .5 + 1.2 * noise.noise(Vector((k * .4, 3, 0)))
        for z in np.arange(0, hmax, .55):
            if k in (7, 8, 17, 18) and 1.2 < z < 3.3: continue       # window openings
            merge(stones, box(.68, .78, .52, .03), T(x, y, z + .26) @ Rz(a + math.pi / 2 + random.uniform(-.03, .03)))
        if k % 2 == 0: site.collider(x, y, .75, hmax)
    for k in (7.5, 17.5):   # window heads
        a = math.pi + (k - 12.5) * .052
        merge(stones, box(1.5, .8, .3, .02), T(math.cos(a) * 12.6, math.sin(a) * 12.6, 3.45) @ Rz(a + math.pi / 2))
    # Two sentinels flank the dais, facing the road; one has lost its head.
    sentinel(stones, 1.2, 4.2, 0, False); sentinel(stones, 1.2, -4.2, 0, True)
    site.collider(1.2, 4.2, .95, 4); site.collider(1.2, -4.2, .95, 3.4)
    # Fallen slabs with the watch's oath still glowing in them.
    for i, (x, y, a) in enumerate([(-4.8, 5.8, .4), (-6.2, -3.8, -.3), (4.9, -7.4, .9)]):
        merge(stones, box(2.6, 1.6, .5, .03), T(x, y, .2) @ Rz(a) @ Rx(.12)); site.collider(x, y, 1.2, .7)
        for j in range(4): merge(runes, box(random.choice((.18, .4)), .12, .05), T(x, y, .47) @ Rz(a) @ T(-.8 + j * .5, 0, 0))
    # Ivy climbing the columns and spilling over the wall.
    vines = []
    for i, (x, y) in enumerate(pos):
        h = heights[i]; pts = [Vector((x + math.cos(t * 9 + i) * .56, y + math.sin(t * 9 + i) * .56, .2 + t * h * .9)) for t in np.linspace(0, 1, 14)]
        vines.append(tube(pts, [.07] * 14, f'ivy{i}'))
    for k in range(6):
        a = math.pi + (k * 4 - 11) * .052; base = Vector((math.cos(a) * 12.2, math.sin(a) * 12.2, 3.2 + random.random()))
        pts = [base + Vector((-math.cos(a) * .3 * t, -math.sin(a) * .3 * t, -t * random.uniform(2, 3))) for t in np.linspace(0, 1, 6)]
        vines.append(tube(pts, [.09 * (1 - t * .5) for t in np.linspace(0, 1, 6)], f'wallivy{k}'))
    leaves = bmesh.new()
    for v in vines:
        for i in range(0, len(v.data.vertices), 9):
            co = v.matrix_world @ v.data.vertices[i].co
            merge(leaves, box(.3, .04, .22), T(*co) @ Rz(random.uniform(0, TAU)) @ Rx(random.uniform(-.8, .8)))
    ivy = site.own(join(vines, 'MosswatchIvy')); ivy.data.materials.append(M['ivy'])
    leafs = finish(leaves, 'MosswatchLeaves', 'ivy', site, False)
    main = finish(stones, 'MosswatchStones', 'stone', site); finish(runes, 'MosswatchRunes', 'rune', site, False)
    return site, [main]

# ================================================================== SHRINE
TRUNK_R = lambda z: 5.3 - 2.6 * sstep(0, 24, z) + 1.2 * sstep(4, 0, z)
def build_shrine():
    site = Site('Shrine'); stones = bmesh.new(); lamps = bmesh.new(); caps = bmesh.new(); ribbons = bmesh.new()
    # The trunk: stacked rings, twisting as they rise, gnarled by noise.
    bm = bmesh.new(); segs, rings = 36, 34; zs = np.linspace(-1, 27, rings); grid = []
    for k, z in enumerate(zs):
        row = []
        for i in range(segs):
            a = i / segs * TAU + z * .045; r = TRUNK_R(z) * (1 + .09 * noise.noise(Vector((math.cos(a) * 1.5, math.sin(a) * 1.5, z * .18))) + .04 * math.sin(a * 7 + z * .6))
            row.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        grid.append(row)
    for k in range(rings - 1):
        for i in range(segs):
            j = (i + 1) % segs; bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
    bm.faces.new(grid[0][::-1]); bm.faces.new(grid[-1])
    trunk = site.own(mesh_obj('ShrineTrunk', bm))
    # The hollow and the cleft that opens it toward the road (+X).
    def cutter(bmc, name):
        o = mesh_obj(name, bmc); return o
    hollow = bmesh.new(); bmesh.ops.create_cone(hollow, cap_ends=True, segments=24, radius1=2.5, radius2=2.0, depth=6.6)
    bmesh.ops.translate(hollow, vec=(0, 0, 3.1), verts=hollow.verts[:])
    slot = bmesh.new(); bmesh.ops.create_cube(slot, size=1); bmesh.ops.scale(slot, vec=(6, 2.3, 4.4), verts=slot.verts[:])
    bmesh.ops.translate(slot, vec=(3.6, 0, 2.0), verts=slot.verts[:])
    top = bmesh.new(); bmesh.ops.create_cone(top, cap_ends=True, segments=16, radius1=1.15, radius2=1.15, depth=6)
    bmesh.ops.transform(top, matrix=T(3.6, 0, 4.2) @ Ry(math.pi / 2), verts=top.verts[:])
    for c in (cutter(hollow, 'cut_h'), cutter(slot, 'cut_s'), cutter(top, 'cut_t')):
        m = trunk.modifiers.new('cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.solver = 'EXACT'; m.object = c
        apply_all(trunk); bpy.data.objects.remove(c)
    # Buttress roots flaring into the ground, leaving the cleft clear.
    parts = [trunk]
    for i in range(9):
        a = i / 9 * TAU + .35
        if gap(a, 0, .5): continue
        p0 = Vector((math.cos(a) * 3.6, math.sin(a) * 3.6, 4.2 + random.uniform(-.6, .8)))
        p1 = Vector((math.cos(a + .15) * random.uniform(9, 11), math.sin(a + .15) * random.uniform(9, 11), -.7))
        pts, rad = [], []
        for t in np.linspace(0, 1, 12):
            p = p0.lerp(p1, t); p.z = p0.z * (1 - t) ** 1.7 + p1.z * t + math.sin(t * math.pi) * .6
            p += Vector((noise.noise(Vector((t * 2, i, 0))), noise.noise(Vector((t * 2, i, 4))), 0)) * .5
            pts.append(p); rad.append((1.5 - 1.05 * t) * (1 + .3 * sstep(.85, 1, t)))
        parts.append(tube(pts, rad, f'buttress{i}'))
        site.collider(p1.x * .72, p1.y * .72, 1.0, 2)
    # Limbs that carry the leaf crowns (the game hangs them at CROWN_*).
    for i in range(6):
        a = i / 6 * TAU + .5; z0 = 17 + (i % 3) * 2; reach = random.uniform(7, 9.5)
        tip = Vector((math.cos(a) * reach, math.sin(a) * reach, z0 + random.uniform(5, 8)))
        base = Vector((math.cos(a) * 2.2, math.sin(a) * 2.2, z0))
        mid = base.lerp(tip, .5) + Vector((0, 0, -1.2))
        pts = [base, base.lerp(mid, .5), mid, mid.lerp(tip, .5), tip]
        parts.append(tube(pts, [1.2, .95, .75, .55, .35], f'limb{i}'))
        site.marker(f'CROWN_{i}', tip)
        if i % 2 == 0:   # prayer ribbons tied along the lower limbs
            for k in range(4):
                p = mid.lerp(tip, .15 + k * .2); p.z -= .5
                rib = box(.06, .22, random.uniform(1.2, 2.2)); merge(ribbons, rib, T(p.x, p.y, p.z - .8) @ Rz(a))
    tree = site.own(join(parts, 'ShrineTree')); tree.data.materials.append(M['root']); smooth(tree)
    site.collider(0, 0, 5.3, 24)
    # Inside the hollow: a root-altar under the memory, glowcaps on the walls.
    merge(stones, rock(.8, .95, 3.3, .3, .9), T(0, 0, -.15))
    for i in range(14):
        a = random.uniform(.6, TAU - .6); r = 2.1; z = random.uniform(.4, 4.5); s = random.uniform(.5, 1)
        cap = bmesh.new(); bmesh.ops.create_uvsphere(cap, u_segments=10, v_segments=5, radius=.2 * s)
        bmesh.ops.delete(cap, geom=[v for v in cap.verts if v.co.z < -.01], context='VERTS')
        merge(caps, cap, T(math.cos(a) * r, math.sin(a) * r, z) @ Rz(a) @ Ry(-1.2))
    # Steps up to the cleft.
    for k in range(3):
        merge(stones, box(1.0, 2.6 - k * .2, .2 + k * .12, .02), T(7.0 - k * .9, 0, .05 + k * .06))
    # Stone lanterns ringing the tree (open toward the road).
    for i in range(10):
        a = i / 10 * TAU + TAU / 20
        if gap(a, 0, .35): continue
        x, y = math.cos(a) * 10.5, math.sin(a) * 10.5
        for p, z in ((box(.9, .9, .3, .01), .15), (cyl(.2, .16, 1.1, 8), .3), (box(.75, .75, .16, .01), 1.48)):
            merge(stones, p, T(x, y, z) @ Rz(a))
        merge(lamps, box(.46, .46, .5), T(x, y, 1.81) @ Rz(a))
        roof = cyl(.72, .05, .5, 4); merge(stones, roof, T(x, y, 2.06) @ Rz(a + math.pi / 4))
        site.collider(x, y, .6, 2.5)
    finish(stones, 'ShrineStones', 'stone', site); finish(lamps, 'ShrineLamps', 'lamp', site, False)
    finish(caps, 'ShrineGlowcaps', 'glowcap', site); finish(ribbons, 'ShrineRibbons', 'cloth', site, False)
    return site, [tree, bpy.data.objects['ShrineStones']]

# ------------------------------------------------------------------- build
rootwell, rw_bake = build_rootwell()
mosswatch, mw_bake = build_mosswatch()
shrine, sh_bake = build_shrine()

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 4
scene.render.bake.use_pass_direct = False; scene.render.bake.use_pass_indirect = False
# Every baked object needs its own material (the bake swaps it for the maps).
for o in rw_bake + mw_bake + sh_bake:
    o.data.materials[0] = o.data.materials[0].copy(); o.data.materials[0].name = 'M_' + o.name
print('BAKING…')
for o in rw_bake + mw_bake + sh_bake: bake(o, TEX * 2 if o.name in ('ShrineTree', 'MosswatchStones') else TEX)
for o in (bpy.data.objects['MosswatchIvy'],): smooth(o)

tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('TRIANGLES', tris, 'COLLIDERS', sum(1 for o in bpy.data.objects if o.name.startswith('COL_')))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP', export_image_quality=82,
                          export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False, export_extras=True, export_animations=False)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')

if PREVIEW:
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.4, .5, .46, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 3; sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    ground = bpy.data.meshes.new('g'); ground.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [(0, 1, 2, 3)])
    g = link(bpy.data.objects.new('ground', ground)); g.data.materials.append(material('M_G', color=hexc('#4f6a3a'), rough=1))
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=6.0, fill_type='NGON', location=(0, 0, .14)); water = bpy.context.object
    water.data.materials.append(material('M_W', color=hexc('#48b3b4'), rough=.15))
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 22
    scene.render.resolution_x, scene.render.resolution_y = 960, 600; scene.cycles.samples = 20
    sites = {'Rootwell': rootwell, 'Mosswatch': mosswatch, 'Shrine': shrine}
    shots = {'Rootwell': ((22, -14, 11), (0, 0, 2.5)), 'Mosswatch': ((24, -16, 10), (0, 0, 2.5)), 'Shrine': ((30, -16, 12), (0, 0, 9))}
    for which, site in sites.items():
        for other in sites.values(): other.root.location.x = 0 if other is site else 400
        water.hide_render = which != 'Rootwell'
        cam.location = shots[which][0]; d = Vector(shots[which][1]) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{PREVIEW}_{which}.png'; bpy.ops.render.render(write_still=True)
        print('PREVIEW', scene.render.filepath)
