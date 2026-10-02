import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SITES, CITY_HOUSES, groundY } from './world.js';

// The Blender set pieces: the three memory sites (tools/blender/build_sites.py)
// and Mossgate's props (tools/blender/build_mossgate.py). The props only add to
// the ChatGPT town: its houses, square, stalls and NPCs are left as they are.

const BASE = import.meta.env?.BASE_URL || '/';
const SITE_ROOTS = { rootwell: 'Rootwell', ruins: 'Mosswatch', shrine: 'Shrine' };

// Mossgate dressing. [prop, x, z, rotation]; rotations turn the prop's front (+X).
const facing = (x, z, tx, tz) => Math.atan2(-(tz - z), tx - x);
const TOWN = [
  ['Well', -7.6, 45.2, .3],
  ['StallCounter', -5.8, 54, .14], ['StallCounter', 5.8, 57, -.12],
  ['Cart', -15.5, 56.5, 1.2],
  ['Planter', -3.6, 45, Math.PI / 2], ['Planter', 3.6, 45, Math.PI / 2],
  ['LanternPost', -2.4, 42.6, 0], ['LanternPost', 2.4, 42.6, Math.PI], ['LanternPost', -12.8, 55.5, 0], ['LanternPost', 13, 56, Math.PI],
  ['Signpost', 5.6, 42.4, .4],
  ['Bench', 0, 57.6, facing(0, 57.6, 0, 53)], ['Bench', -3.8, 55.6, facing(-3.8, 55.6, 0, 53)], ['Bench', 3.8, 55.6, facing(3.8, 55.6, 0, 53)]
];
// (House 3's crate stack sits left of its door: on the right it stood where Sela stands.)
// Around each house, in the house's own frame (x across, z toward its back; the door faces -z).
const AT_HOUSE = [
  ['WindowBox', 2.82, 2.45, .2, 0], ['WindowBox', -2.82, 2.45, .2, Math.PI], ['WindowBox', 0, 2.45, 2.32, -Math.PI / 2], ['Chimney', 1.5, 3.9, 1.1, 0]
];
const BY_DOOR = [[['Sacks', -2.4, -3.0]], [['Firewood', 0, 3.3, Math.PI / 2]], [['Barrel', -2.3, -2.9], ['CrateStack', -3.9, -2.6, .3]], [['Barrel', 2.3, -2.9], ['Barrel', 2.9, -2.4]], [['Firewood', 0, 3.3, Math.PI / 2], ['Crate', -2.5, -3.0, .5]]];
const RADIUS = { Well: 1.3, StallCounter: 1.25, Cart: 1.4, Planter: .7, LanternPost: .22, Signpost: .2, Barrel: .45, Crate: .5, CrateStack: .9, Sacks: .6, Firewood: .8 };
const HEIGHT = { Well: 1.0, StallCounter: 1.0, Cart: 1.2, Planter: .5, LanternPost: 3, Signpost: 2.9, Barrel: 1, Crate: .8, CrateStack: 1.5, Sacks: .8, Firewood: 1 };

/** Load both sets. `addCollider` receives {x, z, r, top}; `crowns` are the forest's leaf crown pieces. */
export async function loadSites(scene, { addCollider, crownGeometry, leafMaterials }) {
  const loader = new GLTFLoader();
  const [sites, props] = await Promise.all([
    loader.loadAsync(`${BASE}sites/memory-sites.glb`), loader.loadAsync(`${BASE}sites/mossgate-props.glb`)
  ]);
  const placed = {};
  for (const site of SITES) {
    const root = sites.scene.getObjectByName(SITE_ROOTS[site.id]); if (!root) continue;
    scene.add(root);
    root.position.set(site.x, groundY(site.x, site.z), site.z);
    root.rotation.set(0, -Math.atan2(site.approach.z - site.z, site.approach.x - site.x), 0);    // its open side (+X) to the road
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    root.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (/^COL_/.test(o.name) && o.userData.r) { o.getWorldPosition(v); addCollider({ x: v.x, z: v.z, r: o.userData.r, top: groundY(v.x, v.z) + o.userData.h }); }
      if (/^CROWN_/.test(o.name)) {   // the forest's own leaf crowns, hung at the shrine tree's limb tips
        o.getWorldPosition(v); const i = Number(o.name.slice(6));
        const crown = new THREE.Mesh(crownGeometry, leafMaterials[i % leafMaterials.length]); crown.position.copy(v);
        crown.scale.set(7 + i % 2 * 2, 6 + i % 2 * 1.5, 7 + i % 2 * 2); crown.castShadow = true; scene.add(crown);
      }
    });
    placed[site.id] = root;
  }
  // Mossgate.
  const proto = name => props.scene.getObjectByName(name);
  const put = (name, x, z, rot, y = null) => {
    const p = proto(name); if (!p) return null;
    const m = p.clone(); m.position.set(x, y ?? groundY(x, z), z); m.rotation.y = rot;
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m);
    if (RADIUS[name]) addCollider({ x, z, r: RADIUS[name], top: groundY(x, z) + HEIGHT[name] });
    return m;
  };
  for (const [name, x, z, rot] of TOWN) put(name, x, z, rot);
  CITY_HOUSES.forEach(([hx, hz, hrot], i) => {
    const c = Math.cos(hrot), s = Math.sin(hrot), base = groundY(hx, hz);
    // House local (x, z) → world, matching the house group's rotation.y.
    const world = (x, z) => [hx + x * c + z * s, hz - x * s + z * c];
    for (const [name, x, y, z, rot] of AT_HOUSE) { const [wx, wz] = world(x, z); const m = proto(name)?.clone(); if (!m) continue; m.position.set(wx, base + y, wz); m.rotation.y = hrot + rot; scene.add(m); }
    for (const [name, x, z, rot = 0] of BY_DOOR[i] || []) { const [wx, wz] = world(x, z); put(name, wx, wz, hrot + rot); }
  });
  // Bunting under the gate lintel and across the square between the stalls.
  put('Bunting', 0, 39.4, Math.PI / 2, groundY(0, 39.4) + 4.4);
  const b = put('Bunting', 0, 55.5, Math.PI / 2 + Math.atan2(-3, 11.6), groundY(0, 55.5) + 3.4); if (b) b.scale.set(1, 1, 1.3);
  return { sites: placed };
}
