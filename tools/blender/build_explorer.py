"""
Builds The Hollow Roots explorer character in Blender and exports it as GLB.

    blender -b --python first-person-verdant/tools/blender/build_explorer.py -- [--stage body|full] [--out PATH]

Requires Blender 4.5 LTS with the MPFB 2 extension and the CC0 MakeHuman asset
packs installed (see public/characters/explorer/README.md). Every step is
scripted so the character can be regenerated after changing a value here.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = arg('--out', os.path.join(PROJECT, 'public', 'characters', 'explorer', 'explorer.glb'))
STAGE = arg('--stage', 'full')

bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
addon_utils.enable('bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.services import HumanService, TargetService, LocationService

USER = LocationService.get_user_data()
SYSTEM = LocationService.get_mpfb_data()
asset = lambda *p: os.path.join(USER, *p)
target = lambda *p: os.path.join(SYSTEM, 'targets', *p)

# ---------------------------------------------------------------------------
# 1. Body. A young adult with an athletic, slightly heroic build. Stylisation
#    comes from proportions (slightly larger eyes and head, longer legs), not
#    from caricature.
# ---------------------------------------------------------------------------
macro = TargetService.get_default_macro_info_dict()
macro.update(gender=.72, age=.47, muscle=.62, weight=.46, proportions=.8, height=.52)
macro['race'] = {'asian': .33, 'caucasian': .34, 'african': .33}
human = HumanService.create_human(macro_detail_dict=macro)
human.name = 'Explorer_Body'

STYLE = {
    ('eyes', 'l-eye-scale-incr'): .35, ('eyes', 'r-eye-scale-incr'): .35,
    ('head', 'head-scale-vert-incr'): .12, ('head', 'head-scale-horiz-incr'): .08, ('head', 'head-oval'): .4,
    ('nose', 'nose-scale-horiz-decr'): .15, ('mouth', 'mouth-scale-horiz-decr'): .1,
    ('neck', 'neck-scale-horiz-incr'): .15,
}
for (folder, name), weight in STYLE.items():
    path = target(folder, name + '.target.gz')
    if os.path.exists(path):
        TargetService.load_target(human, path, weight=weight, name=name)
TargetService.bake_targets(human)

# ---------------------------------------------------------------------------
# 2. Rig: MPFB's game-engine skeleton (Unreal-style names, fingers included).
#    The CC0 Universal Animation Library uses the same bone names.
# ---------------------------------------------------------------------------
HumanService.add_builtin_rig(human, 'game_engine', import_weights=True)
rig = human.parent
rig.name = 'Explorer_Rig'

# ---------------------------------------------------------------------------
# 3. Eyes, brows, lashes, teeth, boots and every hairstyle. Each is its own
#    object so the game can swap them without rebuilding the character.
# ---------------------------------------------------------------------------
def add(path, kind, name):
    before = set(bpy.data.objects)
    HumanService.add_mhclo_asset(path, human, asset_type=kind, material_type='GAMEENGINE', subdiv_levels=0)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in new:
        o.name = name
    return new[0] if new else None

add(asset('eyes', 'low-poly', 'low-poly.mhclo'), 'Eyes', 'Explorer_Eyes')
add(asset('eyebrows', 'eyebrow006', 'eyebrow006.mhclo'), 'Eyebrows', 'Explorer_Brows')
add(asset('eyelashes', 'eyelashes02', 'eyelashes02.mhclo'), 'Eyelashes', 'Explorer_Lashes')
add(asset('teeth', 'teeth_base', 'teeth_base.mhclo'), 'Teeth', 'Explorer_Teeth')
add(asset('clothes', 'shoes03', 'shoes03.mhclo'), 'Clothes', 'Explorer_Boots')
HAIR = {'short': 'short02', 'curly': 'afro01', 'swept': 'short04', 'tied': 'ponytail01', 'braid': 'braid01'}
for key, folder in HAIR.items():
    hair = add(asset('hair', folder, folder + '.mhclo'), 'Hair', 'Hair_' + key)
    bm = bmesh.new(); bm.from_mesh(hair.data); bm.normal_update()
    for v in bm.verts: v.co += v.normal * .004
    bm.to_mesh(hair.data); bm.free()

# ---------------------------------------------------------------------------
# 4. Face presets and expressions as shape keys on the body. Only the head
#    moves, so clothes and hair are unaffected.
# ---------------------------------------------------------------------------
FACES = {
    'Face_Sharp': {('chin', 'chin-prominent-incr'): .5, ('chin', 'chin-width-decr'): .25, ('cheek', 'l-cheek-bones-incr'): .55,
                   ('cheek', 'r-cheek-bones-incr'): .55, ('head', 'head-invertedtriangular'): .5, ('nose', 'nose-point-width-decr'): .3},
    'Face_Round': {('head', 'head-round'): .6, ('cheek', 'l-cheek-volume-incr'): .55, ('cheek', 'r-cheek-volume-incr'): .55,
                   ('chin', 'chin-width-incr'): .3, ('nose', 'nose-volume-incr'): .2},
}
U = lambda n: ('expression/units/caucasian', n)
EXPRESSIONS = {
    'Blink': {U('eye-left-closure'): 1, U('eye-right-closure'): 1},
    'Smile': {U('mouth-corner-puller'): .8, U('mouth-elevation'): .2, U('eye-left-slit'): .25, U('eye-right-slit'): .25,
              U('eyebrows-left-extern-up'): .2, U('eyebrows-right-extern-up'): .2},
    'Exert': {U('mouth-compression'): .6, U('mouth-corner-puller'): .25, U('eyebrows-left-down'): .7, U('eyebrows-right-down'): .7,
              U('eye-left-slit'): .5, U('eye-right-slit'): .5, U('nose-compression'): .4},
    'Hurt': {U('eyebrows-left-inner-up'): .8, U('eyebrows-right-inner-up'): .8, U('eye-left-closure'): .55, U('eye-right-closure'): .55,
             U('mouth-depression-retraction'): .7, U('mouth-open'): .2},
    'Talk': {U('mouth-open'): .55},
}

def compound_key(obj, name, parts):
    """Load each part as a temporary key, mix them into one named key, drop the parts."""
    keys = obj.data.shape_keys.key_blocks
    temps = []
    for (folder, part), weight in parts.items():
        path = target(folder, part + '.target.gz')
        TargetService.load_target(obj, path, weight=weight, name='tmp_' + part)
        temps.append('tmp_' + part)
    for k in keys:
        if k.name != 'Basis' and k.name not in temps:
            k.value = 0
    obj.shape_key_add(name=name, from_mix=True)
    for t in temps:
        obj.shape_key_remove(keys[t])
    keys[name].value = 0

if human.data.shape_keys is None:
    human.shape_key_add(name='Basis')
for name, parts in {**FACES, **EXPRESSIONS}.items():
    compound_key(human, name, parts)

# ---------------------------------------------------------------------------
# 5. Remove helper geometry (MPFB fitting guides) now that everything is fitted.
# ---------------------------------------------------------------------------
def keep_group(obj, group_name):
    gi = obj.vertex_groups[group_name].index
    bm = bmesh.new(); bm.from_mesh(obj.data)
    deform = bm.verts.layers.deform.verify()
    doomed = [v for v in bm.verts if gi not in v[deform]]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(obj.data); bm.free()

for m in list(human.modifiers):
    if m.type == 'MASK':
        human.modifiers.remove(m)
keep_group(human, 'body')
for vg in list(human.vertex_groups):
    if vg.name not in {b.name for b in rig.data.bones}:
        human.vertex_groups.remove(vg)


# ---------------------------------------------------------------------------
# 6. Garments. Each piece is cut from the body surface so it inherits the
#    body's topology, UVs and skin weights, then loosened (inflate + relax),
#    given real thickness, and hemmed with clean cuts.
# ---------------------------------------------------------------------------
from mathutils.bvhtree import BVHTree
import numpy as np

bpy.context.view_layer.update()   # matrices are stale until the depsgraph updates
W = rig.matrix_world
def bone_pt(name, which='head'):
    b = rig.data.bones[name]
    return W @ (b.head_local if which == 'head' else b.tail_local)

L = {n: bone_pt(n) for n in ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'upperarm_l', 'upperarm_r',
                           'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r']}
boots = bpy.data.objects['Explorer_Boots']
BOOT_TOP = max((boots.matrix_world @ v.co).z for v in boots.data.vertices)
WAIST = L['spine_01'].z - .005          # belt line
NECK = L['neck_01'].z - .02
bone_names = [g.name for g in human.vertex_groups]

def dominant_bones(obj):
    """Per-vertex name of the bone with the most weight."""
    out = []
    for v in obj.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        out.append(obj.vertex_groups[best.group].name if best else '')
    return out

DOM = dominant_bones(human)
ARM = {'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'}
HAND = {n for n in bone_names if n.startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_'))}
LEG = {'thigh_l', 'thigh_r', 'calf_l', 'calf_r'}
HEADNECK = {'head', 'neck_01'}

def new_from_body(name, keep_vert):
    mesh = human.data.copy(); mesh.name = name
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    obj.parent = rig; obj.matrix_world = human.matrix_world.copy()
    for g in human.vertex_groups: obj.vertex_groups.new(name=g.name)
    obj.shape_key_clear()
    mod = obj.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    bm = bmesh.new(); bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    world = [human.matrix_world @ v.co for v in bm.verts]
    doomed = [f for f in bm.faces if not all(keep_vert(v.index, world[v.index]) for v in f.verts)]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(mesh); bm.free()
    return obj

def cut(obj, co, no, side=0):
    """Cut the mesh with a plane and remove everything on the +normal side.
    side=+1/-1 limits the removal to that half of the body (x sign)."""
    bm = bmesh.new(); bm.from_mesh(obj.data)
    M = obj.matrix_world; inv = M.inverted()
    co, no = Vector(co), Vector(no).normalized()
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=inv @ co,
                           plane_no=(inv.to_3x3() @ no).normalized(), clear_outer=not side)
    if side:
        doomed = [f for f in bm.faces if (lambda c: (c - co).dot(no) > 1e-5 and c.x * side > 0)(M @ f.calc_center_median())]
        bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free()

def loosen(obj, inflate, relax=4, relax_factor=.5):
    """Push the surface off the skin and relax it so it reads as cloth, not paint."""
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * inflate
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(relax):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=relax_factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:                      # relaxing shrinks; restore the offset
        v.co += v.normal * inflate * .25
    bm.to_mesh(obj.data); bm.free()

EDGE_ART = {}      # object name -> UV segments for seams and hems, recorded before thickening

def record_edges(obj):
    me = obj.data; uv = me.uv_layers.active.data; uses = {}
    for poly in me.polygons:
        loops = list(poly.loop_indices); n = len(loops)
        cen = sum((uv[l].uv for l in loops), Vector((0, 0))) / n
        for k in range(n):
            l0, l1 = loops[k], loops[(k + 1) % n]
            key = tuple(sorted((me.loops[l0].vertex_index, me.loops[l1].vertex_index)))
            uses.setdefault(key, []).append((uv[l0].uv.copy(), uv[l1].uv.copy(), cen.copy()))
    segs = []
    for key, us in uses.items():
        if len(us) == 1: segs.append(('hem',) + us[0])
        elif len(us) == 2 and ((us[0][0] - us[1][1]).length > 1e-4 or (us[0][1] - us[1][0]).length > 1e-4):
            segs.extend(('seam',) + u for u in us)
    EDGE_ART[obj.name] = segs

def thicken(obj, thickness):
    if obj.name not in EDGE_ART: record_edges(obj)
    mod = obj.modifiers.new('Thickness', 'SOLIDIFY'); mod.thickness = thickness; mod.offset = -1; mod.use_rim = True
    obj.modifiers.move(len(obj.modifiers) - 1, 0)
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier='Thickness')

def shade_smooth(obj):
    for p in obj.data.polygons: p.use_smooth = True

def axis_cut(obj, a, b, t, keep_toward_a=True):
    """Cut perpendicular to the segment a→b at fraction t."""
    a, b = Vector(a), Vector(b); d = (b - a).normalized(); co = a.lerp(b, t)
    cut(obj, co, d if keep_toward_a else -d, side=1 if a.x > 0 else -1)

# --- Trousers ----------------------------------------------------------------
trousers = new_from_body('Outfit_Trousers', lambda i, p: p.z < WAIST + .05 and DOM[i] not in HAND and DOM[i] not in ARM)
cut(trousers, (0, 0, WAIST + .03), (0, 0, 1))
cut(trousers, (0, 0, BOOT_TOP - .035), (0, 0, -1))
loosen(trousers, .011, relax=3); thicken(trousers, .004); shade_smooth(trousers)

# --- Undershirt (both outfits wear it; the Warden coat covers most of it) ------
shirt = new_from_body('Outfit_Undershirt', lambda i, p: p.z > WAIST - .09 and DOM[i] not in HAND and DOM[i] not in LEG)
cut(shirt, (0, 0, NECK), (0, 0, 1))
for side in 'lr':
    axis_cut(shirt, L['lowerarm_' + side], L['hand_' + side], .93)
loosen(shirt, .008, relax=3); thicken(shirt, .003); shade_smooth(shirt)


def set_weights(obj, vert_index, weights):
    for g in obj.vertex_groups:
        g.remove([vert_index])
    for name, w in weights.items():
        if w > 0:
            (obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)).add([vert_index], w, 'REPLACE')

def copy_weights_from(obj, source, bvh_source_positions, radius=1):
    """Give each vertex of `obj` the weights of the nearest vertex of `source` (for small added parts)."""
    from mathutils.kdtree import KDTree
    kd = KDTree(len(source.data.vertices))
    for v in source.data.vertices: kd.insert(source.matrix_world @ v.co, v.index)
    kd.balance()
    names = {g.index: g.name for g in source.vertex_groups}
    for v in obj.data.vertices:
        _, idx, _ = kd.find(obj.matrix_world @ v.co)
        set_weights(obj, v.index, {names[g.group]: g.weight for g in source.data.vertices[idx].groups})

def attach(obj, weights_source):
    obj.parent = rig
    for g in weights_source.vertex_groups:
        if not obj.vertex_groups.get(g.name): obj.vertex_groups.new(name=g.name)
    copy_weights_from(obj, weights_source, None)
    mod = obj.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    shade_smooth(obj)

BODY_BVH = None
def uv_from_body(points):
    """UVs of the nearest body surface points (for geometry grown off a garment)."""
    global BODY_BVH
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    if BODY_BVH is None:
        BODY_BVH = BVHTree.FromPolygons([human.matrix_world @ v.co for v in human.data.vertices], [p.vertices[:] for p in human.data.polygons])
    uv = human.data.uv_layers.active.data; out = []
    for p in points:
        loc, _, fi, _ = BODY_BVH.find_nearest(p)
        poly = human.data.polygons[fi]; li = list(poly.loop_indices)
        co = [human.matrix_world @ human.data.vertices[v].co for v in poly.vertices]
        tri = (0, 1, 2) if len(li) == 3 else min([(0, 1, 2), (0, 2, 3)], key=lambda t: (sum((co[i] for i in t), Vector()) / 3 - loc).length)
        a, b, c = (co[i] for i in tri); ua, ub, uc = (uv[li[i]].uv.to_3d() for i in tri)
        out.append(barycentric_transform(loc, a, b, c, ua, ub, uc).to_2d())
    return out

def reuv_faces(obj, faces_pred):
    me = obj.data; uv = me.uv_layers.active.data; M = obj.matrix_world
    for poly in me.polygons:
        if not faces_pred(M @ poly.center): continue
        pts = [M @ me.vertices[me.loops[l].vertex_index].co for l in poly.loop_indices]
        for l, u in zip(poly.loop_indices, uv_from_body(pts)): uv[l].uv = u

def extrude_hem(obj, bottom_z, rings, drop, flare, thigh_share=.55, slit_sides=True, back_vent=False):
    """Extend the lower boundary of a torso garment into a flared skirt with
    side slits. Lower rings borrow thigh weights so the hem follows the legs."""
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    inv = obj.matrix_world.inverted(); M = obj.matrix_world
    deform = bm.verts.layers.deform.verify()
    gi = {g.name: g.index for g in obj.vertex_groups}
    for name in ('thigh_l', 'thigh_r', 'pelvis'):
        if name not in gi: gi[name] = obj.vertex_groups.new(name=name).index
    edges = [e for e in bm.edges if e.is_boundary and all(abs((M @ v.co).z - bottom_z) < .012 for v in e.verts)]
    centre = Vector((0, sum((M @ v.co).y for e in edges for v in e.verts) / max(1, 2 * len(edges)), 0))
    ring_edges = edges; made = []
    for k in range(1, rings + 1):
        res = bmesh.ops.extrude_edge_only(bm, edges=ring_edges)
        new_verts = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
        ring_edges = [g for g in res['geom'] if isinstance(g, bmesh.types.BMEdge) and all(v in new_verts for v in g.verts)]
        for v in new_verts:
            w = M @ v.co
            radial = Vector((w.x - centre.x, w.y - centre.y, 0))
            w = w + radial.normalized() * (flare / rings) * (1 + k * .15) if radial.length > 1e-6 else w
            w.z -= drop / rings
            v.co = inv @ w
            a = thigh_share * k / rings
            side = 'thigh_l' if w.x > 0 else 'thigh_r'
            v[deform].clear()
            v[deform][gi['pelvis']] = 1 - a
            v[deform][gi[side]] = a
        made.append(new_verts)
    # Side slits (and an optional back vent) so the legs can stride.
    doomed = []
    for f in bm.faces:
        c = M @ f.calc_center_median()
        if c.z > bottom_z - .02: continue
        ang = math.degrees(math.atan2(c.x, -(c.y - centre.y)))    # 0 = front, ±90 = sides
        if slit_sides and 80 < abs(ang) < 100: doomed.append(f)
        if back_vent and abs(ang) > 172 and c.z < bottom_z - drop * .45: doomed.append(f)
    bmesh.ops.delete(bm, geom=list(set(doomed)), context='FACES')
    bm.to_mesh(obj.data); bm.free()

def front_v(obj, apex_z, width, top_z):
    """Open a V-neck at the front: two cuts meeting at the sternum, front faces only."""
    bm = bmesh.new(); bm.from_mesh(obj.data)
    inv = obj.matrix_world.inverted(); M = obj.matrix_world
    for sx in (1, -1):
        no = Vector((sx * (top_z - apex_z), 0, -width)).normalized()
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=inv @ Vector((0, 0, apex_z)), plane_no=inv.to_3x3() @ no)
    doomed = []
    for f in bm.faces:
        c = M @ f.calc_center_median()
        if c.y < -.02 and c.z > apex_z and abs(c.x) < (c.z - apex_z) * width / (top_z - apex_z):
            doomed.append(f)
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free()

def band_from(obj, name, z_low, z_high, inflate, thickness):
    band = obj.copy(); band.data = obj.data.copy(); band.name = name; bpy.context.collection.objects.link(band)
    cut(band, (0, 0, z_high), (0, 0, 1)); cut(band, (0, 0, z_low), (0, 0, -1))
    loosen(band, inflate, relax=0); thicken(band, thickness); shade_smooth(band)
    return band

def box(name, size, location, bevel=.004, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        m = o.modifiers.new('b', 'BEVEL'); m.width = bevel; m.segments = 3
        bpy.ops.object.modifier_apply(modifier='b')
    return o

def ribbon(name, points, surface, width, lift, thickness=.004):
    """A strap laid over `surface` along control points (smoothly resampled)."""
    from mathutils.bvhtree import BVHTree
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(surface, deps)
    pts = [Vector(p) for p in points]
    samples = []
    for i in range(len(pts) - 1):
        for k in range(12):
            samples.append(pts[i].lerp(pts[i + 1], k / 12))
    samples.append(pts[-1])
    inv = surface.matrix_world.inverted()
    placed = []
    for p in samples:
        loc, normal, _, _ = bvh.find_nearest(inv @ p)
        placed.append((surface.matrix_world @ loc, (surface.matrix_world.to_3x3() @ normal).normalized()))
    for _ in range(3):   # smooth the path so it drapes rather than zig-zags
        placed = [placed[0]] + [((placed[i - 1][0] + placed[i][0] * 2 + placed[i + 1][0]) / 4, placed[i][1]) for i in range(1, len(placed) - 1)] + [placed[-1]]
    bm = bmesh.new(); rows = []
    for i, (p, n) in enumerate(placed):
        d = (placed[min(i + 1, len(placed) - 1)][0] - placed[max(i - 1, 0)][0]).normalized()
        side = d.cross(n).normalized() * width / 2
        base = p + n * lift
        rows.append([bm.verts.new(base - side), bm.verts.new(base + side), bm.verts.new(base + side + n * thickness), bm.verts.new(base - side + n * thickness)])
    for a, b in zip(rows, rows[1:]):
        for j in range(4):
            bm.faces.new((a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]))
    mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uv.data[li].uv = ((vi % 4) / 4, (vi // 4) / max(1, len(rows)))
    return obj

# --- Ranger outfit: sleeveless laced jerkin with a split skirt -------------------
jerkin = new_from_body('Ranger_Jerkin', lambda i, p: WAIST - .1 < p.z < NECK + .02 and abs(p.x) < L['upperarm_l'].x + .02 and DOM[i] not in HAND and DOM[i] not in HEADNECK and DOM[i] not in LEG)
cut(jerkin, (0, 0, WAIST - .06), (0, 0, -1)); cut(jerkin, (0, 0, NECK - .005), (0, 0, 1))
ARMPIT = L['upperarm_l'].z - .13
def armholes(obj, inset):
    """Sleeveless armholes: a clean vertical cut inside each shoulder, above the armpit only."""
    bm = bmesh.new(); bm.from_mesh(obj.data); M = obj.matrix_world; inv = M.inverted()
    x0 = L['upperarm_l'].x - inset
    for sx in (1, -1):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=inv @ Vector((sx * x0, 0, 0)), plane_no=inv.to_3x3() @ Vector((1, 0, 0)))
    doomed = [f for f in bm.faces if (lambda c: abs(c.x) > x0 and c.z > ARMPIT)(M @ f.calc_center_median())]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free()
armholes(jerkin, .02)
front_v(jerkin, apex_z=L['spine_03'].z + .02, width=.07, top_z=NECK)
loosen(jerkin, .02, relax=5)
extrude_hem(jerkin, WAIST - .06, rings=4, drop=.27, flare=.07)
reuv_faces(jerkin, lambda c: c.z < WAIST - .06)
thicken(jerkin, .006); shade_smooth(jerkin)

belt = band_from(jerkin, 'Ranger_Belt', WAIST - .035, WAIST + .015, .008, .006)
front = min(belt.data.vertices, key=lambda v: (belt.matrix_world @ v.co).y + abs((belt.matrix_world @ v.co).x) * 4)
fp = belt.matrix_world @ front.co
buckle = box('Ranger_Buckle', (.055, .012, .045), (fp.x, fp.y - .006, fp.z), bevel=.003); attach(buckle, belt)
hip = max((belt.matrix_world @ v.co for v in belt.data.vertices), key=lambda w: -w.x * .7 - w.y)
pouch = box('Ranger_Pouch', (.085, .045, .085), (hip.x - .005, hip.y - .02, hip.z - .05), bevel=.01, rotation=(0, 0, math.radians(-35)))
flap = box('Ranger_PouchFlap', (.09, .05, .03), (hip.x - .005, hip.y - .022, hip.z - .013), bevel=.008, rotation=(0, 0, math.radians(-35)))
for o in (pouch, flap): attach(o, belt)
shoulder_l = L['upperarm_l'] + Vector((-.06, .0, .03))
strap = ribbon('Ranger_Strap', [shoulder_l + Vector((0, .1, -.05)), shoulder_l, Vector((.05, -.13, L['spine_03'].z)),
                               Vector((-.07, -.13, L['spine_01'].z + .08)), Vector((hip.x + .02, hip.y, WAIST - .01))], jerkin, .038, .006)
attach(strap, jerkin)

# Leather bracers over the forearms.
bracers = new_from_body('Ranger_Bracers', lambda i, p: DOM[i] in {'lowerarm_l', 'lowerarm_r'})
for side in 'lr':
    axis_cut(bracers, L['lowerarm_' + side], L['hand_' + side], .42, keep_toward_a=False)
    axis_cut(bracers, L['lowerarm_' + side], L['hand_' + side], .95)
loosen(bracers, .016, relax=1); thicken(bracers, .005); shade_smooth(bracers)

# Laces across the V-neck.
laces = []
apex = L['spine_03'].z + .02
for k in range(4):
    z0 = apex + .02 + k * .028
    half = (z0 - apex) * .07 / (NECK - apex) + .012
    laces.append(ribbon(f'Ranger_Lace{k}', [Vector((-half, -.2, z0)), Vector((half, -.2, z0 + .02))], jerkin, .006, .004, .003))
    laces.append(ribbon(f'Ranger_LaceX{k}', [Vector((half, -.2, z0)), Vector((-half, -.2, z0 + .02))], jerkin, .006, .004, .003))
for o in laces: attach(o, jerkin)

# --- Warden outfit: quilted high-collared coat, shoulder guard, shin wraps ------
coat = new_from_body('Warden_Coat', lambda i, p: WAIST - .1 < p.z < NECK + .02 and DOM[i] not in HAND and DOM[i] not in HEADNECK and DOM[i] not in LEG)
cut(coat, (0, 0, WAIST - .06), (0, 0, -1)); cut(coat, (0, 0, NECK - .005), (0, 0, 1))
for side in 'lr':
    axis_cut(coat, L['lowerarm_' + side], L['hand_' + side], .9)
loosen(coat, .024, relax=6)
extrude_hem(coat, WAIST - .06, rings=4, drop=.33, flare=.06, slit_sides=False, back_vent=True)
reuv_faces(coat, lambda c: c.z < WAIST - .06)
# High collar: raise the neck opening.
bm = bmesh.new(); bm.from_mesh(coat.data); M = coat.matrix_world; inv = M.inverted()
top = [e for e in bm.edges if e.is_boundary and all((M @ v.co).z > NECK - .03 for v in e.verts)]
res = bmesh.ops.extrude_edge_only(bm, edges=top)
for v in (g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)):
    w = M @ v.co; r = Vector((w.x, w.y - L['neck_01'].y, 0))
    w = w - r * .12; w.z += .075; v.co = inv @ w
bm.to_mesh(coat.data); bm.free()
reuv_faces(coat, lambda c: c.z > NECK - .01)
thicken(coat, .008); shade_smooth(coat)
wbelt = band_from(coat, 'Warden_Belt', WAIST - .03, WAIST + .02, .009, .006)

guard = new_from_body('Warden_Pauldron', lambda i, p: (p - L['upperarm_r']).length < .15 and p.z > L['upperarm_r'].z - .07 and DOM[i] not in HEADNECK)
loosen(guard, .05, relax=4); thicken(guard, .009); shade_smooth(guard)
guard2 = guard.copy(); guard2.data = guard.data.copy(); guard2.name = 'Warden_PauldronPlate'; bpy.context.collection.objects.link(guard2)
cut(guard2, (0, 0, L['upperarm_r'].z - .02), (0, 0, -1)); loosen(guard2, .012, relax=0)

wraps = new_from_body('Warden_Wraps', lambda i, p: DOM[i] in {'calf_l', 'calf_r'})
cut(wraps, (0, 0, BOOT_TOP - .01), (0, 0, -1)); cut(wraps, (0, 0, L['calf_l'].z - .04), (0, 0, 1))
loosen(wraps, .018, relax=1); thicken(wraps, .004); shade_smooth(wraps)

OUTFITS = {
    'ranger': ['Ranger_Jerkin', 'Ranger_Belt', 'Ranger_Buckle', 'Ranger_Pouch', 'Ranger_PouchFlap', 'Ranger_Strap', 'Ranger_Bracers'] + [o.name for o in laces],
    'warden': ['Warden_Coat', 'Warden_Belt', 'Warden_Pauldron', 'Warden_PauldronPlate', 'Warden_Wraps'],
}

# --- Hide the body where clothing always covers it ---------------------------
wrist = {s: (Vector(L['lowerarm_' + s]), Vector(L['hand_' + s])) for s in 'lr'}
def covered(i, p):
    if DOM[i] in HAND or DOM[i] in HEADNECK: return False
    if p.z > NECK - .05: return False
    if DOM[i] in ARM or DOM[i].startswith('lowerarm'):
        a, b = wrist['l' if p.x > 0 else 'r']; d = b - a
        return (p - a).dot(d) / d.length_squared < .82
    return True
bm = bmesh.new(); bm.from_mesh(human.data); bm.verts.ensure_lookup_table()
hidden = [f for f in bm.faces if all(covered(v.index, human.matrix_world @ v.co) for v in f.verts)]
bmesh.ops.delete(bm, geom=hidden, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(human.data); bm.free()

print('garments', {o.name: len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH'})


# ---------------------------------------------------------------------------
# 6b. Head-attached parts share the face's morph targets: bind them to the
#     body with Surface Deform and bake one shape key per face key, so hair,
#     brows, lashes, eyes and teeth follow face presets, blinks and talking.
# ---------------------------------------------------------------------------
FACE_KEYS = list(FACES) + list(EXPRESSIONS)
# Brows and lashes ride every expression; eyes and hair only change with the
# face preset (eyeballs and hair must not move on a blink); the teeth sit too
# deep for a clean bind and stay rigid.
head_parts = {'Explorer_Brows': FACE_KEYS, 'Explorer_Lashes': FACE_KEYS, 'Explorer_Eyes': list(FACES), **{'Hair_' + k: list(FACES) for k in HAIR}}
keys = human.data.shape_keys.key_blocks
for name, part_keys in head_parts.items():
    obj = bpy.data.objects[name]
    sd = obj.modifiers.new('FaceFollow', 'SURFACE_DEFORM'); sd.target = human
    obj.modifiers.move(len(obj.modifiers) - 1, 0)
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.surfacedeform_bind(modifier='FaceFollow')
        for key in part_keys:
            for k in keys: k.value = 0
            keys[key].value = 1
            bpy.context.view_layer.update()
            bpy.ops.object.modifier_apply_as_shapekey(keep_modifier=True, modifier='FaceFollow')
            obj.data.shape_keys.key_blocks[-1].name = key
        obj.modifiers.remove(sd)
    for k in obj.data.shape_keys.key_blocks: k.value = 0
for k in keys: k.value = 0

# ---------------------------------------------------------------------------
# 7. Materials. Tintable parts use near-white textures so the game's colour
#    choice multiplies straight through: M_Shirt* follow the shirt colour,
#    M_Pants* the trouser colour, M_Skin the skin tone, M_Hair* the hair colour.
# ---------------------------------------------------------------------------
TEX = 1024
rng = np.random.default_rng(7)

def to_image(name, rgba):
    h, w, _ = rgba.shape
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.flipud(np.clip(rgba, 0, 1)).astype(np.float32).ravel())
    img.file_format = 'PNG'; img.pack()
    return img

def from_image(path, size=TEX):
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
    a = np.flipud(a); f = a.shape[0] // size
    return a.reshape(size, f, size, f, 4).mean(axis=(1, 3)) if f > 1 else a

def blur(a, r=2):
    out = a.copy()
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-r, r + 1): acc += np.roll(out, k, axis=axis)
        out = acc / (2 * r + 1)
    return out

def noise(scale, amount):
    small = rng.normal(0, 1, (TEX // scale + 1, TEX // scale + 1))
    big = np.kron(small, np.ones((scale, scale)))[:TEX, :TEX]
    return blur(big[..., None], max(1, scale // 2))[..., 0] * amount

def weave(period=5, amount=.05):
    y, x = np.mgrid[0:TEX, 0:TEX]
    return (np.sin(x * 2 * np.pi / period) * np.sin(y * 2 * np.pi / period)) * amount

def quilt(period=34, amount=.14):
    y, x = np.mgrid[0:TEX, 0:TEX]
    d1 = np.abs(((x + y) % period) - period / 2) / (period / 2)
    d2 = np.abs(((x - y) % period) - period / 2) / (period / 2)
    return (np.minimum(d1, d2) - .5) * amount * 2

def draw(img, a, b, width, mult, dash=None):
    a = np.array(a) * TEX; b = np.array(b) * TEX
    length = np.linalg.norm(b - a); n = max(2, int(length * 2))
    for k in range(n + 1):
        t = k / n
        if dash and (t * length) % dash[0] > dash[1]: continue
        px, py = a + (b - a) * t
        x0, x1 = int(px - width), int(px + width) + 1; y0, y1 = int(py - width), int(py + width) + 1
        if x1 < 0 or y1 < 0 or x0 >= TEX or y0 >= TEX: continue
        img[TEX - min(TEX, y1):TEX - max(0, y0), max(0, x0):min(TEX, x1), :3] *= mult

def paint_edges(img, name, seam=(1.5, .72), hem=(5, .74), stitch=True):
    for kind, a, b, c in EDGE_ART.get(name, []):
        w, m = hem if kind == 'hem' else seam
        draw(img, a, b, w, m)
        if stitch:
            off = (c - (a + b) / 2); off = off / max(off.length, 1e-6) * (w + 3.5) / TEX
            draw(img, a + off, b + off, .7, 1.22 if kind == 'hem' else 1.15, dash=(6, 3))

def cloth(name, tone, pattern=None, stitch=True, hem=(5, .74)):
    base = np.ones((TEX, TEX, 4)); base[..., :3] *= np.array(tone)
    grain = noise(16, .05) + noise(4, .03) + (pattern if pattern is not None else weave())
    base[..., :3] *= (1 + grain)[..., None]
    paint_edges(base, name, stitch=stitch, hem=hem)
    return to_image('T_' + name, base)

def leather(name, tone=(.36, .24, .15)):
    base = np.ones((TEX, TEX, 4)); base[..., :3] *= np.array(tone)
    base[..., :3] *= (1 + noise(24, .12) + noise(6, .06) + np.clip(noise(3, .5), -.08, 0))[..., None]
    paint_edges(base, name, seam=(1, .8), hem=(3, .7))
    return to_image('T_' + name, base)

def material(name, image=None, color=(1, 1, 1), rough=.85, metal=0.0, alpha=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1); bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if image:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha:
            nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha']); m.blend_method = 'CLIP'
    return m

def assign(names, mat):
    for n in names:
        o = bpy.data.objects[n]; o.data.materials.clear(); o.data.materials.append(mat)

# Skin: the CC0 MakeHuman texture, softened and normalised to a neutral mid
# value so the game can tint it to any tone without muddying.
skin = from_image(asset('skins', 'young_caucasian_male', 'young_lightskinned_male_diffuse.png'))
bg = skin[2, 2, :3]; mask = np.abs(skin[..., :3] - bg).sum(-1) > .03
mean = skin[mask][:, :3].mean(0)
skin[..., :3] = blur(skin[..., :3], 1) / mean * .8
assign(['Explorer_Body'], material('M_Skin', to_image('T_Skin', skin), rough=.55))

def greyscale(obj_name, mat_name):
    o = bpy.data.objects[obj_name]; old = o.data.materials[0]
    img = next(n.image for n in old.node_tree.nodes if n.type == 'TEX_IMAGE')
    a = from_image(bpy.path.abspath(img.filepath), size=min(TEX, img.size[0]))
    lum = a[..., :3] @ np.array([.3, .59, .11]); opaque = a[..., 3] > .5
    lum = lum / max(lum[opaque].mean(), 1e-3) * .75
    a[..., :3] = np.clip(lum, 0, 1)[..., None]
    assign([obj_name], material(mat_name, to_image('T_' + mat_name, a), rough=.7, alpha=True))

for key in HAIR: greyscale('Hair_' + key, 'M_Hair_' + key)
greyscale('Explorer_Brows', 'M_Hair_Brows')

assign(['Outfit_Trousers'], material('M_Pants_Trousers', cloth('Outfit_Trousers', (.86, .86, .86), weave(3, .06)), rough=.9))
assign(['Outfit_Undershirt'], material('M_Linen', cloth('Outfit_Undershirt', (.86, .82, .72), weave(4, .07)), rough=.92))
assign(['Ranger_Jerkin'], material('M_Shirt_Jerkin', cloth('Ranger_Jerkin', (.9, .9, .9), weave(6, .04), hem=(7, .62)), rough=.88))
assign(['Warden_Coat'], material('M_Shirt_Coat', cloth('Warden_Coat', (.9, .9, .9), quilt(), hem=(7, .66)), rough=.9))
assign(['Warden_Wraps'], material('M_Wraps', cloth('Warden_Wraps', (.74, .68, .55), quilt(22, .08)), rough=.95))
for n in ['Ranger_Belt', 'Ranger_Bracers', 'Warden_Belt', 'Warden_Pauldron', 'Warden_PauldronPlate']:
    assign([n], material('M_Leather_' + n.split('_')[1], leather(n), rough=.6))
plain_leather = material('M_Leather', leather('small_parts', (.3, .2, .13)), rough=.6)
assign(['Ranger_Pouch', 'Ranger_PouchFlap', 'Ranger_Strap'] + [o.name for o in laces], plain_leather)
assign(['Ranger_Buckle'], material('M_Brass', color=(.62, .47, .22), rough=.35, metal=.9))

print('STAGE body done', len(human.data.vertices), [o.name for o in bpy.data.objects])
if STAGE == 'body':
    bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
    pass

# ---------------------------------------------------------------------------
# 9. Export. One GLB with every variant object, skin, morph target and clip.
# ---------------------------------------------------------------------------
def export(path):
    for o in bpy.data.objects:
        o.hide_set(False); o.hide_render = False; o.select_set(o.type in {'MESH', 'ARMATURE'})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=False, export_yup=True,
        export_skins=True, export_morph=True, export_morph_normal=True, export_morph_animation=False,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_image_format='WEBP', export_image_quality=88, export_texcoords=True, export_normals=True,
        export_tangents=False, export_cameras=False, export_lights=False,
    )
    print('EXPORTED', path, os.path.getsize(path) // 1024, 'KB')

if STAGE == 'full':
    exec(open(os.path.join(HERE, 'animate_explorer.py')).read())
    if '--save' in ARGS: bpy.ops.wm.save_as_mainfile(filepath=arg('--save', '/tmp/explorer_full.blend'))
if STAGE in ('body', 'full'):
    export(OUT)
