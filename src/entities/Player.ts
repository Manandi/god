import Phaser from 'phaser';
import { PHYSICS, PARTICLE_TEXTURE_KEY } from '../config';
import { StateMachine } from '../fsm/StateMachine';
import { IdleState, RunState, JumpState, FallState, ClimbState } from './PlayerStates';
import { PlayerProgress } from '../progress/PlayerProgress';
import { LevelBadge } from '../ui/LevelBadge';

const LANDING_SQUASH_MS = 150;
const FOOTSTEP_INTERVAL_MS = 220;
const HURT_TINT = 0xff5555;

interface InputKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jumpKeys: Phaser.Input.Keyboard.Key[];
  downKeys: Phaser.Input.Keyboard.Key[];
  attackKeys: Phaser.Input.Keyboard.Key[];
  dashKeys: Phaser.Input.Keyboard.Key[];
}

const ATTACK_ACTIVE_MS = 120;
const ATTACK_COOLDOWN_MS = 260;
const DASH_DURATION_MS = 135;
const DASH_COOLDOWN_MS = 650;
const DASH_SPEED = 390;

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly fsm: StateMachine<Player>;

  private readonly keys: InputKeys;
  private readonly leftKeyA: Phaser.Input.Keyboard.Key;
  private readonly rightKeyD: Phaser.Input.Keyboard.Key;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private animPhase = 0;
  private wasGrounded = true;
  private landingSquashUntil = 0;
  private footstepTimer = 0;
  private hurtUntil = 0;
  private wasHurt = false;
  private readonly levelBadge: LevelBadge;
  private climbContactUntil = 0;
  private isClimbing = false;
  private attackActiveUntil = 0;
  private attackReadyAt = 0;
  private dashUntil = 0;
  private dashReadyAt = 0;
  private attackId = 0;
  private climbReleaseUntil = 0;
  private climbCenterX = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
    this.setDragX(PHYSICS.runDrag);
    this.setMaxVelocity(PHYSICS.moveSpeed, PHYSICS.maxFallSpeed);

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input plugin is not available');
    }
    this.keys = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      jumpKeys: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      ],
      downKeys: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      ],
      attackKeys: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X)],
      dashKeys: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C)]
    };
    this.leftKeyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKeyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.fsm = new StateMachine<Player>(this);
    this.fsm
      .add(new IdleState())
      .add(new RunState())
      .add(new JumpState())
      .add(new FallState())
      .add(new ClimbState());
    this.fsm.transition('idle');

    this.levelBadge = new LevelBadge(scene, PlayerProgress.level, '#38bdf8');
  }

  get isGrounded(): boolean {
    return !!(this.body?.blocked.down || this.body?.touching.down);
  }

  /** Flashes a hurt tint for durationMs, overriding the state-driven tint
   * (idle/run/jump/fall each set their own) until it expires, then restores
   * whatever tint the current state should show. */
  setHurtFlash(durationMs: number): void {
    this.hurtUntil = this.scene.time.now + durationMs;
  }

  /** Called every frame the player overlaps a climbable zone — reset happens
   * at the end of update() so it must be reconfirmed each frame. */
  markTouchingClimbZone(centerX: number): void {
    // Physics overlap callbacks can fall on either side of Scene.update().
    // A short contact grace keeps climbing deterministic instead of
    // alternating between gravity-on and gravity-off frames.
    this.climbContactUntil = this.scene.time.now + 90;
    this.climbCenterX = centerX;
  }

  get isClimbingWall(): boolean {
    return this.isClimbing;
  }

  get facingDirection(): 1 | -1 {
    return this.flipX ? -1 : 1;
  }

  get currentAttackId(): number {
    return this.attackId;
  }

  get isAttackActive(): boolean {
    return this.scene.time.now < this.attackActiveUntil;
  }

  get isDashInvulnerable(): boolean {
    return this.scene.time.now < this.dashUntil;
  }

  getAttackBounds(): Phaser.Geom.Rectangle {
    const reach = 34;
    const left = this.facingDirection > 0 ? this.x + 5 : this.x - reach - 5;
    return new Phaser.Geom.Rectangle(left, this.y - 31, reach, 27);
  }

  private get moveLeftHeld(): boolean {
    return this.keys.left.isDown || this.leftKeyA.isDown;
  }

  private get moveRightHeld(): boolean {
    return this.keys.right.isDown || this.rightKeyD.isDown;
  }

  private get jumpJustPressed(): boolean {
    return this.keys.jumpKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  private get upHeld(): boolean {
    return this.keys.jumpKeys.some((key) => key.isDown);
  }

  private get downHeld(): boolean {
    return this.keys.downKeys.some((key) => key.isDown);
  }

  update(time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000;
    const speedScale = 0.94 + (PlayerProgress.stats.speed - 8) * 0.012;

    this.updateActions(time, body);
    if (this.isDashInvulnerable) {
      this.setMaxVelocity(DASH_SPEED, PHYSICS.maxFallSpeed);
      body.setDragX(0);
      body.setAcceleration(0, 0);
      body.setVelocityY(0);
    } else {
      this.setMaxVelocity(PHYSICS.moveSpeed * speedScale, PHYSICS.maxFallSpeed);
      body.setDragX(this.isGrounded ? PHYSICS.runDrag : PHYSICS.airDrag);
      body.setAllowGravity(!this.isClimbing);
      this.updateClimbTransitions(body);
      if (this.isClimbing) {
        this.updateClimbMovement(body);
      } else {
        this.setAngle(0);
        this.updateHorizontalMovement(body);
        this.updateJump(body, dt);
      }
    }
    this.updateStateMachine(body);

    this.fsm.update(delta);
    this.levelBadge.follow(this.x, this.y, this.displayHeight + 6);

    const isHurt = time < this.hurtUntil;
    if (isHurt) {
      this.setTint(HURT_TINT);
    } else if (this.wasHurt) {
      this.fsm.refresh();
    }
    this.wasHurt = isHurt;

    this.updateVisualJuice(time, delta);
  }

  private updateActions(time: number, body: Phaser.Physics.Arcade.Body): void {
    const attackPressed = this.keys.attackKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
    if (attackPressed && time >= this.attackReadyAt && !this.isClimbing) {
      this.attackId += 1;
      this.attackActiveUntil = time + ATTACK_ACTIVE_MS;
      this.attackReadyAt = time + ATTACK_COOLDOWN_MS;
      this.showAttackArc();
    }

    const dashPressed = !this.isClimbing && this.keys.dashKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
    if (dashPressed && time >= this.dashReadyAt && !this.isClimbing) {
      this.dashUntil = time + DASH_DURATION_MS;
      const disciplineScale = 1.06 - (PlayerProgress.stats.discipline - 8) * 0.012;
      this.dashReadyAt = time + DASH_COOLDOWN_MS * disciplineScale;
      body.setAllowGravity(false);
      body.setVelocity(this.facingDirection * DASH_SPEED, 0);
      this.emitDust(0.8);
    }
  }

  private showAttackArc(): void {
    const direction = this.facingDirection;
    const arc = this.scene.add
      .graphics()
      .setPosition(this.x, this.y)
      .lineStyle(4, 0xd8ffe8, 0.9)
      .beginPath()
      .arc(direction * 5, -18, 27, direction > 0 ? -0.9 : Math.PI - 0.9, direction > 0 ? 0.9 : Math.PI + 0.9, direction < 0)
      .strokePath()
      .setDepth(11);
    this.scene.tweens.add({ targets: arc, alpha: 0, scale: 1.2, duration: ATTACK_ACTIVE_MS, onComplete: () => arc.destroy() });
  }

  private updateHorizontalMovement(body: Phaser.Physics.Arcade.Body): void {
    if (this.moveLeftHeld && !this.moveRightHeld) {
      body.setAccelerationX(-PHYSICS.runAccel * (0.94 + (PlayerProgress.stats.speed - 8) * 0.012));
      this.setFlipX(true);
    } else if (this.moveRightHeld && !this.moveLeftHeld) {
      body.setAccelerationX(PHYSICS.runAccel * (0.94 + (PlayerProgress.stats.speed - 8) * 0.012));
      this.setFlipX(false);
    } else {
      body.setAccelerationX(0);
    }
  }

  private updateJump(body: Phaser.Physics.Arcade.Body, dt: number): void {
    if (this.isGrounded) {
      this.coyoteTimer = PHYSICS.coyoteTimeMs;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt * 1000);
    }

    if (this.jumpJustPressed) {
      this.jumpBufferTimer = PHYSICS.jumpBufferMs;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt * 1000);
    }

    const canJump = this.coyoteTimer > 0 && this.jumpBufferTimer > 0;
    if (canJump) {
      body.setVelocityY(PHYSICS.jumpVelocity);
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }
  }

  /** Grabs on when touching a climbable zone and pressing up, lets go on
   * jump (pushing off away from the wall) or on leaving the zone. */
  private updateClimbTransitions(body: Phaser.Physics.Arcade.Body): void {
    const touchingClimbZone = this.scene.time.now <= this.climbContactUntil;
    if (!this.isClimbing && touchingClimbZone && this.upHeld && this.scene.time.now >= this.climbReleaseUntil) {
      this.isClimbing = true;
      body.setAllowGravity(false);
      // Keep the player's current position when grabbing the roots. Snapping
      // directly to the center made contact at the foot of a trunk look like
      // a short teleport, especially when grabbing from either edge.
      body.setVelocity(0, 0);
      return;
    }

    const pushOff = this.isClimbing && this.keys.dashKeys.some(key => Phaser.Input.Keyboard.JustDown(key));
    if (this.isClimbing && (!touchingClimbZone || pushOff)) {
      this.isClimbing = false;
      this.climbReleaseUntil = this.scene.time.now + 300;
      body.setAllowGravity(true);
      if (pushOff) {
        const dir = this.facingDirection;
        body.setVelocity(dir * 200, PHYSICS.jumpVelocity * 0.7);
      } else {
        // Climbed out the top/bottom of the zone — drop any residual climb
        // velocity so gravity doesn't carry a leftover upward "bounce".
        body.setVelocityY(0);
      }
    }
  }

  private updateClimbMovement(body: Phaser.Physics.Arcade.Body): void {
    const climbScale = 0.92 + (PlayerProgress.stats.stamina - 8) * 0.014;
    const vy = this.upHeld ? -PHYSICS.climbSpeed * climbScale : this.downHeld ? PHYSICS.climbSpeed * climbScale : 0;
    // Player input wins, otherwise ease toward the trunk's center. This keeps
    // the climb visually attached without ever changing position instantly.
    const centerVelocity = Phaser.Math.Clamp((this.climbCenterX - this.x) * 5, -55, 55);
    const vx = this.moveRightHeld ? 70 : this.moveLeftHeld ? -70 : centerVelocity;
    body.setAccelerationX(0);
    body.setVelocity(vx, vy);
    if(vx) this.setFlipX(vx < 0);
    this.setAngle(0);
  }

  private updateStateMachine(body: Phaser.Physics.Arcade.Body): void {
    if (this.isClimbing) {
      this.fsm.transition('climb');
      return;
    }

    const grounded = this.isGrounded;
    const vy = body.velocity.y;
    const vx = body.velocity.x;

    if (!grounded && vy < 0) {
      this.fsm.transition('jump');
    } else if (!grounded && vy >= 0) {
      this.fsm.transition('fall');
    } else if (grounded && Math.abs(vx) > 4) {
      this.fsm.transition('run');
    } else if (grounded) {
      this.fsm.transition('idle');
    }
  }

  private updateVisualJuice(time: number, delta: number): void {
    const grounded = this.isGrounded;
    this.animPhase += delta;

    if (!this.wasGrounded && grounded) {
      this.landingSquashUntil = time + LANDING_SQUASH_MS;
      this.emitDust(1);
      this.scene.cameras.main.shake(80, 0.0015);
    }
    this.wasGrounded = grounded;

    if (time < this.landingSquashUntil) {
      const t = 1 - (this.landingSquashUntil - time) / LANDING_SQUASH_MS;
      const ease = Phaser.Math.Easing.Back.Out(t);
      this.setScale(1 + 0.25 * (1 - ease), 1 - 0.25 * (1 - ease));
      return;
    }

    switch (this.fsm.currentName) {
      case 'idle':
        this.setScale(1, 1 + Math.sin(this.animPhase * 0.003) * 0.02);
        break;
      case 'run':
        this.setScale(1 + Math.sin(this.animPhase * 0.02) * 0.05, 1 - Math.sin(this.animPhase * 0.02) * 0.05);
        this.footstepTimer -= delta;
        if (grounded && this.footstepTimer <= 0) {
          this.footstepTimer = FOOTSTEP_INTERVAL_MS;
          this.emitDust(0.4);
        }
        break;
      case 'jump':
        this.setScale(0.9, 1.15);
        break;
      case 'fall':
        this.setScale(1.05, 0.92);
        break;
    }
  }

  private emitDust(intensity: number): void {
    if (!this.scene.textures.exists(PARTICLE_TEXTURE_KEY)) return;
    const emitter = this.scene.add.particles(this.x, this.y - 2, PARTICLE_TEXTURE_KEY, {
      speed: { min: 20, max: 40 + 40 * intensity },
      angle: { min: 200, max: 340 },
      scale: { start: 0.2 + 0.3 * intensity, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      quantity: Math.max(2, Math.round(4 * intensity))
    });
    emitter.explode();
    this.scene.time.delayedCall(400, () => emitter.destroy());
  }
}
