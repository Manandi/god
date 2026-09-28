import * as THREE from 'three';
import { groundY } from './world.js';

// Block-built NPCs: the ChatGPT Sites character design (square limbs,
// expressive block faces), shared with the explorer. Who they are, where they
// stand and what they say lives in story.js; this file only builds and
// animates them. `look` picks colours and a few distinguishing features.

function material(color, emissive = 0) { return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 1.1 : 0, roughness: .9, flatShading: true }); }
function cube(parent, size, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

function makeNpc(scene, id, def) {
  const { look } = def, root = new THREE.Group();
  root.position.set(def.x, groundY(def.x, def.z), def.z); root.scale.setScalar(def.scale || 1); scene.add(root);
  const skin = material(look.skin), cloth = material(look.cloth), dark = material(look.trousers ?? 0x26332f), leather = material(0x554438), glow = material(0xd6d58e, 0x4f6d3d);
  const white = material(0xf5f0df), iris = material(look.iris), lip = material(0x8b5149), hair = material(look.hair);
  const body = new THREE.Group(); root.add(body);
  cube(body, [.62, .78, .35], cloth, 0, 1.24, 0);
  cube(body, [.48, .42, .4], skin, 0, 1.87, -.01);
  cube(body, [.52, .13, .43], hair, 0, 2.09, 0);
  const brows = [];
  for (const side of [-1, 1]) {
    cube(body, [.105, .075, .025], white, side * .115, 1.94, .202);
    cube(body, [.04, .05, .012], iris, side * .115, 1.94, .219);
    const brow = cube(body, [.12, .025, .02], hair, side * .115, 2.015, .212); brow.rotation.z = side * (look.browTilt ?? -.04); brows.push(brow);
  }
  cube(body, [.055, .07, .035], skin, 0, 1.87, .22);
  const mouth = cube(body, [.15, .028, .018], lip, 0, 1.79, .215); mouth.rotation.z = look.mouthTilt || 0;
  if (look.beard) for (let i = 0; i < 5; i++) cube(body, [.09, .18, .08], hair, (i - 2) * .085, 1.68, .04);
  if (look.braid) { const braid = cube(body, [.1, .43, .1], hair, -.2, 1.74, -.06); braid.rotation.z = -.08; }
  // Block arms are intentional: the NPCs and explorer share one visual language.
  for (const side of [-1, 1]) {
    const arm = cube(body, [.2, .68, .22], cloth, side * .43, 1.26, 0); arm.rotation.z = side * (look.armTilt ?? -.08);
    cube(body, [.22, .18, .24], leather, side * .45, .9, 0);
    cube(body, [.18, .19, .2], skin, side * .45, .72, -.01);
    cube(body, [.24, .74, .27], dark, side * .18, .5, .02);
  }
  const rune = cube(body, [.12, .12, .04], glow, 0, 1.35, -.2); rune.rotation.z = Math.PI / 4;
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.12, 0), new THREE.MeshBasicMaterial({ color: 0xe8d993, transparent: true, opacity: .85 }));
  marker.position.set(0, 2.55, 0); root.add(marker);
  root.rotation.y = def.facing ?? 0;
  return { id, ...def, root, body, marker, mouth, brows, talking: false, expression: 'neutral' };
}

export function createNpcs(scene, defs) {
  return Object.fromEntries(Object.entries(defs).map(([id, def]) => [id, makeNpc(scene, id, def)]));
}

/**
 * Turn toward a close explorer, breathe, and move the face. The story speaker
 * (who has the next part of the story to tell) wears a bright gold marker
 * visible from afar; everyone else's is pale and only shows up close.
 */
export function updateNpcs(npcs, time, dt, player, speaker) {
  const damp = (a, b) => THREE.MathUtils.damp(a, b, 9, dt);
  for (const npc of Object.values(npcs)) {
    const d = Math.hypot(player.x - npc.x, player.z - npc.z);
    npc.root.visible = d < 90;
    if (!npc.root.visible) continue;
    if (d < 7 || npc.talking) {
      const want = Math.atan2(player.x - npc.x, player.z - npc.z);
      npc.root.rotation.y += Math.atan2(Math.sin(want - npc.root.rotation.y), Math.cos(want - npc.root.rotation.y)) * (1 - Math.exp(-3 * dt));
    }
    npc.body.position.y = Math.sin(time * 1.7 + npc.x) * .012;
    const warm = npc.talking || npc.expression === 'warm', stern = npc.expression === 'stern';
    npc.mouth.scale.x = damp(npc.mouth.scale.x, warm ? 1.18 : stern ? .82 : 1);
    npc.mouth.scale.y = npc.talking ? 1 + 1.6 * Math.abs(Math.sin(time * 13) * Math.sin(time * 4.3)) : damp(npc.mouth.scale.y, 1);
    npc.mouth.rotation.z = damp(npc.mouth.rotation.z, warm ? .08 : stern ? -.03 : npc.look.mouthTilt || 0);
    npc.mouth.position.y = damp(npc.mouth.position.y, warm ? 1.805 : stern ? 1.785 : 1.79);
    npc.brows.forEach((b, i) => { const side = i ? -1 : 1; b.rotation.z = damp(b.rotation.z, stern ? side * .22 : warm ? -side * .1 : side * .04); b.position.y = damp(b.position.y, stern ? 2.0 : warm ? 2.025 : 2.015); });
    const isSpeaker = speaker === npc.id;
    npc.marker.position.y = 2.5 + Math.sin(time * 2.2 + npc.z) * .07;
    npc.marker.visible = !npc.talking && (isSpeaker || d < 12);
    npc.marker.material.color.setHex(isSpeaker ? 0xf0c86a : 0xe8d993);
    npc.marker.material.opacity = isSpeaker ? 1 : .55;
    npc.marker.scale.setScalar(isSpeaker ? 1.6 : 1);
  }
}
