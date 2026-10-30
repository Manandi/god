import * as THREE from 'three';
import { FROSTBOUND as FB, FROST_ROAD, HEARTHFAST as HF, FROST_LAKE, FROST_COURT, RIME_THRONE, MAW_SEAL, FROST_ROOTWAY_BACK, frostRoadDist } from './world.js';
import { NPCS } from './story.js';
import { rootwayMesh } from './shadowmere.js';

// Book III, the Frostbound Crown (owner, 2026-10-30: "third world building the snow world"). Everything here is
// procedural and instanced, like Shadowmere's props: deep snow (world.js), snow-laden pines, drifts, snowy rocks,
// ice spires, the still lake (a frozen courtier lies under its ice), crystal peaks in the haze, falling snow, lit
// braziers along the white road, Hearthfast (the warm camp: safe ground), the ruined, frost-locked court of Ashmere
// (a broken ice palace, frozen courtiers kneeling to an empty throne, crown-glass in its stones), and the White
// Maw's den behind a seal of ice and crown-glass with three frozen braziers round it.
//
// Local layout: see FROSTBOUND in world.js. main.js says what the story allows (seal.setSealed, seal.setLit,
// setRemembered) and calls update() every frame.

const at = (dx, dz) => ({ x: FB.x + dx, z: FB.z + dz });
const ROAD = FROST_ROAD.map(([x, z]) => [FB.x + x, FB.z + z]);
const ARCH = at(0, 43.5);
/** Where you rest and wake in Hearthfast: beside the great hearth. */
export const HEARTHFAST_SPOTS = { hearth: { x: HF.x, z: HF.z }, wake: { x: HF.x - .2, z: HF.z - 2.7 } };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner); grad.addColorStop(.35, outer); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function canvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t;
}
/** Collects many copies of a few shapes into one InstancedMesh each (one draw call per shape). */
function batcher(root) {
  const groups = new Map(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), s = new THREE.Vector3();
  const mtx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => m.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), s.set(sx, sy, sz)).clone();
  return {
    mtx,
    put(key, geo, mat, matrix, color = null) { if (!groups.has(key)) groups.set(key, { geo, mat, list: [] }); groups.get(key).list.push([matrix, color]); },
    done(shadowless = /x^/) {
      for (const [key, { geo, mat, list }] of groups) {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(([mm, col], i) => { im.setMatrixAt(i, mm); if (col !== null) im.setColorAt(i, new THREE.Color(col)); });
        im.castShadow = !shadowless.test(key); im.receiveShadow = true; im.computeBoundingSphere(); root.add(im);
      }
    }
  };
}
function segDist(px, pz, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(px - ax - dx * t, pz - az - dz * t));
  }
  return best;
}

export function createFrostbound(scene, { groundY, addCollider, creatures }) {
  const root = new THREE.Group(); root.name = 'Frostbound'; scene.add(root);
  const B = batcher(root), r = rng(1115);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true, ...o });
  const snow = mat(0xf1f5f9, { roughness: .8 }), pine = mat(0x2c4a40), pineDark = mat(0x22392f), bark = mat(0x4a3b30), rock = mat(0x6f7a86),
    iceSolid = mat(0xb9dcf2, { emissive: 0x2a5f86, emissiveIntensity: .35, roughness: .18, metalness: .1 }),
    iceClear = new THREE.MeshStandardMaterial({ color: 0xcdeaff, emissive: 0x2a5f86, emissiveIntensity: .25, roughness: .1, metalness: .1, transparent: true, opacity: .5, depthWrite: false }),
    palace = mat(0xc9d9e6, { emissive: 0x24445e, emissiveIntensity: .18, roughness: .35 }), palaceDark = mat(0x8fa6ba, { roughness: .5 }),
    glass = mat(0x3b2266, { emissive: 0x7a3cff, emissiveIntensity: 1.5, roughness: .2, metalness: .3 }),
    iron = mat(0x2b2d31, { metalness: .45, roughness: .55 }), wood = mat(0x5a4230), darkWood = mat(0x3a2a1e), hide = mat(0x8a6a4a), hide2 = mat(0x6a4a36), stone = mat(0x6a6e74);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,214,140,1)', 'rgba(255,140,40,.35)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const coldHalo = new THREE.SpriteMaterial({ map: glowTexture('rgba(220,200,255,1)', 'rgba(140,110,255,.3)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const flames = [];        // { group, base, phase }: every lit fire flickers
  const fireSpots = [];     // [x, y, z]: the warm lights hop to the nearest of these
  /** A flame: two additive cones and a halo. */
  function flame(parent, x, y, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(.22 * s, .75 * s, 7), flameMat); outer.position.y = .32 * s; g.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.12 * s, .45 * s, 6), flameCore); inner.position.y = .22 * s; g.add(inner);
    const h = new THREE.Sprite(haloMat); h.scale.setScalar(2.2 * s); h.position.y = .3 * s; g.add(h);
    flames.push({ group: g, base: s, phase: flames.length * 1.7 }); return g;
  }
  /** An iron brazier on three legs; lit, unlit (cold), or frozen inside a block of ice. */
  // (Instanced: every brazier's legs, bowl and coals are three draw calls in all.)
  const legGeo = new THREE.CylinderGeometry(.05, .06, 1.0, 5), bowlGeo = new THREE.CylinderGeometry(.5, .3, .32, 9), coalGeo = new THREE.SphereGeometry(.36, 8, 4);
  const coalsLit = mat(0xff8a3a, { emissive: 0xff5a14, emissiveIntensity: 1.6 }), coalsCold = mat(0x3b3f45);
  function brazier(x, z, { lit = true } = {}) {
    const y = groundY(x, z);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; B.put('brazierLeg', legGeo, iron, B.mtx(x + Math.cos(a) * .32, y + .48, z + Math.sin(a) * .32, Math.sin(a) * .22, 0, -Math.cos(a) * .22)); }
    B.put('brazierBowl', bowlGeo, iron, B.mtx(x, y + 1.0, z));
    B.put(lit ? 'coalsLit' : 'coalsCold', coalGeo, lit ? coalsLit : coalsCold, B.mtx(x, y + 1.12, z, 0, 0, 0, 1, .4, 1));
    const fire = lit ? flame(root, x, y + 1.15, z, 1) : null;
    addCollider({ x, z, r: .55, top: y + 1.2 });
    if (lit) fireSpots.push([x, y + 1.7, z]);
    return { fire, x, z, y };
  }

  // ------------------------------------------------------------------ placement
  const placed = [];
  const npcSpots = Object.values(NPCS).filter(n => Math.hypot(n.x - FB.x, n.z - FB.z) < FB.r + 5);
  const clear = (x, z, rr) => {
    if (Math.hypot(x - FB.x, z - FB.z) > FB.r - 1.5) return false;
    if (frostRoadDist(x, z) < 4.4 + rr) return false;
    if (Math.hypot(x - HF.x, z - HF.z) < HF.r + 3 + rr || Math.hypot(x - FROST_LAKE.x, z - FROST_LAKE.z) < FROST_LAKE.r + 1.5 + rr) return false;
    if (Math.hypot(x - FROST_COURT.x, z - FROST_COURT.z) < FROST_COURT.r + 2.5 + rr || Math.hypot(x - MAW_SEAL.x, z - MAW_SEAL.z) < 14 + rr) return false;
    if (Math.hypot(x - FB.entry.x, z - FB.entry.z) < 7 + rr || Math.hypot(x - FROST_ROOTWAY_BACK.x, z - FROST_ROOTWAY_BACK.z) < 3.5 + rr) return false;
    if (z < FB.z - 38 && x > FB.x - 6) return false;                                  // the glacier behind the den
    if ((creatures || []).some(c => Math.hypot(x - c.home.x, z - c.home.z) < 2.5 + rr) || npcSpots.some(n => Math.hypot(x - n.x, z - n.z) < 3 + rr)) return false;
    return placed.every(p => Math.hypot(x - p.x, z - p.z) > p.r + rr + 1.3);
  };
  const scatter = (count, tries, fn, near = null) => { for (let i = 0, n = 0; i < tries && n < count; i++) { const a = r() * Math.PI * 2, d = near ? near.r0 + r() * near.r1 : 4 + Math.sqrt(r()) * (FB.r - 5); const x = (near?.x ?? FB.x) + Math.cos(a) * d, z = (near?.z ?? FB.z) + Math.sin(a) * d; if (fn(x, z)) n++; } };

  // Snow-laden pines: a trunk, three tiers of needles and a cap of snow on each.
  const trunkGeo = new THREE.CylinderGeometry(.16, .26, 1, 6); trunkGeo.translate(0, .5, 0);
  const tierGeo = new THREE.ConeGeometry(1, 1, 8); tierGeo.translate(0, .5, 0);
  const capGeo = new THREE.ConeGeometry(1, 1, 8); capGeo.translate(0, .5, 0);
  const putPine = (x, z, sc) => {
    const y = groundY(x, z), ry = r() * 6.28;
    B.put('trunk', trunkGeo, bark, B.mtx(x, y - .2, z, 0, ry, 0, sc, sc * 2.2, sc));
    for (let k = 0; k < 3; k++) {
      const w = (1.7 - k * .45) * sc, h = (2.0 - k * .3) * sc, base = y + (1.3 + k * 1.35) * sc;
      B.put(k % 2 ? 'pineB' : 'pineA', tierGeo, k % 2 ? pineDark : pine, B.mtx(x, base, z, 0, ry + k, 0, w, h, w));
      B.put('cap', capGeo, snow, B.mtx(x, base + h * .42, z, 0, ry + k + .3, 0, w * .66, h * .6, w * .66));
    }
    addCollider({ x, z, r: .42 * sc + .1, top: y + 8 * sc });
  };
  for (let n = 0, i = 0; n < 18 && i < 900; i++) {                                   // a ring of big pines at the edge
    const a = r() * Math.PI * 2, d = FB.r - 3 - r() * 5, x = FB.x + Math.cos(a) * d, z = FB.z + Math.sin(a) * d, sc = 1.35 + r() * .5;
    if (!clear(x, z, .8)) continue; placed.push({ x, z, r: .8 }); putPine(x, z, sc); n++;
  }
  scatter(70, 2400, (x, z) => { const sc = .75 + r() * .8; if (!clear(x, z, .7)) return false; placed.push({ x, z, r: .7 }); putPine(x, z, sc); return true; });
  // Snowy boulders, drifts and ice spires.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0), driftGeo = new THREE.IcosahedronGeometry(1, 1), spireGeo = new THREE.ConeGeometry(.3, 1, 5); spireGeo.translate(0, .5, 0);
  scatter(26, 1500, (x, z) => {
    const sc = .5 + r() * 1.3, cr = sc * 1.05; if (!clear(x, z, cr)) return false; placed.push({ x, z, r: cr });
    const y = groundY(x, z), ry = r() * 6.28; B.put('rock', rockGeo, rock, B.mtx(x, y + sc * .2, z, r() * .4, ry, r() * .3, sc * 1.2, sc * .75, sc));
    B.put('rockCap', driftGeo, snow, B.mtx(x, y + sc * .72, z, 0, ry, 0, sc * .95, sc * .28, sc * .8));
    if (sc > .75) addCollider({ x, z, r: cr * .9, top: y + sc * 1.0 }); return true;
  });
  scatter(44, 1500, (x, z) => {
    if (frostRoadDist(x, z) < 3.5 || Math.hypot(x - HF.x, z - HF.z) < HF.r + 2 || Math.hypot(x - FROST_COURT.x, z - FROST_COURT.z) < FROST_COURT.r + 1 || Math.hypot(x - MAW_SEAL.x, z - MAW_SEAL.z) < 13 || Math.hypot(x - FROST_LAKE.x, z - FROST_LAKE.z) < FROST_LAKE.r + 1) return false;
    const y = groundY(x, z), sc = 1 + r() * 2.2; B.put('drift', driftGeo, snow, B.mtx(x, y - .15, z, 0, r() * 6.28, 0, sc * 1.6, sc * .32, sc)); return true;
  });
  const spireCluster = (cx, cz, n, big = false) => {
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = r() * (big ? 2.2 : 1.4), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, h = (big ? 3.5 : 1.2) + r() * (big ? 4 : 2.2);
      B.put('spire', spireGeo, iceSolid, B.mtx(x, groundY(x, z) - .2, z, (r() - .5) * .5, r() * 6, (r() - .5) * .5, (big ? 1.6 : .8) + r() * .5, h, (big ? 1.6 : .8) + r() * .5));
    }
    if (big) addCollider({ x: cx, z: cz, r: 2.2, top: groundY(cx, cz) + 4 });
  };
  scatter(9, 900, (x, z) => { if (!clear(x, z, 1.6)) return false; placed.push({ x, z, r: 1.6 }); spireCluster(x, z, 5 + Math.floor(r() * 4)); return true; });
  for (const [dx, dz] of [[-35, 22], [-34, 4], [-9, 34], [35, -6], [29, -32], [-6, -40], [24, -42]]) { const p = at(dx, dz); if (Math.hypot(p.x - FB.x, p.z - FB.z) < FB.r - 2) spireCluster(p.x, p.z, 4, true); }

  // Crystal peaks far off in the haze, and a few low mist sheets.
  const peakGeo = new THREE.ConeGeometry(1, 1, 7); peakGeo.translate(0, .5, 0);
  const peakMat = new THREE.MeshBasicMaterial({ color: 0xa9bfd4, fog: false }), peakCap = new THREE.MeshBasicMaterial({ color: 0xe9f1f8, fog: false });
  const peaks = new THREE.Group(); root.add(peaks);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + r() * .3, d = 250 + r() * 70, h = 70 + r() * 90, w = 45 + r() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const base = new THREE.Mesh(peakGeo, peakMat); base.position.set(x, -30, z); base.scale.set(w, h, w); base.rotation.y = r() * 6; peaks.add(base);
    const cap = new THREE.Mesh(peakGeo, peakCap); cap.position.set(x, -30 + h * .62, z); cap.scale.set(w * .4, h * .38, w * .4); cap.rotation.y = base.rotation.y; peaks.add(cap);
  }
  peaks.renderOrder = -1;
  const mistMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(235,242,250,.55)', 'rgba(210,225,240,.2)'), depthWrite: false, transparent: true, opacity: .3 });
  for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 10 + r() * (FB.r - 14), x = FB.x + Math.cos(a) * d, z = FB.z + Math.sin(a) * d, s = new THREE.Sprite(mistMat); s.position.set(x, groundY(x, z) + 1, z); s.scale.set(16 + r() * 10, 4, 1); root.add(s); }

  // ------------------------------------------------------------- the entry
  // Two leaning ice pillars, the court's outer gate, with its crown-glass lintel fallen in the snow.
  for (const sx of [-1, 1]) {
    const x = ARCH.x + sx * 4.4, z = ARCH.z, y = groundY(x, z);
    add(new THREE.BoxGeometry(1.3, 6.2, 1.1), palace, x, y + 2.9, z, 0, sx * .15, sx * .06);
    add(new THREE.ConeGeometry(.6, 1.3, 5), glass, x + sx * .25, y + 6.4, z, 0, 0, sx * .2);
    add(new THREE.BoxGeometry(1.6, .5, 1.4), snow, x, y + 6.05, z, 0, 0, sx * .06);
    addCollider({ x, z, r: .9, top: y + 6 });
  }
  { const x = ARCH.x + 2.2, z = ARCH.z - 2.6, y = groundY(x, z); add(new THREE.BoxGeometry(5.5, .7, .8), palace, x, y + .25, z, .1, .5, .12); for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(.22, .9, 4), glass, x - 1.6 + i * 1.6, y + .7, z + (i - 1) * .7, .4, .5, 0); }
  const back = rootwayMesh(root, FROST_ROOTWAY_BACK.x, groundY(FROST_ROOTWAY_BACK.x, FROST_ROOTWAY_BACK.z), FROST_ROOTWAY_BACK.z, Math.PI * .5, { veil: 0xbfe8ff, swirl: 0xe6f4ff, light: 0xbfe0ff });

  // Lit braziers along the white road, every nine metres, alternating sides.
  { const tc = new THREE.CatmullRomCurve3(ROAD.map(([x, z]) => new THREE.Vector3(x, 0, z))), len = tc.getLength();
    for (let i = 1, k = 0; i * 9 < len - 3; i++, k++) {
      const t = i * 9 / len, p = tc.getPoint(t), d = tc.getTangent(t), side = k % 2 ? 1 : -1, x = p.x - d.z * side * 3.3, z = p.z + d.x * side * 3.3;
      if (Math.hypot(x - MAW_SEAL.x, z - MAW_SEAL.z) < 12) continue;
      brazier(x, z);
    } }

  // ------------------------------------------------------------- the still lake
  const crackTex = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#9fcfe6'; g.fillRect(0, 0, 256, 256); const q = rng(7);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${q() * .12})`; g.fillRect(q() * 256, q() * 256, 2 + q() * 6, 1 + q() * 3); }
    g.strokeStyle = 'rgba(240,250,255,.75)'; g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { let x = q() * 256, y = q() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (q() - .5) * 60; y += (q() - .5) * 60; g.lineTo(x, y); } g.stroke(); }
  }, [3, 3]);
  const lakeMat = new THREE.MeshStandardMaterial({ map: crackTex, color: 0xd8f0ff, roughness: .07, metalness: .35, emissive: 0x16384e, emissiveIntensity: .4, transparent: true, opacity: .88 });
  const ly = groundY(FROST_LAKE.x, FROST_LAKE.z);
  const lake = add(new THREE.CircleGeometry(FROST_LAKE.r + .6, 56), lakeMat, FROST_LAKE.x, ly + .05, FROST_LAKE.z, -Math.PI / 2); lake.castShadow = false;
  // A courtier frozen under the ice, face down, reaching for the shore (where Veyra's people found Aud).
  { const g = new THREE.Group(); g.position.set(FROST_LAKE.x + 2.5, ly - .45, FROST_LAKE.z - 1.5); g.rotation.y = .7; root.add(g);
    const dim = mat(0x2a2638); add(new THREE.BoxGeometry(.6, .3, .8), dim, 0, 0, 0, 0, 0, 0, g); add(new THREE.BoxGeometry(.4, .3, .4), dim, 0, 0, .65, 0, 0, 0, g);
    add(new THREE.BoxGeometry(.22, .2, .8), dim, .35, 0, .9, 0, -.3, 0, g); add(new THREE.BoxGeometry(.5, .25, .9), dim, 0, 0, -.8, 0, 0, 0, g); }
  for (let i = 0; i < 9; i++) {            // broken ice sheets heaved up at the shore
    const a = i / 9 * Math.PI * 2 + r() * .3, d = FROST_LAKE.r + .2 + r() * .8, x = FROST_LAKE.x + Math.cos(a) * d, z = FROST_LAKE.z + Math.sin(a) * d;
    B.put('sheet', new THREE.BoxGeometry(1, 1, 1), iceSolid, B.mtx(x, groundY(x, z) + .1, z, (r() - .5) * .6, -a, .3 + r() * .4, 1.6 + r() * 1.4, .18, 1 + r()));
  }
  spireCluster(FROST_LAKE.x - 8, FROST_LAKE.z - 9, 5); spireCluster(FROST_LAKE.x + 9, FROST_LAKE.z + 8, 4);

  // ---------------------------------------------------------------- Hearthfast
  const hy = groundY(HF.x, HF.z), hat = (a, d) => ({ x: HF.x + Math.cos(a) * d, z: HF.z + Math.sin(a) * d });
  const GATE_HALF = .34, logs = 58;
  const logGeo = new THREE.CylinderGeometry(.24, .28, 1, 6); logGeo.translate(0, .5, 0);
  const tipGeo = new THREE.ConeGeometry(.26, .45, 6);
  for (let i = 0; i < logs; i++) {
    const a = i / logs * Math.PI * 2, gap = Math.abs(Math.atan2(Math.sin(a - HF.gate), Math.cos(a - HF.gate))); if (gap < GATE_HALF) continue;
    const p = hat(a, HF.r), y = groundY(p.x, p.z), h = 2.4 + ((i * 29) % 5) * .14;
    B.put(i % 3 ? 'log' : 'logDark', logGeo, i % 3 ? wood : darkWood, B.mtx(p.x, y - .1, p.z, Math.sin(a) * .06, 0, -Math.cos(a) * .06, 1, h, 1));
    B.put('logTip', tipGeo, snow, B.mtx(p.x, y + h + .1, p.z, 0, 0, 0, 1, 1, 1));
    if (i % 2 === 0) addCollider({ x: p.x, z: p.z, r: .72, top: y + 2.8 });
  }
  for (const side of [-1, 1]) {                         // gate posts with braziers on top, and the camp's sign
    const a = HF.gate + side * (GATE_HALF + .02), p = hat(a, HF.r), y = groundY(p.x, p.z);
    add(new THREE.CylinderGeometry(.34, .4, 3.6, 7), darkWood, p.x, y + 1.8, p.z); addCollider({ x: p.x, z: p.z, r: .5, top: y + 3.8 });
    const bowl = add(new THREE.CylinderGeometry(.42, .26, .3, 8), iron, p.x, y + 3.75, p.z); void bowl; flame(root, p.x, y + 3.85, p.z, 1.1); fireSpots.push([p.x, y + 4.4, p.z]);
  }
  { const gp = hat(HF.gate, HF.r + .3), gy = groundY(gp.x, gp.z);
    add(new THREE.BoxGeometry(.4, .35, 6.2), darkWood, gp.x, gy + 3.2, gp.z, 0, -HF.gate, 0);
    const sign = canvasTexture(512, 96, (g) => { g.fillStyle = '#2a1d12'; g.fillRect(0, 0, 512, 96); g.strokeStyle = '#a5643a'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84); g.fillStyle = '#ffd59a'; g.font = '600 52px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HEARTHFAST', 256, 50); });
    add(new THREE.PlaneGeometry(3.8, .72), new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide }), gp.x - .25, gy + 2.6, gp.z, 0, Math.PI / 2 - HF.gate, 0); }
  // The great hearth: a ring of stones, a stack of logs and a tall fire, the warmest light in the realm.
  { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; B.put('hearthStone', rockGeo, stone, B.mtx(HF.x + Math.cos(a) * 1.15, hy + .15, HF.z + Math.sin(a) * 1.15, r(), r() * 6, r(), .42, .32, .38)); }
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(.12, .14, 1.6, 6), darkWood, HF.x, hy + .25 + i * .06, HF.z, Math.PI / 2, i * .8, 0);
    flame(root, HF.x, hy + .3, HF.z, 2.2); flame(root, HF.x + .3, hy + .2, HF.z - .2, 1.3); flame(root, HF.x - .3, hy + .2, HF.z + .25, 1.2);
    addCollider({ x: HF.x, z: HF.z, r: 1.25, top: hy + .9 }); }
  const hearthLight = new THREE.PointLight(0xff9a48, 36, 26, 1.3); hearthLight.position.set(HF.x, hy + 2.2, HF.z); root.add(hearthLight);
  const embersN = 60, emberBase = new Float32Array(embersN * 3), emberPos = new Float32Array(embersN * 3);
  for (let i = 0; i < embersN; i++) emberBase.set([HF.x + (r() - .5) * 1.2, hy + r() * 4, HF.z + (r() - .5) * 1.2], i * 3);
  const emberGeo = new THREE.BufferGeometry(); emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xffa24a, size: .08, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })); embers.frustumCulled = false; root.add(embers);
  // Hide tents round the hearth, a woodpile, drying racks of hides, and a sledge by the gate.
  for (const [a, d, h] of [[-1.6, 5.6, 3.0], [.95, 5.7, 2.7], [2.3, 5.6, 2.8]]) {
    const p = hat(a, d), y = groundY(p.x, p.z), g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = -a; root.add(g);
    add(new THREE.ConeGeometry(1.65, h, 9, 1, true), hide, 0, h / 2, 0, 0, 0, 0, g).material.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(1.4, 1.52, .3, 9, 1, true), hide2, 0, h * .32, 0, 0, 0, 0, g);
    for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(.04, .05, .9, 4), darkWood, Math.cos(k * 1.57) * .12, h + .2, Math.sin(k * 1.57) * .12, Math.cos(k * 1.57) * .35, 0, -Math.sin(k * 1.57) * .35, g);
    add(new THREE.PlaneGeometry(.8, 1.3), mat(0x2a1a12, { side: THREE.DoubleSide }), -1.25, .62, 0, 0, Math.PI / 2, -.5, g);   // the door flap, toward the hearth
    add(new THREE.ConeGeometry(1.0, .55, 9), snow, 0, h * .82, 0, 0, 0, 0, g);
    addCollider({ x: p.x, z: p.z, r: 1.6, top: y + h });
  }
  { const p = hat(-.55, 6.1), y = groundY(p.x, p.z); for (let k = 0; k < 9; k++) add(new THREE.CylinderGeometry(.16, .16, 1.8, 6), k % 2 ? wood : darkWood, p.x + (k % 3 - 1) * .34, y + .2 + Math.floor(k / 3) * .3, p.z + (k % 3 - 1) * .1, 0, -.55, Math.PI / 2);
    add(new THREE.BoxGeometry(2.1, .22, 1.0), snow, p.x, y + 1.15, p.z, 0, .55, 0); addCollider({ x: p.x, z: p.z, r: 1.1, top: y + 1.2 }); }
  { const p = hat(1.7, 3.6), y = groundY(p.x, p.z); for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.05, .05, 1.8, 4), darkWood, p.x + s * .8, y + .9, p.z, 0, 0, 0);
    add(new THREE.CylinderGeometry(.04, .04, 1.7, 4), darkWood, p.x, y + 1.75, p.z, 0, 0, Math.PI / 2); add(new THREE.PlaneGeometry(.7, .9), mat(0xb08a60, { side: THREE.DoubleSide }), p.x - .35, y + 1.25, p.z, 0, 0, 0); add(new THREE.PlaneGeometry(.6, .8), mat(0x8a6040, { side: THREE.DoubleSide }), p.x + .4, y + 1.3, p.z, 0, 0, .05);
    addCollider({ x: p.x, z: p.z, r: .5, top: y + 1.8 }); }
  { const p = hat(HF.gate + .5, HF.r + 2.5), y = groundY(p.x, p.z), g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = .4; root.add(g);
    add(new THREE.BoxGeometry(1.1, .25, 2.4), wood, 0, .45, 0, 0, 0, 0, g); for (const s of [-1, 1]) add(new THREE.BoxGeometry(.08, .08, 2.8), iron, s * .5, .14, .1, 0, 0, 0, g);
    add(new THREE.BoxGeometry(.9, .45, 1), hide2, 0, .78, -.4, 0, 0, 0, g); add(new THREE.BoxGeometry(1.0, .12, 1.0), snow, 0, 1.03, -.4, 0, 0, 0, g);
    addCollider({ x: p.x, z: p.z, r: 1.1, top: y + 1 }); }

  // ------------------------------------------------------------- the court of Ashmere
  const C = FROST_COURT, cy = groundY(C.x, C.z), cat = (a, d) => ({ x: C.x + Math.cos(a) * d, z: C.z + Math.sin(a) * d });
  const tiles = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#9aaebf'; g.fillRect(0, 0, 256, 256); const q = rng(19);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 150 + Math.floor(q() * 40); g.fillStyle = `rgb(${v - 10},${v + 4},${v + 18})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${q() * .35})`; g.fillRect(q() * 256, q() * 256, 2 + q() * 8, 1 + q() * 4); }
  }, [4, 4]);
  const floor = add(new THREE.CircleGeometry(C.r - .3, 48), new THREE.MeshStandardMaterial({ map: tiles, roughness: .45, metalness: .05 }), C.x, cy + .03, C.z, -Math.PI / 2); floor.castShadow = false;
  const ENTRY = Math.atan2(-14 - (C.z - FB.z), -14 - (C.x - FB.x));             // where the court road comes in (south-east)
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 30; i++) {
    const a = (i + .5) / 30 * Math.PI * 2, gap = Math.abs(Math.atan2(Math.sin(a - ENTRY), Math.cos(a - ENTRY))); if (gap < .36) continue;
    const p = cat(a, C.r), y = groundY(p.x, p.z), broken = (i * 7) % 5 === 0, h = broken ? 1.2 + r() * .8 : 3.2 + r() * 2.4;
    B.put('wall', wallGeo, i % 4 ? palace : palaceDark, B.mtx(p.x, y + h / 2 - .2, p.z, 0, -a + Math.PI / 2, broken ? (r() - .5) * .2 : 0, 2.75, h, .85));
    B.put('wallSnow', wallGeo, snow, B.mtx(p.x, y + h - .1, p.z, 0, -a + Math.PI / 2, 0, 2.8, .22, .95));
    if (!broken && i % 3 === 0) B.put('wallGlass', spireGeo, glass, B.mtx(p.x, y + h, p.z, 0, r() * 6, 0, .5, .9 + r() * .7, .5));
    for (const off of [-.8, .8]) { const q = cat(a + off / C.r, C.r); addCollider({ x: q.x, z: q.z, r: .75, top: y + Math.max(h, 2) }); }
    if (broken) for (let k = 0; k < 3; k++) { const q = cat(a + (r() - .5) * .1, C.r + .8 + r() * 1.5); B.put('rubble', rockGeo, palace, B.mtx(q.x, groundY(q.x, q.z) + .15, q.z, r(), r() * 6, r(), .5 + r() * .4, .3, .45)); }
  }
  // Columns either side of the aisle (some broken, their drums lying in the snow), toward the throne in the north.
  const colGeo = new THREE.CylinderGeometry(.42, .5, 1, 10); colGeo.translate(0, .5, 0);
  for (const [cx, cz, broken] of [[-4.4, -6.5, false], [4.4, -6.5, false], [-4.4, -1.5, true], [4.4, -1.5, false], [-4.4, 3.5, false], [4.4, 3.5, true]]) {
    const x = C.x + cx, z = C.z + cz, y = groundY(x, z), h = broken ? 1.6 + r() * 1.2 : 6.2;
    B.put('column', colGeo, palace, B.mtx(x, y, z, 0, 0, 0, 1, h, 1));
    B.put('colSnow', capGeo, snow, B.mtx(x, y + h - .05, z, 0, 0, 0, .55, .25, .55));
    if (!broken) { B.put('capital', wallGeo, palaceDark, B.mtx(x, y + h, z, 0, .2, 0, 1.3, .35, 1.3)); B.put('wallGlass', spireGeo, glass, B.mtx(x, y + h + .15, z, 0, 0, 0, .35, .7, .35)); }
    else for (let k = 0; k < 2; k++) B.put('column', colGeo, palace, B.mtx(x + (cx > 0 ? -1.2 : 1.2) * (k + 1), y + .45, z + (r() - .5) * 1.5, 0, r() * 3, Math.PI / 2, 1, 1.4, 1));
    addCollider({ x, z, r: .6, top: y + h });
  }
  // The dais and the empty throne: tall ice back, a crown of black-violet crown-glass on top, and on the seat a
  // frozen circlet where the crown should be (the memory).
  const T = RIME_THRONE, ty = groundY(T.x, T.z);
  for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(5.2 - k * 1.2, .16, 3.6 - k * .8), k % 2 ? palace : palaceDark, T.x, ty + .08 + k * .16, T.z + .4 - k * .3);
  const throne = new THREE.Group(); throne.position.set(T.x, ty + .48, T.z - .4); root.add(throne);
  add(new THREE.BoxGeometry(1.6, .5, 1.2), palaceDark, 0, .25, 0, 0, 0, 0, throne);
  add(new THREE.BoxGeometry(1.7, 3.4, .35), palace, 0, 1.7, -.55, 0, 0, 0, throne);
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(.25, .7, 1.2), palace, s * .85, .65, 0, 0, 0, 0, throne); add(new THREE.ConeGeometry(.12, .5, 4), glass, s * .85, 1.2, .4, 0, 0, 0, throne); }
  for (let i = 0; i < 7; i++) { const a = (i - 3) * .32, sp = add(new THREE.ConeGeometry(.13 + (i === 3 ? .06 : 0), .9 + (i === 3 ? .6 : 0) - Math.abs(i - 3) * .08, 5), glass, Math.sin(a) * .8, 3.55 + Math.cos(a) * .2, -.55, 0, 0, -a * .7, throne); void sp; }
  add(new THREE.BoxGeometry(1.75, .2, .45), snow, 0, 3.45, -.55, 0, 0, 0, throne);
  const circletMat = new THREE.MeshStandardMaterial({ color: 0xe8e0ff, emissive: 0x9a7cff, emissiveIntensity: 2.2, roughness: .15, metalness: .4 });
  const circlet = add(new THREE.TorusGeometry(.26, .05, 6, 20), circletMat, 0, .72, .05, Math.PI / 2 - .3, 0, 0, throne);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(.035, .16, 4), circletMat, Math.cos(a) * .26, .8, .05 + Math.sin(a) * .26 * .3, 0, 0, 0, throne); }
  const throneHalo = new THREE.Sprite(coldHalo); throneHalo.scale.setScalar(2.4); throneHalo.position.set(0, .8, .05); throne.add(throneHalo);
  const throneLight = new THREE.PointLight(0xa68cff, 5, 12, 1.6); throneLight.position.set(0, 1.4, .8); throne.add(throneLight);
  addCollider({ x: T.x, z: T.z - .4, r: 1.0, top: ty + 4 });
  for (const s of [-1, 1]) brazier(T.x + s * 3.2, T.z + .6, { lit: false });          // the court let its fires die
  // Frozen courtiers: twelve kneeling in two rows down the aisle, heads bowed to the empty throne, each sealed in ice.
  const COLORS = [0x4b3a66, 0x5a5f6e, 0x7a6640, 0x2f3d5e, 0x6a3a4a, 0x46546a];
  const fig = { torso: new THREE.BoxGeometry(.56, .66, .32), head: new THREE.BoxGeometry(.36, .36, .36), thigh: new THREE.BoxGeometry(.22, .2, .5), shin: new THREE.BoxGeometry(.22, .5, .2),
    arm: new THREE.BoxGeometry(.17, .55, .18), cloak: new THREE.BoxGeometry(.66, .9, .14), shell: new THREE.BoxGeometry(1.05, 1.55, 1.2), brooch: new THREE.OctahedronGeometry(.07, 0) };
  const skinMat = mat(0x9fb1c0), clothMat = mat(0xffffff), robe = mat(0xffffff);
  const F = new THREE.Matrix4(), mm = (x, y, z, rx = 0, ry = 0, rz = 0) => B.mtx(x, y, z, rx, ry, rz);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), x = C.x + side * 1.7, z = C.z - 6 + row * 2.45, y = groundY(x, z), col = COLORS[(i * 5) % COLORS.length];
    F.copy(B.mtx(x, y, z, 0, Math.PI + side * .08, 0));
    const put = (key, geo, m, l, c = null) => B.put(key, geo, m, F.clone().multiply(l), c);
    put('fThigh', fig.thigh, robe, mm(-.13, .32, .2, 0, 0, 0), col); put('fThigh', fig.thigh, robe, mm(.13, .32, .2, 0, 0, 0), col);
    put('fShin', fig.shin, robe, mm(-.13, .12, .44, -Math.PI / 2, 0, 0), col); put('fShin', fig.shin, robe, mm(.13, .12, .44, -Math.PI / 2, 0, 0), col);
    put('fTorso', fig.torso, clothMat, mm(0, .78, .12, .42, 0, 0), col);
    put('fHead', fig.head, skinMat, mm(0, 1.2, .38, .7, 0, 0));
    put('fArm', fig.arm, clothMat, mm(-.33, .7, .3, .9, 0, .08), col); put('fArm', fig.arm, clothMat, mm(.33, .7, .3, .9, 0, -.08), col);
    put('fCloak', fig.cloak, robe, mm(0, .62, -.1, .25, 0, 0), 0x2a2436);
    put('fBrooch', fig.brooch, glass, mm(0, .9, .32, .42, 0, 0));
    put('fShell', fig.shell, iceClear, mm(0, .72, .2, .12, 0, 0));
    addCollider({ x, z, r: .62, top: y + 1.5 });
  }
  // Tattered banners of the court on the wall behind the throne: a hollow crown, grey on violet.
  const bannerTex = canvasTexture(64, 128, (g) => {
    g.fillStyle = '#3a2f52'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#c9cfd8'; g.beginPath(); g.moveTo(14, 70); g.lineTo(14, 44); g.lineTo(22, 56); g.lineTo(32, 38); g.lineTo(42, 56); g.lineTo(50, 44); g.lineTo(50, 70); g.closePath(); g.fill();
    g.fillStyle = '#3a2f52'; g.fillRect(22, 58, 20, 8); g.fillStyle = '#e8eef5'; for (let i = 0; i < 6; i++) g.fillRect(i * 11, 110 + (i % 2) * 6, 7, 18);
  });
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 1, side: THREE.DoubleSide });
  for (const a of [-Math.PI / 2 - .5, -Math.PI / 2 - .22, -Math.PI / 2 + .22, -Math.PI / 2 + .5]) { const p = cat(a, C.r - .55); add(new THREE.PlaneGeometry(.9, 1.9), bannerMat, p.x, groundY(p.x, p.z) + 2.4, p.z, 0, -a - Math.PI / 2, (r() - .5) * .08).castShadow = false; }

  // ------------------------------------------------------------- the Maw's den
  // The glacier behind it: slabs of blue ice and snow closing the north side.
  for (let i = 0; i < 9; i++) {
    const x = MAW_SEAL.x - 13 + i * 3.4 + (r() - .5), z = MAW_SEAL.z - 14.5 - (i % 2) * 1.6 - Math.abs(i - 4) * .5, y = groundY(x, z), h = 7 + r() * 6;
    B.put('glacier', wallGeo, i % 3 ? iceSolid : palace, B.mtx(x, y + h / 2 - 1, z, (r() - .5) * .2, (r() - .5) * .6, (r() - .5) * .2, 3.6 + r() * 1.5, h, 2.6 + r()));
    B.put('glacierSnow', driftGeo, snow, B.mtx(x, y + h - 1, z, 0, r() * 6, 0, 2.2, .5, 1.6));
    addCollider({ x, z, r: 2.0, top: y + h });
  }
  const seal = mawSeal(root, { groundY, addCollider, fireSpots, glass, iceSolid, iron, mat, flame, flames });

  B.done(/fShell|sheet|drift|wallSnow|colSnow|cap|logTip|rockCap|glacierSnow/);

  // Falling snow: flakes in a box round the camera that drift down and wrap.
  const FLAKES = 1700, SPAN = 46, flakePos = new Float32Array(FLAKES * 3), flakeSpeed = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) { flakePos.set([(r() - .5) * SPAN, r() * 22 - 4, (r() - .5) * SPAN], i * 3); flakeSpeed[i] = .9 + r() * 1.1; }
  const flakeGeo = new THREE.BufferGeometry(); flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
  const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.4)'), color: 0xffffff, size: .14, transparent: true, opacity: .9, depthWrite: false }));
  flakes.frustumCulled = false; root.add(flakes);

  // Four warm lights hop to the fires nearest you (cheaper than one per brazier), like Shadowmere's lanterns.
  const lights = []; for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff9a48, 0, 13, 1.5); root.add(l); lights.push(l); }
  const nearest = [];
  const state = { ready: true, frost: 0, pieces: root.children.length };
  let remembered = false;
  return {
    root, state, seal, fireSpots,
    /** The throne's circlet dims once its memory has been heard. */
    setRemembered(on) { remembered = on; },
    update(dt, t, player, camera, frost) {
      state.frost = frost;
      const near = Math.hypot(player.x - FB.x, player.z - FB.z) < FB.r + 60; root.visible = near || frost > .02;
      if (!root.visible) return;
      back.update(t); seal.update(dt, t);
      peaks.position.set(camera.position.x, 0, camera.position.z);
      // Snow: down and sideways in the wind, wrapped round the camera.
      const cx = camera.position.x, cyy = camera.position.y, cz = camera.position.z, wind = Math.sin(t * .3) * .6 + .4;
      for (let i = 0; i < FLAKES; i++) {
        const k = i * 3; let x = flakePos[k] + (wind + Math.sin(t * 1.3 + i) * .3) * dt, y = flakePos[k + 1] - flakeSpeed[i] * dt, z = flakePos[k + 2] + Math.cos(t * 1.1 + i * .7) * .25 * dt;
        if (y < cyy - 6) y += 22; else if (y > cyy + 16) y -= 22;
        if (x - cx > SPAN / 2) x -= SPAN; else if (x - cx < -SPAN / 2) x += SPAN;
        if (z - cz > SPAN / 2) z -= SPAN; else if (z - cz < -SPAN / 2) z += SPAN;
        flakePos[k] = x; flakePos[k + 1] = y; flakePos[k + 2] = z;
      }
      flakeGeo.attributes.position.needsUpdate = true; flakes.material.opacity = .9 * Math.min(1, frost * 1.2 + .1);
      for (const f of flames) { const s = f.base * (1 + Math.sin(t * 9 + f.phase) * .08 + Math.sin(t * 23 + f.phase * 2) * .05); f.group.scale.set(f.base, s, f.base); }
      hearthLight.intensity = 36 * (1 + Math.sin(t * 7) * .06 + Math.sin(t * 17) * .04);
      for (let i = 0; i < embersN; i++) { const k = i * 3, life = (t * .5 + i * .37) % 1; emberPos[k] = emberBase[k] + Math.sin(t + i) * .3 * life; emberPos[k + 1] = hy + .5 + life * 4.5; emberPos[k + 2] = emberBase[k + 2] + Math.cos(t * .8 + i) * .3 * life; }
      emberGeo.attributes.position.needsUpdate = true;
      const glow = remembered ? .35 : 1; circletMat.emissiveIntensity = (1.2 + Math.sin(t * 2) * .4) * glow * 1.6; throneLight.intensity = 5 * glow; throneHalo.material.opacity = .8 * glow;
      if ((state.pick = (state.pick || 0) - dt) <= 0) {
        state.pick = .3; nearest.length = 0;
        for (const p of fireSpots) nearest.push([Math.hypot(p[0] - player.x, p[2] - player.z), p]);
        nearest.sort((a, b) => a[0] - b[0]);
      }
      lights.forEach((l, i) => { const p = nearest[i]?.[1]; if (!p || nearest[i][0] > 30) { l.intensity = 0; return; } l.position.set(p[0], p[1], p[2]); l.intensity = 14 * (1 + Math.sin(t * 8 + i * 2) * .07); });
    }
  };
}

/**
 * The White Maw's seal (Book III): a ring of rime spires shot with crown-glass round its den, a pale wall, and
 * three braziers the court let freeze inside blocks of ice. The same shape as Garrow's seal (shadowmere.js):
 * setSealed() and setLit(), colliders that close the ring while it stands, a third of the spires cracking for
 * each brazier thawed.
 */
function mawSeal(root, { groundY, addCollider, fireSpots, glass, iceSolid, iron, mat, flame, flames }) {
  const C = MAW_SEAL, g = new THREE.Group(); root.add(g);
  const spireGeo = new THREE.ConeGeometry(.42, 1, 5); spireGeo.translate(0, .5, 0);
  const r = rng(83), spires = [], colliders = [];
  const iceGlow = iceSolid.clone(); iceGlow.emissiveIntensity = 1.0;
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2 + (r() - .5) * .08, rr = C.r + (r() - .5) * .5, x = C.x + Math.sin(a) * rr, z = C.z + Math.cos(a) * rr, y = groundY(x, z);
    const m = new THREE.Mesh(spireGeo, i % 4 ? iceGlow : glass), h = 2.4 + r() * 2.6; m.position.set(x, y - .3, z);
    m.rotation.set(Math.cos(a) * .22 * (r() + .4), r() * 3, -Math.sin(a) * .22 * (r() + .4)); m.scale.set(1, h, 1); m.castShadow = true; g.add(m);
    const near = C.braziers.reduce((b, L) => Math.abs(Math.atan2(Math.sin(a - L.a), Math.cos(a - L.a))) < Math.abs(Math.atan2(Math.sin(a - C.braziers[b].a), Math.cos(a - C.braziers[b].a))) ? L.i : b, 0);
    spires.push({ m, h, y, brazier: near, k: 1 });
  }
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, x = C.x + Math.sin(a) * C.r, z = C.z + Math.cos(a) * C.r, c = { x, z, r: .8, top: groundY(x, z) + 9 }; addCollider(c); colliders.push(c); }
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(C.r, C.r, 6, 56, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  wall.position.set(C.x, groundY(C.x, C.z) + 2.7, C.z); g.add(wall);
  const glow = new THREE.PointLight(0x9fb8ff, 6, 16, 2); glow.position.set(C.x, groundY(C.x, C.z) + 3, C.z); g.add(glow);
  const iceBlock = new THREE.MeshStandardMaterial({ color: 0xcdeaff, emissive: 0x2a5f86, emissiveIntensity: .4, roughness: .08, metalness: .1, transparent: true, opacity: .62, depthWrite: false });
  const braziers = C.braziers.map(L => {
    const y = groundY(L.x, L.z), b = new THREE.Group(); b.position.set(L.x, y, L.z); g.add(b);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, 1.2, 5), iron); leg.position.set(Math.cos(a) * .4, .58, Math.sin(a) * .4); leg.rotation.set(Math.sin(a) * .22, 0, -Math.cos(a) * .22); b.add(leg); }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.62, .36, .4, 10), iron); bowl.position.y = 1.2; b.add(bowl);
    const coalMat = mat(0x3b3f45); const coals = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 4), coalMat); coals.position.y = 1.35; coals.scale.y = .4; b.add(coals);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.0, 1.7), iceBlock); block.position.y = 1.0; block.rotation.y = r(); b.add(block);
    const fire = flame(b, 0, 1.4, 0, 1.3); fire.visible = false;
    addCollider({ x: L.x, z: L.z, r: .75, top: y + 1.6 });
    return { ...L, coalMat, block, fire, spot: [L.x, y + 2.1, L.z], lit: false };
  });
  let sealed = true, breakT = -1, strength = 1;
  return {
    braziers,
    get sealed() { return sealed; },
    get breaking() { return breakT >= 0 && breakT < 1.6; },
    /** Thaw (or freeze) brazier i: the ice block melts away and its fire joins the warm lights. */
    setLit(i, on) {
      const L = braziers[i]; if (!L || L.lit === on) return;
      L.lit = on; L.block.visible = !on; L.fire.visible = on; L.coalMat.color.setHex(on ? 0xff8a3a : 0x3b3f45); L.coalMat.emissive.setHex(on ? 0xff5a14 : 0); L.coalMat.emissiveIntensity = on ? 1.6 : 0;
      const at = fireSpots.indexOf(L.spot); if (on && at < 0) fireSpots.push(L.spot); else if (!on && at >= 0) fireSpots.splice(at, 1);
    },
    setSealed(on, instant = false) {
      if (on === sealed && !instant) return;
      sealed = on;
      for (const c of colliders) c.top = on ? groundY(c.x, c.z) + 9 : -1e9;
      if (on) { breakT = -1; for (const sp of spires) { sp.k = 1; sp.m.visible = true; } }
      else if (instant) { breakT = 9; strength = 0; for (const sp of spires) { sp.k = 0; sp.m.visible = false; } }
      else breakT = 0;
    },
    update(dt, t) {
      const lit = braziers.filter(L => L.lit).length;
      strength += ((sealed ? 1 - lit * .22 : 0) - strength) * Math.min(1, dt * 3);
      for (const s of spires) {
        const cracked = sealed && braziers[s.brazier]?.lit, want = breakT >= 0 ? 0 : cracked ? .35 : 1;
        s.k += (want - s.k) * Math.min(1, dt * (breakT >= 0 ? 2.2 : 3));
        s.m.scale.set(.6 + .4 * s.k, s.h * s.k + .001, .6 + .4 * s.k); s.m.position.y = s.y - .3 - (1 - s.k) * .4;
        if (breakT >= 0 && s.k < .03) s.m.visible = false;
      }
      iceGlow.emissiveIntensity = (.6 + strength * .8) * (1 + Math.sin(t * 2.2) * .12);
      wall.material.opacity = .12 * strength * (1 + Math.sin(t * 1.7) * .25); wall.visible = strength > .02;
      glow.intensity = 6 * strength; glow.visible = strength > .02;
      if (breakT >= 0 && breakT < 9) breakT += dt;
    }
  };
}
