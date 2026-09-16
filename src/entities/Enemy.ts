import Phaser from 'phaser';
import { LevelBadge } from '../ui/LevelBadge';

const PATROL_SPEED = 40;
const PROBE_AHEAD = 12;
const DEATH_TWEEN_MS = 150;
const REGULAR_BADGE_COLOR = '#facc15';
const BOSS_BADGE_COLOR = '#ef4444';

export interface EnemyOptions {
  patrols: boolean;
  animKey?: string;
  level: number;
  isBoss?: boolean;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private direction: 1 | -1 = 1;
  private readonly patrols: boolean;
  private readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly levelBadge: LevelBadge;
  private defeated = false;

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
    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
    this.setDepth(5);
    if (options.animKey) {
      this.play(options.animKey);
    }

    this.levelBadge = new LevelBadge(scene, options.level, options.isBoss ? BOSS_BADGE_COLOR : REGULAR_BADGE_COLOR);
    this.levelBadge.follow(x, y, this.displayHeight + 6);
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  update(): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (!this.patrols) {
      body.setVelocityX(0);
      this.levelBadge.follow(this.x, this.y, this.displayHeight + 6);
      return;
    }

    body.setVelocityX(PATROL_SPEED * this.direction);
    this.setFlipX(this.direction < 0);

    const aheadX = this.x + PROBE_AHEAD * this.direction;
    const groundTile = this.groundLayer.getTileAtWorldXY(aheadX, this.y + 4);
    const wallTile = this.groundLayer.getTileAtWorldXY(aheadX, this.y - this.displayHeight * 0.5);
    const blocked = body.blocked.left || body.blocked.right;

    if (!groundTile || wallTile || blocked) {
      this.direction = this.direction === 1 ? -1 : 1;
    }

    this.levelBadge.follow(this.x, this.y, this.displayHeight + 6);
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
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.15,
      alpha: 0,
      duration: DEATH_TWEEN_MS,
      onComplete: () => this.destroy()
    });
  }
}
