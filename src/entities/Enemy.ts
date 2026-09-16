import Phaser from 'phaser';
import { LevelBadge } from '../ui/LevelBadge';

const PATROL_SPEED = 40;
const CHASE_SPEED = 64;
const DEATH_TWEEN_MS = 150;
const TURN_PAUSE_MS = 180;
const HIT_STUN_MS = 220;
const REGULAR_BADGE_COLOR = '#facc15';
const BOSS_BADGE_COLOR = '#ef4444';

export interface EnemyOptions {
  patrols: boolean;
  animKey?: string;
  level: number;
  isBoss?: boolean;
  elite?: boolean;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private direction: 1 | -1 = 1;
  private readonly patrols: boolean;
  private readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly levelBadge: LevelBadge;
  private readonly isBoss: boolean;
  private health: number;
  private defeated = false;
  private pauseUntil = 0;
  private hurtUntil = 0;
  private readonly elite: boolean;
  private chargeState: 'patrol' | 'warn' | 'charge' | 'recover' = 'patrol';
  private stateUntil = 0;
  private turnUntil = 0;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly maxHealth: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    groundLayer: Phaser.Tilemaps.TilemapLayer,
    options: EnemyOptions
  ) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.groundLayer = groundLayer;
    this.patrols = options.patrols;
    this.isBoss = options.isBoss ?? false;
    this.elite = options.elite ?? false;
    this.health = this.isBoss ? (this.elite ? 8 : 5) : this.elite ? 2 : 1;
    this.maxHealth = this.health;
    this.healthBar = scene.add.graphics().setDepth(21);
    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
    this.setDepth(5);
    if (options.animKey) {
      this.play(options.animKey);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(Math.min(this.isBoss ? 88 : 42, this.width), Math.min(this.isBoss ? 68 : 30, this.height));
    body.setOffset((this.width - body.width) / 2, this.height - body.height);

    this.levelBadge = new LevelBadge(scene, options.level, options.isBoss ? BOSS_BADGE_COLOR : REGULAR_BADGE_COLOR);
    this.levelBadge.follow(x, y, this.displayHeight + 6);
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  update(playerX: number, playerY: number): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    this.healthBar.clear();
    if(this.elite) {
      this.healthBar.fillStyle(0x0c1b18).fillRect(this.x-22,this.y-this.height-23,44,3);
      this.healthBar.fillStyle(this.isBoss ? 0xf1a562 : 0xbace8c).fillRect(this.x-22,this.y-this.height-23,44*this.health/this.maxHealth,3);
    }
    this.levelBadge.follow(this.x,this.y,this.height+6);
    if(this.elite && this.isBoss) {
      if(this.chargeState==='patrol' && now>this.stateUntil && Math.abs(playerX-this.x)<300 && Math.abs(playerY-this.y)<100) {
        this.chargeState='warn'; this.stateUntil=now+850;
        this.direction=playerX<this.x ? -1 : 1;
      }
      if(this.chargeState==='warn') {
        body.setVelocityX(0); this.setTint(now%200<100 ? 0xffb44e : 0xffffff);
        if(now>this.stateUntil){this.chargeState='charge';this.stateUntil=now+700;this.clearTint();}
        return;
      }
      if(this.chargeState==='charge') {
        body.setVelocityX(this.direction*230);this.setFlipX(this.direction<0);
        const edge=layerHasFloor(this.groundLayer,body,this.direction);
        if(now>this.stateUntil || body.blocked.left || body.blocked.right || !edge){this.chargeState='recover';this.stateUntil=now+1200;body.setVelocityX(0);}
        return;
      }
      if(this.chargeState==='recover') {
        body.setVelocityX(0);this.setTint(0x9daaa0);
        if(now>this.stateUntil){this.chargeState='patrol';this.stateUntil=now+1800;this.clearTint();}
        return;
      }
    }

    if (this.scene.time.now < this.hurtUntil || this.scene.time.now < this.pauseUntil) {
      body.setVelocityX(0);
      this.levelBadge.follow(this.x, this.y, this.displayHeight + 6);
      return;
    }

    if (!this.patrols) {
      body.setVelocityX(0);
      this.levelBadge.follow(this.x, this.y, this.displayHeight + 6);
      return;
    }

    const seesPlayer = Math.abs(playerX - this.x) < (this.isBoss ? 280 : 150) && Math.abs(playerY - this.y) < 52;
    if (seesPlayer && now > this.turnUntil) this.direction = playerX < this.x ? -1 : 1;
    body.setVelocityX((seesPlayer ? CHASE_SPEED : PATROL_SPEED) * this.direction);
    this.setFlipX(this.direction < 0);

    const aheadX = this.direction > 0 ? body.right+6 : body.left-6;
    const groundTile = layerHasFloor(this.groundLayer,body,this.direction);
    const wallTile = this.groundLayer.getTileAtWorldXY(aheadX,body.center.y)?.collides;
    const blocked = body.blocked.left || body.blocked.right;

    if (body.blocked.down && (!groundTile || wallTile || blocked)) {
      this.direction = this.direction === 1 ? -1 : 1;
      this.pauseUntil = this.scene.time.now + TURN_PAUSE_MS;
      this.turnUntil = now+900;
      body.setVelocityX(0);
    }

    this.levelBadge.follow(this.x, this.y, this.displayHeight + 6);
  }

  takeHit(fromX: number): void {
    if (this.defeated || this.scene.time.now < this.hurtUntil) return;
    this.health -= 1;
    if (this.health <= 0) {
      this.defeat();
      return;
    }

    this.hurtUntil = this.scene.time.now + HIT_STUN_MS;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(fromX < this.x ? 110 : -110, -90);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(HIT_STUN_MS, () => {
      if (!this.defeated) this.clearTint();
    });
  }

  defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.anims.stop();
    this.setTint(0x888888);
    this.levelBadge.destroy();
    this.healthBar.destroy();
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.15,
      alpha: 0,
      duration: DEATH_TWEEN_MS,
      onComplete: () => this.destroy()
    });
  }
}

function layerHasFloor(layer: Phaser.Tilemaps.TilemapLayer, body: Phaser.Physics.Arcade.Body, direction: number): boolean {
  return !!layer.getTileAtWorldXY(direction>0 ? body.right+6 : body.left-6,body.bottom+6)?.collides;
}
