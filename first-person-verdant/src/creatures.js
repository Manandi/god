import * as THREE from 'three';
import { groundY, SHADOWMERE, GARROW_SEAL } from './world.js';
import { canOccupy } from './collision.js';
import { angleTo } from './angles.js';
import { level } from './profile.js';

const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x556f3b, roughness: .92, flatShading: true });
const scuteMaterial = new THREE.MeshStandardMaterial({ color: 0x9aaa5c, roughness: .9, flatShading: true });
const skinMaterial = new THREE.MeshStandardMaterial({ color: 0x7b9963, roughness: .92, flatShading: true });
const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x293c31, roughness: 1 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xf0d397, emissive: 0x594322, roughness: .3 });
const thornMaterial = new THREE.MeshStandardMaterial({ color: 0x758e47, roughness: .9, flatShading: true });
const sphere = (radius = 1) => new THREE.IcosahedronGeometry(radius, 1);
function part(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const damp = THREE.MathUtils.damp;

// Behaviour tuning per kind. Times in seconds, distances in metres.
// Health is for a level 1 explorer: a shellback falls to about two light
// strings, or one string and a heavy. Each explorer level adds 15% (not the bosses).
const KINDS = {
  shellback: { size: .64, pace: 1, health: 45, poise: 12, walk: 1.0, chase: 2.3, turn: 3.2, notice: 12, spacing: 2.4, cooldown: [1.0, 2.0], biteRadius: .42 },
  thornling: { size: .57, pace: .8, health: 32, poise: 9, walk: 1.2, chase: 3.0, turn: 4.2, notice: 12, spacing: 2.2, cooldown: [.8, 1.6], biteRadius: .38 },
  monkey: { size: .82, pace: .78, health: 50, poise: 12, walk: 1.9, chase: 4.3, turn: 6, notice: 16, spacing: 2.1, cooldown: [.55, 1.15], biteRadius: .5 },
  // Garrow, Shadowmere's boss (owner, 2026-10-07: "a boss quest again, an entire massive moveset plus a phase 2").
  gorilla: { size: 1.22, pace: 1.06, health: 360, poise: 34, walk: .9, chase: 3.0, turn: 2.8, notice: 24, spacing: 3.1, cooldown: [.95, 1.7], biteRadius: .8 },
  // The Old Shell (a big armoured variant from the ChatGPT Sites version) was removed
  // from the game on the owner's request; its isBoss / quake code paths below are unused.
};
// The moveset. Each attack: wind-up (the telegraph), active, recovery (the
// punish window). `track` is how long the wind-up keeps turning toward the
// explorer before committing. `kind` decides the explorer's reaction:
// light → flinch (hyper-armour holds), heavy → knockdown.
const ATTACKS = {
  lunge: { windup: .82, track: .46, active: .3, recover: 1.12, range: [1.5, 3.4], damage: 1, kind: 'light', label: 'shell lunge' },
  spin:  { windup: .65, track: 0, active: 1.0, recover: 1.1, range: [0, 2.4], damage: 1, kind: 'light', label: 'shell spin' },
  slam:  { windup: .85, track: .55, active: .44, recover: 1.2, range: [.6, 2.9], damage: 2, kind: 'heavy', label: 'root slam' },
  // Old Shell only: rears for over a second, then the ground breaks around it.
  quake: { windup: 1.28, track: .4, active: .3, recover: 1.4, range: [0, 5.8], damage: 2, kind: 'heavy', label: 'quake', boss: true },
  // Green monkeys only (owner, 2026-10-05: "a new combo, harder, more unique"; 2026-10-07: "not the
  // turtle dash, their own attack"). The vine swing replaced the lunge and often chains into the flurry.
  // Claw flurry: three quick swipes, stepping in and re-aiming between them. Guard each, parry one
  // to break the chain, or back out of reach.
  flurry: { windup: .5, track: .5, active: 1.08, recover: .95, range: [0, 2.6], damage: 1, kind: 'light', label: 'claw flurry', monkey: true, swipes: [.1, .44, .78] },
  // Leaping pounce: crouches, then leaps to where you stood and lands claws-first. Dodge sideways.
  pounce: { windup: .72, track: .64, active: .62, recover: 1.05, range: [3.6, 8.5], damage: 1, kind: 'heavy', label: 'leaping pounce', monkey: true },
  // Seed pellet: hurls a hard seed from range (main.js flies it). Dash through, guard, or parry it away.
  seed: { windup: .62, track: .62, active: .22, recover: .8, range: [5.5, 13], damage: 1, kind: 'light', label: 'seed pellet', monkey: true },
  // Vine swing: grabs a vine from the canopy, swings round you and kicks you from the side, landing
  // behind you. Turn and guard (lock-on helps), dash, or step out of the circle it marked.
  swing: { windup: .62, track: .62, active: 1.0, recover: .85, range: [2.2, 7.5], damage: 1, kind: 'heavy', label: 'vine swing', monkey: true },
  // Garrow only. `phase: 2` moves open once the crown-glass takes hold (below half health).
  // Cleaver chop: the blade comes down in a line in front of it. Step aside.
  chop: { windup: .95, track: .62, active: .42, recover: 1.1, range: [0, 4.2], damage: 2, kind: 'heavy', label: 'cleaver chop', gorilla: true, line: [.5, 4.1, .6] },
  // Backhand: a fast sweep of the free fist across its front. Back off or guard.
  backhand: { windup: .55, track: .45, active: .32, recover: .8, range: [0, 3.3], damage: 1, kind: 'light', label: 'backhand sweep', gorilla: true, phase1: true },
  // Knuckle charge: down on all fours across the clearing. Sidestep late; into a tree it dazes itself.
  charge: { windup: .85, track: .8, active: 1.45, recover: 1.0, range: [5, 16], damage: 2, kind: 'heavy', label: 'knuckle charge', gorilla: true, line: [0, 13, 1.1] },
  // Double ground pound: two shockwaves, one after the other. Jump or dash through each.
  pound: { windup: 1.0, track: .5, active: 1.05, recover: 1.15, range: [0, 4.6], damage: 1, kind: 'heavy', label: 'double ground pound', gorilla: true, rings: [.02, .57], ring: [.8, 4.6, .45] },
  // Boulder hurl: rips up a mossy stone and lobs it where you stand (main.js flies it).
  boulder: { windup: 1.05, track: 1.0, active: .3, recover: .95, range: [6, 20], damage: 2, kind: 'heavy', label: 'boulder hurl', gorilla: true, phase1: true },
  // Chest-drum roar: everyone close is knocked off balance. Dash through it, then punish or get punished.
  roar: { windup: .9, track: .9, active: .5, recover: .45, range: [0, 7], damage: 0, kind: 'light', label: 'chest-drum roar', gorilla: true, reach: 7, phase1: true },
  // Crown-glass combo: chop, backhand, rising cut, stepping in between. Guard all three or get out.
  combo: { windup: .7, track: .55, active: 1.5, recover: 1.15, range: [0, 3.6], damage: 1, kind: 'light', label: 'crown-glass combo', gorilla: true, phase: 2, swipes: [.12, .6, 1.08] },
  // Leaping cleave: lands on you, and crystal spikes burst out in a line ahead. Dodge sideways.
  leap: { windup: .9, track: .85, active: 1.0, recover: 1.25, range: [4, 15], damage: 2, kind: 'heavy', label: 'leaping cleave', gorilla: true, phase: 2 },
  // Rootglass eruption: the cleaver goes into the ground and crystal bursts up where you stand,
  // three times. Keep moving.
  erupt: { windup: .8, track: .8, active: 1.75, recover: .95, range: [0, 16], damage: 1, kind: 'heavy', label: 'crown-glass eruption', gorilla: true, phase: 2, marks: [0, .5, 1.0], fuse: .7 },
  // Shard barrage: tears three crystals off its own back and throws them in a fan. Dash or guard.
  barrage: { windup: .85, track: .85, active: .4, recover: .9, range: [5, 18], damage: 1, kind: 'light', label: 'shard barrage', gorilla: true, phase: 2 },
  // Crown-glass whirl: blade held out, two full turns while it walks you down. Back away.
  whirl: { windup: .7, track: .7, active: 1.4, recover: 1.2, range: [0, 4.6], damage: 1, kind: 'light', label: 'crown-glass whirl', gorilla: true, phase: 2, reach: 3.2 },
  // Crushing grab: unblockable. It lunges with its open hand; caught, you are slammed into the ground.
  // Dodge it, and a miss leaves it wide open.
  grab: { windup: .75, track: .7, active: 1.2, recover: 1.45, range: [0, 3.8], damage: 2, kind: 'heavy', label: 'crushing grab', gorilla: true, phase: 2 }
};
const GORILLA_PHASE_AT = .5, PHASE_TIME = 2.8, DAZE_TIME = 1.8;
const QUAKE_RADIUS = 5.2, SHELL_BREAK = 130;
const PART_DAMAGE = { head: 1.3, shell: .8, belly: 2, crystal: 1.2 };
// Taunts (owner, 2026-10-09): after landing a blow a monkey or Garrow may stop to show off. A free opening.
const TAUNT = { monkey: [.4, 1.3], gorilla: [.45, 1.7] }, TAUNT_DAMAGE = 1.3, CRYSTAL_BREAK = .12;
const healthFor = (type, k) => type === 'oldshell' ? k.health : Math.round(k.health * (1 + (level() - 1) * .15));
const EMERGE_TIME = 1.3, ENRAGE_AT = .4, TOPPLE_TIME = 3.2, RISE_TIME = .6, REEL_TIME = 1.7, LEASH = 24;
// The slam's shockwave: radius over time. Dashing through it is safe; dashing
// away works only if you start early.
export const SHOCKWAVE = { start: .02, duration: .4, from: .5, to: 3.1 };
const shockwaveRadius = t => SHOCKWAVE.from + (SHOCKWAVE.to - SHOCKWAVE.from) * Math.min(1, Math.max(0, (t - SHOCKWAVE.start) / SHOCKWAVE.duration));

function buildPrimateVisual(c) {
  const big=c.type==='gorilla', bodyMat=new THREE.MeshStandardMaterial({color:big?0x173b2c:0x347b37,roughness:.94,flatShading:true}),
    lightMat=new THREE.MeshStandardMaterial({color:big?0x285943:0x6d9b45,roughness:.95,flatShading:true}),
    faceMat=new THREE.MeshStandardMaterial({color:big?0x3c4536:0x8d704c,roughness:.92,flatShading:true}),
    goldEye=new THREE.MeshStandardMaterial({color:0xf0cb69,emissive:0x67420a,emissiveIntensity:.7,roughness:.28}),
    leather=new THREE.MeshStandardMaterial({color:0x4a3020,roughness:1}),rootglass=new THREE.MeshStandardMaterial({color:0x8be2b5,emissive:0x174d35,emissiveIntensity:.85,metalness:.3,roughness:.28}),seedMat=new THREE.MeshStandardMaterial({color:0x8d6129,roughness:.85});
  c.body.clear();c.shellMat=bodyMat;c.skinMat=faceMat;c.eyeMat=goldEye;c.legs=[];c.arms=[];
  const torso=part(c.body,sphere(),bodyMat,0,1.02,0,big?.72:.46,big?.83:.60,big?.50:.39);
  if(big){
    part(c.body,sphere(),lightMat,0,1.6,-.05,.82,.42,.53);
    for(let i=0;i<7;i++){const leaf=part(c.body,new THREE.ConeGeometry(.25,.8,4),lightMat,Math.cos(i*.9)*.56,1.77,Math.sin(i*.9)*.42);leaf.rotation.z=Math.cos(i*.9)*.8;}
    const belt=part(c.body,new THREE.CylinderGeometry(.63,.68,.16,12),leather,0,.84,0);belt.rotation.x=0;
    for(let i=0;i<3;i++)part(c.body,sphere(.19),seedMat,-.34+i*.34,.85,.47,.8,1.2,.8);
    // Oversized rootglass cleaver is attached to the right hand and reads at distance.
    const sword=new THREE.Group();sword.position.set(.78,1.22,.2);sword.rotation.z=-.27;c.body.add(sword);
    part(sword,new THREE.CylinderGeometry(.075,.095,.52,8),leather,0,0,0);
    const guard=part(sword,new THREE.BoxGeometry(.48,.1,.13),leather,0,.28,0);guard.rotation.z=-.12;
    const blade=part(sword,new THREE.BoxGeometry(.31,1.35,.12),rootglass,.03,.98,0);blade.rotation.z=-.12;
    part(sword,new THREE.ConeGeometry(.19,.38,4),rootglass,.03,1.83,0).rotation.z=Math.PI;
    c.sword=sword;
  }
  c.neck=new THREE.Group();c.neck.position.set(0,big?1.58:1.28,0);c.body.add(c.neck);
  c.head=new THREE.Group();c.neck.add(c.head);
  part(c.head,sphere(),bodyMat,0,.28,.04,big?.54:.38,big?.54:.4,big?.46:.36);
  part(c.head,sphere(),faceMat,0,.08,.39,big?.35:.25,big?.22:.16,big?.17:.11);
  for(const side of [-1,1]){
    part(c.head,sphere(.14),faceMat,side*(big?.52:.36),.3,0,1,1.15,.55);
    part(c.head,sphere(.07),goldEye,side*(big?.19:.15),.36,.36,.8,.95,.48);
    part(c.head,sphere(.034),darkMaterial,side*(big?.19:.15),.36,.4);
  }
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*(big?.63:.39),big?1.45:1.12,0);c.body.add(arm);
    part(arm,sphere(),big?lightMat:bodyMat,side*.08,-.34,.02,big?.32:.19,big?.58:.43,big?.28:.21);
    part(arm,sphere(),faceMat,side*.12,-.7,.18,big?.3:.17,big?.25:.16,big?.3:.18);
    c.arms.push({mesh:arm,side});
    const leg=new THREE.Group();leg.position.set(side*(big?.36:.19),.55,-.02);c.body.add(leg);
    part(leg,sphere(),bodyMat,0,-.2,.02,big?.29:.18,big?.42:.33,big?.31:.26);
    part(leg,sphere(),faceMat,0,-.42,.19,big?.34:.24,.13,.4);
    c.legs.push({mesh:leg,phase:side===1?0:Math.PI});
  }
  if(!big){
    const tail=new THREE.Group();tail.position.set(0,.87,-.31);c.body.add(tail);
    for(let i=0;i<4;i++){const piece=part(tail,new THREE.CylinderGeometry(.06-i*.008,.085-i*.008,.33,7),bodyMat,0,.14+i*.09,-i*.12);piece.rotation.x=-.55-i*.2;}
    c.tail=tail;
  }
  c.body.updateMatrixWorld(true);
}

/**
 * A creature driven by explicit states:
 *   wander → alert → approach ⇄ circle → windup(attack) → attack → recover → …
 *   hits wear down poise; at zero it topples onto its back (belly exposed,
 *   Root Strike open), then rises. Heavy hits or enough damage make it
 *   stagger; light hits alone never cancel a committed attack.
 *   Below 40% health it enrages: shorter wind-ups and cooldowns.
 */
export class Creature {
  constructor(scene, x, z, type = 'shellback', options = {}) {
    const k = KINDS[type];
    this.kind = k; this.type = type; this.home = { x, z }; this.x = x; this.z = z;
    this.maxHealth = healthFor(type, k); this.health = this.maxHealth; this.alive = true;
    this.poise = k.poise; this.poiseDelay = 0; this.flinchMeter = 0;
    this.respawnDelay = options.respawn ?? 0;
    this.id = options.id || null; this.chapter = options.chapter || null;
    this.isBoss = type === 'oldshell'; this.isMajorEnemy = type === 'gorilla'; this.bossBar = type === 'gorilla'; this.phase = 1; this.hits = new Set(); this.name = this.isBoss ? 'THE OLD SHELL' : this.isMajorEnemy ? 'ROOTBOUND GORILLA' : ''; this.shellDamage = 0; this.shellBroken = false;
    if (this.isBoss) { this.markerHeight = 3.6; this.focusHeight = 1.6; }
    if (this.isMajorEnemy) { this.markerHeight = 4.2; this.focusHeight = 1.8; }
    this.heading = Math.random() * Math.PI * 2; this.speed = 0;
    this.state = 'wander'; this.t = 0; this.cooldown = 1; this.wanderTurn = 0;
    this.attack = null; this.attackYaw = 0; this.connected = false; this.enraged = false; this.combo = false;
    this.push = { x: 0, z: 0 }; this.flash = 0; this.shake = 0; this.jolt = { pitch: 0, roll: 0 };
    this.radius = 1.15 * k.size; this.legPhase = 0; this.spinAngle = 0;
    this.lastEvent = '';
    this.root = new THREE.Group(); scene.add(this.root);
    this.tilt = new THREE.Group(); this.root.add(this.tilt);       // follows the slope
    this.body = new THREE.Group(); this.tilt.add(this.body);       // rears, lunges, flinches
    this.root.scale.setScalar(k.size);
    this.shellMat = shellMaterial.clone(); this.skinMat = skinMaterial.clone(); this.eyeMat = eyeMaterial.clone();
    this.bossScuteMat = this.isBoss ? new THREE.MeshStandardMaterial({ color: 0x8e5636, emissive: 0x45140c, emissiveIntensity: .55, roughness: .88, flatShading: true }) : scuteMaterial;
    part(this.body, sphere(), this.skinMat, 0, .95, 0, 1.28, .58, 1.8);
    this.shell = part(this.body, new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.shellMat, 0, 1.05, -.27, 1.43, 1.22, 1.65);
    if(this.isBoss){
      this.shellMat.color.setHex(0x28372d);this.shellMat.emissive.setHex(0x160b08);this.eyeMat.color.setHex(0xff5b27);
      // A crown of asymmetric, charred shell-spines gives the Old Shell the
      // exaggerated anime silhouette the distant encounter needs.
      for(let i=0;i<13;i++){const a=i/13*Math.PI*2,r=.78+(i%3)*.11,spike=part(this.body,new THREE.ConeGeometry(.16+(i%2)*.06,.72+(i%4)*.18,5),this.bossScuteMat,Math.sin(a)*r,1.8+Math.cos(a)*.22,Math.cos(a)*r-.34);spike.rotation.set(Math.cos(a)*.48,0,-Math.sin(a)*.48);}
      const ridge=part(this.body,new THREE.TorusGeometry(.88,.09,5,14),this.bossScuteMat,0,1.8,-.34);ridge.rotation.x=Math.PI/2;
      this.bossAura=new THREE.PointLight(0xff4b25,2.8,13,2);this.bossAura.position.set(0,1.65,.4);this.body.add(this.bossAura);
    }

    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, r = .82 + .24 * (i % 2);
      const q = part(this.body, sphere(.23), this.bossScuteMat, Math.cos(a) * r, 1.89 - Math.abs(Math.cos(a)) * .17, Math.sin(a) * r - .25, 1.4, .55, 1.1); q.rotation.y = a;
    }
    this.legs = [];
    for (const xSide of [-1, 1]) for (const zSide of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(xSide * .86, .76, zSide * .89); this.body.add(leg);
      part(leg, sphere(.48), this.skinMat, xSide * .13, -.18, .14, .65, 1, .85);
      part(leg, sphere(.37), darkMaterial, xSide * .12, -.51, .32, .8, .34, 1.25);
      this.legs.push({ mesh: leg, phase: xSide * zSide > 0 ? 0 : Math.PI });
    }
    this.neck = new THREE.Group(); this.neck.position.set(0, 1.2, 1.2); this.body.add(this.neck);
    this.head = new THREE.Group(); this.neck.add(this.head);
    part(this.head, sphere(.65), this.skinMat, 0, 0, .36, 1.02, .78, 1.18);
    for (const xEye of [-.38, .38]) {
      part(this.head, sphere(.11), this.eyeMat, xEye, .23, .92);
      part(this.head, sphere(.05), darkMaterial, xEye, .23, 1.005);
    }
    if(this.isBoss){
      this.head.scale.set(1.18,1.05,1.2);
      const jaw=part(this.head,new THREE.BoxGeometry(1.02,.22,.62),darkMaterial,0,-.27,.62);jaw.rotation.x=-.08;this.bossJaw=jaw;
      for(const side of [-1,1]){
        const brow=part(this.head,new THREE.ConeGeometry(.13,.68,4),this.bossScuteMat,side*.34,.48,.66);brow.rotation.z=side*.92;brow.rotation.x=-.35;
        const tusk=part(this.head,new THREE.ConeGeometry(.09,.5,5),new THREE.MeshStandardMaterial({color:0xd9c595,roughness:.8}),side*.38,-.23,.96);tusk.rotation.x=Math.PI*.48;tusk.rotation.z=side*.15;
      }
      const scar=part(this.head,new THREE.BoxGeometry(.055,.48,.025),new THREE.MeshBasicMaterial({color:0xff6b38}),-.16,.2,1.03);scar.rotation.z=-.38;
    }
    if (type === 'thornling') {
      for (let i = -1; i <= 1; i++) { const thorn = part(this.body, new THREE.ConeGeometry(.25, .85, 5), thornMaterial, i * .7, 2.0, -.4); thorn.rotation.z = i * .24; }
      for (let i = 0; i < 4; i++) { const leaf = part(this.body, new THREE.ConeGeometry(.28, .8, 4), thornMaterial, (i % 2 ? 1 : -1) * 1.0, 1.5, i < 2 ? -.9 : .35); leaf.rotation.z = (i % 2 ? 1 : -1) * .6; }
    }
    if(type==='monkey'||type==='gorilla')buildPrimateVisual(this);
    // Health bar, only shown while the creature is hurt or targeted.
    this.bar = new THREE.Group(); this.bar.position.set(0, 2.9, 0); this.root.add(this.bar);
    const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .12), new THREE.MeshBasicMaterial({ color: 0x14201a, transparent: true, opacity: .7, depthTest: false }));
    this.barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.52, .07), new THREE.MeshBasicMaterial({ color: 0xd6c07a, depthTest: false }));
    this.barFill.position.z = .001; barBack.renderOrder = 10; this.barFill.renderOrder = 11;
    this.bar.add(barBack, this.barFill); this.bar.visible = false;
    // Ground-level tell survives camera angle changes. Amber builds during
    // tracking, red marks the committed attack, pale green marks recovery.
    this.tell = new THREE.Mesh(new THREE.RingGeometry(.82, .91, 32), new THREE.MeshBasicMaterial({ color: 0xe9ad62, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.tell.rotation.x = -Math.PI / 2; this.tell.visible = false; scene.add(this.tell);
    if (type === 'gorilla') {
      // A strip on the ground for Garrow's line attacks (the chop, the charge, the spike line).
      this.lineTell = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xe9ad62, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      this.lineTell.rotation.order = 'YXZ'; this.lineTell.visible = false; scene.add(this.lineTell);
    }
    if (type === 'monkey') {
      // The vine it swings on, from the canopy to its hand.
      this.vine = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 1, 6), new THREE.MeshStandardMaterial({ color: 0x6aa040, emissive: 0x24420f, emissiveIntensity: .8, roughness: .9 }));
      this.vine.visible = false; scene.add(this.vine);
    }
    this.place();
  }
  get toppled() { return this.state === 'toppled'; }
  /** Open to a Root Strike: on its back, or reeling from a parry. */
  get exposed() { return this.state === 'toppled' || this.state === 'reeling' || this.state === 'dazed'; }
  /** A parried attack: the creature recoils and is open to a riposte. */
  deflect() {
    if (!this.alive || this.state !== 'attack') return false;
    this.attack = null; this.poise = Math.max(1, this.poise - 5); this.poiseDelay = 3;
    this.setState('reeling'); this.flash = .1; this.lastEvent = 'PARRIED';
    return true;
  }
  /** Hurt volumes in world space. Upright: shell (two spheres) and head. On its back: the belly.
   *  Small creatures' volumes reach up (`up`) to meet strikes thrown at chest height. */
  hurtVolumes() {
    const out = this.volumes();
    if (!this.isBoss) for (const v of out) v.up = .6;
    return out;
  }
  volumes() {
    const s = this.kind.size, out = [], f = new THREE.Vector3();
    if (this.state === 'toppled' || this.state === 'rising') {
      // On its back only the belly is offered; the head is tucked against the ground.
      f.set(0, 1.0, -.2).applyMatrix4(this.body.matrixWorld); out.push({ x: f.x, y: f.y, z: f.z, r: 1.15 * s, part: 'belly' });
      return out;
    } else if(this.type==='monkey'||this.type==='gorilla'){
      // The gorilla is tall: a belly-and-hips volume where blades land, and its chest above.
      if(this.type==='gorilla')for(const [y,z,r] of [[1.0,.1,.98],[1.85,.15,.9]]){f.set(0,y,z).applyMatrix4(this.body.matrixWorld);out.push({x:f.x,y:f.y,z:f.z,r:r*s,part:'body'});}
      if(this.type==='gorilla'&&this.phase>1&&!this.crystalsBroken){f.set(0,1.7,-.75).applyMatrix4(this.body.matrixWorld);out.push({x:f.x,y:f.y,z:f.z,r:.72*s,part:'crystal'});}
      else{f.set(0,1.0,0).applyMatrix4(this.body.matrixWorld);out.push({x:f.x,y:f.y,z:f.z,r:.5*s,part:'body'});}
    } else {
      for (const [z, r] of [[.45, .98], [-.75, .98]]) {
        f.set(0, 1.05, z).applyMatrix4(this.body.matrixWorld); out.push({ x: f.x, y: f.y, z: f.z, r: r * s, part: 'shell' });
      }
    }
    this.head.getWorldPosition(f); f.addScaledVector(this.forward(), .35 * s);
    out.push({ x: f.x, y: f.y, z: f.z, r: .52 * s, part: 'head' });
    return out;
  }
  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  place() {
    this.root.position.set(this.x, groundY(this.x, this.z), this.z);
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld(true);
  }
  setState(state) { this.state = state; this.t = 0; }
  timing(a) { const m = (this.enraged ? .78 : 1) * this.kind.pace * (this.quick && a.swipes ? .6 : 1); return { windup: a.windup * m, recover: a.recover * (this.enraged ? .85 : 1) * this.kind.pace, track: a.track * m }; }

  /**
   * A strike from the explorer. Returns what happened so the game can show it:
   * { damage, effect: 'weak'|'armored'|'belly'|'normal', toppled, defeated, staggered }
   */
  hit({ damage, poise, fromX, fromZ, push, stagger, part, pierce = 0 }) {
    if (!this.alive) return null;
    // Caught showing off: blows land harder and break its footing faster.
    if (this.state === 'taunt') { damage *= TAUNT_DAMAGE; poise *= 1.5; }
    // Garrow shrugs off blows while the crown-glass takes hold.
    if (this.state === 'phase') { this.flash = .05; this.lastEvent = 'unharmed (phase change)'; return { damage: 0, effect: 'armored', toppled: false, defeated: false, staggered: false }; }
    const onBack = this.state === 'toppled' || this.state === 'rising';
    // Armour-piercing weapons (the Stonebreaker) turn shell hits into full hits.
    let mult = PART_DAMAGE[part] ?? 1;
    // The Old Shell's armour turns more aside until enough shell hits crack it.
    if (this.isBoss && part === 'shell') mult = this.shellBroken ? 1 : .5;
    if (mult < 1 && pierce) mult = Math.min(1, mult * (1 + pierce));
    const dealt = damage * mult;
    this.health = Math.max(0, this.health - dealt);
    if (this.isBoss && part === 'shell' && !this.shellBroken) {
      this.shellDamage += damage * (1 + pierce);
      if (this.shellDamage >= SHELL_BREAK) {
        this.shellBroken = true; this.enraged = true; this.enragedNow = true; this.brokeNow = true;
        this.shellMat.color.setHex(0x58473d); this.bossScuteMat.color.setHex(0x3d332e); this.bossScuteMat.emissiveIntensity = 1.4; this.shellMat.roughness = 1;
      }
    }
    const d = Math.hypot(this.x - fromX, this.z - fromZ) || 1, dx = (this.x - fromX) / d, dz = (this.z - fromZ) / d;
    // Jolt away from the blow in the creature's own frame.
    const f = this.forward(); this.jolt.pitch += -(dx * f.x + dz * f.z) * .22 * (stagger + .3); this.jolt.roll += (dx * f.z - dz * f.x) * .22 * (stagger + .3);
    this.flash = .12; this.shake = .09 + stagger * .08;
    const out = { damage: dealt, effect: part === 'belly' ? 'belly' : mult > 1 || this.state === 'taunt' ? 'weak' : mult < 1 ? 'armored' : 'normal', toppled: false, defeated: false, staggered: false };
    // Garrow's back crystals (phase 2) shatter after enough blows from behind: it topples and the barrage ends.
    if (part === 'crystal' && !this.crystalsBroken) {
      this.crystalDamage = (this.crystalDamage || 0) + dealt;
      if (this.crystalDamage >= this.maxHealth * CRYSTAL_BREAK && this.health > 0) {
        this.crystalsBroken = true; this.crystalsNow = true; this.poise = this.kind.poise; this.attack = null; this.setState('toppled'); this.lastEvent = 'CRYSTALS SHATTERED';
        out.toppled = true; out.crystals = true; return out;
      }
    }
    if (this.health <= 0) { this.alive = false; this.setState('defeated'); this.lastEvent = 'defeated'; out.defeated = true; return out; }
    if (this.type === 'gorilla') { if (this.phase === 1 && this.health < this.maxHealth * GORILLA_PHASE_AT) this.pendingPhase = true; }
    else if (this.health < this.maxHealth * ENRAGE_AT && !this.enraged) { this.enraged = true; this.enragedNow = true; }
    if (onBack) { this.lastEvent = 'struck while toppled'; return out; }
    this.push = { x: dx * push * .6, z: dz * push * .6 };
    this.poise -= poise; this.poiseDelay = 2.5; this.flinchMeter += dealt;
    if (this.poise <= 0) {
      this.poise = this.kind.poise; this.setState('toppled'); this.attack = null; this.lastEvent = 'TOPPLED';
      out.toppled = true; return out;
    }
    const committed = this.state === 'attack';
    if (stagger >= .6 || (this.flinchMeter >= (this.type === 'gorilla' ? 45 : 22) && !committed)) {
      this.flinchMeter = 0; this.staggerTime = stagger >= .6 ? .8 : .45; this.setState('stagger'); this.attack = null;
      this.lastEvent = 'staggered'; out.staggered = true;
    } else this.lastEvent = committed ? 'hit (kept attacking)' : 'flinched';
    // A struck monkey often springs back out of reach (not mid-attack, and not every time).
    if (this.type === 'monkey' && !committed && !out.staggered && !this.remote && Math.random() < (this.enraged ? .55 : .38)) {
      this.hopYaw = Math.atan2(dx, dz); this.setState('hop'); this.attack = null; this.lastEvent = 'hopped back';
    }
    return out;
  }

  /** Try to move; slide around obstacles and refuse slopes that are too steep. */
  travel(dx, dz, grid) {
    const r = this.radius * .8, step = Math.hypot(dx, dz);
    if (step < 1e-5) return true;
    const ok = (x, z) => canOccupy(x, z, groundY(x, z), grid, groundY, r) && Math.abs(groundY(x, z) - groundY(this.x, this.z)) < .9 * step + .12;
    // Already overlapping something (shoved into a rock): let it walk back out rather than freeze.
    if (!canOccupy(this.x, this.z, groundY(this.x, this.z), grid, groundY, r)) { this.x += dx; this.z += dz; return true; }
    if (ok(this.x + dx, this.z + dz)) { this.x += dx; this.z += dz; return true; }
    if (ok(this.x + dx, this.z)) { this.x += dx; return false; }
    if (ok(this.x, this.z + dz)) { this.z += dz; return false; }
    return false;
  }
  /**
   * A heading toward `want` whose path is clear: checked at several points
   * ahead, so a trunk close in front is not missed behind a clear spot further
   * on. When it has to go round something it commits to one side
   * (detourSide), so it does not dither left and right against a tree.
   */
  steer(want, grid) {
    const r = this.radius * .8, here = groundY(this.x, this.z);
    const clear = h => [.4, .8, 1.3].every(d => {
      const x = this.x + Math.sin(h) * d, z = this.z + Math.cos(h) * d;
      return canOccupy(x, z, groundY(x, z), grid, groundY, r) && Math.abs(groundY(x, z) - here) < 1.1 * d + .15;
    });
    // Keep to one side of an obstacle until the way straight on is clear again
    // (following its edge), so a pocket between trees and rocks is walked out of.
    const s = this.detourSide || 1;
    if (clear(want)) { this.detouring = false; return want; }
    const offsets = this.detouring ? [.45, .9, 1.4, 2, 2.6, 3.1, -.45, -.9] : [.45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.6, -2.6, 3.1];
    for (const offset of offsets) {
      const h = want + offset * s;
      if (!clear(h)) continue;
      if (!this.detouring) { this.detourSide = Math.sign(offset) * s; this.detouring = true; }
      return h;
    }
    return want + s * 1.6;
  }
  /** Pick an attack for the explorer's range and angle, or null. */
  chooseAttack(dist, rel) {
    const behind = Math.abs(rel) > 1.3;
    const options = [];
    const monkey = this.type === 'monkey', gorilla = this.type === 'gorilla';
    for (const [name, a] of Object.entries(ATTACKS)) {
      if (dist < a.range[0] || dist > a.range[1]) continue;
      // Monkeys and Garrow use only their own moves; the hollowed never use theirs.
      if (monkey ? !a.monkey : gorilla ? !a.gorilla : (a.monkey || a.gorilla)) continue;
      if (a.phase && this.phase < a.phase) continue;
      if (a.phase1 && this.phase > 1) continue;           // phase 2 swaps these for its own
      let w = 1;
      if (monkey) {
        w = name === 'flurry' ? (behind ? .4 : 1.7) : name === 'pounce' ? 1.1 : name === 'seed' ? (this.enraged ? 1.3 : .9) : behind ? 1.5 : 1.0;
        if (w > 0) options.push([name, w]);
        continue;
      }
      if (gorilla) {
        const front = Math.abs(rel) < .55, side = Math.abs(rel) < 1.6;
        w = { chop: front ? 1.5 : 0, backhand: side && !front ? 1.6 : side ? .8 : 0, charge: dist > 6.5 ? 1.5 : .6, pound: behind ? 2 : dist < 3.2 ? 1.1 : .5,
          boulder: dist > 8 ? 1.4 : .5, roar: this.roarRest > 0 ? 0 : this.phase > 1 ? .7 : .45,
          combo: Math.abs(rel) < .9 ? 2 : 0, leap: dist > 5 ? 1.6 : 0, erupt: dist > 4 ? 1.2 : .7,
          barrage: this.crystalsBroken ? 0 : dist > 6 ? 1.5 : .6, whirl: dist < 3.6 ? 1.4 : .6, grab: Math.abs(rel) < .7 && dist < 3.4 ? 1.3 : 0 }[name] ?? 0;
        if (name === this.lastAttack) w *= .3;      // rarely the same move twice in a row
        if (w > 0) options.push([name, w]);
        continue;
      }
      if (name === 'lunge') w = behind ? 0 : Math.abs(rel) < .5 ? 1.4 : .6;
      if (name === 'spin') w = behind || dist < 1.4 ? 2.4 : .35;
      // Shellbacks and thornlings only lunge and spin; the rearing slam is the Old Shell's.
      if (name === 'slam') w = !(this.isBoss||this.isMajorEnemy) || behind ? 0 : Math.abs(rel) < .8 ? (this.enraged ? 1.4 : .9) : 0;
      if (a.boss) w = (this.isBoss||this.isMajorEnemy) ? (dist < 4.5 ? 1.6 : .8) * (this.enraged ? 1.4 : 1) : 0;
      if (w > 0) options.push([name, w]);
    }
    let r = Math.random() * options.reduce((s, [, w]) => s + w, 0);
    for (const [name, w] of options) { if ((r -= w) <= 0) { this.lastAttack = name; return name; } }
    return null;
  }

  /** The current attack's numbers (the team-fight code checks hits on other explorers with them). */
  get attackInfo() { return ATTACKS[this.attack] || null; }

  // `remote`: in a team fight on a guest's game this creature follows the host's
  // snapshots (coop.js). It still moves and animates here, but it does not choose
  // attacks, notice anyone or respawn on its own; `netEvents` carries the host's
  // wind-ups so the telegraph cues still play.
  update(dt, time, ctx) {
    const events = this.netEvents ? this.netEvents.splice(0) : [], k = this.kind, p = ctx.player;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt); this.shake = Math.max(0, this.shake - dt);
    this.jolt.pitch = damp(this.jolt.pitch, 0, 9, dt); this.jolt.roll = damp(this.jolt.roll, 0, 9, dt);
    if (this.brokeNow) { this.brokeNow = false; events.push({ type: 'shellBroken' }); }
    if (this.enragedNow) { this.enragedNow = false; events.push({ type: 'enrage' }); }
    if (this.crystalsNow) { this.crystalsNow = false; const f = new THREE.Vector3(0, 1.7, -.75).applyMatrix4(this.body.matrixWorld); events.push({ type: 'crystalsBroken', x: f.x, y: f.y, z: f.z }); }
    if (this.state === 'dormant') return events;
    if (this.state === 'bound' || this.state === 'calm') { this.rest(dt, time); return events; }
    if (this.state === 'defeated') {
      this.tell.visible = false; if (this.lineTell) this.lineTell.visible = false; if (this.vine) this.vine.visible = false;
      this.body.rotation.z = damp(this.body.rotation.z, Math.PI * .92, 7, dt);
      this.body.position.y = damp(this.body.position.y, this.t > .9 ? -2.4 : .4, this.t > .9 ? 2 : 9, dt);
      if (this.t > 2.2) this.root.visible = false;
      if (this.respawnDelay && this.t > this.respawnDelay && !this.remote) this.respawn();
      this.bar.visible = false;
      return events;
    }
    // Poise recovers once the creature has had a moment without being hit.
    this.poiseDelay -= dt; if (this.poiseDelay <= 0) this.poise = Math.min(k.poise, this.poise + dt * 4);
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz), rel = angleTo(this.heading, toPlayer);
    let wantHeading = this.heading, wantSpeed = 0, turn = k.turn, moveYaw = null;
    this.cooldown -= dt;
    if (!this.remote && ['approach', 'circle'].includes(this.state) && Math.hypot(this.x - this.home.x, this.z - this.home.z) > LEASH) { this.setState('return'); events.push({ type: 'leash' }); }
    this.roarRest = Math.max(0, (this.roarRest || 0) - dt);
    // Below half health Garrow stops, roars, and the crown-glass blade ignites (phase 2).
    if (this.pendingPhase && !this.remote && !['attack', 'toppled', 'rising', 'phase', 'defeated'].includes(this.state)) {
      this.pendingPhase = false; this.attack = null; this.phaseBlasted = false; this.setState('phase'); events.push({ type: 'phase' });
    }

    switch (this.state) {
      case 'wander':
        this.wanderTurn -= dt;
        if (this.wanderTurn <= 0) { this.wanderTurn = 2 + Math.random() * 2.5; this.wanderHeading = this.heading + (Math.random() - .5) * 2.4; }
        if (Math.hypot(this.x - this.home.x, this.z - this.home.z) > 8) this.wanderHeading = Math.atan2(this.home.x - this.x, this.home.z - this.z);
        wantHeading = this.steer(this.wanderHeading ?? this.heading, ctx.grid); wantSpeed = k.walk; turn = 1.4;
        if (dist < k.notice && !this.remote) { this.setState('alert'); events.push({ type: 'alert' }); }
        break;
      case 'emerge':
        // Clawing up out of the roots: no threat until it is fully out.
        wantHeading = toPlayer; turn = 2;
        if (this.t >= EMERGE_TIME) { this.setState('alert'); events.push({ type: 'alert' }); }
        break;
      case 'alert':
        wantHeading = toPlayer; turn = 5;
        if (this.t > .5) this.setState('approach');
        break;
      case 'return':
        // Dragged too far from home: walk back and recover, as a camp mob does.
        wantHeading = this.steer(Math.atan2(this.home.x - this.x, this.home.z - this.z), ctx.grid); wantSpeed = k.chase;
        this.health = Math.min(this.maxHealth, this.health + dt * this.maxHealth * .25); this.poise = k.poise;
        if (Math.hypot(this.x - this.home.x, this.z - this.home.z) < 2) this.setState('wander');
        break;
      case 'reeling':
        turn = 0;
        if (this.t >= REEL_TIME) { this.cooldown = .8; this.setState('circle'); }
        break;
      case 'approach':
        wantHeading = this.steer(toPlayer, ctx.grid); wantSpeed = k.chase * THREE.MathUtils.clamp((dist - k.spacing) / 1.5, .25, 1);
        if (dist < k.spacing + .3) this.setState('circle');
        if (dist > k.notice * 1.6) this.setState('wander');
        if (this.cooldown <= 0 && dist < (this.type === 'monkey' ? 13 : this.type === 'gorilla' ? 20 : 3.4)) this.beginAttack(dist, rel, events, ctx);
        break;
      case 'circle': {
        // Hold spacing and face the explorer; turn in place when flanked.
        const side = Math.sin(time * .7 + this.home.x) > 0 ? 1 : -1;
        wantHeading = toPlayer;
        if (Math.abs(rel) > .9) { wantSpeed = 0; turn = k.turn * 1.25; }
        else if (dist < k.spacing - .6) { moveYaw = toPlayer + Math.PI; wantSpeed = k.walk * .9; }
        else { moveYaw = toPlayer + side * 1.6; wantSpeed = k.walk * .45; }
        if (dist > k.spacing + 1.4) this.setState('approach');
        else if (this.cooldown <= 0) this.beginAttack(dist, rel, events, ctx);
        break;
      }
      case 'windup': {
        const a = ATTACKS[this.attack], tm = this.timing(a);
        if (this.t < tm.track) { wantHeading = toPlayer; turn = 4.5; } else turn = 0;
        if (this.t >= tm.windup) {
          // The vine swing needs somewhere to land behind you; with nowhere to go it holds off.
          if (this.attack === 'swing' && !(this.swingPath = this.planSwing(p, dist, ctx.grid))) { this.attack = null; this.cooldown = .3; this.setState('circle'); break; }
          this.attackYaw = this.heading; this.connected = false; this.anyHit = false; this.swipe = -1; this.closest = 9; this.hits = new Set(); this.grabbed = false; this.struck = false; this.setState('attack'); events.push({ type: 'attack', attack: this.attack });
          if (this.attack === 'leap') { const reach = Math.min(Math.max(0, dist - 1.2), 14); this.leap = { x0: this.x, z0: this.z, x1: this.x + Math.sin(this.heading) * reach, z1: this.z + Math.cos(this.heading) * reach, landed: false }; }
          if (this.attack === 'boulder') { const fw = this.forward(); events.push({ type: 'boulder', x: this.x + fw.x * .6, y: groundY(this.x, this.z) + 3.9, z: this.z + fw.z * .6, tx: p.x, tz: p.z, flight: THREE.MathUtils.clamp(dist / 15, .7, 1.25), damage: a.damage }); }
          if (this.attack === 'erupt') this.marks = [];
          if (this.attack === 'roar') this.roarRest = 9;
          if (this.attack === 'pounce') { const reach = Math.min(dist - .9, 8.5); this.leap = { x0: this.x, z0: this.z, x1: this.x + Math.sin(this.heading) * reach, z1: this.z + Math.cos(this.heading) * reach, landed: false }; }
          if (this.attack === 'seed') { const hand = new THREE.Vector3(); this.head.getWorldPosition(hand); events.push({ type: 'throw', x: hand.x, y: hand.y + .2, z: hand.z, tx: p.x, ty: (p.y ?? groundY(p.x, p.z)) + 1.1, tz: p.z, speed: 17 }); }
        }
        break;
      }
      case 'attack':
        turn = 0;
        this.runAttack(dt, p, ctx, events, dx, dz);
        break;
      case 'phase': {
        // Rears up and roars; the blast at 1.45 s throws everyone close back. Then phase 2.
        wantHeading = toPlayer; turn = 1.2;
        if (this.t >= 1.45 && !this.phaseBlasted) {
          this.phaseBlasted = true; events.push({ type: 'phaseBlast', x: this.x, z: this.z, radius: 5.5 });
          if (dist < 5.5) events.push({ type: 'strike', attack: 'phase', label: 'crown-glass blast', kind: 'heavy', damage: 0, ring: true, x: this.x, z: this.z });
        }
        if (this.t >= PHASE_TIME) { this.phase = 2; this.enraged = true; this.cooldown = .35; this.setState('circle'); events.push({ type: 'phaseDone' }); }
        break;
      }
      case 'taunt':
        // Showing off after a blow lands: it faces you but does nothing else. Punish it.
        wantHeading = toPlayer; turn = 2;
        if (this.t >= TAUNT[this.type][1]) { this.cooldown = .3; this.setState(dist < k.spacing + 1 ? 'circle' : 'approach'); }
        break;
      case 'dazed':
        // Ran headlong into a trunk: open to a Root Strike for a moment.
        turn = 0;
        if (this.t >= DAZE_TIME) { this.cooldown = .5; this.setState(dist < k.spacing + 1 ? 'circle' : 'approach'); }
        break;
      case 'hop': {
        // A monkey springs back out of reach after being struck, then comes straight back in.
        turn = 6; wantHeading = toPlayer;
        const step = 7.5 * dt * Math.max(0, 1 - this.t / .34);
        this.travel(Math.sin(this.hopYaw) * step, Math.cos(this.hopYaw) * step, ctx.grid);
        if (this.t >= .34) { this.cooldown = Math.min(this.cooldown, .3); this.setState('circle'); }
        break;
      }
      case 'recover': {
        turn = .6;
        if (this.type === 'monkey' && this.attack === 'swing' && !this.chained && this.t > .16 && dist < 2.9 && !this.remote) {
          this.chained = true;
          if (Math.random() < .55 && (!ctx.mayAttack || ctx.mayAttack(this))) { this.attack = 'flurry'; this.quick = true; this.setState('windup'); events.push({ type: 'windup', attack: 'flurry', chained: true }); break; }
        }
        if (this.t >= this.timing(ATTACKS[this.attack]).recover) {
          const tt = TAUNT[this.type];
          if (tt && this.struck && !this.remote && this.attack !== 'roar' && Math.random() < tt[0] * (this.phase > 1 ? .7 : 1)) { this.struck = false; this.setState('taunt'); events.push({ type: 'taunt' }); break; }
          this.cooldown = k.cooldown[0] + Math.random() * (k.cooldown[1] - k.cooldown[0]);
          if (this.enraged) this.cooldown *= .65;
          if (this.attack === 'roar') this.cooldown = .15;     // the roar sets up a follow-up at once
          this.setState(dist < k.spacing + 1 ? 'circle' : 'approach');
        }
        break;
      }
      case 'stagger':
        turn = 0;
        if (this.t >= this.staggerTime) { this.cooldown = Math.max(this.cooldown, .4); this.setState(dist < k.spacing + 1 ? 'circle' : 'approach'); }
        break;
      case 'toppled':
        turn = 0;
        if (this.t >= TOPPLE_TIME) { this.setState('rising'); events.push({ type: 'rising' }); }
        break;
      case 'rising':
        turn = 0;
        if (this.t >= RISE_TIME) { this.cooldown = .6; this.setState('circle'); }
        break;
    }

    if (turn > 0) this.heading += THREE.MathUtils.clamp(angleTo(this.heading, wantHeading), -turn * dt, turn * dt);
    this.speed = damp(this.speed, wantSpeed, 6, dt);
    if (this.state !== 'attack' && this.speed > .01) {
      const yaw = moveYaw ?? this.heading;
      const free = this.travel(Math.sin(yaw) * this.speed * dt, Math.cos(yaw) * this.speed * dt, ctx.grid);
      // Still pressed against something after half a second: go round the other way.
      this.blockedFor = free ? 0 : (this.blockedFor || 0) + dt;
      if (this.blockedFor > .5) { this.detourSide = -(this.detourSide || 1); this.detouring = true; this.blockedFor = 0; if (this.state === 'wander') this.wanderHeading = this.heading + Math.PI * (.5 + Math.random() * .5) * this.detourSide; }
    }
    if (Math.hypot(this.push.x, this.push.z) > .001) {
      const f = 1 - Math.exp(-11 * dt);
      this.travel(this.push.x * f, this.push.z * f, ctx.grid);
      this.push.x *= 1 - f; this.push.z *= 1 - f;
    }
    this.animate(dt, time);
    return events;
  }

  beginAttack(dist, rel, events, ctx) {
    if (this.remote) return;               // the host starts every attack in a team fight
    // Attack tokens: creatures take turns instead of swarming the explorer.
    if (ctx.mayAttack && !ctx.mayAttack(this)) { this.cooldown = .4 + Math.random() * .5; return; }
    const name = this.chooseAttack(dist, rel);
    if (!name) return;
    this.attack = name; this.chained = false; this.quick = false; this.setState('windup');
    events.push({ type: 'windup', attack: name });
  }

  /** The active part of each attack, with its own damage volume. */
  runAttack(dt, p, ctx, events, dx, dz) {
    const a = ATTACKS[this.attack], k = this.kind, s = k.size;
    const strike = (extra = {}) => {
      if (this.connected) return;
      this.connected = true; this.struck = true;
      events.push({ type: 'strike', attack: this.attack, label: a.label, kind: a.kind, damage: a.damage, x: this.x, z: this.z, ...extra });
    };
    if (this.attack === 'lunge') {
      const frac = Math.min(1, this.t / a.active), prev = Math.max(0, (this.t - dt) / a.active);
      let step = ((1 - (1 - frac) ** 2) - (1 - (1 - prev) ** 2)) * 2.8;
      const ahead = dx * Math.sin(this.attackYaw) + dz * Math.cos(this.attackYaw);
      const lateral = Math.abs(dx * Math.cos(this.attackYaw) - dz * Math.sin(this.attackYaw));
      if (lateral < this.radius + .35) step = Math.min(step, Math.max(0, ahead - this.radius - .38));
      this.travel(Math.sin(this.attackYaw) * step, Math.cos(this.attackYaw) * step, ctx.grid);
      if (this.t >= .04 && this.t <= .25) {
        const bite = this.damageVolumes()[0];
        const gap = Math.hypot(bite.x - p.x, bite.z - p.z) - (bite.r + .34);
        if (gap <= 0 && bite.y > p.y + .1 && bite.y < p.y + 1.8) strike();
        else this.closest = Math.min(this.closest, gap);
      }
    } else if (this.attack === 'spin') {
      this.spinAngle += dt * 17;
      const v = this.damageVolumes()[0];
      const gap = Math.hypot(v.x - p.x, v.z - p.z) - (v.r + .34);
      if (gap <= 0 && p.y < v.y + 1.2) strike();
      else this.closest = Math.min(this.closest, gap);
    } else if (this.attack === 'slam') {
      // The shell hits the ground, then a shockwave ring rolls outward: dash
      // through it or jump over it.
      for (const v of this.damageVolumes()) {
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        const inside = v.ring ? Math.abs(d - v.r) < .45 && ctx.playerGrounded : d < v.r + .34;
        if (inside) strike({ ring: !!v.ring });
        else this.closest = Math.min(this.closest, v.ring ? Math.abs(d - v.r) - .45 : d - v.r - .34);
      }
    }
    if (this.attack === 'flurry') {
      // Three swipes; between them it steps in and turns to follow you.
      const toward = Math.atan2(dx, dz);
      this.heading += THREE.MathUtils.clamp(angleTo(this.heading, toward), -3.2 * dt, 3.2 * dt); this.attackYaw = this.heading;
      const n = a.swipes.findIndex((h, i) => this.t >= h && (i === a.swipes.length - 1 || this.t < a.swipes[i + 1]));
      if (n !== this.swipe && n >= 0) { this.swipe = n; this.connected = false; events.push({ type: 'swipe', n }); }
      const since = n >= 0 ? this.t - a.swipes[n] : -1;
      if (since >= 0 && since < .14) {
        const ahead = Math.hypot(dx, dz) - this.radius - .5, step = Math.min(Math.max(0, ahead), 3.4 * dt);
        this.travel(Math.sin(this.heading) * step, Math.cos(this.heading) * step, ctx.grid);
        const v = this.damageVolumes()[0], gap = Math.hypot(v.x - p.x, v.z - p.z) - (v.r + .34);
        if (gap <= 0 && !this.connected) { strike({ swipe: n }); this.anyHit = true; } else this.closest = Math.min(this.closest, gap);
      }
    } else if (this.attack === 'pounce') {
      // An arc through the air to the spot it marked; claws land at the end.
      const L = this.leap, f = Math.min(1, this.t / (a.active * .8)), e = f * f * (3 - 2 * f);
      const tx = L.x0 + (L.x1 - L.x0) * e, tz = L.z0 + (L.z1 - L.z0) * e;
      this.travel(tx - this.x, tz - this.z, ctx.grid);
      if (f >= 1 && !L.landed) {
        L.landed = true; events.push({ type: 'pounceLand', x: this.x, z: this.z });
        const gap = Math.hypot(this.x - p.x, this.z - p.z) - 1.35;
        if (gap <= 0 && ctx.playerGrounded) strike(); else this.closest = Math.min(this.closest, gap);
      }
    } else if (this.attack === 'seed') {
      this.closest = 0;          // the seed itself does the hitting (main.js)
      this.connected = true;
    } else if (this.attack === 'swing') {
      // Round the circle it planned: wide, then in close at the side for the kick, then out behind you.
      const P = this.swingPath, u = Math.min(1, this.t / a.active), e = u * u * (3 - 2 * u);
      const th = P.th0 + P.side * P.sweep * e, r = P.r0 + (P.r1 - P.r0) * e - P.dip * Math.sin(e * Math.PI);
      this.x = P.cx + Math.sin(th) * r; this.z = P.cz + Math.cos(th) * r; this.swingU = u;
      this.heading = Math.atan2(P.cx - this.x, P.cz - this.z); this.attackYaw = this.heading;
      if (u >= .36 && u <= .64) {
        const gap = Math.hypot(this.x - p.x, this.z - p.z) - 1.25;
        if (gap <= 0) { strike(); this.anyHit = true; } else this.closest = Math.min(this.closest, gap);
      }
      if (u >= 1 && !P.landed) { P.landed = true; events.push({ type: 'swingLand', x: this.x, z: this.z }); }
    }
    if (this.type === 'gorilla' && this.runGorilla(dt, p, ctx, events, dx, dz, a)) return;
    if (this.attack === 'quake' && this.t >= .1 && !this.connected) {
      // The ground breaks around it: dash through (i-frames), guard, or be out of range.
      const gap = Math.hypot(this.x - p.x, this.z - p.z) - QUAKE_RADIUS;
      if (gap <= 0 && ctx.playerGrounded) strike({ ring: true, quake: true });
      else this.closest = Math.min(this.closest, gap);
      if (!this.quaked) { this.quaked = true; events.push({ type: 'quake', x: this.x, z: this.z, radius: QUAKE_RADIUS }); }
    }
    if (this.t >= a.active) {
      this.quaked = false;
      if (!this.connected && !this.anyHit) events.push({ type: 'missed', attack: this.attack, label: a.label, gap: this.closest ?? 9 });
      this.setState('recover');
    }
  }
  /** Where the vine swing goes: round you to a clear spot behind, or null if there is none. */
  planSwing(p, dist, grid) {
    const cx = p.x, cz = p.z, th0 = Math.atan2(this.x - cx, this.z - cz), r0 = Math.max(dist, 2), r1 = 2.2, sweep = Math.PI * .92;
    for (const side of Math.random() < .5 ? [1, -1] : [-1, 1]) {
      const th1 = th0 + side * sweep, x1 = cx + Math.sin(th1) * r1, z1 = cz + Math.cos(th1) * r1;
      if (!canOccupy(x1, z1, groundY(x1, z1), grid, groundY, this.radius * .8)) continue;
      return { cx, cz, th0, side, sweep, r0, r1, dip: Math.max(0, (r0 + r1) / 2 - 1.05), ay: groundY(cx, cz) + 7.5, landed: false };
    }
    return null;
  }
  /**
   * Garrow's moves. Each blow lands once (`hits` keys); effects fire once (`fx:` keys).
   * Returns true when the attack was cut short (a charge into a tree).
   */
  runGorilla(dt, p, ctx, events, dx, dz, a) {
    const t = this.t, fw = this.forward(), dist = Math.hypot(dx, dz), rel = angleTo(this.heading, Math.atan2(dx, dz));
    const once = key => !this.hits.has(key) && !!this.hits.add(key);
    const hit = (key, extra = {}) => {
      if (!once(key)) return; this.anyHit = true; this.struck = true;
      events.push({ type: 'strike', attack: this.attack, label: a.label, kind: a.kind, damage: a.damage, x: this.x, z: this.z, ...extra });
    };
    const miss = gap => { this.closest = Math.min(this.closest, gap); };
    // How far outside a strip ahead of (ox, oz) the explorer stands (<= 0: inside it).
    const strip = (ox, oz, yaw, from, to, half) => {
      const rx = p.x - ox, rz = p.z - oz, ahead = rx * Math.sin(yaw) + rz * Math.cos(yaw), lat = Math.abs(rx * Math.cos(yaw) - rz * Math.sin(yaw));
      return Math.max(from - ahead, ahead - to, lat - half - .34);
    };
    switch (this.attack) {
      case 'chop': {
        if (t >= .1 && once('fx:chop')) events.push({ type: 'chopImpact', x: this.x + fw.x * 2.3, z: this.z + fw.z * 2.3, yaw: this.heading, len: a.line[1] });
        if (t >= .08 && t <= .24) { const g = strip(this.x, this.z, this.heading, ...a.line); g <= 0 ? hit('chop') : miss(g); }
        break;
      }
      case 'backhand':
        if (t >= .05 && t <= .24) { const g = dist - 3.5; g <= 0 && Math.abs(rel) < 1.7 ? hit('backhand') : miss(Math.max(g, .1)); }
        break;
      case 'charge': {
        // Steers early, then commits; slows to a skid at the end. A trunk in the way stops it dead.
        const steer = t < .45 ? 1.1 : .12;
        this.heading += THREE.MathUtils.clamp(angleTo(this.heading, Math.atan2(dx, dz)), -steer * dt, steer * dt); this.attackYaw = this.heading;
        const speed = 9.5 * Math.min(1, t / .18) * Math.min(1, Math.max(0, (a.active - t) / .3)), step = speed * dt, x0 = this.x, z0 = this.z;
        this.travel(Math.sin(this.heading) * step, Math.cos(this.heading) * step, ctx.grid);
        if (t > .2 && step > .03 && Math.hypot(this.x - x0, this.z - z0) < step * .3) {
          events.push({ type: 'chargeCrash', x: this.x, z: this.z }); this.shake = .4; this.setState('dazed'); return true;
        }
        const hx = this.x + Math.sin(this.heading) * 1.3, hz = this.z + Math.cos(this.heading) * 1.3, g = Math.hypot(hx - p.x, hz - p.z) - 1.45;
        if (t > .1 && g <= 0) hit('charge'); else miss(g);
        break;
      }
      case 'pound':
        a.rings.forEach((start, i) => {
          if (t < start) return;
          if (once('fx:ring' + i)) events.push({ type: 'poundRing', x: this.x, z: this.z, from: a.ring[0], to: a.ring[1], duration: a.ring[2] });
          if (t > start + a.ring[2] + .03) return;
          const R = a.ring[0] + (a.ring[1] - a.ring[0]) * Math.min(1, (t - start) / a.ring[2]), g = Math.abs(dist - R) - .45;
          if (g <= 0 && ctx.playerGrounded) hit('ring' + i, { ring: true }); else miss(g);
        });
        break;
      case 'boulder':
        this.closest = 0; this.connected = true;     // the boulder itself does the hitting (main.js)
        break;
      case 'roar':
        if (once('fx:roar')) { events.push({ type: 'roar', x: this.x, z: this.z, radius: a.reach }); if (dist < a.reach) hit('roar', { ring: true }); else miss(dist - a.reach); }
        break;
      case 'combo': {
        // Chop, backhand, rising cut; it steps in and turns between them.
        this.heading += THREE.MathUtils.clamp(angleTo(this.heading, Math.atan2(dx, dz)), -2.6 * dt, 2.6 * dt); this.attackYaw = this.heading;
        const n = a.swipes.findIndex((h, i) => t >= h && (i === a.swipes.length - 1 || t < a.swipes[i + 1]));
        if (n !== this.swipe && n >= 0) { this.swipe = n; events.push({ type: 'swipe', n, heavy: true }); }
        const since = n >= 0 ? t - a.swipes[n] : -1;
        if (since >= 0 && since < .16) {
          const step = Math.min(Math.max(0, dist - this.radius - .8), 3.6 * dt);
          this.travel(Math.sin(this.heading) * step, Math.cos(this.heading) * step, ctx.grid);
          const g = n === 0 ? strip(this.x, this.z, this.heading, .4, 3.6, .55) : n === 1 ? (Math.abs(rel) < 1.7 ? dist - 3.4 : 1) : (Math.abs(rel) < .9 ? dist - 2.8 : 1);
          if (g <= 0) hit('combo' + n, n === 2 ? { kind: 'heavy', label: 'rising cut' } : {}); else miss(g);
        }
        break;
      }
      case 'leap': {
        // Up and over to where you stood; the cleaver lands first, then spikes burst ahead.
        const L = this.leap, land = a.active * .7, f = Math.min(1, t / land), e = f * f * (3 - 2 * f);
        if (!L.landed) this.travel(L.x0 + (L.x1 - L.x0) * e - this.x, L.z0 + (L.z1 - L.z0) * e - this.z, ctx.grid);
        if (f >= 1 && !L.landed) {
          L.landed = true; events.push({ type: 'leapLand', x: this.x, z: this.z });
          const g = dist - 2.4; if (g <= 0 && ctx.playerGrounded) hit('land'); else miss(g);
        }
        if (L.landed && t >= land + .18) {
          if (once('fx:spikes')) events.push({ type: 'spikeLine', x: this.x, z: this.z, yaw: this.heading, from: .6, len: 7 });
          if (t <= land + .34) { const g = strip(this.x, this.z, this.heading, .6, 7, .75); if (g <= 0) hit('spikes', { ring: true, damage: 1, label: 'crown-glass spikes' }); else miss(g); }
        }
        break;
      }
      case 'barrage':
        if (t >= .05 && once('fx:barrage')) {
          const y = groundY(this.x, this.z) + 3.3;
          events.push({ type: 'shards', x: this.x + fw.x * .4, y, z: this.z + fw.z * .4, yaw: Math.atan2(dx, dz), n: 3, spread: .26, speed: 19, ty: (p.y ?? groundY(p.x, p.z)) + 1.2, dist, damage: a.damage });
        }
        this.closest = 0; this.connected = true;     // the shards do the hitting (main.js)
        break;
      case 'whirl': {
        // Two turns, drifting after you; each turn can catch you once.
        this.spinAngle += dt * 9;
        const step = Math.min(Math.max(0, dist - 1.6), 3.2 * dt);
        this.travel(Math.sin(Math.atan2(dx, dz)) * step, Math.cos(Math.atan2(dx, dz)) * step, ctx.grid);
        const turn = Math.min(1, Math.floor(t / (a.active / 2))), g = dist - a.reach;
        if (g <= 0) hit('whirl' + turn); else miss(g);
        break;
      }
      case 'grab': {
        // A lunge with the open hand; caught, it lifts you and slams you down. A miss is a long opening.
        if (!this.grabbed && t < .3) {
          const step = 2.6 / .3 * dt * Math.max(0, 1 - t / .3) * 1.8;
          this.travel(fw.x * Math.min(step, Math.max(0, dist - 1.4)), fw.z * Math.min(step, Math.max(0, dist - 1.4)), ctx.grid);
          const hx = this.x + fw.x * 1.9, hz = this.z + fw.z * 1.9, g = Math.hypot(p.x - hx, p.z - hz) - 1.45;
          if (t >= .06 && g <= 0 && Math.abs(rel) < .8) { this.grabbed = true; hit('grab', { ring: true, unblockable: true }); events.push({ type: 'grabbed', x: hx, z: hz }); }
          else miss(g);
        }
        if (this.grabbed && t >= .9 && once('fx:slam')) events.push({ type: 'grabSlam', x: this.x + fw.x * 1.6, z: this.z + fw.z * 1.6 });
        if (!this.grabbed && t >= .36) { events.push({ type: 'missed', attack: 'grab', label: a.label, gap: this.closest ?? 9 }); this.setState('recover'); return true; }
        break;
      }
      case 'erupt':
        // Three marks where you stand, each bursting a moment later.
        a.marks.forEach((at, i) => {
          if (t >= at && once('mark' + i)) { this.marks.push({ x: p.x, z: p.z, at }); events.push({ type: 'eruptMark', x: p.x, z: p.z, fuse: a.fuse, r: 1.5 }); }
        });
        this.marks.forEach((m, i) => {
          if (t < m.at + a.fuse) return;
          if (once('fx:burst' + i)) events.push({ type: 'eruptBurst', x: m.x, z: m.z, r: 1.5 });
          if (t > m.at + a.fuse + .15) return;
          const g = Math.hypot(p.x - m.x, p.z - m.z) - 1.5 - .3;
          if (g <= 0) hit('burst' + i, { ring: true }); else miss(g);
        });
        break;
    }
    return false;
  }
  /** Damage volumes for the current attack (debug draws these). */
  damageVolumes() {
    const s = this.kind.size, f = new THREE.Vector3();
    if (this.type === 'gorilla') return this.state === 'attack' ? this.gorillaVolumes() : [];
    if (this.attack === 'swing') {
      const u = this.swingU ?? 0;
      return this.state === 'attack' && u >= .36 && u <= .64 ? [{ x: this.x, y: groundY(this.x, this.z) + 1.2, z: this.z, r: 1.0 }] : [];
    }
    if (this.attack === 'lunge') {
      this.head.getWorldPosition(f); f.addScaledVector(this.forward(), .5 * s);
      return [{ x: f.x, y: f.y, z: f.z, r: this.kind.biteRadius }];
    }
    if (this.attack === 'flurry') {
      this.head.getWorldPosition(f); f.addScaledVector(this.forward(), .55 * s);
      return [{ x: f.x, y: f.y - .25, z: f.z, r: .62 }];
    }
    if (this.attack === 'pounce') {
      const g = groundY(this.x, this.z);
      return this.state === 'attack' && this.leap && this.t >= ATTACKS.pounce.active * .78 ? [{ x: this.x, y: g + .4, z: this.z, r: 1.35 }] : [];
    }
    if (this.attack === 'spin') {
      const g = groundY(this.x, this.z);
      return [{ x: this.x, y: g + .5, z: this.z, r: this.radius + .55 }];
    }
    if (this.attack === 'quake') {
      const g = groundY(this.x, this.z);
      return this.state === 'attack' ? [{ x: this.x, y: g + .1, z: this.z, r: QUAKE_RADIUS, ring: true }] : [];
    }
    if (this.attack === 'slam') {
      const fw = this.forward(), cx = this.x + fw.x * 1.0 * s, cz = this.z + fw.z * 1.0 * s, g = groundY(cx, cz);
      const out = [];
      if (this.state !== 'attack') return out;
      if (this.t < .1) out.push({ x: cx, y: g + .3, z: cz, r: .75 });
      if (this.t >= .02) out.push({ x: cx, y: g + .1, z: cz, r: shockwaveRadius(this.t), ring: true });
      return out;
    }
    return [];
  }

  gorillaVolumes() {
    const a = ATTACKS[this.attack], fw = this.forward(), g = groundY(this.x, this.z), t = this.t;
    if (!a) return [];
    const line = (from, to, r) => { const out = []; for (let d = from; d <= to; d += r * 1.4) out.push({ x: this.x + fw.x * d, y: g + .8, z: this.z + fw.z * d, r }); return out; };
    const ahead = (d, r) => [{ x: this.x + fw.x * d, y: g + 1.2, z: this.z + fw.z * d, r }];
    if (this.attack === 'chop') return t >= .08 && t <= .24 ? line(.5, 4.1, .6) : [];
    if (this.attack === 'backhand') return t >= .05 && t <= .24 ? ahead(1.2, 2.1) : [];
    if (this.attack === 'charge') return ahead(1.3, 1.45);
    if (this.attack === 'pound') return a.rings.filter(st => t >= st && t <= st + a.ring[2]).map(st => ({ x: this.x, y: g + .1, z: this.z, r: a.ring[0] + (a.ring[1] - a.ring[0]) * Math.min(1, (t - st) / a.ring[2]), ring: true }));
    if (this.attack === 'roar') return t < .2 ? [{ x: this.x, y: g + 1, z: this.z, r: a.reach }] : [];
    if (this.attack === 'combo') { const n = this.swipe ?? -1, since = n >= 0 ? t - a.swipes[n] : -1; return since >= 0 && since < .16 ? (n === 0 ? line(.4, 3.6, .55) : ahead(1.4, n === 1 ? 2 : 1.4)) : []; }
    if (this.attack === 'leap') return this.leap?.landed ? [{ x: this.x, y: g + .5, z: this.z, r: 2.4 }] : [];
    if (this.attack === 'whirl') return [{ x: this.x, y: g + 1.2, z: this.z, r: a.reach }];
    if (this.attack === 'grab') return !this.grabbed && t >= .06 && t < .3 ? ahead(1.9, 1.45) : [];
    if (this.attack === 'erupt') return (this.marks || []).filter(m => t >= m.at + a.fuse && t < m.at + a.fuse + .2).map(m => ({ x: m.x, y: groundY(m.x, m.z) + .5, z: m.z, r: 1.5 }));
    return [];
  }
  /** Garrow's body for the state it is in: lean, lift, twist, and where each arm (and the cleaver) points. */
  gorillaPose(st, t, tm) {
    const a = this.attack, A = a ? ATTACKS[a] : null, w = st === 'windup' && tm ? Math.min(1, t / tm.windup) : 0;
    const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    const kf = pts => { for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0)); } return pts[pts.length - 1][1]; };
    const P = { rear: null, lift: 0, spin: 0, headOut: 0, lean: 0, L: [st === 'alert' ? -.3 : 0, 0], R: [st === 'alert' ? -.3 : 0, 0], sword: 0 };
    const drum = k => { P.L = [-1.3 + Math.sin(t * 24) * .45 * k, .35 * k]; P.R = [-1.3 - Math.sin(t * 24) * .45 * k, -.35 * k]; };
    if (st === 'windup') {
      P.rear = 0;
      if (a === 'chop') { P.R = [-2.9 * w, -.2 * w]; P.L = [-.5 * w, 0]; P.rear = -.22 * w; P.sword = .5 * w; }
      if (a === 'backhand') { P.L = [-1.0 * w, 1.1 * w]; P.spin = .55 * w; P.rear = .1 * w; }
      if (a === 'charge') { P.rear = .6 * w; P.lift = -.3 * w; P.L = P.R = [-.55 * w, 0]; P.headOut = .25 * w; }
      if (a === 'pound') { P.L = P.R = [-2.8 * w, 0]; P.rear = -.3 * w; P.lift = .25 * w; }
      if (a === 'boulder') { const down = ease(t / (tm.windup * .45)), up = ease((t / tm.windup - .45) / .55); P.rear = .6 * down * (1 - up) - .3 * up; P.L = P.R = [-.8 * down * (1 - up) - 3 * up, 0]; P.lift = -.25 * down * (1 - up); }
      if (a === 'roar') { drum(1); P.rear = -.15 * w; }
      if (a === 'combo') { P.R = [-2.3 * w, 0]; P.rear = -.15 * w; P.sword = .4 * w; }
      if (a === 'leap') { P.rear = .4 * w; P.lift = -.4 * w; P.L = P.R = [1.0 * w, 0]; }
      if (a === 'erupt') { P.R = [-2.7 * w, 0]; P.rear = -.25 * w; P.sword = -.3 * w; }
      if (a === 'barrage') { P.L = [-3.5 * w, -.3 * w]; P.rear = -.2 * w; P.spin = .35 * w; }       // reaching over its shoulder for the crystals
      if (a === 'whirl') { P.R = [-.4 * w, 1.45 * w]; P.L = [-.3 * w, -1.2 * w]; P.spin = -.7 * w; P.lift = -.15 * w; }
      if (a === 'grab') { P.L = [1.3 * w, -.3 * w]; P.rear = -.15 * w; P.lift = -.2 * w; P.headOut = .2 * w; }
    }
    if (st === 'attack' && A) {
      if (a === 'chop') { const k = ease(t / .1); P.R = [-2.9 + 2.5 * k, -.2]; P.rear = -.22 + .55 * k; P.sword = .5 - .9 * k; }
      if (a === 'backhand') { const k = ease(t / .2); P.L = [-1.2, 1.1 - 2.5 * k]; P.spin = .55 - 1.3 * k; P.rear = .1; }
      if (a === 'charge') { P.rear = .62; P.lift = -.25 + Math.abs(Math.sin(t * 9)) * .2; P.L = [-.5 + Math.sin(t * 18) * .7, 0]; P.R = [-.5 - Math.sin(t * 18) * .7, 0]; P.headOut = .3; }
      if (a === 'pound') { const x = kf([[0, -2.8], [.1, -.4], [.42, -2.6], [.57, -2.7], [.67, -.4]]); P.L = P.R = [x, 0]; P.rear = kf([[0, -.3], [.1, .35], [.42, -.25], [.57, -.25], [.67, .4]]); }
      if (a === 'boulder') { const x = kf([[0, -3], [.15, -.9]]); P.L = P.R = [x, 0]; P.rear = kf([[0, -.3], [.15, .3]]); }
      if (a === 'roar') { P.rear = -.45; P.headOut = .35; P.L = [-.7, -1.1]; P.R = [-.7, 1.1]; }
      if (a === 'combo') {
        const n = this.swipe ?? -1, since = n >= 0 ? t - A.swipes[n] : 0;
        P.R = [-2.3, 0]; P.rear = 0;
        if (n === 0) { const k = ease(since / .1); P.R = [-2.3 + 1.9 * k, 0]; P.rear = .3 * k; P.sword = .4 - .8 * k; }
        if (n === 1) { const k = ease(since / .18); P.L = [-1.1, 1.1 - 2.4 * k]; P.spin = .5 - 1.2 * k; P.R = [-.6, 0]; }
        if (n === 2) { const k = ease(since / .14); P.R = [.8 - 3.7 * k, 0]; P.rear = -.25 * k; P.lift = .15 * k; }
      }
      if (a === 'leap') { const f = Math.min(1, t / (A.active * .7)); P.lift = f < 1 ? Math.sin(f * Math.PI) * 3 : 0; P.R = [f < 1 ? -2.9 : -.4, 0]; P.L = [f < 1 ? -1.5 : -.8, 0]; P.rear = f < 1 ? -.2 + .2 * f : .45; P.sword = f < 1 ? .5 : -.4; }
      if (a === 'erupt') { P.R = [-.35, 0]; P.L = [-.4, .2]; P.rear = .55; P.sword = .9; P.lift = -.15; }
      if (a === 'barrage') { const k = ease(t / .12); P.L = [-3.5 + 2.3 * k, -.3]; P.spin = .35 - .7 * k; P.rear = .25 * k; }
      if (a === 'whirl') { P.R = [-.4, 1.45]; P.L = [-.3, -1.2]; P.spin = this.spinAngle; P.whirl = true; P.lift = -.1; }
      if (a === 'grab') {
        if (!this.grabbed) { const k = ease(t / .18); P.L = [1.3 - 2.8 * k, -.3 + .3 * k]; P.rear = .45 * k; P.headOut = .3; }
        else { P.L = [kf([[0, -1.5], [.3, -1.5], [.75, -2.9], [.9, -.3]]), 0]; P.rear = kf([[0, .45], [.75, -.3], [.9, .55]]); P.R = [-.5, 0]; }
      }
    }
    if (st === 'phase') {
      if (t < 1.45) { drum(1); P.rear = -.3 - .2 * t / 1.45; P.lift = .2; }
      else if (t < 2.4) { P.rear = -.55; P.headOut = .4; P.L = [-.8, -1.25]; P.R = [-.8, 1.25]; P.lift = .1; }
      else { const k = ease((t - 2.4) / .4); P.rear = -.55 * (1 - k); P.L = [-.8 * (1 - k), -1.25 * (1 - k)]; P.R = [-.8 * (1 - k), 1.25 * (1 - k)]; }
    }
    if (st === 'taunt') { drum(1); P.rear = -.25; P.headOut = .25; P.lift = Math.abs(Math.sin(t * 4)) * .08; }
    if (st === 'dazed') { P.rear = .25; P.lean = Math.sin(t * 7) * .15; P.headOut = -.2; P.L = P.R = [.2, 0]; }
    return P;
  }
  animate(dt, time) {
    this.place();
    const s = this.kind.size * 1.1, h = this.heading;
    const fx = Math.sin(h) * s, fz = Math.cos(h) * s, rx = Math.cos(h) * s, rz = -Math.sin(h) * s;
    const pitch = Math.atan2(groundY(this.x - fx, this.z - fz) - groundY(this.x + fx, this.z + fz), 2 * s);
    const roll = Math.atan2(groundY(this.x + rx, this.z + rz) - groundY(this.x - rx, this.z - rz), 2 * s);
    this.tilt.rotation.x = damp(this.tilt.rotation.x, pitch, 10, dt);
    this.tilt.rotation.z = damp(this.tilt.rotation.z, roll, 10, dt);
    const st = this.state, t = this.t, a = this.attack ? ATTACKS[this.attack] : null, tm = a ? this.timing(a) : null;
    let rear = 0, headOut = 0, headLow = 0, glow = 0, lean = 0, lift = 0, flip = 0, spin = 0, legsIn = 0, legRate = 1;
    if (st === 'alert') { rear = -.12 * Math.sin(Math.min(1, t / .5) * Math.PI); headOut = .15; }
    if (st === 'windup') {
      const w = Math.min(1, t / tm.windup); glow = w * w;
      if (this.attack === 'lunge') { rear = -.28 * w; headOut = -.35 * w; }
      if (this.attack === 'spin') { headOut = -.6 * w; legsIn = w; spin = Math.sin(t * 40) * .06 * w; }    // retract and rattle
      if (this.attack === 'slam') { rear = -.75 * w; lift = .9 * w; headOut = .2 * w; }                     // rear up high
      if (this.attack === 'quake') { rear = -.62 * w; lift = .7 * w; headOut = -.48 * w; spin = Math.sin(t * 30) * .04 * w; }
    }
    if (st === 'attack') {
      glow = .7;
      if (this.attack === 'lunge') { rear = .16; headOut = .45; }
      if (this.attack === 'spin') { headOut = -.6; legsIn = 1; spin = this.spinAngle; }
      if (this.attack === 'slam') { const k = Math.min(1, t / .07); rear = -.75 + .95 * k; lift = .9 * (1 - k); }
      if (this.attack === 'quake') { const k = Math.min(1, t / .08); rear = -.62 + .98 * k; lift = .7 * (1 - k); headOut = .22; headLow = -.42; }
    }
    if (st === 'recover') { rear = .06; headOut = .1; headLow = -.25 + Math.sin(time * 5) * .03; legRate = .5; }
    if (st === 'stagger') { lean = Math.sin(t * 28) * .12 * Math.max(0, 1 - t / this.staggerTime); rear = .1; headOut = -.2; }
    if (st === 'reeling') { lean = Math.sin(t * 9) * .18 * Math.max(0, 1 - t / REEL_TIME); rear = -.2 * Math.max(0, 1 - t / .4); headOut = -.3; legRate = .4; }
    if (st === 'toppled') { flip = 1; legRate = 3; headOut = Math.sin(time * 6) * .15; }
    if (st === 'rising') { flip = 1 - Math.min(1, t / RISE_TIME); }
    if (st === 'emerge') { const e = Math.min(1, t / EMERGE_TIME); lift = -2.6 * (1 - e) ** 2; rear = -.35 * Math.sin(e * Math.PI); legRate = 2.5; }
    const G = this.type === 'gorilla' ? this.gorillaPose(st, t, tm) : null;
    if (G && G.rear !== null) { rear = G.rear; lift = G.lift; spin = G.spin; headOut = G.headOut; lean = G.lean; glow = st === 'phase' ? .8 : glow; }
    if (G?.whirl) this.body.rotation.y = spin;
    // Monkey poses: crouch before the pounce, an arc through the air, the hop back.
    if (this.type === 'monkey') {
      const w = tm ? Math.min(1, t / tm.windup) : 0;
      if (st === 'windup' && this.attack === 'pounce') { rear = .32 * w; lift = -.22 * w; headOut = 0; }
      if (st === 'windup' && this.attack === 'flurry') { rear = -.18 * w; headOut = 0; }
      if (st === 'attack' && this.attack === 'pounce') { const f = Math.min(1, t / (a.active * .8)); lift = Math.sin(f * Math.PI) * 1.8; rear = .45 - f * .3; headOut = 0; }
      if (st === 'attack' && this.attack === 'flurry') { rear = .22; headOut = 0; }
      if (st === 'hop') { lift = Math.sin(Math.min(1, t / .34) * Math.PI) * .75; rear = -.35; headOut = 0; }
      if (st === 'taunt') { lift = Math.abs(Math.sin(t * 9)) * .35; rear = -.2; headOut = 0; }      // hopping and screeching
      if (st === 'windup' && this.attack === 'swing') { rear = -.25 * w; lift = -.15 * w; headOut = 0; }     // crouch, eyes on the canopy
      if (st === 'attack' && this.attack === 'swing') { const u = this.swingU ?? 0; lift = .5 + Math.sin(u * Math.PI) * 1.4; rear = -.3 + u * .3; headOut = 0; }
    }
    this.body.rotation.x = damp(this.body.rotation.x, rear + this.jolt.pitch, st === 'attack' ? 22 : 10, dt);
    this.body.rotation.z = damp(this.body.rotation.z, lean + this.jolt.roll + flip * Math.PI, flip ? 9 : 20, dt);
    if (!G?.whirl) this.body.rotation.y = st === 'attack' && this.attack === 'spin' ? spin : damp(this.body.rotation.y, spin, 12, dt);
    this.body.position.y = damp(this.body.position.y, lift + flip * 2.3 + Math.sin(time * 7) * .01, 12, dt);
    // A dressed monkey or gorilla (shadowmere.js) keeps its head on its own neck, moving less.
    const nb = this.neckBase || { y: 1.2, z: 1.2, k: 1 };
    this.neck.position.z = damp(this.neck.position.z, nb.z + headOut * nb.k, st === 'attack' ? 26 : 12, dt);
    this.neck.position.y = damp(this.neck.position.y, nb.y + headLow * nb.k, 10, dt);
    const moving = st === 'attack' && this.attack === 'lunge' ? 2.2 : st === 'attack' && this.attack === 'charge' ? 2.6 : st === 'toppled' ? 1 : Math.min(1, (this.speed + (st === 'circle' ? .6 : 0)) / 2);
    this.legPhase += dt * (4 + this.speed * 4.5) * legRate;
    this.legs.forEach(({ mesh, phase }) => {
      mesh.rotation.x = Math.sin(this.legPhase + phase) * .5 * moving;
      mesh.scale.setScalar(damp(mesh.scale.x, 1 - legsIn * .55, 14, dt));
    });
    // The swing's kick: both feet out at the side of you.
    if (this.type === 'monkey' && st === 'attack' && this.attack === 'swing') { const u = this.swingU ?? 0; for (const { mesh } of this.legs) mesh.rotation.x = u > .3 && u < .7 ? -1.4 : -.4; }
    if (G && this.arms) {
      for (const { mesh, side } of this.arms) {
        const [x, z] = side < 0 ? G.L : G.R, fast = st === 'attack' ? 22 : 10;
        mesh.rotation.x = damp(mesh.rotation.x, x, fast, dt); mesh.rotation.z = damp(mesh.rotation.z, z, fast, dt);
      }
      if (this.sword) this.sword.rotation.x = damp(this.sword.rotation.x, G.sword, st === 'attack' ? 18 : 8, dt);
    } else if(this.arms){
      const wind=st==='windup'?Math.min(1,t/(tm?.windup||1)):0,attack=st==='attack'?Math.max(0,1-t/.22):0;
      for(const {mesh,side} of this.arms){
        const guard=st==='alert'?.18:0,lift=this.type==='gorilla'?(wind*.95+attack*-.75):wind*.52;
        mesh.rotation.x=damp(mesh.rotation.x,guard+lift,st==='attack'?20:9,dt);
        mesh.rotation.z=damp(mesh.rotation.z,side*(st==='recover'?.13:0),8,dt);
      }
      if(this.sword)this.sword.rotation.x=damp(this.sword.rotation.x,st==='windup'?.64:st==='attack'?-.48:0,st==='attack'?18:8,dt);
    }
    if (this.type === 'monkey' && this.arms && a) {
      // Arms: both cocked back for the flurry, then alternate claws; out front in the pounce; a throw for the seed.
      const w = Math.min(1, t / (tm?.windup || 1));
      for (const { mesh, side } of this.arms) {
        let x = null;
        if (st === 'windup') x = this.attack === 'flurry' ? 1.25 * w : this.attack === 'pounce' ? .9 * w : this.attack === 'seed' && side > 0 ? 2.3 * w : this.attack === 'swing' && side > 0 ? -2.6 * w : null;
        if (st === 'attack') {
          if (this.attack === 'flurry') { const mine = (this.swipe ?? 0) % 2 === (side > 0 ? 0 : 1), since = t - (a.swipes[this.swipe] ?? 0); x = mine ? (since < .14 ? 1.3 - since / .14 * 2.8 : -1.5) : .5; }
          if (this.attack === 'pounce') x = -1.35;
          if (this.attack === 'seed' && side > 0) x = -1.4;
          if (this.attack === 'swing') x = side > 0 ? -2.9 : -.6;
        }
        if (st === 'taunt') x = -2.3 + Math.sin(t * 14 + side) * .6;
        if (x !== null) mesh.rotation.x = damp(mesh.rotation.x, x, st === 'attack' ? 30 : 12, dt);
      }
    }
    if(this.tail)this.tail.rotation.x=Math.sin(time*(this.type==='monkey'&&st!=='wander'?7:4)+this.home.x)*.25;
    if (this.vine) {
      // From high in the canopy above you down to its raised hand.
      const P = this.swingPath, on = this.alive && st === 'attack' && this.attack === 'swing' && P;
      this.vine.visible = !!on;
      if (on) {
        const hand = new THREE.Vector3(); (this.arms[1] || this.arms[0]).mesh.getWorldPosition(hand); hand.y += .55;
        const top = new THREE.Vector3(P.cx, P.ay, P.cz), d = top.clone().sub(hand), len = d.length();
        this.vine.position.copy(hand).addScaledVector(d, .5); this.vine.scale.set(1, len, 1);
        this.vine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      }
    }

    const rage = this.enraged ? 1 : 0;
    if (this.isBoss) {
      this.bossAura.intensity = (1.8 + glow * 4 + Math.sin(time * 5) * .35) * (this.shellBroken ? 1.5 : 1);
      this.bossJaw.rotation.x = damp(this.bossJaw.rotation.x, st === 'windup' || st === 'attack' ? -.42 : -.08, 9, dt);
    }
    this.shellMat.emissive.setRGB(.55 * glow + this.flash * 3, .28 * glow + this.flash * 3, .05 * glow + this.flash * 3);
    this.skinMat.emissive.setScalar(this.flash * 2.5);
    this.eyeMat.emissive.setRGB(.35 + glow * .8 + rage * .9, (.26 + glow * .4) * (1 - rage * .8), .13 * (1 - rage));
    if (this.type === 'gorilla') this.crownGlow(st === 'phase' ? Math.min(1, Math.max(0, (t - .8) / .65)) : this.phase > 1 ? 1 : 0, time);
    this.tell.visible = this.alive && (st === 'windup' || st === 'attack' || st === 'recover');
    if (this.tell.visible) {
      const warning = st === 'windup', w = warning ? Math.min(1, t / tm.windup) : 1;
      // The spin's danger zone is wider than the body; size the tell to match.
      const A2 = this.attack ? ATTACKS[this.attack] : null;
      const reach = this.attack === 'spin' ? (this.radius + .55) / this.radius : this.attack === 'quake' ? QUAKE_RADIUS / this.radius : A2?.ring ? A2.ring[1] / this.radius : A2?.reach ? A2.reach / this.radius : 1;
      this.tell.position.set(this.x, groundY(this.x, this.z) + .065, this.z);
      this.tell.scale.setScalar(this.radius * reach * (warning ? .9 + .45 * w : st === 'attack' ? 1.42 : 1.18));
      this.tell.material.color.setHex(warning ? 0xe9ad62 : st === 'attack' ? 0xf27d56 : 0xb9d892);
      this.tell.material.opacity = warning ? .25 + .45 * w : st === 'attack' ? .75 : .3;
    }
    if (this.lineTell) {
      // Garrow's line attacks: amber while it winds up, red as it strikes; the spike line after a leap.
      const A3 = this.attack ? ATTACKS[this.attack] : null, spikes = this.attack === 'leap' && st === 'attack' && this.leap?.landed && t < A3.active * .7 + .4;
      const line = spikes ? [.6, 7, .75] : A3?.line && (st === 'windup' || st === 'attack') ? A3.line : this.attack === 'combo' && st === 'windup' ? [.4, 3.6, .55] : null;
      this.lineTell.visible = this.alive && !!line;
      if (line) {
        const [from, to, half] = line, mid = (from + to) / 2, cx = this.x + Math.sin(this.heading) * mid, cz = this.z + Math.cos(this.heading) * mid, warn = st === 'windup';
        this.lineTell.position.set(cx, groundY(cx, cz) + .07, cz); this.lineTell.rotation.set(-Math.PI / 2, this.heading, 0); this.lineTell.scale.set(half * 2, to - from, 1);
        this.lineTell.material.color.setHex(warn ? 0xe9ad62 : spikes ? 0xb57cff : 0xf27d56);
        this.lineTell.material.opacity = warn ? .12 + .3 * Math.min(1, t / (tm?.windup || 1)) : .42;
      }
    }
    if (this.shake > 0) { this.root.position.x += (Math.random() - .5) * .07; this.root.position.z += (Math.random() - .5) * .07; }
    this.root.updateMatrixWorld(true);
  }
  /** The crown-glass in Garrow's blade wakes in phase 2: a violet glow and light. */
  crownGlow(k, time) {
    if (!this.sword) return;
    if (this.glowOf !== this.sword) {
      this.glowOf = this.sword; this.glowMats = [];
      this.sword.traverse(m => { if (m.material?.emissive) { m.material = m.material.clone(); this.glowMats.push({ m: m.material, color: m.material.emissive.clone(), k: m.material.emissiveIntensity }); } });
      this.glowLight = new THREE.PointLight(0xa070ff, 0, 7, 2); this.glowLight.position.set(0, -.9, .2); this.sword.add(this.glowLight);
    }
    const violet = new THREE.Color(0xa45cff), pulse = 1 + Math.sin(time * 6) * .15 * k;
    for (const g of this.glowMats) { g.m.emissive.copy(g.color).lerp(violet, k); g.m.emissiveIntensity = (g.k + (2.6 - g.k) * k) * pulse; }
    this.glowLight.intensity = 6 * k * pulse;
    // Phase 2 changes the whole body: crown-glass bursts from its back, shoulders and head and
    // creeps up the sword arm, the fur goes dark, the eyes burn violet, and it stands taller.
    if (k > 0 && !this.growth) this.buildGrowth();
    if (this.growth) {
      for (const c of this.growth) { const s = c.back && this.crystalsBroken ? 0 : c.size * Math.min(1, k * 1.25 - c.delay * .25); c.mesh.visible = s > .01; c.mesh.scale.setScalar(Math.max(.001, s)); }
      const dark = new THREE.Color(0x14101c);
      for (const f of this.furTint) f.m.color.copy(f.color).lerp(dark, k * .7);
      if (this.eyeMat) { this.eyeMat.emissive.lerp(violet, k); this.eyeMat.emissiveIntensity = 1 + 2 * k; }
      this.aura.intensity = 5 * k * pulse;
      this.root.scale.setScalar(this.kind.size * (1 + .1 * k));
    }
  }
  /** The crystals of phase 2, sized to the model it wears (the Blender body or the fallback). */
  buildGrowth() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a2a80, emissive: 0x7a3cff, emissiveIntensity: 1.6, roughness: .2, metalness: .3, flatShading: true });
    const geo = new THREE.ConeGeometry(.15, 1, 5); geo.translate(0, .5, 0);      // base at the origin, so it grows out of the body
    const boxOf = g => { const box = new THREE.Box3(), tmp = new THREE.Box3(); g.updateMatrixWorld(true); const inv = g.matrixWorld.clone().invert();
      g.traverse(m => { if (m.isMesh) { m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox).applyMatrix4(inv.clone().multiply(m.matrixWorld)); box.union(tmp); } }); return box; };
    this.growth = [];
    const add = (parent, x, y, z, rx, rz, size, delay, back = false) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.visible = false; m.castShadow = true; parent.add(m); this.growth.push({ mesh: m, size, delay, back }); };
    const torso = this.body.children[0], tb = boxOf(torso), o = torso.position, h = tb.max.y - tb.min.y;
    for (let i = 0; i < 6; i++) add(this.body, o.x + (i % 2 ? .14 : -.14), o.y + tb.max.y - .12 - i * h * .09, o.z + tb.min.z + .12, -.85 - i * .05, (i % 2 ? .2 : -.2), 1.05 - i * .1, i / 6, true);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) add(this.body, o.x + side * (tb.max.x * .78 - i * .12), o.y + tb.max.y - .2 - i * .1, o.z + (i - 1) * .16, (i - 1) * .3, -side * (.75 + i * .15), .75 - i * .12, .3 + i * .1);
    if (this.neck) { const hb = boxOf(this.neck); for (let i = 0; i < 4; i++) { const a = -1 + i * .66; add(this.neck, Math.sin(a) * .22, hb.max.y - .08, -.05 + Math.cos(a) * .05, -.35, -a * .6, .42 + (i % 2) * .12, .5); } }
    const arm = this.arms?.find(a => a.side > 0)?.mesh;
    if (arm) { const ab = boxOf(arm); for (let i = 0; i < 4; i++) add(arm, ab.max.x - .04, ab.min.y + (ab.max.y - ab.min.y) * (.15 + i * .18), (i % 2 ? .1 : -.08), (i % 2 ? .5 : -.4), -1.1, .5 - i * .06, .2 + i * .15); }
    this.furTint = [this.shellMat, this.skinMat].filter(Boolean).map(m => ({ m, color: m.color.clone() }));
    this.aura = new THREE.PointLight(0x9d5cff, 0, 9, 2); this.aura.position.set(0, 1.6, .4); this.body.add(this.aura);
  }
  /** Before its quest: kneeling inside the seal. After it: freed, at rest, the crown-glass gone. */
  bind() { this.respawn(); this.alive = false; this.setState('bound'); this.heading = 0; }
  calm() { this.respawn(); this.alive = false; this.setState('calm'); this.heading = 0; }
  /** Its quest begins: up off its knees and into the fight. */
  wake() { this.respawn(); this.setState('alert'); }
  rest(dt, time) {
    this.place();
    const calm = this.state === 'calm';
    this.body.rotation.x = damp(this.body.rotation.x, calm ? .2 : .42, 4, dt); this.body.rotation.z = damp(this.body.rotation.z, 0, 4, dt); this.body.rotation.y = 0;
    this.body.position.y = damp(this.body.position.y, -.38 + Math.sin(time * 1.3) * .03, 4, dt);
    for (const { mesh } of this.legs) mesh.rotation.x = damp(mesh.rotation.x, -1.0, 4, dt);
    for (const { mesh, side } of this.arms || []) { mesh.rotation.x = damp(mesh.rotation.x, calm ? -.25 : .3, 4, dt); mesh.rotation.z = damp(mesh.rotation.z, side * .15, 4, dt); }
    if (this.sword) this.sword.visible = !calm;
    this.tell.visible = false; if (this.lineTell) this.lineTell.visible = false; this.bar.visible = false;
    if (this.type === 'gorilla') this.crownGlow(0, time);
    this.root.visible = true; this.root.updateMatrixWorld(true);
  }
  showBar(visible, camera) {
    this.bar.visible = !this.isBoss && !this.bossBar && visible && this.alive && this.state !== 'toppled' && this.state !== 'rising' && this.state !== 'return';
    if (!this.bar.visible) return;
    this.bar.quaternion.copy(this.root.quaternion).invert().multiply(camera.quaternion);
    const f = this.health / this.maxHealth;
    this.barFill.scale.x = Math.max(.001, f); this.barFill.position.x = -.76 * (1 - f);
    this.barFill.material.color.set(this.enraged ? 0xe0805a : 0xd6c07a);
  }
  /** Dormant: out of the world until its chapter of the story calls it. */
  sleep() {
    this.alive = false; this.setState('dormant'); this.root.visible = false; this.tell.visible = false; this.bar.visible = false; if (this.lineTell) this.lineTell.visible = false; if (this.vine) this.vine.visible = false;
  }
  /** Rise out of the ground at home, then notice the explorer. */
  emerge() {
    this.respawn(); this.setState('emerge'); this.body.position.y = -2.6; this.heading = Math.random() * Math.PI * 2;
  }
  respawn() {
    this.maxHealth = healthFor(this.type, this.kind); this.alive = true; this.health = this.maxHealth; this.poise = this.kind.poise; this.enraged = false; this.phase = 1; this.pendingPhase = false; this.crystalDamage = 0; this.crystalsBroken = false;
    if (this.isBoss) { this.shellDamage = 0; this.shellBroken = false; this.shellMat.color.setHex(0x28372d); this.bossScuteMat.color.setHex(0x8e5636); this.bossScuteMat.emissiveIntensity = .55; this.shellMat.roughness = .92; }
    this.x = this.home.x; this.z = this.home.z;
    this.root.visible = true; this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); if (this.sword) this.sword.visible = true;
    this.setState('wander'); this.cooldown = 1.5; this.push = { x: 0, z: 0 }; this.attack = null;
  }
}

export function createCreatures(scene, chapters = []) {
  // The first shellback waits on the open slope below the camp so the first
  // fight (Wren's trial) happens on readable ground. It returns after defeat.
  const list = [new Creature(scene, 1, 27, 'shellback', { respawn: 6, id: 'trial' })];
  // Every other creature belongs to a chapter of the story and gathers at that
  // chapter's site; it stays dormant until the story reaches it.
  for (const c of chapters) for (const [x, z, type] of c.mobs) {
    const m = new Creature(scene, x, z, type, { chapter: c.id }); m.sleep(); list.push(m);
  }
  // Shadowmere patrols and its guardian belong to the second atlas destination.
  // They keep their own home radius and never change Verdant Reach progression.
  for(const [i,x,z] of [[0,SHADOWMERE.x-10,SHADOWMERE.z+8],[1,SHADOWMERE.x+11,SHADOWMERE.z+4],[2,SHADOWMERE.x-15,SHADOWMERE.z-4],[3,SHADOWMERE.x+8,SHADOWMERE.z+26],[4,SHADOWMERE.x-9,SHADOWMERE.z+31]]){
    const monkey=new Creature(scene,x,z,'monkey',{id:`shadow-monkey-${i}`,respawn:45});monkey.name='GREEN MONKEY';list.push(monkey);
  }
  const guardian=new Creature(scene,SHADOWMERE.guardian.x,SHADOWMERE.guardian.z,'gorilla',{id:'shadow-gorilla',respawn:150});guardian.name='GARROW · THE ROOTBOUND';list.push(guardian);
  // Lantern thieves: two at each dark lantern round Garrow's seal; they drop from the canopy when you come.
  for(const L of GARROW_SEAL.lanterns)for(const j of [0,1]){
    const a=L.a+(j?.5:-.5),x=GARROW_SEAL.x+Math.sin(a)*11.8,z=GARROW_SEAL.z+Math.cos(a)*11.8;
    const t=new Creature(scene,x,z,'monkey',{id:`seal-thief-${L.i}-${j}`});t.name='LANTERN THIEF';t.lantern=L.i;t.sleep();list.push(t);
  }
  return list;
}

/**
 * Team fights: the k-th extra hollowed for a chapter's nest (two per extra
 * explorer). Every game makes the same one for the same k, so it can be
 * synced by id. It stands in a free spot around one of the nest's own.
 */
export function extraHollowed(scene, chapter, k, grid) {
  const [hx, hz, type] = chapter.mobs[k % chapter.mobs.length];
  let x = hx, z = hz;
  for (let i = 0; i < 16; i++) {
    const a = k * 2.4 + i * .9, r = 3 + (k % 2) * 1.3 + i * .25, px = hx + Math.sin(a) * r, pz = hz + Math.cos(a) * r;
    if (!grid || canOccupy(px, pz, groundY(px, pz), grid, groundY, .75)) { x = px; z = pz; break; }
  }
  const m = new Creature(scene, x, z, type, { chapter: chapter.id });
  m.sleep(); m.extra = k; m.netId = `x:${chapter.id}:${k}`;
  return m;
}
