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
}

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
  private touchingClimbZone = false;
  private isClimbing = false;

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
      ]
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
    return this.body?.blocked.down ?? false;
  }

  /** Flashes a hurt tint for durationMs, overriding the state-driven tint
   * (idle/run/jump/fall each set their own) until it expires, then restores
   * whatever tint the current state should show. */
  setHurtFlash(durationMs: number): void {
    this.hurtUntil = this.scene.time.now + durationMs;
  }

  /** Called every frame the player overlaps a climbable zone — reset happens
   * at the end of update() so it must be reconfirmed each frame. */
  markTouchingClimbZone(): void {
    this.touchingClimbZone = true;
  }

  get isClimbingWall(): boolean {
    return this.isClimbing;
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

    this.updateClimbTransitions(body);
    if (this.isClimbing) {
      this.updateClimbMovement(body);
    } else {
      this.updateHorizontalMovement(body);
      this.updateJump(body, dt);
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
    this.touchingClimbZone = false;
  }

  private updateHorizontalMovement(body: Phaser.Physics.Arcade.Body): void {
    if (this.moveLeftHeld && !this.moveRightHeld) {
      body.setAccelerationX(-PHYSICS.runAccel);
      this.setFlipX(true);
    } else if (this.moveRightHeld && !this.moveLeftHeld) {
      body.setAccelerationX(PHYSICS.runAccel);
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
    if (!this.isClimbing && this.touchingClimbZone && this.upHeld) {
      this.isClimbing = true;
      body.setAllowGravity(false);
      body.setVelocity(0, 0);
      return;
    }

    if (this.isClimbing && (!this.touchingClimbZone || this.jumpJustPressed)) {
      const pushOff = this.isClimbing && this.touchingClimbZone && this.jumpJustPressed;
      this.isClimbing = false;
      body.setAllowGravity(true);
      if (pushOff) {
        const dir = this.flipX ? 1 : -1;
        body.setVelocity(dir * 200, PHYSICS.jumpVelocity * 0.7);
      } else {
        // Climbed out the top/bottom of the zone — drop any residual climb
        // velocity so gravity doesn't carry a leftover upward "bounce".
        body.setVelocity(0, 0);
      }
    }
  }

  private updateClimbMovement(body: Phaser.Physics.Arcade.Body): void {
    const vy = this.upHeld ? -PHYSICS.climbSpeed : this.downHeld ? PHYSICS.climbSpeed : 0;
    body.setVelocity(0, vy);
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
