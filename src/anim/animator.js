import * as THREE from 'three';

const damp = THREE.MathUtils.damp;

/**
 * Drives a skinned figure from AnimationClips. Nothing here advances time on
 * its own: gameplay code tells the animator which clip is at which moment, so
 * the pose on screen is always the pose the combat code is judging.
 *
 * Two layers:
 *  - locomotion: several looping clips blended by weight on a shared phase
 *  - action: one-shot clips (strikes, evades, reactions, emotes) that override
 *    locomotion, with short cross-fades between them.
 */
export class Animator {
  constructor(figure, clips) {
    this.mixer = new THREE.AnimationMixer(figure);
    this.actions = {};
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      a.play();
      a.paused = true;
      a.setEffectiveWeight(0);
      this.actions[c.name] = a;
    }
    this.loco = {};          // name -> target weight
    this.locoWeight = {};    // name -> smoothed weight
    this.phase = 0;          // 0..1 shared locomotion phase
    this.current = null;     // {name,time}
    this.actionWeight = 0;
    this.fading = [];        // [{name,time,weight}]
    this.fadeIn = 12;
  }
  duration(name) { return this.actions[name]?.getClip().duration ?? 0; }
  has(name) { return !!this.actions[name]; }

  setLocomotion(weights, phaseStep) {
    this.loco = weights;
    this.phase = (this.phase + phaseStep) % 1;
  }

  /** Show `name` at `time` seconds. Switching clips cross-fades from the old one. */
  play(name, time, fadeIn = 12) {
    if (this.current && this.current.name !== name) {
      this.fading.push({ name: this.current.name, time: this.current.time, weight: this.actionWeight });
      this.actionWeight = Math.min(this.actionWeight, 1);
    }
    if (!this.current || this.current.name !== name) this.fadeIn = fadeIn;
    this.current = { name, time };
  }
  stop() {
    if (this.current) this.fading.push({ name: this.current.name, time: this.current.time, weight: this.actionWeight });
    this.current = null;
  }

  update(dt) {
    for (const a of Object.values(this.actions)) a.setEffectiveWeight(0);
    // An incoming action takes over from locomotion quickly; the outgoing one decays.
    this.actionWeight = damp(this.actionWeight, this.current ? 1 : 0, this.current ? this.fadeIn : 10, dt);
    if (this.current && this.actionWeight > .985) this.actionWeight = 1;
    this.fading = this.fading.filter(f => (f.weight = damp(f.weight, 0, 16, dt)) > .01);
    const act = this.current ? this.actionWeight : 0;
    const fixed = act + this.fading.reduce((sum, f) => sum + f.weight, 0);
    const k = fixed > 1 ? 1 / fixed : 1;           // weights always total 1, so the
    const locoShare = Math.max(0, 1 - fixed * k);  // pose never sags toward rest
    let locoSum = 0;
    for (const name of Object.keys(this.actions)) {
      this.locoWeight[name] = damp(this.locoWeight[name] || 0, this.loco[name] || 0, 14, dt);
      locoSum += this.locoWeight[name];
    }
    for (const [name, w] of Object.entries(this.locoWeight)) {
      if (w < .001 || !locoSum) continue;
      const a = this.actions[name];
      a.time = this.phase * a.getClip().duration;
      a.setEffectiveWeight(locoShare * w / locoSum);
    }
    const show = (name, time, weight) => {
      const a = this.actions[name];
      a.time = Math.min(time, a.getClip().duration - 1e-4);
      a.setEffectiveWeight(a.getEffectiveWeight() + weight);
    };
    for (const f of this.fading) show(f.name, f.time, f.weight * k);
    if (this.current) show(this.current.name, this.current.time, act * k);
    this.mixer.update(0);
  }
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();

function rotateBoneToward(bone, from, to) {
  // Rotate `bone` in world space so that the direction `from` becomes `to`.
  qa.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  bone.getWorldQuaternion(qb);
  qc.copy(qa).multiply(qb);                               // desired world rotation
  bone.parent.getWorldQuaternion(qb).invert();
  bone.quaternion.copy(qb.multiply(qc));
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone leg IK used after animation: keeps the animated stride but moves
 * each ankle by `lift` metres vertically so feet meet sloped ground instead of
 * floating over or sinking into it. The knee keeps bending the way the
 * animation bent it; the foot keeps its animated world orientation.
 */
export function solveLeg(upLeg, leg, foot, lift) {
  if (Math.abs(lift) < .002) return;
  const hip = upLeg.getWorldPosition(v1), knee = leg.getWorldPosition(v2), ankle = foot.getWorldPosition(v3);
  const footWorld = foot.getWorldQuaternion(new THREE.Quaternion());
  const target = ankle.clone(); target.y += lift;
  const a = hip.distanceTo(knee), b = knee.distanceTo(ankle);
  const toTarget = target.clone().sub(hip);
  const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = toTarget.normalize();
  // Pole: the side the knee already points toward.
  const pole = knee.clone().sub(hip); pole.addScaledVector(dir, -pole.dot(dir));
  if (pole.lengthSq() < 1e-8) pole.set(0, 0, -1); pole.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const newKnee = hip.clone().addScaledVector(dir, cosA * a).addScaledVector(pole, sinA * a);
  rotateBoneToward(upLeg, v4.copy(knee).sub(hip), newKnee.clone().sub(hip));
  const kneeNow = leg.getWorldPosition(new THREE.Vector3()), ankleNow = foot.getWorldPosition(new THREE.Vector3());
  const hipToTarget = hip.clone().addScaledVector(dir, d);
  rotateBoneToward(leg, ankleNow.sub(kneeNow), hipToTarget.sub(kneeNow));
  foot.parent.getWorldQuaternion(qb).invert();
  foot.quaternion.copy(qb.multiply(footWorld));
  foot.updateMatrixWorld(true);
}
