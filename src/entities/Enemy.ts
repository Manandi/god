import Phaser from 'phaser';
import { LevelBadge } from '../ui/LevelBadge';

const PATROL_SPEED = 40;
const CHASE_SPEED = 64;
const TURN_PAUSE_MS = 180;
const HIT_STUN_MS = 220;
const REGULAR_BADGE_COLOR = '#facc15';
const BOSS_BADGE_COLOR = '#ef4444';

export type GuardianAttack = 'fireball' | 'wave';
type BossAttack = 'charge' | 'fireball' | 'jump';
type BossState = 'patrol' | 'warn' | 'charge' | 'jump' | 'recover';

export interface EnemyOptions {
  patrols: boolean;
  animKey?: string;
  level: number;
  isBoss?: boolean;
  elite?: boolean;
  onGuardianAttack?: (attack: GuardianAttack, enemy: Enemy) => void;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private direction: 1 | -1 = 1;
  private readonly patrols: boolean;
  private readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly levelBadge: LevelBadge;
  private readonly isBoss: boolean;
  private readonly elite: boolean;
  private readonly maxHealth: number;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly attackTell?: Phaser.GameObjects.Text;
  private readonly onGuardianAttack?: (attack: GuardianAttack, enemy: Enemy) => void;
  private health: number;
  private defeated = false;
  private pauseUntil = 0;
  private hurtUntil = 0;
  private turnUntil = 0;
  private bossState: BossState = 'patrol';
  private queuedAttack: BossAttack = 'charge';
  private lastAttack: BossAttack = 'jump';
  private stateUntil = 1000;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, groundLayer: Phaser.Tilemaps.TilemapLayer, options: EnemyOptions) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.groundLayer = groundLayer;
    this.patrols = options.patrols;
    this.isBoss = options.isBoss ?? false;
    this.elite = options.elite ?? false;
    this.onGuardianAttack = options.onGuardianAttack;
    this.health = this.isBoss ? (this.elite ? 10 : 5) : this.elite ? 2 : 1;
    this.maxHealth = this.health;
    this.healthBar = scene.add.graphics().setDepth(21);
    this.setOrigin(0.5, 1).setCollideWorldBounds(true).setDepth(5);
    if (options.animKey) this.play(options.animKey);

    const body = this.body as Phaser.Physics.Arcade.Body;
    const bodyWidth = Math.min(this.isBoss ? 80 : 44, this.width);
    const bodyHeight = Math.min(this.isBoss ? 54 : 28, this.height);
    body.setSize(bodyWidth, bodyHeight);
    body.setOffset((this.width - bodyWidth) / 2, this.height - bodyHeight - 2);

    this.levelBadge = new LevelBadge(scene, options.level, options.isBoss ? BOSS_BADGE_COLOR : REGULAR_BADGE_COLOR);
    if (this.elite && this.isBoss) {
      this.attackTell = scene.add.text(x, y - this.height - 38, '', {
        fontFamily: 'monospace', fontSize: '11px', color: '#fff4cf', backgroundColor: '#07110bcc'
      }).setPadding(4, 2, 4, 2).setOrigin(0.5, 1).setDepth(22).setVisible(false);
    }
  }

  get isDefeated(): boolean { return this.defeated; }
  get stompSurfaceY(): number { return this.y - (this.isBoss ? 64 : 34); }

  turnFromObstacle(): void {
    if (this.defeated) return;
    this.direction = this.direction === 1 ? -1 : 1;
    this.pauseUntil = this.scene.time.now + TURN_PAUSE_MS;
    this.turnUntil = this.scene.time.now + 850;
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
    if (this.isBoss && this.bossState === 'charge') this.enterRecover(1050);
  }

  update(playerX: number, playerY: number): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    this.drawStatus();

    if (this.elite && this.isBoss && this.updateGuardian(now, playerX, playerY, body)) return;
    if (now < this.hurtUntil || now < this.pauseUntil) { body.setVelocityX(0); return; }
    if (!this.patrols) { body.setVelocityX(0); return; }

    const seesPlayer = Math.abs(playerX - this.x) < (this.isBoss ? 280 : 150) && Math.abs(playerY - this.y) < 52;
    if (seesPlayer && now > this.turnUntil) this.direction = playerX < this.x ? -1 : 1;
    body.setVelocityX((seesPlayer ? CHASE_SPEED : PATROL_SPEED) * this.direction);
    this.setFlipX(this.direction < 0);

    const aheadX = this.direction > 0 ? body.right + 6 : body.left - 6;
    const floorAhead = layerHasFloor(this.groundLayer, body, this.direction);
    const wallAhead = this.groundLayer.getTileAtWorldXY(aheadX, body.center.y)?.collides;
    const oneTileStep = !this.isBoss
      && wallAhead
      && this.groundLayer.getTileAtWorldXY(aheadX, body.bottom - 6)?.collides
      && !this.groundLayer.getTileAtWorldXY(aheadX, body.bottom - 22)?.collides;
    if (body.blocked.down && oneTileStep) {
      this.y -= 17;
      body.updateFromGameObject();
      body.setVelocityX((seesPlayer ? CHASE_SPEED : PATROL_SPEED) * this.direction);
      return;
    }
    if (body.blocked.down && (!floorAhead || wallAhead || body.blocked.left || body.blocked.right)) this.turnFromObstacle();
  }

  private updateGuardian(now: number, playerX: number, playerY: number, body: Phaser.Physics.Arcade.Body): boolean {
    const playerNear = Math.abs(playerX - this.x) < 360 && Math.abs(playerY - this.y) < 150;
    if (this.bossState === 'patrol' && playerNear && now > this.stateUntil) this.beginRandomAttack(now, playerX);

    if (this.bossState === 'warn') {
      body.setVelocityX(0);
      const colors: Record<BossAttack, number> = { charge: 0xffa647, fireball: 0x70d9ff, jump: 0xb8ff8a };
      this.setTint(now % 180 < 90 ? colors[this.queuedAttack] : 0xffffff);
      if (now >= this.stateUntil) this.executeQueuedAttack(now, playerX, body);
      return true;
    }
    if (this.bossState === 'charge') {
      body.setVelocityX(this.direction * 250);
      this.setFlipX(this.direction < 0);
      if (now >= this.stateUntil || body.blocked.left || body.blocked.right || !layerHasFloor(this.groundLayer, body, this.direction)) this.enterRecover(1100);
      return true;
    }
    if (this.bossState === 'jump') {
      if (body.blocked.down && now >= this.stateUntil) {
        this.onGuardianAttack?.('wave', this);
        this.scene.cameras.main.shake(130, 0.004);
        this.enterRecover(950);
      }
      return true;
    }
    if (this.bossState === 'recover') {
      body.setVelocityX(0);
      this.setTint(0x91a79a);
      if (now >= this.stateUntil) {
        this.bossState = 'patrol';
        this.stateUntil = now + Phaser.Math.Between(650, 1050);
        this.clearTint();
        this.attackTell?.setVisible(false);
      }
      return true;
    }
    return false;
  }

  private beginRandomAttack(now: number, playerX: number): void {
    const attacks: BossAttack[] = ['charge', 'fireball', 'jump'];
    let index = Phaser.Math.Between(0, attacks.length - 1);
    if (attacks[index] === this.lastAttack) index = (index + 1) % attacks.length;
    this.queuedAttack = attacks[index];
    this.lastAttack = this.queuedAttack;
    this.direction = playerX < this.x ? -1 : 1;
    this.bossState = 'warn';
    this.stateUntil = now + (this.queuedAttack === 'jump' ? 780 : 650);
    const labels: Record<BossAttack, string> = { charge: 'CHARGE', fireball: 'SPORE VOLLEY', jump: 'ROOT QUAKE' };
    this.attackTell?.setText(labels[this.queuedAttack]).setVisible(true);
  }

  private executeQueuedAttack(now: number, playerX: number, body: Phaser.Physics.Arcade.Body): void {
    this.clearTint();
    if (this.queuedAttack === 'charge') {
      this.bossState = 'charge';
      this.stateUntil = now + 760;
      this.attackTell?.setText('DASH!');
      return;
    }
    if (this.queuedAttack === 'fireball') {
      this.onGuardianAttack?.('fireball', this);
      this.enterRecover(900);
      return;
    }
    this.bossState = 'jump';
    this.stateUntil = now + 260;
    body.setVelocity(playerX < this.x ? -115 : 115, -525);
    this.attackTell?.setText('JUMP!');
  }

  private enterRecover(duration: number): void {
    this.bossState = 'recover';
    this.stateUntil = this.scene.time.now + duration;
    this.attackTell?.setText('OPEN').setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
  }

  private drawStatus(): void {
    this.levelBadge.follow(this.x, this.y, this.height + 7);
    this.attackTell?.setPosition(this.x, this.y - this.height - 27);
    this.healthBar.clear();
    if (!this.elite) return;
    const width = this.isBoss ? 76 : 44;
    const y = this.y - this.height - 18;
    this.healthBar.fillStyle(0x07110b).fillRect(this.x - width / 2, y, width, 5);
    this.healthBar.fillStyle(this.isBoss ? 0xf1a562 : 0xbace8c).fillRect(this.x - width / 2, y, width * this.health / this.maxHealth, 5);
  }

  takeHit(fromX: number): void {
    if (this.defeated || this.scene.time.now < this.hurtUntil) return;
    this.health -= 1;
    if (this.health <= 0) { this.defeat(); return; }
    this.hurtUntil = this.scene.time.now + HIT_STUN_MS;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!this.isBoss || this.bossState === 'patrol' || this.bossState === 'recover') body.setVelocity(fromX < this.x ? 105 : -105, -80);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(HIT_STUN_MS, () => { if (!this.defeated && this.bossState === 'patrol') this.clearTint(); });
  }

  defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0); body.enable = false; this.anims.stop(); this.setTint(0x888888);
    this.levelBadge.destroy(); this.healthBar.destroy(); this.attackTell?.destroy();
    this.scene.tweens.add({ targets: this, scaleY: 0.15, alpha: 0, duration: 180, onComplete: () => this.destroy() });
  }
}

function layerHasFloor(layer: Phaser.Tilemaps.TilemapLayer, body: Phaser.Physics.Arcade.Body, direction: number): boolean {
  const aheadX = direction > 0 ? body.right + 6 : body.left - 6;
  return !!layer.getTileAtWorldXY(aheadX, body.bottom + 6)?.collides
    || !!layer.getTileAtWorldXY(aheadX, body.bottom + 22)?.collides;
}
