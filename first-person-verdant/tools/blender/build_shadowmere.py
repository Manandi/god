"""Shadowmere: the dark forest realm, its green monkeys and the Rootbound Gorilla.

Built from the owner's concept image (public/concepts/shadowmere-forest-concept.png):
giant gnarled mossy trees with flaring roots, amber cage lanterns on vines, glowing
mushrooms, mossy boulders, a root arch over the trail; leaf-crowned green monkeys
with big ears and amber eyes and curly tails; a huge moss-green gorilla with a leaf
mantle, seed grenades on its belt, root-wrapped forearm and a green crystal sword.

Run:  blender --background --python tools/blender/build_shadowmere.py [-- --preview out.png]

Writes public/worlds/shadowmere.glb with named prototypes:
  Forest props (origin at the base):  SM_TreeA, SM_TreeB, SM_TreeC, SM_Lantern (origin at the
  hook), SM_Mushrooms, SM_Rock, SM_Arch, SM_Cliff
  Creature parts (origin at the joint, game axes: +Y up, creature faces +Z):
  Monkey_Torso, Monkey_Head, Monkey_ArmL/R, Monkey_LegL/R, Monkey_Tail
  Gorilla_Torso, Gorilla_Head, Gorilla_ArmL/R, Gorilla_LegL/R, Gorilla_Sword (origin at the grip)
src/shadowmere.js reads each part's position as its joint and animates them there.
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'public/worlds/shadowmere.glb')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
random.seed(517)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def link(o): scene.collection.objects.link(o); return o
def activate(o):
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
def B(x, y, z):
    """Game space (x, y up, z toward the creature's front) → Blender (z up, front is -y)."""
    return Vector((x, -z, y))

def lin(h):
    h = h.lstrip('#'); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))
def mat(name, color, rough=.9, emission=None, strength=0, metallic=0, alpha=None, vcol=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*lin(color), 1)
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*lin(emission), 1); p.inputs['Emission Strength'].default_value = strength
    if alpha is not None:
        p.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND'
    if vcol:
        # Vertex colour multiplies the base colour (moss on bark, lighter leaf tips).
        nt = m.node_tree; a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
        mix.inputs['A'].default_value = (*lin(color), 1)
        nt.links.new(a.outputs['Color'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], p.inputs['Base Color'])
    return m

M = {
    'bark': mat('SM_Bark', '#ffffff', .95, vcol=True),
    'leaf': mat('SM_Canopy', '#ffffff', .9, vcol=True),
    'moss': mat('SM_Moss', '#4f7a34', .95),
    'vine': mat('SM_Vine', '#3d5a2b', .9),
    'rock': mat('SM_Stone', '#ffffff', .95, vcol=True),
    'iron': mat('SM_LanternIron', '#2a2119', .55, metallic=.6),
    'glass': mat('SM_LanternGlow', '#ffb24a', .3, '#ff9a2e', 6),
    'shroom': mat('SM_ShroomCap', '#e0752b', .55, '#ff7a1f', 1.6),
    'stem': mat('SM_ShroomStem', '#e7d6b0', .8),
    # creatures
    'mfur': mat('SM_MonkeyFur', '#5a8a2c', .85), 'mfur2': mat('SM_MonkeyLeaf', '#93c43c', .75),
    'mskin': mat('SM_MonkeySkin', '#e6c69b', .7), 'ear': mat('SM_EarInner', '#e08f7c', .7), 'mbelly': mat('SM_MonkeyBelly', '#a9c45c', .85),
    'eye': mat('SM_AmberEye', '#ffb52e', .15, '#ff9a1a', 1.2), 'pupil': mat('SM_Pupil', '#120c08', .2),
    'gfur': mat('SM_GorillaFur', '#20402a', .95), 'gfur2': mat('SM_GorillaMantle', '#4f8a3a', .85),
    'gskin': mat('SM_GorillaSkin', '#4a4a40', .75), 'leather': mat('SM_Leather', '#5a3a22', .9),
    'rope': mat('SM_RootCord', '#6b4a2a', .95), 'pod': mat('SM_SeedPod', '#5f9a3a', .45, '#2a5a1a', .4),
    'crystal': mat('SM_RootCrystal', '#9af0b0', .12, '#3bd27a', 1.1, alpha=.86), 'nail': mat('SM_Nail', '#2a221c', .6),
}

def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.data.materials.append(material); return o

def apply_mods(o):
    activate(o)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def skin(name, verts, edges, radii, material, subsurf=1, displace=0., dscale=1.5, smooth=True):
    """Organic tubes: a vertex skeleton with a radius at each vertex (Skin + Subsurf)."""
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], edges, []); me.update()
    o = link(bpy.data.objects.new(name, me))
    o.modifiers.new('skin', 'SKIN')
    for i, r in enumerate(radii):
        rr = r if isinstance(r, (tuple, list)) else (r, r)
        o.data.skin_vertices[0].data[i].radius = rr
    o.data.skin_vertices[0].data[0].use_root = True
    if subsurf: s = o.modifiers.new('sub', 'SUBSURF'); s.levels = subsurf; s.render_levels = subsurf
    if displace:
        tex = bpy.data.textures.new(name + '_n', 'CLOUDS'); tex.noise_scale = dscale
        d = o.modifiers.new('disp', 'DISPLACE'); d.texture = tex; d.strength = displace; d.mid_level = .5
    apply_mods(o); o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = smooth
    return o

def blob(name, center, radius, scale, material, sub=2, rough=0., seed=0, rot=None):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1)
    for v in bm.verts:
        n = noise.noise(v.co * 1.7 + Vector((seed, seed * .3, 0))) if rough else 0
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) * (1 + rough * n)
    if rot: bmesh.ops.rotate(bm, verts=bm.verts, matrix=rot)
    bmesh.ops.translate(bm, verts=bm.verts, vec=center)
    o = obj_from_bm(name, bm, material)
    for p in o.data.polygons: p.use_smooth = True
    return o

def cone(name, base, tip, r1, r2, material, segs=8):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=1)
    d = tip - base; q = d.to_track_quat('Z', 'Y')
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0, 0, .5)))
    bmesh.ops.scale(bm, verts=bm.verts, vec=Vector((1, 1, d.length)))
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=q.to_matrix())
    bmesh.ops.translate(bm, verts=bm.verts, vec=base)
    return obj_from_bm(name, bm, material)

def leaf(name, base, direction, length, width, material, curl=.3, up=Vector((0, 0, 1))):
    """A pointed, slightly cupped leaf from base along direction."""
    d = direction.normalized(); side = d.cross(up)
    if side.length < 1e-3: side = d.cross(Vector((1, 0, 0)))
    side.normalize(); nrm = side.cross(d)
    bm = bmesh.new(); rows = []
    for i in range(6):
        t = i / 5; w = width * math.sin(math.pi * min(1, t * 1.15)) * (1 - t * .25)
        c = base + d * (length * t) + nrm * (curl * length * t * t)
        rows.append([bm.verts.new(c - side * w + nrm * w * .25), bm.verts.new(c), bm.verts.new(c + side * w + nrm * w * .25)])
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], b[0], b[1], a[1])); bm.faces.new((a[1], b[1], b[2], a[2]))
    o = obj_from_bm(name, bm, material)
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = .012; apply_mods(o)
    return o

def join(objs, name):
    objs = [o for o in objs if o]
    activate(objs[0])
    for o in objs: o.select_set(True)
    bpy.ops.object.join(); o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    return o

def set_origin(o, point):
    scene.cursor.location = point; activate(o); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    scene.cursor.location = (0, 0, 0)

def paint(o, fn):
    """Vertex colour from fn(position, normal) → (r, g, b) in linear space."""
    me = o.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            attr.data[li].color = (*fn(v.co, poly.normal), 1)

def mixc(a, b, t): t = max(0, min(1, t)); return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

# ===================================================================== FOREST
BARK, BARK_DARK, MOSS, MOSS_LIGHT = lin('#4a3a2a'), lin('#2a2219'), lin('#3f6a2a'), lin('#6f9a3e')
def bark_paint(height):
    def fn(co, n):
        mossy = max(0, n.z) * .9 + max(0, 1 - co.z / (height * .3)) * .45 + noise.noise(co * .9) * .35
        base = mixc(BARK_DARK, BARK, .5 + noise.noise(co * 2.3) * .5)
        return mixc(base, mixc(MOSS, MOSS_LIGHT, noise.noise(co * 1.3) * .5 + .5), sstep(.55, .95, mossy))
    return fn
def sstep(a, b, x): t = max(0, min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t)

LEAF_DARK, LEAF_MID, LEAF_LIGHT = lin('#0f2a1e'), lin('#1d4a2c'), lin('#3a6e34')
def canopy_paint(co, n):
    t = max(0, n.z) * .6 + noise.noise(co * .7) * .4 + .2
    return mixc(LEAF_DARK, LEAF_LIGHT if t > .75 else LEAF_MID, t)

def tree(name, height, radius, lean, seed, crowns=True, hang=6):
    """A giant gnarled tree: flaring buttress roots, a twisting trunk, heavy limbs, dark crowns, hanging moss."""
    rnd = random.Random(seed)
    verts, edges, radii = [Vector((0, 0, -.4))], [], [radius * 1.5]
    # trunk: thick and tall, swelling at the base, a slow twist and lean
    seg = 6; prev = 0; tops = []
    for i in range(1, seg + 1):
        t = i / seg
        p = Vector((math.sin(t * 2.4 + seed) * lean * t, math.cos(t * 1.9 + seed) * lean * .7 * t, height * .78 * t))
        verts.append(p); edges.append((prev, len(verts) - 1)); radii.append(radius * (1.25 if i == 1 else 1 - t * .5)); prev = len(verts) - 1
        if i in (seg - 2, seg - 1, seg): tops.append(prev)
    # buttress roots: thick near the trunk, snaking out along the ground
    for k in range(rnd.randint(5, 7)):
        a = k / 6 * math.tau + rnd.uniform(-.3, .3); last = 1
        for j, (rr, z, rad) in enumerate([(radius * 1.25, 1.1, .75), (radius * 2.3, .35, .5), (radius * 3.5 + rnd.uniform(0, 1.4), -.2, .26)]):
            p = Vector((math.cos(a) * rr, math.sin(a) * rr, z)); verts.append(p); edges.append((last if j else 0, len(verts) - 1))
            radii.append((radius * rad, radius * rad * .8)); last = len(verts) - 1
    # limbs
    ends = []
    for k, ti in enumerate(tops):
        for b in range(2 if k < 2 else 3):
            a = rnd.uniform(0, math.tau); base = verts[ti]; last = ti; L = height * rnd.uniform(.18, .26)
            for j in range(1, 4):
                t = j / 3; p = base + Vector((math.cos(a) * L * t, math.sin(a) * L * t, L * .55 * t - L * .25 * t * t))
                verts.append(p); edges.append((last, len(verts) - 1)); radii.append(radius * .38 * (1 - t * .7)); last = len(verts) - 1
            ends.append(verts[last])
    trunk = skin(name + '_wood', verts, edges, radii, M['bark'], subsurf=1, displace=radius * .45, dscale=.7)
    paint(trunk, bark_paint(height))
    parts = [trunk]
    if crowns:
        for i, e in enumerate(ends + [verts[seg]]):
            for j in range(3):
                c = e + Vector((rnd.uniform(-1.8, 1.8), rnd.uniform(-1.8, 1.8), rnd.uniform(.2, 1.8)))
                s = height * rnd.uniform(.1, .14)
                parts.append(blob(f'{name}_crown{i}{j}', c, 1, (s * 1.3, s * 1.2, s * .8), M['leaf'], sub=1, rough=.3, seed=i * 3 + j))
        crown = join(parts[1:], name + '_crowns'); paint(crown, canopy_paint); parts = [trunk, crown]
    # hanging moss strands from limbs
    for i in range(hang):
        e = ends[i % len(ends)].lerp(verts[tops[0]], rnd.uniform(.1, .6))
        L = rnd.uniform(1.2, 3.2)
        parts.append(cone(f'{name}_moss{i}', e, e - Vector((rnd.uniform(-.2, .2), rnd.uniform(-.2, .2), L)), .12, .015, M['moss'], 5))
    o = join(parts, name); set_origin(o, (0, 0, 0)); return o

def lantern():
    """A hexagonal iron cage with amber glass, a cap and a hook, hanging on a vine. Origin at the hook."""
    parts = []
    glass = blob('lg', Vector((0, 0, -1.05)), 1, (.13, .13, .2), M['glass'], sub=2)
    parts.append(glass)
    for i in range(6):
        a = i / 6 * math.tau; x, y = math.cos(a) * .16, math.sin(a) * .16
        parts.append(cone(f'lb{i}', Vector((x, y, -1.3)), Vector((x * .9, y * .9, -.8)), .012, .012, M['iron'], 4))
    parts.append(cone('lcap', Vector((0, 0, -.82)), Vector((0, 0, -.62)), .22, .04, M['iron'], 6))
    parts.append(cone('lbase', Vector((0, 0, -1.36)), Vector((0, 0, -1.28)), .12, .19, M['iron'], 6))
    parts.append(cone('lvine', Vector((0, 0, -.62)), Vector((0, 0, 0)), .025, .02, M['vine'], 5))
    for i in range(3):
        parts.append(leaf(f'll{i}', Vector((0, 0, -.25 - i * .14)), Vector((math.cos(i * 2.1), math.sin(i * 2.1), -.3)), .22, .07, M['moss'], .2))
    return join(parts, 'SM_Lantern')

def mushrooms():
    parts = []; rnd = random.Random(4)
    for i in range(6):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0, .45); x, y = math.cos(a) * r, math.sin(a) * r
        h = rnd.uniform(.18, .55); w = h * rnd.uniform(.45, .7)
        parts.append(cone(f'ms{i}', Vector((x, y, 0)), Vector((x * 1.1, y * 1.1, h)), w * .22, w * .16, M['stem'], 6))
        parts.append(blob(f'mc{i}', Vector((x * 1.1, y * 1.1, h)), 1, (w, w, w * .45), M['shroom'], sub=1))
    return join(parts, 'SM_Mushrooms')

ROCK_A, ROCK_B = lin('#4b5048'), lin('#2e322d')
def rock():
    o = blob('SM_Rock', Vector((0, 0, .35)), 1, (1.3, 1.0, .75), M['rock'], sub=3, rough=.35, seed=7)
    paint(o, lambda co, n: mixc(mixc(ROCK_B, ROCK_A, noise.noise(co * 2) * .5 + .5), mixc(MOSS, MOSS_LIGHT, noise.noise(co) * .5 + .5), sstep(.35, .7, n.z + noise.noise(co * 1.4) * .3)))
    set_origin(o, (0, 0, 0)); return o

def arch():
    """Two root trunks that lean in and braid over the trail (span about 7 m, 6 m high)."""
    verts, edges, radii = [], [], []
    def chain(pts, rr):
        start = len(verts)
        for i, (p, r) in enumerate(zip(pts, rr)):
            verts.append(Vector(p)); radii.append(r)
            if i: edges.append((len(verts) - 2, len(verts) - 1))
        return start
    chain([(-4.2, 0, -.3), (-3.8, .3, 2.2), (-2.6, .1, 4.6), (-.6, -.2, 6.1), (1.4, .2, 5.9), (3.0, 0, 4.4), (3.9, -.2, 2.0), (4.3, 0, -.3)], [.9, .75, .6, .5, .5, .6, .75, .9])
    chain([(-4.6, -.5, -.3), (-3.3, -.6, 3.3), (-1.4, -.4, 5.4), (1.0, -.5, 5.6), (2.9, -.6, 3.8), (4.0, -.5, .8)], [.5, .4, .35, .35, .4, .5])
    for s in (-1, 1):
        for k in range(3):
            a = k * 1.4 + (0 if s < 0 else 3.1)
            chain([(s * 4.2, 0, .2), (s * 4.2 + math.cos(a) * 1.4, math.sin(a) * 1.4, -.1), (s * 4.2 + math.cos(a) * 2.6, math.sin(a) * 2.6, -.35)], [.45, .3, .15])
    o = skin('SM_Arch', verts, edges, radii, M['bark'], subsurf=1, displace=.3, dscale=.8); paint(o, bark_paint(6))
    parts = [o]
    for i, x in enumerate((-2.2, -.4, 1.6)):
        parts.append(cone(f'am{i}', Vector((x, -.2, 5.5)), Vector((x, -.2, 3.6 + i * .3)), .12, .02, M['moss'], 5))
    o = join(parts, 'SM_Arch'); set_origin(o, (0, 0, 0)); return o

def cliff():
    """A mossy rock shelf behind the guardian's clearing, with a notch the waterfall pours from."""
    parts = []
    for i, (x, w, h) in enumerate([(-9, 6, 9), (-3.6, 4, 11), (3.6, 4, 11), (9, 6, 8.5), (0, 3.4, 7.2)]):
        o = blob(f'cl{i}', Vector((x, 0, h * .45)), 1, (w * .62, 3.2, h * .55), M['rock'], sub=3, rough=.3, seed=i * 5); parts.append(o)
    o = join(parts, 'SM_Cliff')
    paint(o, lambda co, n: mixc(mixc(ROCK_B, ROCK_A, noise.noise(co * .6) * .5 + .5), mixc(MOSS, MOSS_LIGHT, noise.noise(co * .4) * .5 + .5), sstep(.3, .7, n.z + noise.noise(co * .5) * .35)))
    set_origin(o, (0, 0, 0)); return o

forest = [tree('SM_TreeA', 18, 1.25, 1.2, 1), tree('SM_TreeB', 14, .95, 1.6, 2), tree('SM_TreeC', 11, .7, .9, 3, hang=4),
          lantern(), mushrooms(), rock(), arch(), cliff()]
for i, o in enumerate(forest): o.location.x = i * 22    # spread out for the preview only; reset before export

# ================================================================= CREATURES
def gblob(name, center, scale, material, **kw):
    """blob() with the scale given in game axes (x, y up, z front)."""
    return blob(name, center, 1, (scale[0], scale[2], scale[1]), material, **kw)

def part_obj(objs, name, pivot):
    o = join(objs, name); set_origin(o, B(*pivot)); return o

def monkey():
    """A leaf-crowned forest imp-monkey (concept image): big round head, huge pointed ears, amber eyes,
    heart-shaped pale face, olive fur with a light belly, crouched on long arms, and a spiral tail."""
    fur, leafc, face, belly = M['mfur'], M['mfur2'], M['mskin'], M['mbelly']
    parts = {}
    # torso: pelvis low and back, chest up and forward (a crouch), belly patch, leafy collar
    torso = [skin('mtorso', [B(0, .52, -.42), B(0, .52, -.25), B(0, .57, -.04), B(0, .68, .14), B(0, .79, .25)],
                  [(0, 1), (1, 2), (2, 3), (3, 4)], [.1, .21, .2, .24, .14], fur, subsurf=2),
             gblob('mbelly', B(0, .58, .2), (.15, .16, .09), belly, rot=Matrix.Rotation(-.9, 3, 'X'))]
    for i in range(9):
        a = -1.4 + i * .35
        torso.append(leaf(f'mcol{i}', B(math.sin(a) * .17, .82, .22 + math.cos(a) * .1), B(math.sin(a) * .9, -.35, math.cos(a) * .55 - .15) - B(0, 0, 0), .26 + .05 * (i % 2), .12, leafc if i % 2 else fur, .3, up=Vector((0, -1, 0))))
    parts['Monkey_Torso'] = part_obj(torso, 'Monkey_Torso', (0, .52, -.2))
    # head
    H = Vector(B(0, .99, .38))
    head = [gblob('mskull', H, (.32, .29, .28), fur, sub=3),
            gblob('mcheekL', H + B(-.09, -.07, .19), (.13, .11, .1), face, sub=3),
            gblob('mcheekR', H + B(.09, -.07, .19), (.13, .11, .1), face, sub=3),
            gblob('mforehead', H + B(0, .05, .2), (.17, .11, .1), face, sub=3),
            gblob('mmuzzle', H + B(0, -.12, .26), (.11, .075, .07), face, sub=3),
            gblob('mnose', H + B(0, -.08, .325), (.03, .02, .02), M['pupil']),
            cone('mmouth', H + B(-.06, -.165, .3), H + B(.06, -.165, .3), .008, .008, M['pupil'], 5)]
    for sd in (-1, 1):
        e = H + B(sd * .1, .0, .255)
        head += [gblob('meye', e, (.075, .085, .045), M['eye'], sub=3),
                 gblob('mpupil', e + B(0, -.005, .034), (.034, .05, .015), M['pupil']),
                 gblob('mshine', e + B(-sd * .025, .03, .043), (.016, .016, .008), M['stem']),
                 # mischievous brows, slanting down to the middle
                 cone('mbrow', e + B(-sd * .07, .095, .02), e + B(sd * .06, .065, .03), .022, .016, fur, 6)]
        # huge pointed ears, angled out and a little up, pink inside
        base = H + B(sd * .27, .06, -.03)
        d = B(sd * 1, .4, -.12) - B(0, 0, 0)
        head += [leaf('mearOut', base, d, .44, .17, fur, .18, up=Vector((0, -1, 0))),
                 leaf('mearIn', base + B(0, 0, .015), d, .36, .12, M['ear'], .16, up=Vector((0, -1, 0)))]
    # leaf crown: a ring of pointed leaves over the brow, longer and sweeping back into a mane
    for i in range(9):
        a = -1.35 + i * (2.7 / 8)
        back = abs(math.cos(a))
        root = H + B(math.sin(a) * .19, .2 + .03 * back, -.03 - .06 * (1 - back))
        d = B(math.sin(a) * 1.0, .85, -.55 - .7 * (1 - back)) - B(0, 0, 0)
        head.append(leaf(f'mcrown{i}', root, d, .3 + .16 * (1 - back), .15, leafc if i % 2 else fur, .35, up=Vector((0, -1, 0))))
    for i in range(5):
        a = -.9 + i * .45
        head.append(leaf(f'mmane{i}', H + B(math.sin(a) * .2, .08, -.2), B(math.sin(a) * .6, .1, -1) - B(0, 0, 0), .36, .14, fur if i % 2 else leafc, .3))
    parts['Monkey_Head'] = part_obj(head, 'Monkey_Head', (0, .8, .26))
    # long arms planted on the ground, elbows back, big hands with long fingers
    for sd, tag in ((-1, 'L'), (1, 'R')):
        sh = (sd * .2, .7, .16)
        arm = skin('marm', [B(*sh), B(sd * .32, .38, .04), B(sd * .28, .1, .36)], [(0, 1), (1, 2)], [.095, .08, .065], fur, subsurf=2)
        hand = [gblob('mpalm', B(sd * .28, .06, .41), (.08, .05, .085), face, sub=2)]
        for k in range(4):
            a = (k - 1.5) * .32
            hand.append(skin(f'mfing{k}', [B(sd * .28 + math.sin(a) * .05, .05, .46), B(sd * .28 + math.sin(a) * .13, .03, .46 + math.cos(a) * .1)], [(0, 1)], [.024, .016], face, subsurf=1))
        parts['Monkey_Arm' + tag] = part_obj([arm] + hand, 'Monkey_Arm' + tag, sh)
    # crouched legs: knee up by the elbow, long feet flat on the ground
    for sd, tag in ((-1, 'L'), (1, 'R')):
        hip = (sd * .16, .5, -.27)
        leg = skin('mleg', [B(*hip), B(sd * .31, .5, .04), B(sd * .25, .14, -.3)], [(0, 1), (1, 2)], [.12, .09, .065], fur, subsurf=2)
        foot = [gblob('mfoot', B(sd * .24, .05, -.2), (.07, .045, .15), face, sub=2)]
        for k in range(4):
            a = (k - 1.5) * .25
            foot.append(skin(f'mtoe{k}', [B(sd * .24 + math.sin(a) * .04, .04, -.08), B(sd * .24 + math.sin(a) * .11, .025, .02)], [(0, 1)], [.02, .013], face, subsurf=1))
        parts['Monkey_Leg' + tag] = part_obj([leg] + foot, 'Monkey_Leg' + tag, hip)
    # tail: sweeps back and up in an S, then winds into a tight spiral with a pale tip
    pts = []
    for i in range(26):
        t = i / 25
        if t < .45:
            u = t / .45; p = (0, .54 + u * .5, -.42 - math.sin(u * 1.4) * .42)
        else:
            u = (t - .45) / .55; ang = u * math.tau * 1.25; r = .2 * (1 - u * .75)
            p = (0, 1.04 + .2 + math.sin(ang - math.pi / 2) * r, -.82 + .02 - math.cos(ang - math.pi / 2) * r)
        pts.append(B(*p))
    tail = skin('mtail', pts, [(i, i + 1) for i in range(25)], [.075 - i * .0019 for i in range(26)], fur, subsurf=1)
    tip = gblob('mtip', pts[-1], (.05, .05, .05), leafc, sub=2)
    parts['Monkey_Tail'] = part_obj([tail, tip], 'Monkey_Tail', (0, .54, -.42))
    return parts

def gorilla():
    f, f2, sk = M['gfur'], M['gfur2'], M['gskin']
    parts = {}
    torso = [gblob('gt', B(0, 1.75, .05), (.72, .78, .55), f),
             gblob('gp', B(0, 1.12, -.05), (.5, .42, .42), f),
             gblob('gchest', B(0, 1.92, .4), (.48, .36, .2), sk),
             gblob('gbelly', B(0, 1.42, .34), (.38, .3, .2), sk)]
    for s in (-1, 1):
        torso.append(gblob('gsh', B(s * .66, 2.2, .02), (.42, .4, .4), f))
    # leaf mantle over the shoulders and back
    for ring, (y, n, rad, L) in enumerate([(2.55, 13, .62, .62), (2.38, 15, .78, .55), (2.18, 11, .9, .45)]):
        for i in range(n):
            a = -math.pi * .95 + i / (n - 1) * math.pi * 1.9
            base = B(math.sin(a) * rad * .9, y, math.cos(a) * rad * .62 - .05)
            d = B(math.sin(a) * .8, -.55 - ring * .15, math.cos(a) * .55) - B(0, 0, 0)
            torso.append(leaf(f'gm{ring}{i}', base, d, L, .16, f2 if (i + ring) % 3 else M['mfur'], .25))
    # belt and diagonal harness with three seed grenades
    belt = skin('gbelt', [B(math.sin(a) * .56, 1.2 + math.sin(a) * .05, math.cos(a) * .45) for a in [i / 16 * math.tau for i in range(17)]], [(i, i + 1) for i in range(16)], [.07] * 17, M['leather'], subsurf=1)
    strap = skin('gstrap', [B(-.55, 2.25, .3), B(0, 1.75, .52), B(.5, 1.25, .42)], [(0, 1), (1, 2)], [.05, .05, .05], M['rope'], subsurf=1)
    torso += [belt, strap]
    for i, x in enumerate((-.32, .02, .36)):
        z = .5 if abs(x) < .2 else .43
        torso.append(gblob(f'gpod{i}', B(x, 1.08, z), (.15, .17, .15), M['pod'], sub=2))
        for k in range(3):
            torso.append(skin(f'gnet{i}{k}', [B(x - .14, 1.08 + (k - 1) * .08, z + .03), B(x, 1.08 + (k - 1) * .1, z + .16), B(x + .14, 1.08 + (k - 1) * .08, z + .03)], [(0, 1), (1, 2)], [.012] * 3, M['rope'], subsurf=0))
        torso.append(cone(f'gfuse{i}', B(x, 1.22, z), B(x, 1.3, z), .03, .015, M['rope'], 5))
    parts['Gorilla_Torso'] = part_obj(torso, 'Gorilla_Torso', (0, .98, 0))
    # head: small for the body, heavy brow, dark face, leaf crest
    H = Vector(B(0, 2.5, .42))
    head = [gblob('gh', H + B(0, .05, -.05), (.4, .42, .38), f), gblob('gface', H + B(0, -.06, .24), (.3, .27, .17), sk),
            gblob('gmuz', H + B(0, -.19, .33), (.23, .14, .14), sk), gblob('gbrow', H + B(0, .1, .33), (.31, .08, .1), sk)]
    for s in (-1, 1):
        e = H + B(s * .12, .02, .38)
        head += [gblob('ge', e, (.05, .04, .03), M['eye']), gblob('gpu', e + B(0, 0, .022), (.022, .022, .012), M['pupil']),
                 gblob('gnos', H + B(s * .05, -.14, .46), (.03, .02, .02), M['pupil'])]
    for i in range(7):
        a = -.9 + i * .3
        head.append(leaf(f'gcr{i}', H + B(math.sin(a) * .16, .38, -.1), B(math.sin(a) * .6, .7, -1) - B(0, 0, 0), .36, .12, f2, .35, up=Vector((0, -1, 0))))
    parts['Gorilla_Head'] = part_obj(head, 'Gorilla_Head', (0, 2.3, .25))
    # arms: huge, knuckles near the ground; the right forearm wrapped in roots
    for s, tag in ((-1, 'L'), (1, 'R')):
        sh = (s * .8, 2.18, .05)
        arm = skin('ga', [B(*sh), B(s * 1.0, 1.55, .12), B(s * 1.02, .95, .3)], [(0, 1), (1, 2)], [.3, .24, .22], f, subsurf=1)
        fist = gblob('gfist', B(s * 1.02, .8, .36), (.24, .2, .26), sk)
        knuckles = [gblob(f'gk{i}', B(s * 1.02 + (i - 1.5) * .09, .74, .55), (.06, .06, .06), sk) for i in range(4)]
        objs = [arm, fist] + knuckles
        if s > 0:
            for k in range(5):
                t = k / 4
                objs.append(skin(f'gwrap{k}', [B(s * (1.0 + .235 * math.cos(a)), 1.5 - t * .5 + .07 * math.sin(a * .5), .21 + .235 * math.sin(a)) for a in [j / 10 * math.tau for j in range(11)]], [(j, j + 1) for j in range(10)], [.028] * 11, M['rope'], subsurf=0))
        parts['Gorilla_Arm' + tag] = part_obj(objs, 'Gorilla_Arm' + tag, sh)
    for s, tag in ((-1, 'L'), (1, 'R')):
        hip = (s * .38, 1.0, -.05)
        leg = skin('gl', [B(*hip), B(s * .45, .55, .12), B(s * .44, .16, 0)], [(0, 1), (1, 2)], [.3, .24, .2], f, subsurf=1)
        foot = gblob('gfoot', B(s * .44, .1, .14), (.24, .1, .32), sk)
        toes = [gblob(f'gt{i}', B(s * .44 + (i - 1.5) * .1, .07, .42), (.055, .05, .07), sk) for i in range(4)]
        parts['Gorilla_Leg' + tag] = part_obj([leg, foot] + toes, 'Gorilla_Leg' + tag, hip)
    # the sword: a long faceted green crystal on a root-wrapped hilt; grip at the right fist, pointing forward and down
    grip = Vector(B(1.02, .8, .36))
    d = (B(.25, -.35, 1) - B(0, 0, 0)).normalized()
    up = d.cross(Vector((1, 0, 0))).normalized()
    sword = [cone('shilt', grip - d * .42, grip + d * .2, .06, .055, M['rope'], 6),
             gblob('spom', grip - d * .46, (.1, .1, .1), M['crystal'], sub=1)]
    for k in range(4):
        sword.append(skin(f'sguard{k}', [grip + d * .24 + up * (.1 * (k - 1.5)) + d.cross(up) * -.25, grip + d * .3 + up * (.1 * (k - 1.5)), grip + d * .24 + up * (.1 * (k - 1.5)) + d.cross(up) * .25], [(0, 1), (1, 2)], [.05, .06, .05], M['rope'], subsurf=0))
    bm = bmesh.new(); L = 1.8; base = grip + d * .22; side = d.cross(up).normalized()
    ring = lambda c, w, t: [bm.verts.new(c + side * w), bm.verts.new(c + up * t), bm.verts.new(c - side * w), bm.verts.new(c - up * t)]
    r0 = ring(base, .1, .05); r1 = ring(base + d * .25, .2, .07); r2 = ring(base + d * (L * .8), .17, .06); tip = bm.verts.new(base + d * L)
    for a, b in ((r0, r1), (r1, r2)):
        for i in range(4): bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    for i in range(4): bm.faces.new((r2[i], r2[(i + 1) % 4], tip))
    bm.faces.new(list(reversed(r0)))
    sword.append(obj_from_bm('sblade', bm, M['crystal']))
    parts['Gorilla_Sword'] = part_obj(sword, 'Gorilla_Sword', tuple(Vector((grip.x, grip.z, -grip.y))))
    return parts

mk = monkey(); gr = gorilla()
for o in mk.values(): o.location += Vector((0, 0, 0))

def tris(objs): return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
print('FOREST TRIS', {o.name: tris([o]) for o in forest})
for o in list(mk.values()) + list(gr.values()): print('PART', o.name, tuple(round(v, 2) for v in o.location), tuple(round(v, 2) for v in o.dimensions))
print('MONKEY TRIS', tris(mk.values()), 'GORILLA TRIS', tris(gr.values()))

if PREVIEW and '--monkey' in argv:
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = o not in mk.values()
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (*lin('#22323c'), 1)
    key = link(bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))); key.data.energy = 3; key.rotation_euler = (math.radians(55), 0, math.radians(-35))
    warm = link(bpy.data.objects.new('warm', bpy.data.lights.new('warm', 'POINT'))); warm.data.energy = 60; warm.data.color = lin('#ffb060'); warm.location = (-1.2, -1.6, 1.4)
    ground = blob('ground', Vector((0, 0, -1)), 1, (4, 4, 1), M['rock'], sub=2)
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 50
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 20; scene.render.resolution_x, scene.render.resolution_y = 700, 700
    for name, loc in (('front', (0, -3.0, 1.0)), ('three', (2.2, -2.2, 1.2)), ('side', (3.0, .2, .9))):
        cam.location = loc; dd = Vector((0, -.1, .6)) - cam.location; cam.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = PREVIEW.replace('.png', f'-{name}.png'); bpy.ops.render.render(write_still=True)
    print('MONKEY PREVIEW done'); sys.exit(0)
if PREVIEW:
    # Preview: monkey, gorilla and props side by side, under a moonlit sky with warm lantern light.
    for o in gr.values(): o.location += Vector((2.2, 0, 0))
    props = [forest[3], forest[4], forest[5]]
    for o in forest: o.hide_render = o not in props
    forest[3].location = Vector((-1.4, -.6, 2.6)); forest[4].location = Vector((-1.0, -1.4, 0)); forest[5].location = Vector((4.6, .8, 0))
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (*lin('#1c2c38'), 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
    sun = link(bpy.data.objects.new('moon', bpy.data.lights.new('moon', 'SUN'))); sun.data.energy = 2.2; sun.data.color = lin('#a8c4ff'); sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
    lamp = link(bpy.data.objects.new('warm', bpy.data.lights.new('warm', 'POINT'))); lamp.data.energy = 300; lamp.data.color = lin('#ffb060'); lamp.location = (-1, -2.5, 2.4)
    ground = blob('ground', Vector((1, 0, -1)), 1, (9, 9, 1), M['rock'], sub=2)
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 35
    cam.location = (1.6, -7.2, 2.2); dd = Vector((1.4, 0, 1.25)) - cam.location; cam.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.render.resolution_x, scene.render.resolution_y = 1100, 700
    scene.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True); print('PREVIEW', PREVIEW)
    cam.location = (6.5, -4.5, 2.4); dd = Vector((1.4, 0, 1.2)) - cam.location; cam.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = PREVIEW.replace('.png', '-side.png'); bpy.ops.render.render(write_still=True)
    if '--trees' in argv:
        for o in bpy.data.objects:
            if o.type == 'MESH': o.hide_render = o not in forest
        for o in gr.values(): o.hide_render = True
        for o in mk.values(): o.hide_render = True
        for o in forest: o.hide_render = False
        for i, o in enumerate(forest): o.location = Vector((i * 14 - 40, 30 if i > 2 else 0, 0))
        ground.scale = (9, 9, 1); ground.location = (0, 0, -40)
        cam.location = (-10, -38, 14); dd = Vector((-10, 10, 7)) - cam.location; cam.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 24
        lamp.location = (-20, -6, 4); lamp.data.energy = 3000
        scene.render.filepath = PREVIEW.replace('.png', '-trees.png'); bpy.ops.render.render(write_still=True); print('PREVIEW', scene.render.filepath)
    sys.exit(0)

for o in forest: o.location = (0, 0, 0)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_normals=True, export_texcoords=False,
                          export_vertex_color='ACTIVE', export_cameras=False, export_lights=False, export_animations=False)
print('EXPORTED', OUT, os.path.getsize(OUT) // 1024, 'KB')
