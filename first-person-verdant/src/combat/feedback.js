import * as THREE from 'three';

// Short synthesized sounds, layered so each outcome is distinct by ear alone:
// a connecting strike thumps, a strike into bark knocks, a whiff only swishes.
export class CombatSound {
  constructor() { this.ctx = null; this.noise = null; }
  attach(ctx) {
    this.ctx = ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }
  tone(freq, dur, vol, type = 'sine', end = .5, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * end), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
  }
  hiss(dur, vol, from, to, q = 1, delay = 0, type = 'bandpass') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + .02);
  }
  swing(move) {                       // the air moving, pitched per strike
    const p = { palm: [1900, 700], swing: [1300, 420], heel: [900, 260] }[move] || [1500, 500];
    this.hiss(.16, .05, p[0], p[1], 1.4);
  }
  hit(move) {
    const heavy = move === 'heel';
    this.tone(heavy ? 70 : 96, heavy ? .3 : .18, heavy ? .22 : .15, 'triangle', .45);
    this.hiss(.07, heavy ? .16 : .11, 2600, 900, .8, 0, 'lowpass');
    this.tone(heavy ? 190 : 260, .06, .05, 'square', .6);
  }
  blocked() { this.tone(210, .09, .09, 'square', .55); this.hiss(.09, .08, 700, 300, 2); }
  whiff() { this.hiss(.1, .025, 2400, 1200, 1); }
  evade() { this.hiss(.2, .045, 900, 2200, .9); }
  evadedAttack() { this.tone(880, .22, .03, 'sine', 1.4); this.hiss(.22, .04, 1500, 3500, 1); }
  tired() { this.tone(150, .18, .05, 'sine', .7); }
  windup(kind) { this.tone(kind === 'thornling' ? 190 : 140, .6, .045, 'sawtooth', 2.1); this.hiss(.5, .02, 300, 900, 3); }
  lunge() { this.hiss(.25, .07, 500, 180, 1.2); this.tone(90, .2, .06, 'triangle', .6); }
  bite() { this.tone(120, .25, .16, 'sawtooth', .4); this.hiss(.12, .14, 1800, 500, 1); }
  alert() { this.tone(330, .12, .03, 'triangle', 1.3); }
  defeated() { this.tone(160, .6, .08, 'triangle', .35); this.tone(420, .4, .03, 'sine', 1.5, .2); }
}

/** Small, fast-fading particles. Nothing here obscures the fighters. */
export class ImpactEffects {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.spark = new THREE.MeshBasicMaterial({ color: 0xf2f0c8, transparent: true, depthWrite: false });
    this.chip = new THREE.MeshStandardMaterial({ color: 0x5d4a33, roughness: 1 });
    this.dust = new THREE.MeshBasicMaterial({ color: 0xcfc8a8, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.sparkGeo = new THREE.OctahedronGeometry(.045, 0); this.chipGeo = new THREE.BoxGeometry(.06, .03, .1);
    this.ringGeo = new THREE.RingGeometry(.55, .7, 28);
  }
  burst(point, dir, heavy) {
    const n = heavy ? 11 : 7;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.spark.clone()); m.position.copy(point);
      const v = new THREE.Vector3((Math.random() - .5) * 2, Math.random() * 1.4 + .3, (Math.random() - .5) * 2).add(dir.clone().multiplyScalar(-1.2)).multiplyScalar(heavy ? 3.2 : 2.4);
      this.scene.add(m); this.items.push({ mesh: m, v, life: .22 + Math.random() * .1, max: .3, gravity: 6 });
    }
    // A thin flash ring at the contact, turned toward the strike.
    const ring = new THREE.Mesh(this.ringGeo, this.spark.clone()); ring.position.copy(point);
    ring.lookAt(point.clone().add(dir)); ring.scale.setScalar(heavy ? .6 : .4);
    this.scene.add(ring); this.items.push({ mesh: ring, v: new THREE.Vector3(), life: .12, max: .12, grow: heavy ? 9 : 6 });
  }
  chips(point) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(this.chipGeo, this.chip); m.position.copy(point);
      const v = new THREE.Vector3((Math.random() - .5) * 2.5, Math.random() * 2 + .5, (Math.random() - .5) * 2.5);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.scene.add(m); this.items.push({ mesh: m, v, life: .45, max: .45, gravity: 9, spin: 12 });
    }
  }
  ring(point) {
    const m = new THREE.Mesh(this.ringGeo, this.dust.clone()); m.position.copy(point); m.position.y += .05; m.rotation.x = -Math.PI / 2;
    this.scene.add(m); this.items.push({ mesh: m, v: new THREE.Vector3(), life: .35, max: .35, grow: 3.5, flat: true });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.life -= dt;
      if (it.gravity) it.v.y -= it.gravity * dt;
      it.mesh.position.addScaledVector(it.v, dt);
      if (it.spin) { it.mesh.rotation.x += it.spin * dt; it.mesh.rotation.z += it.spin * dt; }
      if (it.grow) it.mesh.scale.multiplyScalar(1 + it.grow * dt);
      if (it.mesh.material.transparent) it.mesh.material.opacity = Math.max(0, it.life / it.max) * (it.flat ? .5 : 1);
      if (it.life <= 0) {
        this.scene.remove(it.mesh);
        if (it.mesh.material !== this.chip) it.mesh.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
