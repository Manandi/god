import * as THREE from 'three';
import { createAvatar } from './avatar.js';

// The character screen's live preview: the real block explorer (with the
// Blender hair and outfit pieces from avatar.js) on a small turntable, in its
// own canvas. It only renders while the character screen is open. Drag to turn.

export function createDressingRoom() {
  let renderer = null, avatar = null, spin = .6, dragging = null, host = null;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfffe8, 0x1a2a20, 1.4));
  const key = new THREE.DirectionalLight(0xfff0d6, 2.2); key.position.set(2.5, 4, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fe0c0, 1.1); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshStandardMaterial({ color: 0x1d3a2c, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 20);
  camera.position.set(0, 1.35, 6.2); camera.lookAt(0, 1.12, 0);

  function ensure() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    const el = renderer.domElement; el.className = 'dressing-canvas';
    el.addEventListener('pointerdown', e => { dragging = e.clientX; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (dragging === null || !avatar) return; avatar.root.rotation.y += (e.clientX - dragging) * .012; dragging = e.clientX; });
    el.addEventListener('pointerup', () => { dragging = null; });
    avatar = createAvatar(scene); avatar.root.position.set(0, 0, 0); avatar.root.rotation.y = .5;
  }
  return {
    /** Put the preview canvas into `el` (the character screen re-renders on every choice). */
    mount(el, appearance, weapon) {
      if (!el) return;
      ensure(); host = el; el.appendChild(renderer.domElement);
      avatar.setAppearance(appearance); if (weapon) avatar.setWeapon(weapon);
    },
    /** Face the preview a given way (radians; 0 faces the camera). Used by tests. */
    setAngle(a) { if (avatar) avatar.root.rotation.y = a; },
    update(dt) {
      if (!renderer || !host?.isConnected) return;
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      const c = renderer.domElement;
      if (c.width !== Math.round(w * renderer.getPixelRatio()) || c.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      if (dragging === null) avatar.root.rotation.y += dt * spin;
      avatar.update(dt, () => 0);
      renderer.render(scene, camera);
    }
  };
}
