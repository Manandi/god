import * as THREE from 'three';
import { LANTERNHOLD as L } from './world.js';

// Lanternhold, the lamplighters' town in Shadowmere (owner, 2026-10-16: "a city where the mobs can't come in,
// designed cool, with a proper story line"). A ring of sharpened root-stakes with one lantern gate facing the
// trail; inside, round moss-roofed huts with lit windows, a forge, a well, a little market, strings of lanterns
// running to the Great Lantern in the plaza, and a rest brazier. The Great Lantern's seed burns low until Garrow
// is freed (setRelit). No creature crosses the wall: creatures.js refuses any step inside it.
//
// Local layout: angle 0 points east (+x) through the gate, toward the lantern trail.

const at = (a, d) => ({ x: L.x + Math.cos(a) * d, z: L.z + Math.sin(a) * d });
export const LANTERNHOLD_SPOTS = {
  lantern: at(0, 0),
  rest: at(-.55, 3.4),
  well: at(-1.75, 5.4),
  forge: at(Math.PI * .95, 7.6),
  market: [at(.42, 8.4), at(-.42, 8.4)]
};
const HUTS = [1.05, 1.62, 2.25, 2.85, 3.55, 4.25].map((a, i) => ({ a, ...at(a, 8.9), r: 1.75, i }));
const GATE_HALF = .27;                       // radians either side of east

export function createLanternhold(scene, { groundY, addCollider }) {
  const root = new THREE.Group(); root.name = 'Lanternhold'; scene.add(root);
  const y0 = groundY(L.x, L.z);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true, ...o });
  const wood = mat(0x3a2a1c), darkWood = mat(0x241a12), bark = mat(0x2f2418), moss = mat(0x2f5a33), thatch = mat(0x3d4a26),
    stone = mat(0x5a5d55), plaza = mat(0x3b3a33), iron = mat(0x2b2b2e, { metalness: .4, roughness: .6 }),
    cloth = [mat(0x7a3b2e), mat(0x2f5f6b), mat(0x8a6a2a)],
    glowWarm = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa53a, emissiveIntensity: 2.2 }),
    windowGlow = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };

  // The plaza: a worn stone disc and a lane out through the gate.
  const disc = add(new THREE.CircleGeometry(L.r - .6, 48), plaza, L.x, y0 + .04, L.z, -Math.PI / 2); disc.castShadow = false;
  const lane = add(new THREE.PlaneGeometry(13, 3.4), plaza, L.x + L.r + 3.5, groundY(L.x + L.r + 3.5, L.z) + .05, L.z, -Math.PI / 2); lane.castShadow = false;

  // The palisade: root-stakes with sharpened tips, leaning a little outward, and a rail of lashing.
  const stake = new THREE.CylinderGeometry(.22, .28, 1, 6), tip = new THREE.ConeGeometry(.24, .6, 6);
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, gap = Math.abs(Math.atan2(Math.sin(a - L.gate), Math.cos(a - L.gate)));
    if (gap < GATE_HALF) continue;
    const p = at(a, L.r), y = groundY(p.x, p.z), h = 2.9 + ((i * 37) % 7) * .12, lean = .08;
    const g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); root.add(g);
    add(stake, i % 3 ? wood : darkWood, 0, h / 2, 0, 0, 0, 0, g).scale.y = h;
    add(tip, darkWood, 0, h + .28, 0, 0, 0, 0, g);
    if (i % 2 === 0) addCollider({ x: p.x, z: p.z, r: .75, top: y + 3.4 });
  }
  for (const hgt of [.9, 2.1]) {                            // the lashing rails, in arcs between the gate posts
    const arc = new THREE.TorusGeometry(L.r - .05, .06, 4, 80, Math.PI * 2 - GATE_HALF * 2);
    const r = add(arc, bark, L.x, y0 + hgt, L.z, Math.PI / 2, 0, L.gate + GATE_HALF); r.castShadow = false;
  }
  // Banners on every eighth stake: the lamplighters' sign, a gold flame on dark blue.
  const bannerTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#1f3346'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#d9a640'; g.beginPath(); g.moveTo(32, 26); g.quadraticCurveTo(50, 60, 32, 92); g.quadraticCurveTo(14, 60, 32, 26); g.fill();
    g.fillStyle = '#ffe3a0'; g.beginPath(); g.arc(32, 72, 7, 0, 7); g.fill(); g.fillStyle = '#d9a640'; g.fillRect(6, 108, 52, 6);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 1, side: THREE.DoubleSide });
  for (let i = 4; i < n; i += 8) {
    const a = i / n * Math.PI * 2, gap = Math.abs(Math.atan2(Math.sin(a - L.gate), Math.cos(a - L.gate))); if (gap < GATE_HALF + .1) continue;
    const p = at(a, L.r - .45);
    add(new THREE.PlaneGeometry(.75, 1.5), bannerMat, p.x, groundY(p.x, p.z) + 2.1, p.z, 0, -a + Math.PI / 2, 0);
  }

  // The gate: two great posts, a crossbeam with the town's name, and a lantern hanging either side.
  const lanterns = [];
  for (const side of [-1, 1]) {
    const a = L.gate + side * (GATE_HALF + .02), p = at(a, L.r), y = groundY(p.x, p.z);
    add(new THREE.CylinderGeometry(.38, .46, 5, 7), darkWood, p.x, y + 2.5, p.z);
    add(new THREE.ConeGeometry(.42, .7, 7), darkWood, p.x, y + 5.35, p.z);
    addCollider({ x: p.x, z: p.z, r: .55, top: y + 5.5 });
    const lp = at(a, L.r + .9); lanterns.push(lantern(lp.x, y + 3.6, lp.z, 1.1));
  }
  const gp = at(L.gate, L.r), gy = groundY(gp.x, gp.z);
  const beam = add(new THREE.BoxGeometry(.5, .45, 7.4), darkWood, gp.x, gy + 4.55, gp.z, 0, -L.gate, 0);
  const signTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#2a1d12'; g.fillRect(0, 0, 512, 96); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84);
    g.fillStyle = '#f0c870'; g.font = '600 50px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LANTERNHOLD', 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  add(new THREE.PlaneGeometry(4.2, .8), new THREE.MeshBasicMaterial({ map: signTex }), gp.x + .3, gy + 3.95, gp.z, 0, Math.PI / 2 - L.gate, 0);

  // Huts: a stone footing, plank walls, a moss-thatched cone roof with a smoke vent, a door and lit windows.
  for (const h of HUTS) {
    const y = groundY(h.x, h.z), face = Math.atan2(L.x - h.x, L.z - h.z), g = new THREE.Group(); g.position.set(h.x, y, h.z); g.rotation.y = face; root.add(g);
    add(new THREE.CylinderGeometry(h.r + .15, h.r + .25, .45, 10), stone, 0, .22, 0, 0, 0, 0, g);
    add(new THREE.CylinderGeometry(h.r, h.r, 2.1, 10), h.i % 2 ? wood : bark, 0, 1.45, 0, 0, 0, 0, g);
    const roof = add(new THREE.ConeGeometry(h.r + .65, 2.2 + (h.i % 3) * .3, 10), h.i % 2 ? moss : thatch, 0, 3.55 + (h.i % 3) * .15, 0, 0, Math.PI / 10, 0, g);
    add(new THREE.CylinderGeometry(.16, .2, .8, 6), stone, .5, 4.4 + (h.i % 3) * .3, -.3, 0, 0, 0, g);
    add(new THREE.BoxGeometry(.9, 1.5, .12), darkWood, 0, 1.15, h.r - .02, 0, 0, 0, g);                       // the door, facing the plaza
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(.42, .42), windowGlow, Math.sin(s * .9) * (h.r + .02), 1.7, Math.cos(s * .9) * (h.r + .02), 0, s * .9, 0, g);
    addCollider({ x: h.x, z: h.z, r: h.r + .25, top: y + 4.5 });
    void roof;
  }

  // The forge: an open lean-to with an anvil and a glowing hearth.
  { const f = LANTERNHOLD_SPOTS.forge, y = groundY(f.x, f.z), g = new THREE.Group(); g.position.set(f.x, y, f.z); g.rotation.y = Math.atan2(L.x - f.x, L.z - f.z); root.add(g);
    for (const [px, pz] of [[-1.2, -.8], [1.2, -.8], [-1.2, .9], [1.2, .9]]) add(new THREE.CylinderGeometry(.1, .12, 2.6, 6), darkWood, px, 1.3, pz, 0, 0, 0, g);
    add(new THREE.BoxGeometry(2.8, .14, 2.2), thatch, 0, 2.65, 0, .18, 0, 0, g);
    add(new THREE.BoxGeometry(1, .7, .8), stone, -.5, .35, -.4, 0, 0, 0, g);
    add(new THREE.BoxGeometry(.7, .14, .5), new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 1.6 }), -.5, .72, -.4, 0, 0, 0, g);
    add(new THREE.BoxGeometry(.55, .28, .24), iron, .6, .75, .2, 0, 0, 0, g); add(new THREE.BoxGeometry(.3, .5, .3), darkWood, .6, .36, .2, 0, 0, 0, g);
    const fl = new THREE.PointLight(0xff7a2a, 4, 6, 2); fl.position.set(-.5, 1, -.4); g.add(fl);
    addCollider({ x: f.x, z: f.z, r: 1.3, top: y + 2.7 }); }

  // The well: a stone ring, a little roof, a bucket.
  { const w = LANTERNHOLD_SPOTS.well, y = groundY(w.x, w.z);
    add(new THREE.CylinderGeometry(.85, .9, .8, 10, 1, true), stone, w.x, y + .4, w.z).material.side = THREE.DoubleSide;
    add(new THREE.CircleGeometry(.8, 10), new THREE.MeshStandardMaterial({ color: 0x0b1820, roughness: .2, metalness: .3 }), w.x, y + .55, w.z, -Math.PI / 2);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.07, .07, 1.6, 5), darkWood, w.x + s * .78, y + 1.2, w.z);
    add(new THREE.ConeGeometry(1.15, .6, 4), thatch, w.x, y + 2.2, w.z, 0, Math.PI / 4, 0);
    add(new THREE.CylinderGeometry(.17, .14, .26, 8), wood, w.x + .3, y + 1.1, w.z);
    addCollider({ x: w.x, z: w.z, r: 1.0, top: y + .8 }); }

  // The market by the gate: two stalls with striped awnings, crates, barrels and lanterns.
  LANTERNHOLD_SPOTS.market.forEach((m, k) => {
    const y = groundY(m.x, m.z), g = new THREE.Group(); g.position.set(m.x, y, m.z); g.rotation.y = Math.atan2(L.x + 8.4 - m.x, L.z - m.z);   // facing the lane root.add(g);
    add(new THREE.BoxGeometry(2.4, .9, 1.1), wood, 0, .45, 0, 0, 0, 0, g);
    for (const [px, pz] of [[-1.1, -.5], [1.1, -.5], [-1.1, .5], [1.1, .5]]) add(new THREE.CylinderGeometry(.06, .06, 2.3, 5), darkWood, px, 1.15, pz, 0, 0, 0, g);
    add(new THREE.BoxGeometry(2.7, .08, 1.5), cloth[k], 0, 2.35, .1, -.22, 0, 0, g);
    add(new THREE.BoxGeometry(.5, .5, .5), wood, -1.6, .25, .7, 0, .4, 0, g); add(new THREE.CylinderGeometry(.3, .3, .7, 8), darkWood, 1.7, .35, .6, 0, 0, 0, g);
    for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(.12, 6, 4), i % 2 ? glowWarm : cloth[2], -.8 + i * .5, 1.02, -.1, 0, 0, 0, g);
    addCollider({ x: m.x, z: m.z, r: 1.4, top: y + 1 });
  });

  // The Great Lantern: a twisted root-trunk, branching at the top into a cage that holds the town's seed of light.
  const glp = LANTERNHOLD_SPOTS.lantern, gly = groundY(glp.x, glp.z), great = new THREE.Group(); great.position.set(glp.x, gly, glp.z); root.add(great);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, s = add(new THREE.CylinderGeometry(.18, .42, 6.4, 6), bark, Math.cos(a) * .35, 3.1, Math.sin(a) * .35, Math.sin(a) * .1, a, Math.cos(a) * -.1, great); s.rotation.y = a; }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, r = add(new THREE.ConeGeometry(.35, 1.6, 5), bark, Math.cos(a) * .9, .55, Math.sin(a) * .9, Math.sin(a) * .9, 0, -Math.cos(a) * .9, great); r.scale.set(1, 1, .6); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4, b = add(new THREE.CylinderGeometry(.08, .16, 2.2, 5), bark, Math.cos(a) * .6, 6.7, Math.sin(a) * .6, Math.sin(a) * .7, 0, -Math.cos(a) * .7, great); void b; }
  const cage = new THREE.Group(); cage.position.y = 7.3; great.add(cage);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.BoxGeometry(.07, 1.6, .07), iron, Math.cos(a) * .62, 0, Math.sin(a) * .62, 0, 0, 0, cage); }
  add(new THREE.CylinderGeometry(.75, .75, .1, 6), iron, 0, .8, 0, 0, 0, 0, cage); add(new THREE.CylinderGeometry(.75, .75, .1, 6), iron, 0, -.8, 0, 0, 0, 0, cage);
  add(new THREE.ConeGeometry(.85, .7, 6), darkWood, 0, 1.2, 0, 0, 0, 0, cage);
  const seedMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa53a, emissiveIntensity: .6 });
  const seed = add(new THREE.OctahedronGeometry(.42, 1), seedMat, 0, 0, 0, 0, 0, 0, cage);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .35 }));
  halo.scale.setScalar(4); cage.add(halo);
  const greatLight = new THREE.PointLight(0xffb45a, 8, 34, 1.2); greatLight.position.y = 7.3; great.add(greatLight);
  // A low warm fill so the plaza reads as lit ground, brighter once the Great Lantern is relit.
  const fill = new THREE.PointLight(0xffa860, 6, 24, 1.1); fill.position.set(L.x, y0 + 3, L.z); root.add(fill);
  addCollider({ x: glp.x, z: glp.z, r: 1.35, top: gly + 8 });

  // Strings of small lanterns from the Great Lantern out to every hut roof.
  const bulb = new THREE.SphereGeometry(.09, 6, 4), cord = new THREE.LineBasicMaterial({ color: 0x1a120c });
  for (const h of HUTS) {
    const a = new THREE.Vector3(glp.x, gly + 6.2, glp.z), b = new THREE.Vector3(h.x, groundY(h.x, h.z) + 3.4, h.z), pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 1.1; pts.push(p); if (i && i < 12 && i % 2 === 0) add(bulb, glowWarm, p.x, p.y - .12, p.z).castShadow = false; }
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cord));
  }

  // The rest brazier: a bronze bowl of embers on three legs.
  { const r = LANTERNHOLD_SPOTS.rest, y = groundY(r.x, r.z);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(new THREE.CylinderGeometry(.05, .05, .9, 5), iron, r.x + Math.cos(a) * .35, y + .45, r.z + Math.sin(a) * .35, Math.sin(a) * .25, 0, -Math.cos(a) * .25); }
    add(new THREE.CylinderGeometry(.6, .32, .35, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a2a, metalness: .5, roughness: .5 }), r.x, y + 1.0, r.z);
    add(new THREE.SphereGeometry(.42, 8, 5), new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff5a14, emissiveIntensity: 2 }), r.x, y + 1.15, r.z).scale.y = .45;
    const bl = new THREE.PointLight(0xff8a3a, 12, 10, 1.6); bl.position.set(r.x, y + 1.6, r.z); root.add(bl); lanterns.push({ light: bl, base: 12 });
    addCollider({ x: r.x, z: r.z, r: .7, top: y + 1.2 }); }

  function lantern(x, y, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    add(new THREE.BoxGeometry(.32 * s, .42 * s, .32 * s), glowWarm, 0, 0, 0, 0, 0, 0, g);
    add(new THREE.ConeGeometry(.28 * s, .22 * s, 4), iron, 0, .3 * s, 0, 0, Math.PI / 4, 0, g);
    const l = new THREE.PointLight(0xffb45a, 8, 10, 1.6); g.add(l); return { light: l, base: 8 };
  }
  let relit = false, glow = .25;
  return {
    root,
    /** The Great Lantern burns low while Garrow is bound, and blazes once it is free. */
    setRelit(on) { relit = on; },
    update(t) {
      glow += ((relit ? 1 : .25) - glow) * .03; const cur = glow;
      seedMat.emissiveIntensity = cur * 3 * (1 + Math.sin(t * (relit ? 2 : 6)) * (relit ? .06 : .18));
      greatLight.intensity = 10 + cur * 50; fill.intensity = 6 + cur * 30; halo.material.opacity = .15 + cur * .5; halo.scale.setScalar(3 + cur * 3);
      seed.rotation.y = t * .6;
      lanterns.forEach((l, i) => { l.light.intensity = l.base * (1 + Math.sin(t * 7 + i * 1.7) * .08); });
    }
  };
}

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,150,1)'); grad.addColorStop(.35, 'rgba(255,160,60,.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
