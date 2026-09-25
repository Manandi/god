import * as THREE from 'three';
import { MOVES, FIRST_LIGHT, HEAVY, EVADE, HURT, COUNTER, phaseOf, travelBetween } from './moves.js';
import { strikeSegment, sweep, obstacleBetween } from './hits.js';

const BUFFER = .28;           // how long a press waits for a window to open
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const yawOf = (x, z) => Math.atan2(-x, -z);        // explorer faces -Z at yaw 0

/**
 * The explorer's combat state machine.
 *
 *   move ─light─▶ palm ─light─▶ swing ─light─▶ palm …      (chain windows)
 *     │             └──── heavy ────▶ heel (finisher) ◀── heavy ── move
 *     │                                 hold heavy: charges at the chamber pose
 *     ├─evade─▶ evade roll (i-frames; a hit inside the first frames is a PERFECT evade)
 *     │            └─ attackFrom: a buffered attack starts straight out of the roll
 *     ├─light/heavy near a toppled creature ─▶ root (Root Strike finisher)
 *     └──── hurt (light flinch / heavy knockdown) unless in i-frames or hyper-armour
 *
 * Inputs are buffered for BUFFER seconds, so a press slightly early still lands
 * on the next open window. Every action needs Breath (stamina) above zero; the
 * caller spends it from the 'spend' events. The controller decides intent only:
 * facing, displacement and which clip is at which time.
 */
export class PlayerCombat {
  constructor() {
    this.state = 'move'; this.t = 0; this.move = null;
    this.buffer = { light: -1, heavy: -1, evade: -1 };
    this.heavyHeld = false; this.charging = false; this.chargeTime = 0; this.chargeLevel = 0;
    this.clock = 0; this.facing = 0;
    this.evadeDir = { x: 0, z: 1 }; this.evadeClip = 'evadeForward'; this.iframeEnd = EVADE.invulnerable[1];
    this.hitThisSwing = new Set();
    this.prevSegment = null; this.segment = { a: new THREE.Vector3(), b: new THREE.Vector3() };
    this.nearest = Infinity; this.blocked = null; this.target = null;
    this.hurtFrom = { x: 0, z: 0 }; this.hurtKind = 'light';
    this.invulnerableUntil = 0; this.counterUntil = -1;
    this.events = [];
  }
  press(action) { this.buffer[action] = this.clock; }
  buffered(action) { return this.buffer[action] >= 0 && this.clock - this.buffer[action] <= BUFFER; }
  consume(action) { this.buffer[action] = -1; }
  get invulnerable() {
    return (this.state === 'evade' && this.t >= EVADE.invulnerable[0] && this.t < this.iframeEnd) || this.clock < this.invulnerableUntil;
  }
  /** Inside the opening frames of a roll: a hit here counts as a perfect evade. */
  get perfectWindow() { return this.state === 'evade' && this.t < EVADE.perfect + EVADE.invulnerable[0]; }
  /** Hyper-armour: hits still hurt but do not interrupt a heavy strike. */
  get armored() {
    if (this.state !== 'attack') return false;
    const m = MOVES[this.move];
    return this.charging || (m.armor && this.t >= m.armor[0] && this.t < m.armor[1]);
  }
  get countering() { return this.clock < this.counterUntil; }
  get busy() { return this.state !== 'move'; }
  phase() { return this.state === 'attack' ? (this.charging ? 'charging' : phaseOf(MOVES[this.move], this.t)) : this.state; }

  startAttack(name, ctx) {
    const m = MOVES[name];
    if (m.stamina && ctx.stamina <= 0) { this.events.push({ type: 'tired' }); return false; }
    this.state = 'attack'; this.move = name; this.t = 0;
    this.charging = false; this.chargeTime = 0; this.chargeLevel = 0;
    this.hitThisSwing.clear(); this.prevSegment = null; this.nearest = Infinity; this.blocked = null;
    const aim = ctx.input.x || ctx.input.z ? yawOf(ctx.input.x, ctx.input.z) : this.facing;
    this.target = name === 'root' ? ctx.critTarget : ctx.pickTarget(aim);
    if (!this.target && (ctx.input.x || ctx.input.z)) this.facing = aim;   // strike where the stick points
    this.events.push({ type: 'swing', move: name }, { type: 'spend', amount: m.stamina });
    return true;
  }
  tryAttack(ctx, from) {
    // Root Strike takes priority when a toppled creature is in reach.
    if ((this.buffered('light') || this.buffered('heavy')) && ctx.critTarget) {
      this.consume('light'); this.consume('heavy'); return this.startAttack('root', ctx);
    }
    if (this.buffered('heavy') && (!from || this.t >= from.heavyFrom)) { this.consume('heavy'); return this.startAttack(HEAVY, ctx); }
    if (this.buffered('light') && (!from || (from.next && this.t >= from.chainFrom))) {
      this.consume('light'); return this.startAttack(from?.next || FIRST_LIGHT, ctx);
    }
    return false;
  }
  startEvade(ctx) {
    this.consume('evade');
    if (ctx.stamina <= 0) { this.events.push({ type: 'tired' }); return false; }
    this.state = 'evade'; this.t = 0; this.move = null; this.charging = false;
    this.iframeEnd = EVADE.invulnerable[1] + (ctx.iframeBonus || 0);
    let { x, z } = ctx.input;
    if (!x && !z) { x = Math.sin(this.facing); z = Math.cos(this.facing); }      // roll back
    const len = Math.hypot(x, z); this.evadeDir = { x: x / len, z: z / len };
    // The roll travels the way the body faces; with a lock-on the body turns back
    // to the target as soon as the roll ends.
    this.facing = yawOf(x, z); this.evadeClip = 'evadeForward';
    this.events.push({ type: 'evade' }, { type: 'spend', amount: EVADE.stamina });
    return true;
  }
  /** A perfect evade: the caller slows time; the next strikes count as counters. */
  perfectEvade() { this.counterUntil = this.clock + COUNTER.window; this.events.push({ type: 'perfect' }); }
  hurt(fromX, fromZ, x, z, kind = 'light') {
    this.state = 'hurt'; this.t = 0; this.move = null; this.charging = false; this.hurtKind = kind;
    const len = Math.hypot(x - fromX, z - fromZ) || 1;
    this.hurtFrom = { x: (x - fromX) / len, z: (z - fromZ) / len };
    this.invulnerableUntil = this.clock + HURT[kind].invulnerable;
    this.facing = yawOf(-this.hurtFrom.x, -this.hurtFrom.z);
  }

  /**
   * ctx: input {x,z}, lockTarget, pickTarget(yaw), critTarget, bones, grid,
   *      targets, stamina, iframeBonus, x, z, chest.
   * Returns {dx,dz} root displacement for this frame.
   */
  update(dt, ctx) {
    this.clock += dt; this.events = [];
    const out = { dx: 0, dz: 0 };
    const t0 = this.t; this.t += dt;
    const hasInput = !!(ctx.input.x || ctx.input.z);

    if (this.state === 'move') {
      if (this.buffered('evade')) this.startEvade(ctx);
      else this.tryAttack(ctx, null);
      return out;
    }

    if (this.state === 'attack') {
      const m = MOVES[this.move];
      // Charging: hold at the chamber pose while the heavy input is held.
      if (m.charge && t0 < m.charge.at + 1e-6 && this.t >= m.charge.at && (this.heavyHeld || this.charging)) {
        if (this.heavyHeld && this.chargeTime < m.charge.max) {
          this.charging = true; this.chargeTime += dt; this.t = m.charge.at;
          const level = m.charge.levels.filter(l => this.chargeTime >= l).length;
          if (level > this.chargeLevel) { this.chargeLevel = level; this.events.push({ type: 'charge', level }, { type: 'spend', amount: m.charge.stamina }); }
          if (this.buffered('evade')) { this.charging = false; this.startEvade(ctx); }
          return out;
        }
        if (this.charging) { this.charging = false; this.events.push({ type: 'release', level: this.chargeLevel }); }
      }
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
          const charge = m.charge ? { damage: m.charge.damage[this.chargeLevel], poise: m.charge.poise[this.chargeLevel] } : { damage: 1, poise: 1 };
          const counter = this.countering && m.kind !== 'critical';
          for (const c of result.contacts) {
            const wall = obstacleBetween(ctx.chest, c.point, ctx.grid);
            if (wall) { this.blocked = wall; this.events.push({ type: 'blocked', move: this.move, point: wall.point }); break; }
            this.hitThisSwing.add(c.target);
            this.events.push({ type: 'hit', move: this.move, target: c.target, part: c.part, point: c.point, t: this.t,
              damage: m.damage * charge.damage * (counter ? COUNTER.damage : 1), poise: m.poise * charge.poise * (counter ? COUNTER.poise : 1),
              push: m.push * (1 + this.chargeLevel * .25), stagger: m.stagger, hitstop: m.hitstop * (1 + this.chargeLevel * .3),
              chargeLevel: this.chargeLevel, counter, critical: m.kind === 'critical' });
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
      if (this.tryAttack(ctx, m)) return out;
      if ((hasInput && this.t >= m.moveFrom) || this.t >= m.duration) this.state = 'move';
      return out;
    }

    if (this.state === 'evade') {
      const step = travelBetween(EVADE.travel, t0, this.t);
      out.dx = this.evadeDir.x * step; out.dz = this.evadeDir.z * step;
      if (this.t >= EVADE.attackFrom && this.tryAttack(ctx, null)) return out;
      if (this.buffered('evade') && this.t >= EVADE.evadeFrom) { this.startEvade(ctx); return out; }
      if ((hasInput && this.t >= EVADE.moveFrom) || this.t >= EVADE.duration) this.state = 'move';
      return out;
    }

    if (this.state === 'hurt') {
      const h = HURT[this.hurtKind];
      const step = travelBetween({ from: 0, to: .2, distance: h.push }, t0, this.t);
      out.dx = this.hurtFrom.x * step; out.dz = this.hurtFrom.z * step;
      if (this.buffered('evade') && this.t >= h.evadeFrom) { this.startEvade(ctx); return out; }
      if (this.t >= h.attackFrom && this.tryAttack(ctx, null)) return out;
      if ((hasInput && this.t >= h.moveFrom) || this.t >= h.duration) this.state = 'move';
    }
    return out;
  }

  /** The one-shot clip and time the body should show, or null for locomotion. */
  clip() {
    if (this.state === 'attack') {
      const m = MOVES[this.move];
      // Root Strike plays the heel clip a touch slower in its wind-up for weight.
      return { name: m.clip, time: this.t, fade: this.t < .05 ? 30 : 14 };
    }
    if (this.state === 'evade') return { name: this.evadeClip, time: this.t, fade: 30 };
    if (this.state === 'hurt') return { name: 'hurt', time: this.hurtKind === 'heavy' ? Math.min(this.t * .6, .4) : this.t, fade: 40 };
    return null;
  }
}
