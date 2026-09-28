"""Shared helpers for the procedural Blender builds (build_warden.py, build_arena.py)."""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

TMP = os.environ.get('HR_BAKE_TMP', '/tmp/hr_bake')
os.makedirs(TMP, exist_ok=True)

def col(): return bpy.context.scene.collection
def link(obj): col().objects.link(obj); return obj
def activate(obj):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
def apply_all(obj):
    activate(obj)
    for m in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
def smooth(obj, angle=None):
    for p in obj.data.polygons: p.use_smooth = True
def sstep(a, b, x):
    t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))
def join(objs, name):
    activate(objs[0])
    for o in objs: o.select_set(True)
    bpy.ops.object.join(); objs[0].name = name; objs[0].data.name = name
    return objs[0]
def set_attr(obj, name, values):
    a = obj.data.attributes.get(name) or obj.data.attributes.new(name, 'FLOAT', 'POINT')
    a.data.foreach_set('value', np.asarray(values, dtype=np.float32))

def tube(points, radii, name, res=10):
    """A tapering tube along points (curve → mesh)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = 2
    cu.resolution_u = 3; cu.use_fill_caps = True
    sp = cu.splines.new('NURBS'); sp.points.add(len(points) - 1); sp.use_endpoint_u = True; sp.order_u = 3
    for p, (co, r) in zip(sp.points, zip(points, radii)): p.co = (*co, 1); p.radius = r
    o = link(bpy.data.objects.new(name, cu))
    activate(o); bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active

# --------------------------------------------------------------- materials
def material(name, build=None, color=None, emission=None, strength=0, rough=.8, metallic=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = metallic
    if color: bsdf.inputs['Base Color'].default_value = (*color, 1)
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1); bsdf.inputs['Emission Strength'].default_value = strength
    if build: build(nt, bsdf)
    return m

def hexc(h): h = h.lstrip('#'); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))

class N:
    """Tiny helper for writing shader networks in a few lines."""
    def __init__(self, nt): self.nt = nt
    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items(): setattr(n, k, v)
        return n
    def attr(self, name): return self.node('ShaderNodeAttribute', attribute_name=name).outputs['Fac']
    def coord(self): return self.node('ShaderNodeTexCoord').outputs['Object']
    def noise(self, scale, detail=4, vec=None, rough=.55):
        n = self.node('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        self.nt.links.new(vec or self.coord(), n.inputs['Vector']); return n.outputs['Fac']
    def voronoi(self, scale, feature='DISTANCE_TO_EDGE', vec=None):
        n = self.node('ShaderNodeTexVoronoi', feature=feature); n.inputs['Scale'].default_value = scale
        self.nt.links.new(vec or self.coord(), n.inputs['Vector']); return n.outputs['Distance']
    def scale(self, vec, s):
        n = self.node('ShaderNodeVectorMath', operation='MULTIPLY'); self.nt.links.new(vec, n.inputs[0]); n.inputs[1].default_value = s
        return n.outputs[0]
    def math(self, op, a, b=0.0, clamp=True):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: self.nt.links.new(v, n.inputs[i])
        return n.outputs[0]
    def ramp(self, fac, a, b, lo=0, hi=1):
        n = self.node('ShaderNodeMapRange'); self.nt.links.new(fac, n.inputs['Value'])
        n.inputs['From Min'].default_value = lo; n.inputs['From Max'].default_value = hi
        n.inputs['To Min'].default_value = a; n.inputs['To Max'].default_value = b; return n.outputs['Result']
    def mix(self, a, b, fac):
        n = self.node('ShaderNodeMix', data_type='RGBA')
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b), (n.inputs[0], fac)):
            if isinstance(v, (int, float)): sock.default_value = v
            elif isinstance(v, tuple): sock.default_value = (*v, 1)
            else: self.nt.links.new(v, sock)
        return n.outputs[2]
    def bump(self, height, strength, bsdf, distance=.1):
        b = self.node('ShaderNodeBump'); b.inputs['Strength'].default_value = strength; b.inputs['Distance'].default_value = distance
        self.nt.links.new(height, b.inputs['Height']); self.nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    def out(self, sock, target):
        self.nt.links.new(sock, target)

def shell_nodes(nt, bsdf):
    n = N(nt)
    g, ring, crack, plast, moss = (n.attr(a) for a in ('groove', 'ring', 'crack', 'plastron', 'moss'))
    grain = n.noise(9, 6); fine = n.noise(38, 3)
    stripes = n.math('SINE', n.math('MULTIPLY', ring, 150, clamp=False), clamp=False)
    base = n.mix(hexc('#3c4526'), hexc('#5e4c2d'), n.ramp(grain, 0, 1, .35, .7))
    base = n.mix(base, hexc('#6e5f3b'), n.math('MULTIPLY', n.ramp(stripes, 0, 1, .4, 1), .14))
    base = n.mix(base, hexc('#b19a63'), plast)
    mossy = n.math('MULTIPLY', moss, n.ramp(n.noise(5, 5), 0, 1, .42, .62))
    base = n.mix(base, hexc('#4a6d2a'), mossy)
    base = n.mix(base, hexc('#1b1a12'), n.math('POWER', g, 1.4))
    base = n.mix(base, hexc('#2a6b5c'), crack)
    n.out(base, bsdf.inputs['Base Color'])
    n.out(n.mix((0, 0, 0), hexc('#63f2c4'), n.math('POWER', crack, 1.5)), bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
    height = n.math('ADD', n.math('MULTIPLY', g, -1.0), n.math('ADD', n.math('MULTIPLY', fine, .35), n.math('MULTIPLY', n.ramp(stripes, 0, 1, -1, 1), .12)), clamp=False)
    n.bump(height, .55, bsdf, .06)

def skin_nodes(nt, bsdf, beak=False):
    n = N(nt)
    scales = n.voronoi(7.5); grain = n.noise(6, 5)
    bark, under = (n.attr('bark'), n.attr('under')) if not beak else (None, None)
    base = n.mix(hexc('#4d5a44'), hexc('#6f7858'), n.ramp(grain, 0, 1, .35, .7))
    if under is not None: base = n.mix(base, hexc('#9a8b63'), under)
    stretched = n.noise(3, 6, n.scale(n.coord(), (5, 5, .6)))
    if bark is not None: base = n.mix(base, n.mix(hexc('#3a2d1f'), hexc('#5a4630'), stretched), bark)
    if beak:
        tip = n.attr('beak'); base = n.mix(base, n.mix(hexc('#2a241b'), hexc('#6d5d42'), n.ramp(grain, 0, 1, .3, .8)), tip)
    base = n.mix(base, hexc('#2c3024'), n.ramp(scales, .55, 0, 0, .06))
    n.out(base, bsdf.inputs['Base Color'])
    height = n.math('ADD', n.ramp(scales, 0, 1, 0, .12), n.math('MULTIPLY', stretched if bark is not None else grain, .4), clamp=False)
    n.bump(height, .6, bsdf, .05)

def root_nodes(nt, bsdf):
    n = N(nt)
    stretched = n.noise(4, 7, n.scale(n.coord(), (7, 7, 1.2)))
    moss = n.ramp(n.noise(3.5, 4), 0, 1, .55, .7)
    base = n.mix(hexc('#2e2317'), hexc('#5b4630'), n.ramp(stretched, 0, 1, .3, .75))
    base = n.mix(base, hexc('#4f6f2e'), moss)
    n.out(base, bsdf.inputs['Base Color'])
    n.bump(stretched, .8, bsdf, .06)

# ------------------------------------------------------------------- baking
def bake(obj, size, normal=True, emission=False):
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    mat = obj.data.materials[0]; nt = mat.node_tree
    mats = [m for m in obj.data.materials if m]
    maps = {}
    passes = [('col', 'DIFFUSE', size)] + ([('emit', 'EMIT', size // 2)] if emission else []) + ([('nrm', 'NORMAL', size // 2)] if normal else [])
    for key, kind, s in passes:
        img = bpy.data.images.new(f'{obj.name}_{key}', s, s, alpha=False)
        if key == 'nrm': img.colorspace_settings.name = 'Non-Color'
        added = []
        for m in mats:  # every slot needs the target image active
            node = m.node_tree.nodes.new('ShaderNodeTexImage'); node.image = img
            for nd in m.node_tree.nodes: nd.select = False
            node.select = True; m.node_tree.nodes.active = node; added.append((m, node))
        if kind == 'DIFFUSE': bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=6)
        else: bpy.ops.object.bake(type=kind, margin=6)
        img.filepath_raw = os.path.join(TMP, f'{obj.name}_{key}.png'); img.file_format = 'PNG'; img.save()
        for m, node in added: m.node_tree.nodes.remove(node)
        maps[key] = img
    # Replace the procedural network with the baked maps.
    new = bpy.data.materials.new(mat.name); new.use_nodes = True
    t = new.node_tree; b = t.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value
    tex = t.nodes.new('ShaderNodeTexImage'); tex.image = maps['col']; t.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if 'emit' in maps:
        e = t.nodes.new('ShaderNodeTexImage'); e.image = maps['emit']; t.links.new(e.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = 3.0
    if 'nrm' in maps:
        nm = t.nodes.new('ShaderNodeTexImage'); nm.image = maps['nrm']
        nmap = t.nodes.new('ShaderNodeNormalMap'); t.links.new(nm.outputs['Color'], nmap.inputs['Color']); t.links.new(nmap.outputs['Normal'], b.inputs['Normal'])
    obj.data.materials[0] = new
    name = mat.name; bpy.data.materials.remove(mat); new.name = name

