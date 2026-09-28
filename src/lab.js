// Development-only pose lab: renders clips at chosen times from several angles
// so animation can be checked without playing. Open /lab.html?clips=palm,swing
import * as THREE from 'three';
import { createAvatar } from './avatar.js';
import { clip } from './anim/pose.js';

const q = new URLSearchParams(location.search);
const names = q.get('poses') ? JSON.parse(q.get('poses')).map((_, i) => 'test' + i) : (q.get('clips') || 'guard,palm').split(',');
const views = (q.get('views') || 'front,side,back,top').split(',');
const samples = Number(q.get('samples') || 6);
const cell = Number(q.get('cell') || 220);
const canvas = document.getElementById('lab');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a3530');
scene.add(new THREE.HemisphereLight(0xdfeee8, 0x3b4a33, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 4); scene.add(sun);
const grid = new THREE.GridHelper(6, 12, 0x6c7f70, 0x3f4d45); scene.add(grid);
const avatar = createAvatar(scene);
// ?poses=[{...},{...}] renders raw test poses as extra one-frame clips.
const extra = q.get('poses') ? JSON.parse(q.get('poses')) : [];
extra.forEach((pose, i) => { const c = clip('test' + i, [{ t: 0, pose }, { t: 1, pose }]); const a = avatar.animator.mixer.clipAction(c); a.play(); a.paused = true; a.setEffectiveWeight(0); avatar.animator.actions[c.name] = a; });
avatar.setAppearance({ skinIndex: 2, shirt: 'moss', pants: 'charcoal', hairColor: 'earth', hairStyle: 'short', face: 'soft' });
const rows = [];
for (const name of names) {
  const d = avatar.animator.duration(name);
  const loop = /^(idle|guard|run|walk|guard_|air|sit|pose|wave|cheer)/.test(name);
  const ts = q.get('times') ? q.get('times').split(',').map(Number) : Array.from({ length: samples }, (_, i) => d * i / (samples - (loop ? 0 : 1)));
  for (const t of ts) rows.push({ name, t: Math.min(t, d), loop });
}
const W = cell * views.length, H = cell * rows.length;
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.setScissorTest(true);
const cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
const at = { front: [0, 1.1, -5.2], side: [5.2, 1.1, 0], back: [0, 1.1, 5.2], top: [.01, 6.5, -1.2], quarter: [3.6, 1.6, -3.6] };
const labels = document.getElementById('labels');
rows.forEach((row, r) => {
  const a = avatar.animator;
  if (row.loop) { a.stop(); a.setLocomotion({ [row.name]: 1 }, 0); a.phase = row.t / a.duration(row.name); a.fading = []; a.locoWeight = { [row.name]: 1 }; }
  else { a.setLocomotion({ guard: 1 }, 0); a.locoWeight = { guard: 1 }; a.current = { name: row.name, time: row.t }; a.actionWeight = 1; a.fading = []; }
  // Freeze the smoothing so each render shows exactly this sample.
  const damp = THREE.MathUtils.damp; THREE.MathUtils.damp = (x, y) => y;
  avatar.update(1 / 60);
  THREE.MathUtils.damp = damp;
  views.forEach((v, c) => {
    cam.position.set(...at[v]); cam.lookAt(0, v === 'top' ? 0 : 1.0, 0);
    renderer.setViewport(c * cell, H - (r + 1) * cell, cell, cell); renderer.setScissor(c * cell, H - (r + 1) * cell, cell, cell);
    renderer.render(scene, cam);
    const s = document.createElement('span'); s.textContent = `${row.name} ${row.t.toFixed(2)} ${v}`;
    s.style.left = c * cell + 'px'; s.style.top = r * cell + 'px'; labels.appendChild(s);
  });
});
window.__labReady = true;
