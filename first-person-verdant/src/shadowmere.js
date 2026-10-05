import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SHADOWMERE as SM } from './world.js';

// Shadowmere, built from the owner's concept image (public/concepts/shadowmere-forest-concept.png):
// giant gnarled mossy trees, amber cage lanterns along the trail, glowing mushrooms, mossy
// boulders, a root arch at the entrance, a moon over blue mist, fireflies, and a waterfall
// pouring into a pool behind the Rootbound Gorilla's clearing. The models come from
// tools/blender/build_shadowmere.py (public/worlds/shadowmere.glb). The same file holds the
// green monkeys' and the gorilla's body parts; dress() swaps them onto the creatures in
// creatures.js, keeping its joints (arms, legs, neck, tail, sword) so its animation drives them.

const BASE = import.meta.env?.BASE_URL || '/';
const TRAIL = [[130, -11], [129, -23], [133, -37], [127, -49], [130, -65]];
const STREAM = [[134, -80], [141, -78], [147, -73], [153, -69], [160, -66]];
const POOL = { x: 130, z: -81.5, r: 4.6 }, CLIFF = { x: 130, z: -88 }, ARCH = { x: 130, z: -16 };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function segDist(px, pz, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(px - ax - dx * t, pz - az - dz * t));
  }
  return best;
}
function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner); grad.addColorStop(.35, outer); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), r = rng(9);
  g.fillStyle = 'rgba(160,215,230,.35)'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(235,250,255,${.25 + r() * .6})`; g.fillRect(r() * 64, r() * 256, 1 + r() * 2.5, 18 + r() * 60); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rippleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,190,110,${.15 + r() * .35})`; g.lineWidth = 1; g.beginPath(); const x = r() * 128, y = r() * 128; g.moveTo(x, y); g.lineTo(x + 6 + r() * 14, y + (r() - .5) * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** The meshes of a GLB node (a node with several materials is a group of meshes). */
function meshesOf(node) { const out = []; node.traverse(o => { if (o.isMesh) out.push(o); }); return out; }

export function createShadowmere(scene, { groundY, addCollider, creatures }) {
  const root = new THREE.Group(); root.name = 'Shadowmere'; scene.add(root);
  const lanternSpots = [], halos = [], lights = [];
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,214,140,1)', 'rgba(255,140,40,.35)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

  // The moon and its halo, hung in the sky to the south (ahead of you on the trail).
  const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false, transparent: true }));
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(200,220,255,.9)', 'rgba(120,150,220,.25)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  moonHalo.scale.setScalar(120); moon.renderOrder = moonHalo.renderOrder = -1; scene.add(moon, moonHalo);
  const MOON_DIR = new THREE.Vector3(-.25, .42, -1).normalize();

  // Fireflies: amber specks drifting low between the trees.
  const FLY = 240, flyBase = new Float32Array(FLY * 3), flyPos = new Float32Array(FLY * 3), fr = rng(77);
  for (let i = 0; i < FLY; i++) { const a = fr() * Math.PI * 2, d = Math.sqrt(fr()) * (SM.r - 4), x = SM.x + Math.cos(a) * d, z = SM.z + Math.sin(a) * d; flyBase.set([x, groundY(x, z) + .5 + fr() * 3.5, z], i * 3); }
  const flyGeo = new THREE.BufferGeometry(); flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: 0xffc463, size: .13, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flies.frustumCulled = false; root.add(flies);

  // Ground mist: soft blue sheets that hang between the trunks.
  const mistMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(120,160,190,.5)', 'rgba(70,110,140,.18)'), depthWrite: false, transparent: true, opacity: .32 });
  const mr = rng(31);
  for (let i = 0; i < 26; i++) { const a = mr() * Math.PI * 2, d = 8 + mr() * (SM.r - 10), x = SM.x + Math.cos(a) * d, z = SM.z + Math.sin(a) * d, s = new THREE.Sprite(mistMat); s.position.set(x, groundY(x, z) + 1.2, z); s.scale.set(16 + mr() * 10, 5, 1); root.add(s); }

  // Four warm lights follow you from lantern to lantern (cheaper than one per lantern).
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa548, 0, 14, 1.6); scene.add(l); lights.push(l); }

  // Water: the pool under the falls and the stream that runs east out of the clearing.
  const ripple = rippleTexture(); ripple.repeat.set(3, 3);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b3a48, roughness: .12, metalness: .35, emissive: 0xffffff, emissiveMap: ripple, emissiveIntensity: .35, transparent: true, opacity: .92 });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(POOL.r, 40), waterMat); pool.rotation.x = -Math.PI / 2; pool.position.set(POOL.x, groundY(POOL.x, POOL.z) + .06, POOL.z); root.add(pool);
  const curve = new THREE.CatmullRomCurve3(STREAM.map(([x, z]) => new THREE.Vector3(x, 0, z))), sp = [], si = [], N = 60;
  for (let i = 0; i <= N; i++) { const t = i / N, p = curve.getPoint(t), q = curve.getTangent(t), w = 1.3 - t * .3; for (const s of [-1, 1]) { const x = p.x - q.z * w * s, z = p.z + q.x * w * s; sp.push(x, groundY(x, z) + .07, z); } if (i < N) { const a = i * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
  const streamMat = waterMat.clone(); streamMat.emissiveMap = ripple.clone(); streamMat.emissiveMap.repeat.set(1, 8); streamMat.side = THREE.DoubleSide;
  root.add(new THREE.Mesh(sg, streamMat));
  // The falls: a sheet of moving streaks from the notch in the cliff, with spray at the foot.
  const streaks = streakTexture(); streaks.repeat.set(1.4, 1.5);
  const fallsY = groundY(CLIFF.x, CLIFF.z + 4);
  const falls = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7.4, 1, 6), new THREE.MeshBasicMaterial({ map: streaks, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
  { const pos = falls.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, Math.pow((3.7 - y) / 7.4, 2) * 1.6); } }
  falls.position.set(CLIFF.x, fallsY + 3.7, CLIFF.z + 3.05); root.add(falls);
  const sprayMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(230,245,255,.8)', 'rgba(160,200,220,.25)'), depthWrite: false, transparent: true, opacity: .55 });
  const spray = [0, 1, 2, 3, 4].map(i => { const s = new THREE.Sprite(sprayMat); s.position.set(CLIFF.x - 1.4 + i * .7, fallsY + .5, CLIFF.z + 4.4); s.scale.setScalar(2.2); root.add(s); return s; });

  const placed = [];                // {x, z, r}: keeps props apart so no walker can be boxed in
  const clear = (x, z, r) => {
    if (Math.hypot(x - SM.x, z - SM.z) > SM.r - 1.5) return false;
    if (segDist(x, z, TRAIL) < 4.6 + r || segDist(x, z, STREAM) < 2 + r) return false;
    if (Math.hypot(x - SM.guardian.x, z - SM.guardian.z) < 13 + r || Math.hypot(x - SM.entry.x, z - SM.entry.z) < 6 + r) return false;
    if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 1.5 + r || (Math.abs(x - CLIFF.x) < 15 && z < CLIFF.z + 5.5)) return false;
    if ((creatures || []).some(c => Math.hypot(x - c.home.x, z - c.home.z) < 2.5 + r)) return false;
    return placed.every(p => Math.hypot(x - p.x, z - p.z) > p.r + r + 1.3);
  };

  const state = { ready: false, shade: 0 };
  const loaded = new GLTFLoader().loadAsync(`${BASE}worlds/shadowmere.glb`).then(gltf => {
    const proto = name => gltf.scene.getObjectByName(name);
    gltf.scene.updateMatrixWorld(true);
    const batches = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
    const put = (name, x, y, z, rotY, scale, sy = scale) => { if (!batches.has(name)) batches.set(name, []); batches.get(name).push(m4.compose(v.set(x, y, z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY), s3.set(scale, sy, scale)).clone()); };
    const r = rng(2026);
    // Giant trees ring the forest and stand among the paths; medium ones fill between.
    const TREES = [['SM_TreeA', 1.25, 20, .85, 1.25], ['SM_TreeB', .95, 26, .85, 1.2], ['SM_TreeC', .7, 30, .9, 1.3]];
    for (const [name, trunk, count, s0, s1] of TREES) {
      let n = 0;
      for (let tries = 0; n < count && tries < 3000; tries++) {
        const a = r() * Math.PI * 2, d = name === 'SM_TreeA' && n < 12 ? SM.r - 4 - r() * 6 : 6 + Math.sqrt(r()) * (SM.r - 8), x = SM.x + Math.cos(a) * d, z = SM.z + Math.sin(a) * d;
        const sc = s0 + r() * (s1 - s0), cr = trunk * 1.35 * sc;
        if (!clear(x, z, cr)) continue;
        placed.push({ x, z, r: cr }); const y = groundY(x, z); put(name, x, y, z, r() * Math.PI * 2, sc);
        addCollider({ x, z, r: cr, top: y + 30 }); n++;
      }
    }
    // Mossy boulders and glowing mushrooms between the roots.
    for (let i = 0, n = 0; i < 900 && n < 34; i++) {
      const a = r() * Math.PI * 2, d = 5 + Math.sqrt(r()) * (SM.r - 6), x = SM.x + Math.cos(a) * d, z = SM.z + Math.sin(a) * d, sc = .5 + r() * 1.3, cr = sc * 1.1;
      if (!clear(x, z, cr)) continue;
      placed.push({ x, z, r: cr }); const y = groundY(x, z); put('SM_Rock', x, y - .1, z, r() * 6.28, sc, sc * (.7 + r() * .5));
      if (sc > .75) addCollider({ x, z, r: cr * .95, top: y + sc * 1.05 }); n++;
    }
    for (let i = 0, n = 0; i < 900 && n < 46; i++) {
      const a = r() * Math.PI * 2, d = 4 + Math.sqrt(r()) * (SM.r - 5), x = SM.x + Math.cos(a) * d, z = SM.z + Math.sin(a) * d;
      const near = placed.find(p => Math.abs(Math.hypot(x - p.x, z - p.z) - p.r - .5) < .6);   // tucked against a root or rock
      if (!near || segDist(x, z, TRAIL) < 3) continue;
      put('SM_Mushrooms', x, groundY(x, z), z, r() * 6.28, .8 + r() * .9); n++;
    }
    // The root arch over the trail's mouth, with three lanterns hanging from it.
    const ay = groundY(ARCH.x, ARCH.z); put('SM_Arch', ARCH.x, ay, ARCH.z, 0, 1);
    for (const sx of [-1, 1]) addCollider({ x: ARCH.x + sx * 4.2, z: ARCH.z, r: 1.05, top: ay + 7 });
    for (const dx of [-2.2, -.4, 1.6]) lanternSpots.push([ARCH.x + dx, ay + 5.2, ARCH.z - .2]);
    // Lantern posts every few metres along the trail, alternating sides.
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 1, flatShading: true });
    const postGeo = new THREE.CylinderGeometry(.13, .24, 3.9, 6), armGeo = new THREE.BoxGeometry(1.3, .12, .12);
    const tc = new THREE.CatmullRomCurve3(TRAIL.map(([x, z]) => new THREE.Vector3(x, 0, z))), len = tc.getLength();
    for (let i = 1, k = 0; i * 7.5 < len - 4; i++, k++) {
      const t = i * 7.5 / len, p = tc.getPoint(t), d = tc.getTangent(t), side = k % 2 ? 1 : -1, nx = -d.z * side, nz = d.x * side;
      const x = p.x + nx * 3.4, z = p.z + nz * 3.4, y = groundY(x, z);
      const post = new THREE.Mesh(postGeo, postMat); post.position.set(x, y + 1.95, z); post.rotation.z = side * .05; post.castShadow = true; root.add(post);
      const arm = new THREE.Mesh(armGeo, postMat); arm.position.set(x - nx * .55, y + 3.8, z - nz * .55); arm.rotation.y = Math.atan2(nx, nz) + Math.PI / 2; root.add(arm);
      addCollider({ x, z, r: .32, top: y + 3.9 });
      lanternSpots.push([x - nx * 1.1, y + 3.8, z - nz * 1.1]);
    }
    for (const [x, y, z] of lanternSpots) {
      put('SM_Lantern', x, y, z, r() * 6.28, 1);
      const h = new THREE.Sprite(haloMat); h.position.set(x, y - 1.05, z); h.scale.setScalar(2.3); root.add(h); halos.push(h);
    }
    // The cliff behind the clearing (solid), the falls pour from its notch.
    const cy = groundY(CLIFF.x, CLIFF.z); put('SM_Cliff', CLIFF.x, cy - .6, CLIFF.z, 0, 1);
    for (let x = CLIFF.x - 13; x <= CLIFF.x + 13; x += 1.6) addCollider({ x, z: CLIFF.z + .6, r: 2.6, top: cy + 12 });

    // One InstancedMesh per prototype piece.
    for (const [name, mats] of batches) {
      const node = proto(name); if (!node) continue;
      for (const mesh of meshesOf(node)) {
        const local = mesh.matrixWorld.clone(), im = new THREE.InstancedMesh(mesh.geometry, mesh.material, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m4.multiplyMatrices(m, local)));
        im.castShadow = !/Lantern|Mushroom/.test(name); im.receiveShadow = true; im.frustumCulled = false; root.add(im);
      }
    }
    for (const c of creatures || []) if (c.type === 'monkey' || c.type === 'gorilla') dress(c, proto);
    state.ready = true; state.pieces = batches.size;
  }).catch(e => console.warn('Shadowmere models failed to load', e));

  const nearest = [];
  return {
    state, loaded, lanternSpots,
    /** Per frame: moon and halo follow the camera's sky, fireflies drift, water flows, lights hop to the nearest lanterns. */
    update(dt, t, player, camera, shade) {
      state.shade = shade;
      const on = shade > .02; moon.visible = moonHalo.visible = on; root.visible = on || Math.hypot(player.x - SM.x, player.z - SM.z) < SM.r + 60;
      if (on) {
        moon.position.copy(camera.position).addScaledVector(MOON_DIR, 400); moon.lookAt(camera.position); moon.material.opacity = shade;
        moonHalo.position.copy(moon.position); moonHalo.material.opacity = shade * .8;
        for (let i = 0; i < FLY; i++) {
          const k = i * 3, ph = i * 1.37;
          flyPos[k] = flyBase[k] + Math.sin(t * .4 + ph) * 1.2; flyPos[k + 1] = flyBase[k + 1] + Math.sin(t * .9 + ph * 2) * .4; flyPos[k + 2] = flyBase[k + 2] + Math.cos(t * .35 + ph) * 1.2;
        }
        flyGeo.attributes.position.needsUpdate = true; flies.material.opacity = shade * (.6 + Math.sin(t * 3) * .1);
        streaks.offset.y -= dt * 1.4; ripple.offset.x += dt * .02; streamMat.emissiveMap.offset.y -= dt * .25;
        spray.forEach((s, i) => { s.scale.setScalar(2 + Math.sin(t * 3 + i * 1.7) * .4); });
        halos.forEach((h, i) => { h.material.opacity = .85 + Math.sin(t * 2.3 + i) * .08; });
      }
      // Lights: the four lanterns nearest you (re-picked a few times a second).
      if ((state.pick = (state.pick || 0) - dt) <= 0) {
        state.pick = .3; nearest.length = 0;
        for (const p of lanternSpots) nearest.push([Math.hypot(p[0] - player.x, p[2] - player.z), p]);
        nearest.sort((a, b) => a[0] - b[0]);
      }
      lights.forEach((l, i) => {
        const p = nearest[i]?.[1]; if (!p || !on) { l.intensity = 0; return; }
        l.position.set(p[0], p[1] - 1.1, p[2]); l.intensity = shade * (9 + Math.sin(t * 7 + i * 2) * .6);
      });
    }
  };
}

/**
 * Put the Blender body on a green monkey or the gorilla. Each part goes on a pivot at its joint;
 * creatures.js animates those pivots (arms swing and wind up, legs walk, the tail sways, the
 * sword cocks back and cuts), so the models move with the same timing as the attack tells.
 */
export function dress(c, proto) {
  const pre = c.type === 'gorilla' ? 'Gorilla_' : 'Monkey_', get = n => proto(pre + n);
  if (!get('Torso')) return;
  const mats = new Map(), mat = m => { if (!mats.has(m)) mats.set(m, m.clone()); return mats.get(m); };
  const pivot = (node, at = node.position) => {
    const g = new THREE.Group(); g.position.copy(at);
    for (const mesh of meshesOf(node)) {
      const m = new THREE.Mesh(mesh.geometry, mat(mesh.material)); m.castShadow = m.receiveShadow = true;
      if (mesh !== node) { m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale); }
      g.add(m);
    }
    return g;
  };
  c.body.clear(); c.arms = []; c.legs = []; c.sword = null; c.tail = null;
  c.body.add(pivot(get('Torso')));
  const head = get('Head'); c.neck = pivot(head); c.head = c.neck; c.body.add(c.neck);
  c.neckBase = { y: head.position.y, z: head.position.z, k: c.type === 'gorilla' ? .35 : .3 };
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    const arm = pivot(get('Arm' + tag)); c.body.add(arm); c.arms.push({ mesh: arm, side });
    const leg = pivot(get('Leg' + tag)); c.body.add(leg); c.legs.push({ mesh: leg, phase: side > 0 ? 0 : Math.PI });
    if (tag === 'R' && get('Sword')) { const sw = get('Sword'); c.sword = pivot(sw, sw.position.clone().sub(get('ArmR').position)); arm.add(c.sword); }
  }
  if (get('Tail')) { c.tail = pivot(get('Tail')); c.body.add(c.tail); }
  for (const m of mats.values()) {
    if (/Fur$/.test(m.name)) c.shellMat = m;
    else if (/Skin$/.test(m.name)) c.skinMat = m;
    else if (/AmberEye/.test(m.name)) c.eyeMat = m;
  }
  c.bar.position.y = c.type === 'gorilla' ? 3.35 : 2.15;
  c.dressed = true; c.body.updateMatrixWorld(true);
}
