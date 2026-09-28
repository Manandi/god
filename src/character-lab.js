// Development-only: renders the exported explorer GLB from several angles.
//   /character-lab.html?views=front,side,back&hair=short&keys=Smile:1&clips=Idle@0,Walk@.4
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const q = new URLSearchParams(location.search);
const views = (q.get('views') || 'front,side,back,quarter').split(',');
const cell = Number(q.get('cell') || 260);
const canvas = document.getElementById('lab');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a3530');
scene.add(new THREE.HemisphereLight(0xdfeee8, 0x3b4a33, 2.0));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(2, 5, 4); scene.add(sun);
scene.add(new THREE.GridHelper(6, 12, 0x6c7f70, 0x3f4d45));
const gltf = await new GLTFLoader().loadAsync(q.get('src') || '/characters/explorer/explorer.glb');
const model = gltf.scene; scene.add(model);
const hair = q.get('hair') || 'short';
model.traverse(o => { if (o.name.startsWith('Hair_')) o.visible = o.name === 'Hair_' + hair; });
const outfit = q.get('outfit') || 'ranger';
model.traverse(o => { if (/^(Ranger|Warden)_/.test(o.name)) o.visible = o.name.toLowerCase().startsWith(outfit); });
// Preview tints, as the game applies them.
const tint = { M_Skin: q.get('skin') || '#c89365', M_Shirt: q.get('shirt') || '#476f59', M_Pants: q.get('pants') || '#594c3e', M_Hair: q.get('haircolor') || '#563b2b' };
model.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { const key = Object.keys(tint).find(k => m.name.startsWith(k)); if (key) m.color.set(tint[key]).multiplyScalar(key === 'M_Skin' ? 1.25 : 1.1); } });
for (const kv of (q.get('keys') || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':');
  model.traverse(o => { if (o.morphTargetDictionary && k in o.morphTargetDictionary) o.morphTargetInfluences[o.morphTargetDictionary[k]] = Number(v); });
}
const mixer = new THREE.AnimationMixer(model);
const rows = (q.get('clips') || 'rest@0').split(',').map(s => { const [name, t] = s.split('@'); return { name, t: Number(t || 0) }; });
const box = new THREE.Box3().setFromObject(model); const h = box.max.y - box.min.y;
const W = cell * views.length, H = cell * rows.length;
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.setScissorTest(true);
const cam = new THREE.PerspectiveCamera(q.has('face') ? 12 : 30, 1, .05, 50);
const dist = q.has('face') ? 2.4 : 5;
const lookY = q.has('face') ? 1.55 : h * .52;
const at = { front: [0, lookY, dist], side: [dist, lookY, 0], back: [0, lookY, -dist], quarter: [dist * .7, lookY + .3, dist * .7], left: [-dist, lookY, 0], top: [0, 5.5, .9] };
const labels = document.getElementById('labels');
const info = { clips: gltf.animations.map(a => `${a.name}:${a.duration.toFixed(2)}`), height: h.toFixed(3),
  meshes: [], morphs: [] };
model.traverse(o => { if (o.isMesh) { info.meshes.push(`${o.name}(${o.geometry.attributes.position.count})`); if (o.morphTargetDictionary) info.morphs.push(o.name + ':' + Object.keys(o.morphTargetDictionary).join('|')); } });
window.__info = info;
rows.forEach((row, r) => {
  mixer.stopAllAction();
  const clip = gltf.animations.find(a => a.name === row.name);
  if (clip) { const a = mixer.clipAction(clip); a.play(); a.paused = true; a.time = Math.min(row.t, clip.duration); mixer.update(0); }
  else model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  views.forEach((v, c) => {
    cam.position.set(...at[v]); cam.lookAt(0, lookY, 0);
    renderer.setViewport(c * cell, H - (r + 1) * cell, cell, cell); renderer.setScissor(c * cell, H - (r + 1) * cell, cell, cell);
    renderer.render(scene, cam);
    const s = document.createElement('span'); s.textContent = `${row.name} ${row.t} ${v}`;
    s.style.left = c * cell + 'px'; s.style.top = r * cell + 'px'; labels.appendChild(s);
  });
});
window.__labReady = true;
