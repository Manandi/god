"""
Animation stage for build_explorer.py (executed in its namespace: `rig`, `bpy`).

Motion comes from two places:
  * The CC0 Universal Animation Library (Quaternius) as a motion foundation.
    Its skeleton uses the same Unreal-style bone names as MPFB's game-engine
    rig, so clips are retargeted bone by bone through world-space rotation
    deltas, with pelvis travel scaled to our leg length.
  * Edits authored here. Every clip is `base clip + time warp + edits`, where
    an edit rotates a bone (and everything below it) about a body axis over
    time. The explorer's strikes, guard, strafes and emotes are built this way
    so the finished motion belongs to The Hollow Roots.

Axes (Blender space, the character faces -Y):
  LEFT = +X, FWD = -Y, UP = +Z.
  about LEFT: +angle tips the top of a bone forward (a hanging limb swings back)
  about UP:   +angle turns toward the character's left
  about FWD:  +angle rolls the top toward the character's right
"""
import bpy, math, os
from mathutils import Quaternion, Matrix, Vector

FPS = 30
LIBRARY = os.environ.get('UAL_GLB', '/opt/mpfb/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
LEFT, FWD, UP = Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))

scene = bpy.context.scene
scene.render.fps = FPS

before = set(bpy.data.objects); actions_before = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=LIBRARY)
library_objects = [o for o in bpy.data.objects if o not in before]
src = next(o for o in library_objects if o.type == 'ARMATURE')
library_actions = {a.name: a for a in bpy.data.actions if a not in actions_before}
if src.animation_data is None: src.animation_data_create()

tgt = rig
if tgt.animation_data is None: tgt.animation_data_create()
tbones = tgt.data.bones
ORDER = []                                 # parents before children
def walk(b):
    ORDER.append(b.name)
    for c in b.children: walk(c)
for b in tbones:
    if b.parent is None: walk(b)
SRC_NAME = {n: ('Head' if n == 'head' else 'root' if n == 'Root' else n) for n in ORDER}
MAPPED = {n for n in ORDER if SRC_NAME[n] in src.data.bones}

Wt = tgt.matrix_world.to_quaternion(); Ws = src.matrix_world.to_quaternion()
REST_T = {n: tgt.matrix_world @ tbones[n].matrix_local for n in ORDER}
REST_Tq = {n: REST_T[n].to_quaternion() for n in ORDER}
REST_Sq = {n: (src.matrix_world @ src.data.bones[SRC_NAME[n]].matrix_local).to_quaternion() for n in MAPPED}
S_HIP = (src.matrix_world @ src.data.bones['pelvis'].head_local)
T_HIP = (tgt.matrix_world @ tbones['pelvis'].head_local)
HIP_SCALE = (T_HIP.z - min((tgt.matrix_world @ tbones[n].head_local).z for n in ('foot_l', 'foot_r'))) / \
            (S_HIP.z - min((src.matrix_world @ src.data.bones[n].head_local).z for n in ('foot_l', 'foot_r')))
DESC = {n: [] for n in ORDER}
for n in reversed(ORDER):
    p = tbones[n].parent
    if p: DESC[p.name] += [n] + DESC[n]

REST_HEAD = {n: tgt.matrix_world @ tbones[n].head_local for n in ORDER}
Y = Vector((0, 1, 0))

def fk_positions(world, pelvis_offset):
    pos = {}
    for n in ORDER:
        p = tbones[n].parent
        if not p: pos[n] = REST_HEAD[n].copy(); continue
        pos[n] = pos[p.name] + world[p.name] @ (REST_Tq[p.name].inverted() @ (REST_HEAD[n] - REST_HEAD[p.name]))
        if n == 'pelvis': pos[n] = pos[n] + pelvis_offset
    return pos

def rotate_subtree(world, bone, q):
    for m in [bone] + DESC[bone]:
        world[m] = q @ world[m]

def solve_two_bone(world, offset, upper, lower, end, target, pole, weight):
    """Aim `upper`→`lower`→`end` so `end` reaches `target` (world), bending toward `pole`."""
    if weight <= 0: return
    pos = fk_positions(world, offset)
    S, E, H = pos[upper], pos[lower], pos[end]
    la, lb = (E - S).length, (H - E).length
    goal = H.lerp(target, weight)
    to = goal - S; d = min(max(to.length, abs(la - lb) + 1e-4), la + lb - 1e-4); dir = to.normalized()
    pp = (pole - dir * pole.dot(dir)); pp = pp.normalized() if pp.length > 1e-6 else Vector((0, 0, -1))
    cos_a = max(-1, min(1, (la * la + d * d - lb * lb) / (2 * la * d))); sin_a = math.sqrt(1 - cos_a * cos_a)
    E2 = S + dir * cos_a * la + pp * sin_a * la
    rotate_subtree(world, upper, (E - S).normalized().rotation_difference((E2 - S).normalized()))
    pos = fk_positions(world, offset)
    E3, H3 = pos[lower], pos[end]
    rotate_subtree(world, lower, (H3 - E3).normalized().rotation_difference((S + dir * d - E3).normalized()))

def sample_source(action, t):
    """World rotations of mapped bones and pelvis offset from the library clip at time t (s)."""
    src.animation_data.action = action
    f = action.frame_range[0] + t * FPS
    scene.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    rot = {n: (src.matrix_world @ src.pose.bones[SRC_NAME[n]].matrix).to_quaternion() for n in MAPPED}
    hip = (src.matrix_world @ src.pose.bones['pelvis'].matrix).translation - S_HIP
    return rot, hip

def retarget_world(src_rot):
    world = {}
    for n in ORDER:
        if n in MAPPED:
            world[n] = (src_rot[n] @ REST_Sq[n].inverted()) @ REST_Tq[n]
        else:
            p = tbones[n].parent
            world[n] = world[p.name] @ (REST_Tq[p.name].inverted() @ REST_Tq[n]) if p else REST_Tq[n]
    return world

def smooth_keys(keys, t):
    """Interpolate [(t, value)] with smoothstep easing; values may be numbers or vectors."""
    if t <= keys[0][0]: return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            u = (t - t0) / max(t1 - t0, 1e-6); u = u * u * (3 - 2 * u)
            return v0 + (v1 - v0) * u
    return keys[-1][1]

ARMS = {n for n in ORDER if n.startswith(('clavicle', 'upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky'))}

def build(name, base, duration, warp=None, edits=(), hip_offset=None, loop=False, reverse=False, fixed_time=None, arms_from=None, ik=()):
    """Bake one clip onto the explorer rig.
    base: library clip name; warp: [(t_new, t_src)] time mapping; edits: list of
    (bone, axis, [(t, degrees)], space) with space 'world' (default) or 'local'.
    arms_from: (library clip, time) whose arm pose (relative to the chest) replaces
    the base clip's arms, so authored strikes start from a clean arm pose.
    ik: list of (upper, lower, end, origin_bone, [(t, (x, y, z), weight)], [(t, pole)])
    placing `end` at a target given relative to `origin_bone` in body axes."""
    lib = library_actions[base]
    src_len = (lib.frame_range[1] - lib.frame_range[0]) / FPS
    act = bpy.data.actions.new('HR_' + name); act.use_fake_user = True
    tgt.animation_data.action = act
    for pb in tgt.pose.bones: pb.rotation_mode = 'QUATERNION'
    frames = int(round(duration * FPS))
    for fi in range(frames + 1):
        t = fi / FPS
        if fixed_time is not None: ts = fixed_time
        elif warp: ts = _linear(warp, t)
        elif reverse: ts = src_len - (t / duration) * src_len
        else: ts = min(t / duration * src_len, src_len) if loop else min(t, src_len)
        src_rot, hip = sample_source(lib, ts)
        world = retarget_world(src_rot)
        if arms_from:
            arm_world = retarget_world(sample_source(library_actions[arms_from[0]], arms_from[1])[0])
            for n in ORDER:
                if n in ARMS:
                    p = tbones[n].parent.name
                    world[n] = world[p] @ arm_world[p].inverted() @ arm_world[n]
        local_edits = []
        for bone, axis, keys, *space in edits:
            angle = math.radians(smooth_keys(keys, t))
            if abs(angle) < 1e-6: continue
            if space and space[0] == 'local':
                local_edits.append((bone, axis, angle)); continue
            q = Quaternion(axis, angle)
            for m in [bone] + DESC[bone]:
                world[m] = q @ world[m]
        offset = hip * HIP_SCALE
        if hip_offset: offset = offset + smooth_keys([(a, Vector(b)) for a, b in hip_offset], t)
        for upper, lower, end, origin, keys, poles in ik:
            target = smooth_keys([(a, Vector(v)) for a, v, w in keys], t)
            weight = smooth_keys([(a, w) for a, v, w in keys], t)
            pole = smooth_keys([(a, Vector(v)) for a, v in poles], t)
            solve_two_bone(world, offset, upper, lower, end, fk_positions(world, offset)[origin] + target, pole, weight)
        # Convert world rotations to pose-bone locals, parents first.
        for n in ORDER:
            pb = tgt.pose.bones[n]; p = tbones[n].parent
            if p:
                basis = REST_Tq[n].inverted() @ REST_Tq[p.name] @ world[p.name].inverted() @ world[n]
            else:
                basis = REST_Tq[n].inverted() @ world[n]
            for bone, axis, angle in local_edits:
                if bone == n: basis = basis @ Quaternion(axis, angle)
            pb.rotation_quaternion = basis.normalized()
            pb.keyframe_insert('rotation_quaternion', frame=fi + 1)
        pelvis = tgt.pose.bones['pelvis']
        # Pose translation is expressed in the pelvis's rest orientation.
        pelvis.location = REST_Tq['pelvis'].inverted() @ offset
        pelvis.keyframe_insert('location', frame=fi + 1)
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    act.frame_range = (1, frames + 1)
    return act

def _linear(points, t):
    if t <= points[0][0]: return points[0][1]
    for (a0, b0), (a1, b1) in zip(points, points[1:]):
        if t <= a1: return b0 + (b1 - b0) * (t - a0) / max(a1 - a0, 1e-6)
    return points[-1][1]

# ----------------------------------------------------------------------------
# Shared pose layers
# ----------------------------------------------------------------------------
GUARD_L, GUARD_R = (.11, -.3, .1), (-.09, -.24, .17)       # fists relative to the chest
POLE_L, POLE_R = (.5, .1, -.8), (-.5, .1, -.8)                # elbows down and a little out
def guard_ik(keys_l=None, keys_r=None, poles_l=None, poles_r=None):
    return [('upperarm_l', 'lowerarm_l', 'hand_l', 'spine_03', keys_l or [(0, GUARD_L, 1), (99, GUARD_L, 1)], poles_l or [(0, POLE_L), (99, POLE_L)]),
            ('upperarm_r', 'lowerarm_r', 'hand_r', 'spine_03', keys_r or [(0, GUARD_R, 1), (99, GUARD_R, 1)], poles_r or [(0, POLE_R), (99, POLE_R)])]

def guard(level=1.0):
    """Rootbound guard details that IK does not cover: fists, wrists, chin."""
    k = lambda deg: [(0, deg * level), (99, deg * level)]
    return [('hand_l', LEFT, k(12), 'local'), ('hand_r', LEFT, k(12), 'local'),
            *fist('l', level), *fist('r', level), ('spine_01', LEFT, k(6)), ('head', LEFT, k(-4))]

def fist(side, level=1.0, keys=None):
    out = []
    for finger in ('index', 'middle', 'ring', 'pinky'):
        for j, deg in ((1, 70), (2, 90), (3, 60)):
            out.append((f'{finger}_0{j}_{side}', LEFT, keys or [(0, deg * level), (99, deg * level)], 'local'))
    out.append((f'thumb_02_{side}', LEFT, keys or [(0, 35 * level), (99, 35 * level)], 'local'))
    return out

def scaled(edits, keys_fn):
    """Re-key a constant pose layer over time: keys_fn(deg) -> [(t, deg)]."""
    return [(b, ax, keys_fn(k[0][1]), *rest) for b, ax, k, *rest in edits]

# ----------------------------------------------------------------------------
# Clips
# ----------------------------------------------------------------------------
CLIPS = []
def clip(*a, **kw): CLIPS.append(build(*a, **kw))

clip('Idle', 'Idle_Loop', 2.5, loop=True)
clip('Walk', 'Walk_Loop', 1.0, loop=True)
clip('Jog', 'Jog_Fwd_Loop', .72, loop=True)
clip('WalkBackward', 'Walk_Loop', 1.1, loop=True, reverse=True)
# Strafes: the legs walk sideways while the chest stays square to the front.
strafe = lambda sign: [('pelvis', UP, [(0, -80 * sign), (99, -80 * sign)]), ('spine_01', UP, [(0, 40 * sign), (99, 40 * sign)]),
                       ('spine_02', UP, [(0, 25 * sign), (99, 25 * sign)]), ('spine_03', UP, [(0, 15 * sign), (99, 15 * sign)])]
clip('StrafeRight', 'Walk_Loop', 1.0, loop=True, edits=strafe(1))
clip('StrafeLeft', 'Walk_Loop', 1.0, loop=True, edits=strafe(-1))
# Combat locomotion keeps the guard up.
clip('GuardIdle', 'Idle_Loop', 1.4, loop=True, edits=guard(), hip_offset=[(0, (0, 0, -.04)), (99, (0, 0, -.04))], ik=guard_ik())
clip('GuardWalk', 'Walk_Loop', .9, loop=True, edits=guard(.95) + [('spine_01', LEFT, [(0, 8), (99, 8)])], ik=guard_ik())
clip('GuardBack', 'Walk_Loop', .95, loop=True, reverse=True, edits=guard(.95), ik=guard_ik())
clip('GuardRight', 'Walk_Loop', .9, loop=True, edits=strafe(1) + guard(.95), ik=guard_ik())
clip('GuardLeft', 'Walk_Loop', .9, loop=True, edits=strafe(-1) + guard(.95), ik=guard_ik())

clip('JumpStart', 'Jump_Start', .3, warp=[(0, .72), (.3, 1.2)])
clip('Fall', 'Jump_Loop', 1.0, loop=True)
clip('Land', 'Jump_Land', .42, warp=[(0, 0), (.42, .7)])
clip('Dash', 'Roll', .6, warp=[(0, .1), (.08, .3), (.42, 1.0), (.6, 1.32)])
clip('Hurt', 'Hit_Chest', .42, warp=[(0, 0), (.42, .33)], edits=[('spine_01', LEFT, [(0, 0), (.08, -10), (.42, 0)])])
clip('Death', 'Death01', 2.0, warp=[(0, 0), (2.0, 2.4)])
clip('Interact', 'Interact', 1.2, warp=[(0, 0), (1.2, 2.0)])
clip('Talk', 'Idle_Talking_Loop', 2.93, loop=True)
clip('Sit', 'Sitting_Idle_Loop', 1.67, loop=True)
clip('Wave', 'Idle_Loop', 1.2, loop=True, edits=[
    ('upperarm_r', FWD, [(0, 140), (99, 140)]), ('upperarm_r', LEFT, [(0, -20), (99, -20)]),
    ('lowerarm_r', FWD, [(0, 20), (.3, -25), (.6, 20), (.9, -25), (1.2, 20)]), ('head', UP, [(0, -8), (99, -8)])])
clip('Cheer', 'Idle_Loop', 1.0, loop=True, edits=[
    ('upperarm_l', FWD, [(0, -150), (.5, -165), (1, -150)]), ('upperarm_r', FWD, [(0, 150), (.5, 165), (1, 150)]),
    ('lowerarm_l', LEFT, [(0, -20), (99, -20)]), ('lowerarm_r', LEFT, [(0, -20), (99, -20)]),
    *fist('l'), *fist('r'), ('head', LEFT, [(0, -10), (99, -10)])],
    hip_offset=[(0, (0, 0, 0)), (.25, (0, 0, .05)), (.5, (0, 0, 0)), (.75, (0, 0, .05)), (1, (0, 0, 0))])
clip('Pose', 'Idle_Loop', 2.0, loop=True, edits=[
    ('upperarm_r', FWD, [(0, 35), (99, 35)]), ('lowerarm_r', UP, [(0, -80), (99, -80)]), ('lowerarm_r', LEFT, [(0, -30), (99, -30)]),
    ('upperarm_l', FWD, [(0, -35), (99, -35)]), ('lowerarm_l', UP, [(0, 80), (99, 80)]), ('lowerarm_l', LEFT, [(0, -30), (99, -30)]),
    ('head', LEFT, [(0, -8), (99, -8)]), ('spine_03', LEFT, [(0, -5), (99, -5)])])

# --- Rootbound strikes. Contact times match combat/moves.js exactly. ------------
# AttackLight1 · Sapling Palm: lead-hand palm heel stepping off the front foot.
# Foundation: the library jab (contact frame 6), re-timed to land at 0.12 s and
# changed from a fist to an open palm heel driven by a torso turn.
clip('AttackLight1', 'Punch_Jab', .46, warp=[(0, 0), (.12, .2), (.46, .87)], arms_from=('Idle_Loop', 0), edits=guard(1) + [
    ('hand_l', LEFT, [(0, 0), (.08, -40), (.12, -55), (.2, -55), (.35, 0)], 'local'),       # wrist back: palm heel leads
    *[(f'{f}_0{j}_l', LEFT, [(0, 0), (.08, -d), (.22, -d), (.35, 0)], 'local') for f in ('index', 'middle', 'ring', 'pinky') for j, d in ((1, 70), (2, 90), (3, 60))],
    ('spine_01', UP, [(0, 0), (.06, 10), (.12, -18), (.2, -16), (.46, 0)]),
    ('spine_01', LEFT, [(0, 0), (.12, 10), (.2, 10), (.46, 0)]),
], ik=guard_ik(keys_l=[(0, GUARD_L, 1), (.06, (.15, -.18, .06), 1), (.12, (.03, -.66, -.05), 1), (.2, (.03, -.64, -.05), 1), (.35, GUARD_L, 1), (.46, GUARD_L, 1)],
               poles_l=[(0, POLE_L), (.12, (.6, 0, -.6)), (.35, POLE_L)]),
   hip_offset=[(0, (0, 0, -.04)), (.12, (0, -.03, -.07)), (.46, (0, 0, -.04))])

# AttackLight2 · Bough Swing: the rear forearm sweeps across at chest height as
# the hips and chest unwind; the elbow stays bent, so the forearm is the edge.
clip('AttackLight2', 'Punch_Cross', .6, warp=[(0, 0), (.2, .3), (.6, 1.0)], arms_from=('Idle_Loop', 0), edits=guard(1) + [
    ('spine_01', UP, [(0, 0), (.12, -24), (.2, 28), (.26, 34), (.6, 0)]),
    ('spine_02', UP, [(0, 0), (.12, -10), (.2, 12), (.26, 14), (.6, 0)]),
    ('head', UP, [(0, 0), (.12, 20), (.2, -26), (.6, 0)]),
], ik=guard_ik(keys_r=[(0, GUARD_R, 1), (.12, (-.4, -.08, .08), 1), (.2, (.02, -.5, .02), 1), (.26, (.26, -.4, 0), 1), (.45, GUARD_R, 1), (.6, GUARD_R, 1)],
               poles_r=[(0, POLE_R), (.12, (-.8, .3, .2)), (.2, (-.6, -.2, .3)), (.3, (-.3, 0, -.5)), (.45, POLE_R)]),
   hip_offset=[(0, (0, 0, -.04)), (.12, (0, .03, -.06)), (.2, (0, -.03, -.08)), (.6, (0, 0, -.04))])

# AttackHeavy · Taproot Heel: the rear knee chambers high, the heel drives
# straight through, then the leg re-chambers and plants. Authored with leg IK.
FOOT_R_REST = (-.1, .02, -1.2)
clip('AttackHeavy', 'Idle_Loop', .82, fixed_time=0, arms_from=('Idle_Loop', 0), edits=guard(1) + [
    ('foot_r', LEFT, [(0, 0), (.16, -25), (.27, -45), (.34, -45), (.47, -10), (.82, 0)], 'local'),
    ('spine_01', LEFT, [(0, 0), (.16, -6), (.27, -18), (.34, -18), (.47, -8), (.82, 0)]),
    ('head', LEFT, [(0, 0), (.27, 10), (.34, 10), (.82, 0)]),
], ik=guard_ik(keys_l=[(0, GUARD_L, 1), (.27, (.2, -.2, .06), 1), (.5, GUARD_L, 1)], keys_r=[(0, GUARD_R, 1), (.27, (-.2, -.12, .1), 1), (.5, GUARD_R, 1)]) + [
    ('thigh_r', 'calf_r', 'foot_r', 'spine_03', [(0, FOOT_R_REST, 0), (.16, (-.1, -.22, -.78), 1), (.27, (-.07, -.82, -.52), 1), (.34, (-.07, -.8, -.52), 1),
                                                (.47, (-.1, -.28, -.8), 1), (.62, (-.1, -.12, -1.1), .6), (.82, FOOT_R_REST, 0)],
     [(0, (0, -1, .2)), (.16, (0, -1, .6)), (.27, (0, -.3, 1)), (.47, (0, -1, .5)), (.82, (0, -1, .2))]),
], hip_offset=[(0, (0, 0, -.04)), (.16, (0, .02, 0)), (.27, (0, .03, -.02)), (.34, (0, .02, -.02)), (.62, (0, -.02, -.06)), (.82, (0, 0, -.04))])

# Library clips and the library skeleton are not shipped.
for o in library_objects: bpy.data.objects.remove(o, do_unlink=True)
for a in library_actions.values(): bpy.data.actions.remove(a)
for a in CLIPS: a.name = a.name[3:]
tgt.animation_data.action = None
for pb in tgt.pose.bones:
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
scene.frame_set(1)
print('CLIPS', [(a.name, round((a.frame_range[1] - a.frame_range[0]) / FPS, 2)) for a in CLIPS])
