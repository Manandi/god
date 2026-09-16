import Phaser from 'phaser';
import { PHYSICS } from '../config';
import { StateMachine } from '../fsm/StateMachine';
import { IdleState, RunState, JumpState, FallState } from './PlayerStates';

interface InputKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jumpKeys: Phaser.Input.Keyboard.Key[];
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly fsm: StateMachine<Player>;

  private readonly keys: InputKeys;
  private readonly leftKeyA: Phaser.Input.Keyboard.Key;
  private readonly rightKeyD: Phaser.Input.Keyboard.Key;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

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
      ]
    };
    this.leftKeyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKeyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.fsm = new StateMachine<Player>(this);
    this.fsm
      .add(new IdleState())
      .add(new RunState())
      .add(new JumpState())
      .add(new FallState());
    this.fsm.transition('idle');
  }

  get isGrounded(): boolean {
    return this.body?.blocked.down ?? false;
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

  update(_time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000;

    this.updateHorizontalMovement(body);
    this.updateJump(body, dt);
    this.updateStateMachine(body);

    this.fsm.update(delta);
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

  private updateStateMachine(body: Phaser.Physics.Arcade.Body): void {
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
}
