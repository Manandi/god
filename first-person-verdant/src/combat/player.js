import * as THREE from 'three';
import { MOVES, FIRST_MOVE, EVADE, HURT, phaseOf, travelBetween } from './moves.js';
import { strikeSegment, sweep, obstacleBetween } from './hits.js';

const BUFFER = .28;           // how long a press waits for a window to open
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const yawOf = (x, z) => Math.atan2(-x, -z);        // explorer faces -Z at yaw 0

/**
 * The explorer's combat state machine.
 *
 *   move ──attack──▶ attack(palm) ──chain──▶ attack(swing) ──chain──▶ attack(heel)
 *    ▲  ╲                 │  evadeFrom / moveFrom / end                  │
 *    │   ╲──evade──▶ evade ◀─────────────────────────────────────────────┘
 *    │                 │ attackFrom: a buffered attack becomes a counter palm
 *    └──── hurt ◀──────┘ (any state except invulnerable frames)
 *
 * Inputs are buffered for BUFFER seconds, so a press slightly early still
 * lands on the next open window. The controller only decides intent: facing,
 * displacement and which clip is at which time. The caller moves the body
 * through collision and feeds animation.
 */
export class PlayerCombat {
  constructor() {
    this.state = 'move'; this.t = 0; this.move = null;
    this.buffer = { attack: -1, evade: -1 };
    this.clock = 0;
    this.facing = 0;
    this.evadeDir = { x: 0, z: 1 }; this.evadeClip = 'evadeBack';
    this.hitThisSwing = new Set();
    this.prevSegment = null; this.segment = { a: new THREE.Vector3(), b: new THREE.Vector3() };
    this.nearest = Infinity; this.blocked = null;
    this.target = null;
    this.hurtFrom = { x: 0, z: 0 };
    this.invulnerableUntil = 0;
    this.events = [];               // feedback for the caller this frame
  }
  press(action) { this.buffer[action] = this.clock; }
  buffered(action) { return this.buffer[action] >= 0 && this.clock - this.buffer[action] <= BUFFER; }
  consume(action) { this.buffer[action] = -1; }
  get invulnerable() {
    return (this.state === 'evade' && this.t >= EVADE.invulnerable[0] && this.t < EVADE.invulnerable[1]) || this.clock < this.invulnerableUntil;
  }
  get busy() { return this.state !== 'move'; }
  phase() { return this.state === 'attack' ? phaseOf(MOVES[this.move], this.t) : this.state; }

  startAttack(name, ctx) {
    this.state = 'attack'; this.move = name; this.t = 0;
    this.hitThisSwing.clear(); this.prevSegment = null; this.nearest = Infinity; this.blocked = null;
    this.target = ctx.pickTarget(ctx.input.x || ctx.input.z ? yawOf(ctx.input.x, ctx.input.z) : this.facing);
    // Without a target, strike the way the stick points.
    if (!this.target && (ctx.input.x || ctx.input.z)) this.facing = yawOf(ctx.input.x, ctx.input.z);
    this.events.push({ type: 'swing', move: name });
  }
  startEvade(ctx) {
    if (ctx.stamina < EVADE.stamina) { this.events.push({ type: 'tired' }); this.consume('evade'); return; }
    this.consume('evade');
    this.state = 'evade'; this.t = 0; this.move = null;
    let { x, z } = ctx.input;
    if (!x && !z) { x = Math.sin(this.facing); z = Math.cos(this.facing); }      // step back
    const len = Math.hypot(x, z); this.evadeDir = { x: x / len, z: z / len };
    // The roll travels the way the body faces; with a lock-on the body turns back
    // to the target as soon as the roll ends.
    this.facing = yawOf(x, z); this.evadeClip = 'evadeForward';
    this.events.push({ type: 'evade' });
  }
  hurt(fromX, fromZ, x, z) {
    this.state = 'hurt'; this.t = 0; this.move = null;
    const len = Math.hypot(x - fromX, z - fromZ) || 1;
    this.hurtFrom = { x: (x - fromX) / len, z: (z - fromZ) / len };
    this.invulnerableUntil = this.clock + HURT.invulnerable;
    this.facing = yawOf(-this.hurtFrom.x, -this.hurtFrom.z);
  }

  /**
   * ctx: input {x,z} world direction (unit or zero), lockTarget, pickTarget(yaw),
   *      bones (posed last frame), grid, stamina.
   * Returns {dx,dz} root displacement for this frame.
   */
  update(dt, ctx) {
    this.clock += dt; this.events = [];
    const out = { dx: 0, dz: 0 };
    const t0 = this.t; this.t += dt;
    const hasInput = !!(ctx.input.x || ctx.input.z);

    if (this.state === 'move') {
      if (this.buffered('evade')) this.startEvade(ctx);
      else if (this.buffered('attack')) { this.consume('attack'); this.startAttack(FIRST_MOVE, ctx); }
      return out;
    }

    if (this.state === 'attack') {
      const m = MOVES[this.move];
      // Track the target through startup, then commit to the line.
      const target = this.target && this.target.alive ? this.target : null;
      if (t0 < m.turnUntil && target) {
        const want = yawOf(target.x - ctx.x, target.z - ctx.z);
        this.facing += THREE.MathUtils.clamp(angleTo(this.facing, want), -14 * dt, 14 * dt);
      }
      // Step in, but never past striking range of the target.
      let step = travelBetween(m.lunge, t0, this.t);
      if (target) {
        const gap = Math.hypot(target.x - ctx.x, target.z - ctx.z) - target.radius - m.reach * .72;
        step = Math.min(step, Math.max(0, gap));
      }
      out.dx = -Math.sin(this.facing) * step; out.dz = -Math.cos(this.facing) * step;

      // Hit detection runs only while the strike is active, against the posed limb.
      if (this.t >= m.active[0] && t0 < m.active[1] && !this.blocked) {
        strikeSegment(ctx.bones, m.hitbox, this.segment);
        if (this.prevSegment) {
          const obstacle = obstacleBetween(ctx.chest, this.segment.b, ctx.grid);
          const result = sweep(this.prevSegment, this.segment, m.hitbox.radius, ctx.targets.filter(tg => !this.hitThisSwing.has(tg)));
          this.nearest = Math.min(this.nearest, result.nearest);
          for (const c of result.contacts) {
            const wall = obstacleBetween(ctx.chest, c.point, ctx.grid);
            if (wall) { this.blocked = wall; this.events.push({ type: 'blocked', move: this.move, point: wall.point }); break; }
            this.hitThisSwing.add(c.target);
            this.events.push({ type: 'hit', move: this.move, target: c.target, part: c.part, point: c.point, damage: m.damage, push: m.push, stagger: m.stagger, hitstop: m.hitstop });
          }
          if (!this.blocked && obstacle && !result.contacts.length) {
            this.blocked = obstacle; this.events.push({ type: 'blocked', move: this.move, point: obstacle.point });
          }
        }
        this.prevSegment = { a: this.segment.a.clone(), b: this.segment.b.clone() };
      }
      if (t0 < m.active[1] && this.t >= m.active[1] && !this.hitThisSwing.size && !this.blocked) {
        this.events.push({ type: 'whiff', move: this.move, nearest: this.nearest });
      }
      // Windows out of the move.
      if (this.buffered('evade') && this.t >= m.evadeFrom) { this.startEvade(ctx); return out; }
      if (this.buffered('attack') && m.next && this.t >= m.chainFrom) { this.consume('attack'); this.startAttack(m.next, ctx); return out; }
      if ((hasInput && this.t >= m.moveFrom) || this.t >= m.duration) this.state = 'move';
      return out;
    }

    if (this.state === 'evade') {
      const step = travelBetween(EVADE.travel, t0, this.t);
      out.dx = this.evadeDir.x * step; out.dz = this.evadeDir.z * step;
      if (this.buffered('attack') && this.t >= EVADE.attackFrom) { this.consume('attack'); this.startAttack(FIRST_MOVE, ctx); return out; }
      if (this.buffered('evade') && this.t >= EVADE.evadeFrom) { this.startEvade(ctx); return out; }
      if ((hasInput && this.t >= EVADE.moveFrom) || this.t >= EVADE.duration) this.state = 'move';
      return out;
    }

    if (this.state === 'hurt') {
      const step = travelBetween({ from: 0, to: .16, distance: HURT.push }, t0, this.t);
      out.dx = this.hurtFrom.x * step; out.dz = this.hurtFrom.z * step;
      if (this.buffered('evade') && this.t >= HURT.evadeFrom) { this.startEvade(ctx); return out; }
      if (this.buffered('attack') && this.t >= HURT.attackFrom) { this.consume('attack'); this.startAttack(FIRST_MOVE, ctx); return out; }
      if ((hasInput && this.t >= HURT.moveFrom) || this.t >= HURT.duration) this.state = 'move';
    }
    return out;
  }

  /** The one-shot clip and time the body should show, or null for locomotion. */
  clip() {
    if (this.state === 'attack') return { name: MOVES[this.move].clip, time: this.t, fade: this.t < .05 ? 30 : 14 };
    if (this.state === 'evade') return { name: this.evadeClip, time: this.t, fade: 30 };
    if (this.state === 'hurt') return { name: 'hurt', time: this.t, fade: 40 };
    return null;
  }
}
