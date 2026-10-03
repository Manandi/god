import * as THREE from 'three';
import { MOVES, MOVESETS, EVADE, HURT, COUNTER, GUARD, FLASK, phaseOf, travelBetween } from './moves.js';
import { strikeSegment, sweep, obstacleBetween } from './hits.js';
import { angleTo, yawOf } from '../angles.js';

const BUFFER = .28;           // how long a press waits for a window to open

/**
 * The explorer's combat state machine.
 *
 *   move ─light─▶ palm ─light─▶ swing ─light─▶ palm …      (chain windows)
 *     │             └──── heavy ────▶ heel (finisher) ◀── heavy ── move
 *     │                                 hold heavy: charges at the chamber pose
 *     ├─evade─▶ evade dash (i-frames; a hit inside the first frames is a PERFECT evade)
 *     │            └─ attackFrom: a buffered attack starts straight out of the dash
 *     ├─light/heavy near a toppled creature ─▶ root (Root Strike finisher)
 *     ├─hold guard─▶ guard (blocks from the front; raised just before a hit = PARRY)
 *     │            └─ heavy soon after a block ─▶ guard_heel (Guard Counter)
 *     ├─sprinting ─▶ dash_palm / dash_heel · airborne ─▶ air_heel (jump attack)
 *     ├─flask ─▶ drinking (heals at FLASK.healAt; a hit before then wastes it)
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
    this.buffer = { light: -1, heavy: -1, evade: -1, flask: -1 };
    this.guardHeld = false; this.guardSince = -9; this.lastBlockAt = -9; this.healed = false;
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
  /** Inside the opening frames of a dash: a hit here counts as a perfect evade. */
  get perfectWindow() { return this.state === 'evade' && this.t < EVADE.perfect + EVADE.invulnerable[0]; }
  /** Hyper-armour: hits still hurt but do not interrupt a heavy strike. */
  get armored() {
    if (this.state !== 'attack') return false;
    const m = MOVES[this.move];
    return this.charging || (m.armor && this.t >= m.armor[0] && this.t < m.armor[1]);
  }
  get countering() { return this.clock < this.counterUntil; }
  get guarding() { return this.state === 'guard'; }
  /** Guard raised within the parry window: the next blocked hit is deflected. */
  get parrying() { return this.state === 'guard' && this.clock - this.guardSince <= GUARD.parry + (this.parryBonus || 0); }
  /** States in which the explorer can still walk (slowly). */
  get mobile() { return this.state === 'move' || this.state === 'guard' || this.state === 'flask'; }
  raiseGuard(on) {
    if (on && !this.guardHeld) this.guardSince = this.clock;
    this.guardHeld = on;
  }
  /** A blocked hit: the caller has already charged Breath and chip damage. */
  onBlocked() { this.lastBlockAt = this.clock; this.t = 0; }
  get busy() { return this.state !== 'move'; }
  phase() { return this.state === 'attack' ? (this.charging ? 'charging' : phaseOf(MOVES[this.move], this.t)) : this.state; }

  startAttack(name, ctx) {
    const m = MOVES[name];
    if (m.stamina && (ctx.stamina <= 0 || ctx.winded)) { this.events.push({ type: 'tired' }); return false; }
    this.state = 'attack'; this.move = name; this.t = 0;
    this.charging = false; this.chargeTime = 0; this.chargeLevel = 0;
    this.hitThisSwing.clear(); this.prevSegment = null; this.nearest = Infinity; this.blocked = null;
    const moveAim = ctx.aimWithMovement && (ctx.input.x || ctx.input.z);
    const aim = moveAim ? yawOf(ctx.input.x, ctx.input.z) : this.facing;
    this.target = name === 'root' ? ctx.critTarget : ctx.pickTarget(aim);
    if (!this.target && moveAim) this.facing = aim;   // strike where the stick points
    this.events.push({ type: 'swing', move: name }, { type: 'spend', amount: m.stamina });
    return true;
  }
  tryAttack(ctx, from) {
    // Root Strike takes priority when a toppled or reeling creature is in reach.
    const set = ctx.moveset || MOVESETS.unarmed;
    if ((this.buffered('light') || this.buffered('heavy')) && ctx.critTarget && !ctx.airborne) {
      this.consume('light'); this.consume('heavy'); return this.startAttack(set.root, ctx);
    }
    // Contextual openers: in the air, out of a sprint, or right after a block.
    if (!from && (this.buffered('light') || this.buffered('heavy'))) {
      const heavy = this.buffered('heavy');
      let special = null;
      if (ctx.airborne) special = set.air;
      else if (ctx.sprinting) special = heavy ? set.dash_heavy : set.dash_light;
      else if (heavy && this.clock - this.lastBlockAt < GUARD.counterWindow) special = set.counter;
      if (special) { this.consume('light'); this.consume('heavy'); return this.startAttack(special, ctx); }
    }
    if (ctx.airborne) return false;
    if (this.buffered('heavy') && (!from || this.t >= from.heavyFrom)) { this.consume('heavy'); return this.startAttack(set.heavy, ctx); }
    if (this.buffered('light') && (!from || (from.next && this.t >= from.chainFrom))) {
      this.consume('light'); return this.startAttack(from?.next || set.first, ctx);
    }
    return false;
  }
  startEvade(ctx) {
    this.consume('evade');
    if (ctx.stamina <= 0 || ctx.winded) { this.events.push({ type: 'tired' }); return false; }
    this.state = 'evade'; this.t = 0; this.move = null; this.charging = false;
    this.iframeEnd = EVADE.invulnerable[1] + (ctx.iframeBonus || 0);
    let { x, z } = ctx.input;
    if (!x && !z) { x = Math.sin(this.facing); z = Math.cos(this.facing); }      // dash back
    const len = Math.hypot(x, z); this.evadeDir = { x: x / len, z: z / len };
    const forwardX = -Math.sin(this.facing), forwardZ = -Math.cos(this.facing);
    this.evadeClip = this.evadeDir.x * forwardX + this.evadeDir.z * forwardZ < -.45 ? 'evadeBack' : 'evadeForward';
    // Keep the upper body facing the threat for a retreat or side step while
    // locked on; otherwise the dash turns the body toward where it travels.
    if (!ctx.lockTarget) this.facing = yawOf(x, z);
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
    this.parryBonus = ctx.parryBonus || 0;
    this.clock += dt; this.events = [];
    const out = { dx: 0, dz: 0 };
    const t0 = this.t; this.t += dt;
    const hasInput = !!(ctx.input.x || ctx.input.z);

    if (this.state === 'move' || this.state === 'guard') {
      if (this.buffered('evade')) { this.startEvade(ctx); return out; }
      if (this.tryAttack(ctx, null)) return out;
      if (this.buffered('flask') && !ctx.airborne) {
        this.consume('flask');
        if (ctx.flasks > 0) { this.state = 'flask'; this.t = 0; this.healed = false; this.events.push({ type: 'flask' }); }
        else this.events.push({ type: 'noFlask' });
        return out;
      }
      if (this.guardHeld && this.state === 'move') { this.state = 'guard'; this.t = 0; this.events.push({ type: 'guardUp' }); }
      else if (!this.guardHeld && this.state === 'guard') this.state = 'move';
      return out;
    }

    if (this.state === 'flask') {
      if (!this.healed && this.t >= FLASK.healAt) { this.healed = true; this.events.push({ type: 'heal' }); }
      if (this.t >= FLASK.duration) this.state = 'move';
      else if (this.healed && this.buffered('evade')) this.startEvade(ctx);
      return out;
    }

    if (this.state === 'attack') {
      let m = MOVES[this.move];
      // Charging: hold at the chamber pose while the heavy input is held.
      // How far you may charge depends on your level (moves.js chargeCap); none below level 3.
      const cap = ctx.chargeCap || { levels: 2, into: true };
      if (m.charge && cap.levels > 0 && t0 < m.charge.at + 1e-6 && this.t >= m.charge.at && (this.heavyHeld || this.charging)) {
        // Still holding at the chamber: from level 10 the heavy becomes this weapon's signature blow.
        if (this.heavyHeld && m.charge.into && cap.into && !this.charging) {
          const from = m; this.move = m.charge.into; m = MOVES[this.move]; this.t = m.charge.at;
          this.events.push({ type: 'rootbreaker', move: this.move }, { type: 'spend', amount: Math.max(0, m.stamina - from.stamina) });
        }
        if (this.heavyHeld && this.chargeTime < m.charge.max) {
          this.charging = true; this.chargeTime += dt; this.t = m.charge.at;
          const level = Math.min(cap.levels, m.charge.levels.filter(l => this.chargeTime >= l).length);
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
      // A ground slam (the Earthsplitter): at impact, a shockwave ahead that hits everything in reach.
      if (m.slam && t0 < m.slam.at && this.t >= m.slam.at) {
        const k = 1 + this.chargeLevel * .2;
        this.events.push({ type: 'slam', move: this.move, x: ctx.x - Math.sin(this.facing) * m.slam.ahead, z: ctx.z - Math.cos(this.facing) * m.slam.ahead,
          radius: m.slam.radius * k, damage: m.slam.damage * k, poise: m.slam.poise * k, pierce: m.pierce || 0, chargeLevel: this.chargeLevel });
      }

      // A ranged move fires its projectile; the Bloom heals around you (main.js does the rest).
      if (m.shot && t0 < m.shot.at && this.t >= m.shot.at) this.events.push({ type: 'shot', move: this.move, facing: this.facing, chargeLevel: this.chargeLevel, counter: this.countering });
      if (m.pulse && t0 < m.pulse.at && this.t >= m.pulse.at) this.events.push({ type: 'pulse', move: this.move, chargeLevel: this.chargeLevel });
      // Hit detection runs only while the strike is active, against the posed limb.
      // The limb is also sampled during startup, so the first active frame sweeps
      // from the pose just before it instead of losing a frame.
      if (m.hitbox && this.t < m.active[1] && !this.blocked) {
        strikeSegment(ctx.bones, m.hitbox, this.segment);
        if (this.t >= m.active[0] && this.prevSegment) {
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
              chargeLevel: this.chargeLevel, counter, critical: m.kind === 'critical', heavy: m.kind !== 'light', pierce: m.pierce || 0, ring: !!m.ring });
          }
          if (!this.blocked && obstacle && !result.contacts.length) {
            this.blocked = obstacle; this.events.push({ type: 'blocked', move: this.move, point: obstacle.point });
          }
        }
        this.prevSegment = { a: this.segment.a.clone(), b: this.segment.b.clone() };
      }
      if (m.hitbox && t0 < m.active[1] && this.t >= m.active[1] && !this.hitThisSwing.size && !this.blocked) {
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
      return { name: m.clip, fp: m.fp, move: this.move, time: this.t, fade: this.t < .05 ? 30 : 14 };
    }
    if (this.state === 'evade') return { name: this.evadeClip, time: this.t, fade: 30 };
    if (this.state === 'guard') return { name: 'guard', time: this.t % 1.4, fade: 22 };
    if (this.state === 'flask') return { name: 'interact', time: .1 + this.t * .9, fade: 16 };
    if (this.state === 'hurt') return { name: 'hurt', time: this.hurtKind === 'heavy' ? Math.min(this.t * .6, .4) : this.t, fade: 40 };
    return null;
  }
}
