"""
Orrun, the Hollow Warden: the boss of the Verdant Reach (The Hollow Roots).

    blender -b --python first-person-verdant/tools/blender/build_warden.py -- \
        [--out PATH.glb] [--preview PATH.png] [--save PATH.blend] [--tex 2048]

Everything is built here from code, so the model can be rebuilt and changed:
  * shell     a sculpted carapace: scutes carved from a spherical Voronoi of
              hand-placed plate centres, flared marginal plates, a pale
              plastron, and glowing cracks where the Hollowing has split it
  * body      one continuous skin (Skin modifier over a skeleton of points)
              for body, neck, legs and tail, so the joints deform smoothly
  * head/jaw  one skull cut along the mouth line into a head and a jaw
  * roots     the forest grown through it: roots caging the shell, tendrils
              hanging from the rim and the jaw
  * memories  crystals on its back: the memories it has drained
Textures are procedural shader networks baked by Cycles into colour,
emission and normal maps, so the GLB carries them to three.js.

Axes (Blender): the Warden faces -Y. LEFT = +X, BACK = +Y, UP = +Z.
Rotations in the animation are given about these armature axes:
  +X tips the front of a bone down (a hanging limb swings back),
  +Z turns toward the left, +Y rolls the top toward the left.
"""
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import procedural
from procedural import link, activate, apply_all, smooth, sstep, mesh_obj, join, set_attr, tube, material, hexc, N, bake
from procedural import shell_nodes, skin_nodes, root_nodes

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default): return ARGS[ARGS.index(name) + 1] if name in ARGS else default
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '../../public/characters/warden/warden.glb')))
PREVIEW = arg('--preview', None)
TEX = int(arg('--tex', 2048))
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


# --------------------------------------------------------------------- shell
SHELL_C = Vector((0, .15, 2.3)); SHELL_R = Vector((2.4, 3.25, 1.8))
def unit(v): v = Vector(v); return v.normalized()
SCUTES = [unit((0, y, 1)) for y in (-.95, -.45, 0, .45, .95)]
SCUTES += [unit((s * .85, y, .62)) for s in (-1, 1) for y in (-.8, -.27, .27, .8)]
SCUTES += [unit((math.cos(a), math.sin(a) * 1.05, .1)) for a in np.linspace(0, 2 * math.pi, 26, endpoint=False)]
SCUTES += [unit((s * .45, y, -1)) for s in (-1, 1) for y in (-.62, 0, .62)]
SC = np.array([tuple(v) for v in SCUTES])
# Cracks on the back, and the Hollowing's heart glowing through the plastron (its weak point).
CRACKED = {(a, b) for a, b in [(1, 2), (2, 3), (2, 7), (6, 7), (3, 11), (10, 11), (7, 8), (0, 5), (12, 11), (3, 4),
                                (39, 40), (40, 41), (42, 43), (43, 44), (40, 43), (39, 42), (41, 44)]}

def build_shell():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=1)
    groove, ring, crack, plast, moss = [], [], [], [], []
    for v in bm.verts:
        d = v.co.normalized()
        dots = SC @ np.array(d)
        order = np.argsort(-dots)
        a1, a2 = math.acos(min(1, dots[order[0]])), math.acos(min(1, dots[order[1]]))
        edge = a2 - a1
        g = 1 - sstep(0, .07, edge)
        pair = tuple(sorted((int(order[0]), int(order[1]))))
        c = (1 - sstep(0, .035, edge)) if pair in CRACKED else 0
        el = math.asin(max(-1, min(1, d.z)))
        # Radius: dome above, flattened plastron below, flared and serrated rim.
        r = 1 + .035 * noise.noise(Vector(d) * 3.1) - .07 * g - .03 * c
        flare = sstep(.35, .05, abs(el - .08))
        r += .09 * flare
        if d.y > .2: r += .05 * flare * (abs(math.sin(math.atan2(d.y, d.x) * 13)) - .5)
        co = Vector((d.x * SHELL_R.x * r, d.y * SHELL_R.y * r, d.z * SHELL_R.z * r))
        if co.z < 0: co.z *= .5
        v.co = co + SHELL_C
        groove.append(g); ring.append(a1); crack.append(c); plast.append(1 - sstep(-.42, -.18, el))
        moss.append(sstep(.45, .9, d.z) * (.5 + .5 * noise.noise(Vector(d) * 4.3)))
    obj = mesh_obj('Shell', bm); smooth(obj)
    for n, vals in (('groove', groove), ('ring', ring), ('crack', crack), ('plastron', plast), ('moss', moss)): set_attr(obj, n, vals)
    return obj

# ---------------------------------------------------------------- body skin
# A skeleton of points with radii (x, y); the Skin modifier wraps it.
L, R = 1, -1
def legs(side):
    s = side
    return [
        ('S%s' % s, (s * 1.35, -1.6, 1.75), (.66, .66), 'B3'), ('E%s' % s, (s * 1.95, -1.85, 1.0), (.56, .56), 'S%s' % s),
        ('W%s' % s, (s * 2.05, -1.95, .38), (.5, .5), 'E%s' % s), ('F%s' % s, (s * 2.1, -2.15, .14), (.66, .5), 'W%s' % s),
        ('T%s' % s, (s * 2.12, -2.62, .12), (.42, .22), 'F%s' % s),
        ('H%s' % s, (s * 1.35, 1.7, 1.7), (.7, .7), 'B1'), ('K%s' % s, (s * 1.95, 2.0, 1.0), (.6, .6), 'H%s' % s),
        ('A%s' % s, (s * 2.0, 2.1, .38), (.52, .52), 'K%s' % s), ('G%s' % s, (s * 2.05, 1.95, .14), (.66, .5), 'A%s' % s),
        ('U%s' % s, (s * 2.07, 1.5, .12), (.42, .22), 'G%s' % s),
    ]
SKEL = [
    # Radii are (width, height). The body core stays inside the shell and plastron.
    ('B0', (0, 2.7, 1.8), (1.0, .5), None), ('B1', (0, 1.25, 1.95), (1.7, .6), 'B0'), ('B2', (0, -.35, 2.0), (1.8, .62), 'B1'),
    ('B3', (0, -1.9, 2.0), (1.45, .6), 'B2'), ('B4', (0, -2.75, 2.08), (.8, .6), 'B3'),
    ('N1', (0, -3.4, 2.22), (.58, .54), 'B4'), ('N2', (0, -3.95, 2.36), (.52, .5), 'N1'),
    ('T1', (0, 3.35, 1.55), (.46, .38), 'B0'), ('T2', (0, 4.05, 1.28), (.3, .25), 'T1'), ('T3', (0, 4.65, 1.02), (.1, .09), 'T2'),
] + legs(L) + legs(R)
P = {n: Vector(co) for n, co, _, _ in SKEL}

def build_skin():
    me = bpy.data.meshes.new('Skin'); names = [s[0] for s in SKEL]
    me.from_pydata([s[1] for s in SKEL], [(names.index(s[3]), i) for i, s in enumerate(SKEL) if s[3]], [])
    obj = link(bpy.data.objects.new('Skin', me))
    m = obj.modifiers.new('skin', 'SKIN'); m.use_smooth_shade = True; m.branch_smoothing = .6
    if not me.skin_vertices: me.skin_vertices.new()
    for i, s in enumerate(SKEL): me.skin_vertices[0].data[i].radius = s[2]
    me.skin_vertices[0].data[0].use_root = True
    sub = obj.modifiers.new('sub', 'SUBSURF'); sub.levels = 2
    apply_all(obj)
    # Wrinkled hide; bark creeping up the lower legs.
    bark, under = [], []
    for v in obj.data.vertices:
        c = v.co
        leg = sstep(1.2, .5, c.z) * sstep(1.0, 1.6, abs(c.x))
        n = noise.noise(Vector((c.x * 2.1, c.y * 2.1, c.z * 6))) * .05 * leg + noise.noise(c * 5.5) * .02
        v.co = c + v.normal * n
        bark.append(leg); under.append(sstep(1.9, 1.2, c.z) * sstep(1.2, .3, abs(c.x)))
    set_attr(obj, 'bark', bark); set_attr(obj, 'under', under)
    smooth(obj)
    return obj

# ------------------------------------------------------------- head and jaw
HINGE = Vector((0, -3.9, 2.42)); MOUTH_TIP = Vector((0, -5.4, 2.16))
def build_head():
    pts = [((0, -3.8, 2.36), (.64, .56)), ((0, -4.35, 2.48), (.7, .58)), ((0, -4.9, 2.4), (.52, .44)), ((0, -5.42, 2.16), (.16, .2))]
    me = bpy.data.meshes.new('HeadBase'); me.from_pydata([p for p, _ in pts], [(i, i + 1) for i in range(3)], [])
    obj = link(bpy.data.objects.new('HeadBase', me))
    m = obj.modifiers.new('skin', 'SKIN'); sub = obj.modifiers.new('sub', 'SUBSURF'); sub.levels = 3
    if not me.skin_vertices: me.skin_vertices.new()
    for i, (_, r) in enumerate(pts): me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[0].use_root = True
    apply_all(obj)
    beak = []
    for v in obj.data.vertices:
        c = v.co.copy(); fwd = sstep(-4.6, -5.4, c.y)
        # Flat brow, heavy ridges over the eyes, a hooked beak.
        if c.z > 2.5: c.z = 2.5 + (c.z - 2.5) * .55
        ridge = math.exp(-((abs(c.x) - .36) ** 2 + (c.y + 4.45) ** 2 * .6) / .03)
        c.z += .13 * ridge * sstep(2.35, 2.6, c.z)
        c.z -= .22 * fwd ** 2.2 * sstep(-5.1, -5.45, c.y)
        c.x *= 1 - .18 * fwd
        c += Vector(v.normal) * noise.noise(c * 7) * .018
        v.co = c; beak.append(sstep(-4.75, -5.2, c.y))
    set_attr(obj, 'beak', beak)
    # Cut along the mouth line into skull (above) and jaw (below); cap both.
    n = (MOUTH_TIP - HINGE).cross(Vector((1, 0, 0))).normalized()
    if n.z < 0: n = -n
    parts = []
    for keep_above, name in ((True, 'Head'), (False, 'Jaw')):
        bm = bmesh.new(); bm.from_mesh(obj.data)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=HINGE, plane_no=n, clear_outer=not keep_above, clear_inner=keep_above)
        cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        before = set(bm.faces)
        bmesh.ops.holes_fill(bm, edges=cut)
        caps = [f for f in bm.faces if f not in before]
        # The caps are the inside of the mouth.
        for f in caps: f.material_index = 1
        me2 = bpy.data.meshes.new(name); bm.to_mesh(me2); bm.free()
        o = link(bpy.data.objects.new(name, me2)); smooth(o); parts.append(o)
    bpy.data.objects.remove(obj)
    return parts

# ------------------------------------------------------------------- roots
def on_shell(d, lift):
    d = Vector(d).normalized()
    co = Vector((d.x * SHELL_R.x, d.y * SHELL_R.y, d.z * SHELL_R.z)) * (1 + lift)
    if co.z < 0: co.z *= .5
    return co + SHELL_C

def build_roots():
    out = []
    # Roots caging the shell: rim to rim over the top.
    for i, (a0, a1) in enumerate([(-.3, 3.3), (.25, 2.75), (.9, 2.2), (-.9, 4.0), (-1.4, 4.7), (1.3, 1.8)]):
        pts, rad = [], []
        for t in np.linspace(0, 1, 9):
            a = a0 + (a1 - a0) * t
            d = Vector((math.cos(a), math.sin(a) * 1.05, .08 + math.sin(t * math.pi) * (1.6 + .3 * (i % 2))))
            w = Vector((noise.noise(Vector((t * 3, i, 0))), noise.noise(Vector((t * 3, i, 5))), 0)) * .12
            pts.append(on_shell(d + w, .07 + .05 * math.sin(t * math.pi))); rad.append(.2 - .09 * math.sin(t * math.pi))
        out.append(tube(pts, rad, 'root%d' % i))
    # Tendrils hanging from the rim, swaying roots from the jaw are separate.
    for i, a in enumerate(np.linspace(0, 2 * math.pi, 8, endpoint=False) + .35):
        if abs(math.sin(a) + 1) < .35: continue          # keep the face clear
        base = on_shell((math.cos(a), math.sin(a), .05), .05)
        drop = .8 + .5 * random.random(); side = Vector((-math.sin(a), math.cos(a), 0))
        pts = [base + Vector((math.cos(a), math.sin(a), 0)) * (.35 * s - .15 * s * s) + Vector((0, 0, -drop * s ** 1.3)) + side * .16 * math.sin(s * 9 + i)
               for s in np.linspace(0, 1, 8)]
        out.append(tube(pts, [.075 * (1 - s * .7) for s in np.linspace(0, 1, 8)], 'tendril%d' % i))
    return join(out, 'Roots')

def build_beard():
    out = []
    for i, x in enumerate((-.34, -.22, -.1, .04, .16, .28, .38)):
        base = Vector((x, -4.3 - abs(x) * .5, 2.0)); drop = .45 + .35 * random.random()
        pts = [base + Vector((x * s * .25 + .07 * math.sin(s * 8 + i), .12 * s, -s * drop)) for s in np.linspace(0, 1, 7)]
        out.append(tube(pts, [.035 * (1 - s * .6) for s in np.linspace(0, 1, 7)], 'beard%d' % i))
    return join(out, 'Beard')

def prism(bm, rr, hh, matrix):
    """A six-sided crystal: straight prism with a pointed cap."""
    angs = [i * math.pi / 3 for i in range(6)]
    lo = [bm.verts.new((rr * math.cos(t), rr * math.sin(t), 0)) for t in angs]
    hi = [bm.verts.new((rr * .9 * math.cos(t), rr * .9 * math.sin(t), hh)) for t in angs]
    apex = bm.verts.new((0, 0, hh + rr * 1.3))
    for i in range(6):
        j = (i + 1) % 6
        bm.faces.new((lo[i], lo[j], hi[j], hi[i])); bm.faces.new((hi[i], hi[j], apex))
    bm.faces.new(list(reversed(lo)))
    bmesh.ops.transform(bm, matrix=matrix, verts=lo + hi + [apex])

def build_crystals():
    bm = bmesh.new()
    for d, h in [((0, -.2, 1), 1.5), ((.35, .35, 1), 1.1), ((-.3, .5, 1), 1.2), ((.1, .95, .8), .9), ((-.5, -.55, .9), .8), ((.55, -.35, .8), .75)]:
        base = on_shell(d, -.03); up = (Vector(d).normalized() + Vector((0, 0, 1.4))).normalized()
        frame = up.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        for k in range(3):  # a main crystal and two smaller ones leaning out of the same crack
            hh = h * (1, .6, .45)[k]; rr = .26 * h ** .5 * (1, .7, .6)[k]
            lean = Vector(((1, -.8, .3)[k] * .5 * (k > 0), (0, .4, -.6)[k] * .5, 1)).normalized()
            m = Matrix.Translation(base) @ frame @ lean.to_track_quat('Z', 'Y').to_matrix().to_4x4() @ Matrix.Rotation(random.random() * 3, 4, 'Z') @ Matrix.Translation((0, 0, -.25))
            prism(bm, rr, hh, m)
    bm.normal_update()
    return mesh_obj('Memories', bm)

def build_eyes():
    bm = bmesh.new()
    for s in (1, -1):
        g = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=.1)
        bmesh.ops.translate(bm, vec=Vector((s * .5, -4.52, 2.52)), verts=g['verts'])
    o = mesh_obj('Eyes', bm); smooth(o); return o

def build_claws():
    objs = {}
    for key, toe in (('fl', 'T1'), ('fr', 'T-1'), ('bl', 'U1'), ('br', 'U-1')):
        bm = bmesh.new(); t = P[toe]; fwd = Vector((0, -1, -.25)).normalized()
        for k in (-1, 0, 1):
            g = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=.12, radius2=.01, depth=.42)
            rot = fwd.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            bmesh.ops.transform(bm, matrix=Matrix.Translation(t + Vector((k * .24, -.2, -.02))) @ rot, verts=g['verts'])
        objs[key] = mesh_obj('Claws_' + key, bm)
    return objs

def build_fungi():
    bm = bmesh.new()
    for i in range(9):
        a = random.uniform(0, 2 * math.pi); base = on_shell((math.cos(a), math.sin(a), .2 + random.random() * .5), 0)
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=.17 + random.random() * .08, radius2=.11, depth=.07)
        out = (base - SHELL_C); out.z = 0; out.normalize()
        m = Matrix.Translation(base + out * .02) @ Matrix.Rotation(math.atan2(out.y, out.x), 4, 'Z') @ Matrix.Rotation(.25, 4, 'Y')
        bmesh.ops.transform(bm, matrix=m, verts=g['verts'])
    o = mesh_obj('Fungi', bm); smooth(o); return o

# ---------------------------------------------------------------------- rig
BONES = [  # name, head, tail, parent
    ('root', (0, 0, 0), (0, -1, 0), None),
    ('body', (0, .3, 1.9), (0, -1.2, 1.9), 'root'),
    ('shell', (0, .15, 2.3), (0, .15, 3.4), 'body'),
    ('neck_01', (0, -2.6, 2.05), (0, -3.4, 2.22), 'body'),
    ('neck_02', (0, -3.4, 2.22), (0, -3.95, 2.36), 'neck_01'),
    ('head', (0, -3.95, 2.36), (0, -5.2, 2.36), 'neck_02'),
    ('jaw', tuple(HINGE), (0, -5.2, 2.02), 'head'),
    ('tail_01', (0, 2.9, 1.62), (0, 3.9, 1.34), 'body'),
    ('tail_02', (0, 3.9, 1.34), (0, 4.7, 1.0), 'tail_01'),
]
for side, s in (('l', 1), ('r', -1)):
    k = str(s)
    for pre, a, b, c, d in (('f', 'S', 'E', 'W', 'T'), ('b', 'H', 'K', 'A', 'U')):
        BONES += [(f'thigh_{pre}{side}', tuple(P[a + k]), tuple(P[b + k]), 'body'),
                  (f'shin_{pre}{side}', tuple(P[b + k]), tuple(P[c + k]), f'thigh_{pre}{side}'),
                  (f'foot_{pre}{side}', tuple(P[c + k]), tuple(P[d + k]), f'shin_{pre}{side}')]

def build_rig():
    arm = bpy.data.armatures.new('Warden_Rig'); rig = link(bpy.data.objects.new('Warden', arm))
    activate(rig); bpy.ops.object.mode_set(mode='EDIT')
    for name, h, t, parent in BONES:
        e = arm.edit_bones.new(name); e.head = h; e.tail = t
        if parent: e.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig

def seg_dist(p, a, b):
    ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)

def bind(obj, rig, weights):
    """weights: {bone: array(len(verts))} (normalised here, top 4 kept)."""
    names = list(weights); W = np.stack([weights[n] for n in names], 1)
    top = np.argsort(-W, 1)[:, 4:]; np.put_along_axis(W, top, 0, 1)
    W /= W.sum(1, keepdims=True)
    for j, n in enumerate(names):
        vg = obj.vertex_groups.new(name=n)
        for i in np.nonzero(W[:, j] > .002)[0]: vg.add([int(i)], float(W[i, j]), 'REPLACE')
    obj.parent = rig
    m = obj.modifiers.new('rig', 'ARMATURE'); m.object = rig

def rigid(obj, rig, bone): bind(obj, rig, {bone: np.ones(len(obj.data.vertices))})

def skin_weights(obj):
    V = np.array([v.co for v in obj.data.vertices])
    segs = {'body': ((0, 3.0, 1.75), (0, -2.55, 2.0), 1.35), 'neck_01': ((0, -2.6, 2.05), (0, -3.4, 2.22), .55),
            'neck_02': ((0, -3.4, 2.22), (0, -4.1, 2.4), .5), 'tail_01': ((0, 3.0, 1.6), (0, 3.9, 1.34), .42), 'tail_02': ((0, 3.9, 1.34), (0, 4.8, .98), .26)}
    for name, h, t, parent in BONES:
        if name.startswith(('thigh', 'shin', 'foot')):
            segs[name] = (h, t, {'thigh': .62, 'shin': .52, 'foot': .5}[name.split('_')[0]])
    w = {n: (r / (seg_dist(V, np.array(a), np.array(b)) + .02)) ** 7 for n, (a, b, r) in segs.items()}
    return w

# --------------------------------------------------------------- animation
FPS = 30
def keys(t, pts):
    """Smooth piecewise interpolation through (time, value) pairs; values are tuples or floats."""
    if t <= pts[0][0]: return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            u = sstep(t0, t1, t)
            if isinstance(v0, tuple): return tuple(a + (b - a) * u for a, b in zip(v0, v1))
            return v0 + (v1 - v0) * u
    return pts[-1][1]
def S(x): return math.sin(x)
TAU = math.tau
LEGS = ['fl', 'fr', 'bl', 'br']

def gait(t, period, amp, stance, lift, offsets=None):
    """Diagonal gait: front-left with back-right, front-right with back-left."""
    offsets = offsets or {'fl': 0, 'br': 0, 'fr': .5, 'bl': .5}
    out = {}
    for leg, off in offsets.items():
        ph = (t / period + off) % 1
        if ph < stance: th = -amp + 2 * amp * ph / stance; kn = 0
        else:
            u = (ph - stance) / (1 - stance); th = amp - 2 * amp * sstep(0, 1, u); kn = lift * S(u * math.pi)
        out[f'thigh_{leg}'] = (th, 0, 0); out[f'shin_{leg}'] = (kn, 0, 0); out[f'foot_{leg}'] = (-kn * .6, 0, 0)
    return out

def clip_idle(t):
    p = t / 3 * TAU
    return {'body': ((0, 0, 0), (0, 0, .035 * S(p))), 'shell': (.6 * S(p), 0, 0), 'neck_01': (2 * S(p + 1), 0, 4 * S(p)), 'neck_02': (1.5 * S(p + 2), 0, 2 * S(p + .5)),
            'head': (-2 * S(2 * p), 0, 0), 'jaw': (2 + 2 * S(p), 0, 0), 'tail_01': (0, 0, 6 * S(p)), 'tail_02': (0, 0, 8 * S(p - .8))}

def clip_walk(t, period=1.6, amp=20, stance=.62, lift=32, head=0, bob=.05):
    p = t / period * TAU
    pose = gait(t, period, amp, stance, lift)
    pose.update({'body': ((head * .3, 2 * S(p), 1.5 * S(p)), (0, 0, bob * math.cos(2 * p))), 'neck_01': (head, 0, -3 * S(p)), 'neck_02': (head * .5, 0, -2 * S(p)),
                 'head': (2 * S(2 * p) + head * .3, 0, 0), 'jaw': (3, 0, 0), 'tail_01': (0, 0, 7 * S(p + math.pi)), 'tail_02': (0, 0, 9 * S(p + 2.4))})
    return pose

def clip_charge(t): return clip_walk(t, .8, 34, .5, 48, head=12, bob=.12)

def shake(t, amp, hz=18): return amp * S(t * hz * TAU)

def clip_roar(t):
    rear = keys(t, [(0, 0), (.6, 1), (2.0, 1), (2.6, 0)]); jaw = keys(t, [(0, 0), (.5, 0), (.7, 38), (2.0, 38), (2.35, 0)])
    sh = shake(t, 4) * (1 if .7 < t < 2.0 else 0)
    pose = {'body': ((-10 * rear, 0, 0), (0, .15 * rear, .15 * rear)), 'neck_01': (-26 * rear, 0, sh), 'neck_02': (-16 * rear, 0, sh * .6), 'head': (-10 * rear, 0, sh * .5),
            'jaw': (jaw, 0, 0), 'tail_01': (-10 * rear, 0, 0)}
    for leg in ('fl', 'fr'): pose[f'thigh_{leg}'] = (-8 * rear, 0, 0)
    return pose

def clip_bite(t):
    # Bite one: wind-up 0–.7, strike .7–.85, snap at .85. Bite two: wind-up 1.3–1.65, strike 1.65–1.8.
    n1 = keys(t, [(0, 0), (.7, -1), (.8, 1.1), (.95, 1), (1.3, .2), (1.65, -.6), (1.78, 1.1), (1.95, 1), (2.8, 0)])
    yaw = keys(t, [(0, 0), (1.3, 0), (1.62, 16), (1.8, -18), (2.1, -12), (2.8, 0)])
    jaw = keys(t, [(0, 2), (.5, 2), (.72, 42), (.8, 42), (.86, 0), (1.5, 2), (1.66, 42), (1.74, 42), (1.8, 0), (2.8, 2)])
    lunge = keys(t, [(0, 0), (.7, .35), (.85, -.7), (1.3, -.3), (1.65, 0), (1.8, -.6), (2.8, 0)])
    return {'body': ((4 * max(0, n1), 0, yaw * .3), (0, lunge, -.05 * max(0, n1))), 'neck_01': (18 * n1, 0, yaw), 'neck_02': (14 * n1, 0, yaw * .5), 'head': (8 * n1, 0, 0),
            'jaw': (jaw, 0, 0), 'thigh_fl': (-6 * max(0, n1), 0, 0), 'thigh_fr': (-6 * max(0, n1), 0, 0), 'tail_01': (0, 0, -yaw * .5)}

def clip_stomp(t):
    # Rear up 0–1.0 (hold and tremble), slam at 1.12, recover to 2.6.
    up = keys(t, [(0, 0), (.85, 1), (1.0, 1.02), (1.12, -.12), (1.4, -.08), (2.6, 0)])
    legs = keys(t, [(0, 0), (.85, 1), (1.0, 1), (1.12, 0), (2.6, 0)])
    tr = shake(t, 1.2, 14) * (1 if .8 < t < 1.0 else 0)
    whip = keys(t, [(0, 0), (1.0, -10), (1.14, 14), (1.6, 4), (2.6, 0)])
    pose = {'body': ((-24 * up + tr, 0, 0), (0, .3 * max(0, up), .38 * max(0, up) - .1 * max(0, -up) * 8)), 'neck_01': (whip, 0, 0), 'neck_02': (whip * .6, 0, 0),
            'head': (whip * .4, 0, 0), 'jaw': (keys(t, [(0, 2), (.8, 30), (1.15, 30), (1.6, 2)]), 0, 0)}
    for leg in ('fl', 'fr'):
        pose[f'thigh_{leg}'] = (-38 * legs, 0, 0); pose[f'shin_{leg}'] = (42 * legs, 0, 0); pose[f'foot_{leg}'] = (-20 * legs, 0, 0)
    for leg in ('bl', 'br'): pose[f'thigh_{leg}'] = (14 * max(0, up), 0, 0)
    return pose

def clip_sweep(t):
    # Wind-up turn 0–.7, sweep .7–1.0 (the tail swings across the rear), unwind to 2.2.
    turn = keys(t, [(0, 0), (.7, 30), (1.0, -95), (1.35, -95), (2.2, 0)])
    lag = keys(t, [(0, 0), (.7, -18), (.85, 30), (1.05, 40), (1.4, 0), (2.2, 0)])
    return {'body': ((0, -4 * S(min(1, t / 1.2) * math.pi), turn), (0, 0, 0)), 'tail_01': (0, 0, lag), 'tail_02': (0, 0, lag * .8), 'neck_01': (0, 0, -turn * .15),
            'head': (0, 0, -turn * .1), 'jaw': (keys(t, [(0, 2), (.6, 20), (1.2, 20), (1.8, 2)]), 0, 0)}

def clip_erupt(t):
    # Brace 0–.8, drive the head into the ground at 1.0 (the roots answer), hold, recover by 2.4.
    brace = keys(t, [(0, 0), (.8, 1), (1.6, 1), (2.4, 0)]); slam = keys(t, [(0, 0), (.8, -1), (1.0, 1), (1.6, 1), (2.4, 0)])
    tr = shake(t, 1.5, 16) * (1 if 1.0 < t < 1.6 else 0)
    pose = {'body': ((8 * max(0, slam) + tr, 0, 0), (0, 0, -.28 * brace)), 'neck_01': (30 * slam, 0, 0), 'neck_02': (18 * slam, 0, 0), 'head': (12 * slam, 0, 0),
            'jaw': (keys(t, [(0, 2), (.8, 26), (.98, 0), (2.4, 2)]), 0, 0)}
    for leg, s in (('fl', -1), ('bl', -1), ('fr', 1), ('br', 1)): pose[f'thigh_{leg}'] = (0, s * 12 * brace, 0)
    return pose

def clip_stagger(t):
    j = keys(t, [(0, 0), (.12, 1), (1.2, 0)]); decay = max(0, 1 - t / 1.2)
    return {'body': ((-8 * j, 6 * S(t * 12) * decay, 0), (0, .25 * j, 0)), 'neck_01': (-18 * j, 0, 10 * j), 'head': (-12 * j, 0, 8 * S(t * 10) * decay), 'jaw': (18 * j, 0, 0)}

FLAIL = lambda t, k: 25 * S(t * 7 + k * 1.7)
def clip_topple(t):
    roll = keys(t, [(0, 0), (.3, -14), (1.0, -180), (1.2, -180)]); lift = keys(t, [(0, 0), (.3, .3), (.65, 1.4), (1.0, .35), (1.2, .3)])
    pose = {'body': ((0, roll, 0), (0, 0, lift)), 'neck_01': (-20 * sstep(.3, 1, t), 0, 0), 'jaw': (20, 0, 0)}
    for k, leg in enumerate(LEGS): pose[f'thigh_{leg}'] = (FLAIL(t, k) * sstep(.4, 1, t), 0, 0); pose[f'shin_{leg}'] = (30 * sstep(.4, 1, t), 0, 0)
    return pose

def clip_down(t):
    pose = {'body': ((0, -180, 0), (0, 0, .3 + .04 * S(t * TAU))), 'neck_01': (-24, 0, 18 * S(t * TAU * .5)), 'neck_02': (-10, 0, 8 * S(t * TAU * .5 + 1)),
            'head': (-10, 0, 0), 'jaw': (14 + 10 * S(t * 3), 0, 0), 'tail_01': (0, 0, 14 * S(t * 5))}
    for k, leg in enumerate(LEGS): pose[f'thigh_{leg}'] = (FLAIL(t, k), 0, 0); pose[f'shin_{leg}'] = (30 + 15 * S(t * 7 + k), 0, 0)
    return pose

def clip_getup(t):
    roll = keys(t, [(0, -180), (.35, -190), (1.0, -8), (1.4, 0)]); lift = keys(t, [(0, .3), (.55, 1.4), (1.0, .2), (1.4, 0)])
    pose = {'body': ((0, roll, 0), (0, 0, lift)), 'neck_01': (-24 * (1 - sstep(.6, 1.4, t)), 0, 0)}
    for k, leg in enumerate(LEGS): pose[f'thigh_{leg}'] = (FLAIL(t, k) * (1 - sstep(.6, 1.2, t)), 0, 0); pose[f'shin_{leg}'] = (30 * (1 - sstep(.6, 1.3, t)), 0, 0)
    return pose

def rest_pose(k):
    """Lying down, legs folded, head on the ground (k: 0 standing → 1 lying)."""
    pose = {'body': ((0, 0, 0), (0, 0, -1.0 * k)), 'neck_01': (22 * k, 0, 0), 'neck_02': (16 * k, 0, 0), 'head': (8 * k, 0, 0),
            'tail_01': (10 * k, 0, 0), 'tail_02': (10 * k, 0, 0)}
    for leg in ('fl', 'fr'): pose[f'thigh_{leg}'] = (-40 * k, 0, 0); pose[f'shin_{leg}'] = (80 * k, 0, 0); pose[f'foot_{leg}'] = (-40 * k, 0, 0)
    for leg in ('bl', 'br'): pose[f'thigh_{leg}'] = (45 * k, 0, 0); pose[f'shin_{leg}'] = (-20 * k, 0, 0); pose[f'foot_{leg}'] = (-25 * k, 0, 0)
    return pose

def clip_death(t):
    k = sstep(.2, 2.4, t); pose = rest_pose(k)
    pose['jaw'] = (keys(t, [(0, 2), (.4, 24), (1.5, 24), (3.5, 8)]), 0, 0)
    pose['neck_01'] = (22 * k - 18 * S(min(1, t / 1.2) * math.pi), 0, 0)
    return pose

def clip_sleep(t):
    pose = rest_pose(1); p = t / 4 * TAU
    pose['body'] = ((0, 0, 0), (0, 0, -1.0 + .03 * S(p))); pose['shell'] = (.8 * S(p), 0, 0); pose['jaw'] = (1, 0, 0)
    return pose

CLIPS = [('Idle', 3.0, clip_idle), ('Walk', 1.6, clip_walk), ('Charge', .8, clip_charge), ('Roar', 2.6, clip_roar), ('Bite', 2.8, clip_bite),
         ('Stomp', 2.6, clip_stomp), ('Sweep', 2.2, clip_sweep), ('Erupt', 2.4, clip_erupt), ('Stagger', 1.2, clip_stagger), ('Topple', 1.2, clip_topple),
         ('Down', 2.0, clip_down), ('GetUp', 1.4, clip_getup), ('Death', 3.5, clip_death), ('Sleep', 4.0, clip_sleep)]

def animate(rig):
    if rig.animation_data is None: rig.animation_data_create()
    rest = {b.name: b.matrix_local.to_quaternion() for b in rig.data.bones}
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    for name, dur, fn in CLIPS:
        act = bpy.data.actions.new('W_' + name); act.use_fake_user = True; rig.animation_data.action = act
        frames = int(round(dur * FPS)); prev = {}
        for f in range(frames + 1):
            pose = fn(f / FPS)
            for pb in rig.pose.bones:
                v = pose.get(pb.name, (0, 0, 0))
                rot, loc = (v if isinstance(v[0], tuple) else (v, (0, 0, 0)))
                Q = Euler(tuple(math.radians(a) for a in rot), 'XYZ').to_quaternion()
                Rm = rest[pb.name]; q = Rm.inverted() @ Q @ Rm
                if pb.name in prev and prev[pb.name].dot(q) < 0: q.negate()
                prev[pb.name] = q.copy()
                pb.rotation_quaternion = q; pb.location = Rm.inverted() @ Vector(loc)
                pb.keyframe_insert('rotation_quaternion', frame=f + 1); pb.keyframe_insert('location', frame=f + 1)
        act.name = name
    rig.animation_data.action = None
    for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)

# -------------------------------------------------------------------- build
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 4
scene.render.bake.use_pass_direct = False; scene.render.bake.use_pass_indirect = False

shell = build_shell(); shell.data.materials.append(material('M_Shell', shell_nodes, rough=.72))
skin = build_skin(); skin.data.materials.append(material('M_Hide', skin_nodes, rough=.85))
head, jaw = build_head()
mouth = material('M_Mouth', color=hexc('#3a1414'), rough=.6)
for o in (head, jaw):
    o.data.materials.append(material('M_Head' if o is head else 'M_Jaw', lambda nt, b: skin_nodes(nt, b, beak=True), rough=.7)); o.data.materials.append(mouth)
roots = build_roots(); roots.data.materials.append(material('M_Roots', root_nodes, rough=.9))
beard = build_beard(); beard.data.materials.append(bpy.data.materials['M_Roots'])
crystals = build_crystals(); crystals.data.materials.append(material('M_Memory', color=hexc('#8ef0d2'), emission=hexc('#63f2c4'), strength=4, rough=.15))
eyes = build_eyes(); eyes.data.materials.append(material('M_Eye', color=hexc('#b6ffe6'), emission=hexc('#63f2c4'), strength=8, rough=.2))
claws = build_claws(); claw_mat = material('M_Claw', color=hexc('#2a241c'), rough=.45)
for o in claws.values(): o.data.materials.append(claw_mat)
fungi = build_fungi(); fungi.data.materials.append(material('M_Fungus', color=hexc('#d9cfab'), rough=.9))

print('BAKING…')
bake(shell, TEX, emission=True); bake(skin, TEX); bake(head, TEX // 2); bake(jaw, TEX // 2); bake(roots, TEX // 2)
beard.data.materials[0] = roots.data.materials[0]
bpy.ops.object.select_all(action='DESELECT')
for o in (beard,):  # the beard shares the roots' baked bark
    activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(island_margin=.01); bpy.ops.object.mode_set(mode='OBJECT')

# Decimate the dense sculpts to a game budget before binding.
for o, ratio in ((skin, .7), (shell, .6), (head, .8), (jaw, .8), (roots, .7)):
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; apply_all(o)

rig = build_rig()
bind(skin, rig, skin_weights(skin))
for o, bone in ((shell, 'shell'), (roots, 'shell'), (crystals, 'shell'), (fungi, 'shell'), (head, 'head'), (eyes, 'head'), (jaw, 'jaw'), (beard, 'jaw')): rigid(o, rig, bone)
for key, o in claws.items(): rigid(o, rig, f'foot_{key}')
animate(rig)

tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('TRIANGLES', tris)
if '--save' in ARGS: bpy.ops.wm.save_as_mainfile(filepath=arg('--save', '/tmp/warden.blend'))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=False, export_yup=True, export_skins=True,
                          export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
                          export_image_format='WEBP', export_image_quality=86, export_texcoords=True, export_normals=True,
                          export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')

# ------------------------------------------------------------------ preview
if PREVIEW:
    rig.animation_data.action = bpy.data.actions[arg('--pose', 'Idle')]; scene.frame_set(int(arg('--frame', 1)))
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.35, .45, .4, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    ground = bpy.data.meshes.new('g'); ground.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)])
    g = link(bpy.data.objects.new('ground', ground)); g.data.materials.append(material('M_G', color=hexc('#4f5d3a'), rough=1))
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 35
    ang = math.radians(float(arg('--angle', -35))); dist = 13
    cam.location = (math.sin(ang) * dist, -math.cos(ang) * dist, 4.2)
    d = Vector((0, 0, 2.2)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = 960, 640; scene.cycles.samples = 24
    scene.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True)
    print('PREVIEW', PREVIEW)
