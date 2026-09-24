import * as THREE from 'three';
import { MOVES, EVADE } from './moves.js';
import { strikeSegment } from './hits.js';

/**
 * Combat readout (F3, or ?debug in the URL). Shows the live striking limb,
 * every hurt volume, the creature's bite, state timelines and a log that says
 * why each strike did or did not land.
 */
export class CombatDebug {
  constructor(scene) {
    this.enabled = new URLSearchParams(location.search).has('debug');
    this.group = new THREE.Group(); scene.add(this.group);
    this.panel = document.createElement('pre');
    Object.assign(this.panel.style, { position: 'fixed', left: '12px', top: '120px', margin: 0, padding: '8px 10px', font: '11px/1.45 "DM Mono",monospace',
      color: '#e7f3dc', background: '#081512cc', border: '1px solid #6d8d74', pointerEvents: 'none', zIndex: 5, whiteSpace: 'pre', maxWidth: '44vw' });
    document.body.appendChild(this.panel);
    this.log = [];
    this.pool = []; this.used = 0;
    this.sphere = new THREE.SphereGeometry(1, 12, 8);
    this.mats = {
      hurt: new THREE.MeshBasicMaterial({ color: 0x7fe08a, wireframe: true, transparent: true, opacity: .45 }),
      live: new THREE.MeshBasicMaterial({ color: 0xff5a4a, wireframe: true }),
      idle: new THREE.MeshBasicMaterial({ color: 0x9aa39e, wireframe: true, transparent: true, opacity: .35 }),
      bite: new THREE.MeshBasicMaterial({ color: 0xffb14a, wireframe: true }),
      player: new THREE.MeshBasicMaterial({ color: 0x74b8ff, wireframe: true, transparent: true, opacity: .5 })
    };
    this.show(this.enabled);
  }
  toggle() { this.show(!this.enabled); }
  show(on) { this.enabled = on; this.group.visible = on; this.panel.style.display = on ? 'block' : 'none'; }
  note(text, clock) { this.log.unshift(`${clock.toFixed(2).padStart(6)}  ${text}`); this.log.length = Math.min(this.log.length, 9); }
  ball(x, y, z, r, mat) {
    let m = this.pool[this.used];
    if (!m) { m = new THREE.Mesh(this.sphere, mat); this.group.add(m); this.pool.push(m); }
    m.material = mat; m.visible = true; m.position.set(x, y, z); m.scale.setScalar(r); this.used++;
  }
  update({ combat, bones, creatures, player, lockTarget }) {
    if (!this.enabled) return;
    this.used = 0;
    for (const c of creatures) {
      if (!c.alive) continue;
      for (const v of c.hurtVolumes()) this.ball(v.x, v.y, v.z, v.r, this.mats.hurt);
      if (c.state === 'lunge' || c.state === 'windup') { const b = c.biteSphere(); this.ball(b.x, b.y, b.z, b.r, c.state === 'lunge' ? this.mats.bite : this.mats.idle); }
    }
    // Player body (what a bite must reach) and the striking limb.
    for (const y of [.5, 1.0, 1.5]) this.ball(player.x, player.y + y, player.z, .34, this.mats.player);
    const move = combat.state === 'attack' ? MOVES[combat.move] : null;
    if (move) {
      const seg = strikeSegment(bones, move.hitbox), live = combat.t >= move.active[0] && combat.t < move.active[1];
      for (let i = 0; i <= 3; i++) { const p = seg.a.clone().lerp(seg.b, i / 3); this.ball(p.x, p.y, p.z, move.hitbox.radius, live ? this.mats.live : this.mats.idle); }
    }
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
    const c = lockTarget || creatures.filter(x => x.alive).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    const timeline = move ? `${move.label.padEnd(14)} t=${combat.t.toFixed(2)}  ${combat.phase().toUpperCase()}\n  active ${move.active.join('–')}  chain≥${move.chainFrom}  evade≥${move.evadeFrom}  move≥${move.moveFrom}`
      : combat.state === 'evade' ? `LEAF STEP     t=${combat.t.toFixed(2)}  ${combat.invulnerable ? 'INVULNERABLE' : 'recovering'}\n  i-frames ${EVADE.invulnerable.join('–')}  attack≥${EVADE.attackFrom}` : combat.state.toUpperCase();
    const buf = ['attack', 'evade'].filter(a => combat.buffered(a)).join('+') || '—';
    this.panel.textContent = `COMBAT READOUT (F3)\nexplorer  ${timeline}\n  buffered: ${buf}   lock: ${lockTarget ? 'on' : 'off'}\n` +
      (c ? `creature  ${c.state.padEnd(8)} t=${c.t.toFixed(2)}  hp ${c.health}/${c.maxHealth}  dist ${Math.hypot(c.x - player.x, c.z - player.z).toFixed(2)} m\n` : '') +
      `\n${this.log.join('\n')}`;
  }
}
