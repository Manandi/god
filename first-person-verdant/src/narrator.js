import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The intro's narrator: Mycel (tools/blender/build_mycel.py) floating through a
// dusky glade while he tells the story. He drifts to a new spot on each line,
// bobs and sways, blinks, moves his mouth while the text types, and each line
// sets his mood (brows, eyes, a gesture). His parts are animated directly.

const BASE = import.meta.env?.BASE_URL || '/';
const damp = THREE.MathUtils.damp;

// Mood → brow tilt (inner end up +), brow lift, eye squint, arm poses [left, right] as
// [raise, forward], head roll, and an extra bounce.
export const MOODS = {
  welcoming: { brow: .25, lift: .012, squint: 1, arms: [[1.1, .2], [1.1, .2]], roll: 0, bounce: .6 },
  curious: { brow: .1, lift: .01, squint: 1.05, arms: [[.2, 0], [.9, .6]], roll: .16, bounce: .2 },
  proud: { brow: 0, lift: 0, squint: .9, arms: [[-.35, .5], [-.35, .5]], roll: 0, bounce: .1 },
  serious: { brow: -.35, lift: -.01, squint: .8, arms: [[.1, .2], [.1, .2]], roll: 0, bounce: 0 },
  warm: { brow: .3, lift: .006, squint: .75, arms: [[.5, .6], [.5, .6]], roll: -.08, bounce: .3 },
  hopeful: { brow: .35, lift: .016, squint: 1.05, arms: [[1.4, .4], [1.4, .4]], roll: 0, bounce: .5 },
  stern: { brow: -.45, lift: -.012, squint: .7, arms: [[.9, .9], [0, .1]], roll: 0, bounce: 0 },
  thoughtful: { brow: -.1, lift: .004, squint: .85, arms: [[.1, .1], [1.3, 1.3]], roll: .12, bounce: 0 },
  excited: { brow: .3, lift: .018, squint: 1.1, arms: [[1.6, .1], [1.6, .1]], roll: 0, bounce: 1 }
};
// Where he drifts to (x across, y up), always above the story box along the bottom.
const SPOTS = [[0, 1.45], [-1.5, 1.6], [1.4, 1.4], [-.7, 1.3], [.9, 1.65], [-1.7, 1.35], [.3, 1.6], [1.6, 1.55]];

export function createNarrator() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06150f); scene.fog = new THREE.Fog(0x06150f, 5, 13);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 40); camera.position.set(0, .35, 6); camera.lookAt(0, .35, 0);
  scene.add(new THREE.HemisphereLight(0x9fd6b6, 0x0b1a12, 1.1));
  const key = new THREE.DirectionalLight(0xfff1d0, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.PointLight(0x63f2c4, 3, 6, 2); rim.position.set(-1.5, 1.2, -1); scene.add(rim);
  const glow = new THREE.PointLight(0xffd774, 1.2, 3, 2); scene.add(glow);
  // A glade behind him: dark trunks and a faint ring of light on the ground.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x14261d, roughness: 1 });
  for (let i = 0; i < 14; i++) {   // all behind him, so none ever hides him
    const h = 9 + (i % 4);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.18 + (i % 3) * .08, .35, h, 8), trunkMat);
    t.position.set((i / 13 - .5) * 16 + ((i * 7) % 3 - 1) * .5, h / 2 - .6, -3.5 - (i % 4) * 1.4); scene.add(t);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x0d2218, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.4; scene.add(ground);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 64), new THREE.MeshBasicMaterial({ color: 0x5fe0b8, transparent: true, opacity: .25, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -.38; scene.add(ring);
  // Spores drifting up through the light.
  const count = 260, pos = new Float32Array(count * 3), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - .5) * 9; pos[i * 3 + 1] = Math.random() * 5 - 1.6; pos[i * 3 + 2] = (Math.random() - .5) * 6 - 1; speed[i] = .08 + Math.random() * .22; }
  const sporeGeo = new THREE.BufferGeometry(); sporeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spores = new THREE.Points(sporeGeo, new THREE.PointsMaterial({ color: 0xc6f48a, size: .035, transparent: true, opacity: .7, depthWrite: false }));
  scene.add(spores);

  const holder = new THREE.Group(); holder.scale.setScalar(.82); scene.add(holder);
  let parts = null, mood = MOODS.welcoming, talking = false, spot = 0, blinkAt = 2, blink = 0;
  const at = new THREE.Vector3(0, 1.45, 0), want = new THREE.Vector3(0, 1.45, 0);
  new GLTFLoader().loadAsync(`${BASE}characters/mycel/mycel.glb`).then(gltf => {
    const m = gltf.scene; holder.add(m);
    const get = n => m.getObjectByName(n);
    parts = { body: get('Body'), cap: get('Cap'), eyeL: get('EyeL'), eyeR: get('EyeR'), browL: get('BrowL'), browR: get('BrowR'), mouth: get('Mouth'), armL: get('ArmL'), armR: get('ArmR'), seed: get('Heartseed') };
    parts.browY = parts.browL?.position.y ?? 0;
  }).catch(e => console.warn('Mycel failed to load', e));

  return {
    scene, camera,
    get loaded() { return !!parts; },
    /** A new line: his mood, and (unless told to stay) a new spot to drift to. */
    say(moodName, move = true) {
      mood = MOODS[moodName] || MOODS.welcoming;
      if (move) { spot = (spot + 1 + Math.floor(Math.random() * 2)) % SPOTS.length; }
    },
    set talking(v) { talking = v; },
    update(dt, t, width, height) {
      const aspect = width / Math.max(1, height); camera.aspect = aspect; camera.updateProjectionMatrix();
      // Keep him in the upper part of the frame, above the story box; narrower screens pull him in.
      const spread = Math.min(1, aspect / 1.6), [sx, sy] = SPOTS[spot];
      want.set(sx * spread + Math.sin(t * .37) * .15, sy + Math.sin(t * .53) * .06, Math.sin(t * .29) * .3);
      const prevX = at.x;
      at.x = damp(at.x, want.x, 1.3, dt); at.y = damp(at.y, want.y, 1.3, dt); at.z = damp(at.z, want.z, 1.3, dt);
      const vx = (at.x - prevX) / Math.max(dt, 1e-3);
      holder.position.set(at.x, at.y + Math.sin(t * 2.1) * .06 + Math.abs(Math.sin(t * 4)) * .03 * mood.bounce, at.z);
      // Plush squash-and-stretch: Mycel settles wide at the bottom of each bob,
      // then springs tall. It makes the floating spirit feel soft rather than rigid.
      const hop=Math.sin(t*2.1),squash=.035*(1-hop)+.025*mood.bounce*Math.abs(Math.sin(t*4));
      holder.scale.x=damp(holder.scale.x,.96+squash,8,dt);holder.scale.z=damp(holder.scale.z,.96+squash,8,dt);holder.scale.y=damp(holder.scale.y,.96-squash*.72,8,dt);
      holder.rotation.z = damp(holder.rotation.z, -vx * .35 + mood.roll + Math.sin(t * 1.3) * .04, 4, dt);
      holder.rotation.y = damp(holder.rotation.y, -vx * .25 - at.x * .12 + Math.sin(t * .7) * .12, 3, dt);
      holder.rotation.x = damp(holder.rotation.x, .06 + Math.sin(t * 1.7) * .03, 3, dt);
      glow.position.set(at.x + .5, at.y + .2, at.z + .4);
      ring.position.x = damp(ring.position.x, at.x, 2, dt); ring.material.opacity = .18 + Math.sin(t * 2) * .06;
      const p = sporeGeo.attributes.position;
      for (let i = 0; i < count; i++) { let y = p.getY(i) + speed[i] * dt; if (y > 3.4) y = -1.6; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t + i) * .002); }
      p.needsUpdate = true;
      if (!parts) return;
      // Blink every few seconds; squint by mood.
      if ((blinkAt -= dt) <= 0) { blink = .14; blinkAt = 2.5 + Math.random() * 3; }
      blink = Math.max(0, blink - dt); const open = (blink > 0 ? .1 : 1) * mood.squint;
      for (const e of [parts.eyeL, parts.eyeR]) if (e) e.scale.y = damp(e.scale.y, open, 22, dt);
      // Brows: tilt and lift by mood.
      if (parts.browL) { parts.browL.rotation.z = damp(parts.browL.rotation.z, mood.brow, 8, dt); parts.browL.position.y = damp(parts.browL.position.y, parts.browY + mood.lift, 8, dt); }
      if (parts.browR) { parts.browR.rotation.z = damp(parts.browR.rotation.z, -mood.brow, 8, dt); parts.browR.position.y = damp(parts.browR.position.y, parts.browY + mood.lift, 8, dt); }
      // Mouth: moves while the words type.
      if (parts.mouth) {
        const talk = talking ? .6 + Math.abs(Math.sin(t * 17)) * 1.4 + Math.sin(t * 9) * .3 : 1;
        parts.mouth.scale.y = damp(parts.mouth.scale.y, talk, 18, dt); parts.mouth.scale.x = damp(parts.mouth.scale.x, talking ? .85 : 1, 10, dt);
      }
      // Arms: the mood's gesture, with a little life; they talk with him.
      const gesture = talking ? Math.sin(t * 5) * .15 : 0;
      for (const [arm, [raise, fwd], side] of [[parts.armL, mood.arms[0], 1], [parts.armR, mood.arms[1], -1]]) {
        if (!arm) continue;
        arm.rotation.z = damp(arm.rotation.z, side * (raise + gesture + Math.sin(t * 1.6 + side) * .06), 5, dt);
        arm.rotation.x = damp(arm.rotation.x, -fwd, 5, dt);
      }
      if (parts.cap) { parts.cap.rotation.z = Math.sin(t * 1.9) * .04; parts.cap.rotation.x = Math.sin(t * 1.4) * .03; }
      // The Heartseed orbits him.
      if (parts.seed) parts.seed.position.set(Math.cos(t * 1.1) * .62, .3 + Math.sin(t * 2.2) * .12, Math.sin(t * 1.1) * .45);
    }
  };
}

