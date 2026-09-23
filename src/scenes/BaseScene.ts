import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { CharacterStats } from '../progress/PlayerProgress';

export interface BaseSceneData {
  owner?: { name: string; level: number; total_stats: number; stats?: Partial<CharacterStats> };
}

const DECOR = [
  { level: 2, key: 'base-bush', file: 'bush.png', x: 500, y: 340, scale: 2.1, label: 'Moss garden' },
  { level: 4, key: 'base-torch', file: 'torch_on_a.png', x: 645, y: 326, scale: 2.2, label: 'Root lantern' },
  { level: 6, key: 'base-gem', file: 'gem_yellow.png', x: 750, y: 334, scale: 2.4, label: 'Heartseed trophy' },
  { level: 9, key: 'base-rock', file: 'rock.png', x: 845, y: 344, scale: 2.7, label: 'Guardian stone' }
] as const;

export class BaseScene extends Phaser.Scene {
  private owner = { name: 'Explorer', level: 1, total_stats: 0 };
  private avatar!: Phaser.Physics.Arcade.Sprite;
  private moveKeys?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('BaseScene'); }

  init(data: BaseSceneData): void {
    this.owner = { ...this.owner, ...(data.owner ?? {}) };
  }

  preload(): void {
    if (!this.textures.exists('base-island-v1')) this.load.image('base-island-v1', 'art/base-island-v1.webp');
    for (const decor of DECOR) if (!this.textures.exists(decor.key)) this.load.image(decor.key, `sprites/decor/${decor.file}`);
  }

  create(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'base-island-v1').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, 76, 0x020b09, 0.86).setOrigin(0).setScrollFactor(0);
    this.add.text(24, 18, `${this.owner.name.toUpperCase()}'S ROOTSTEAD`, { fontFamily: 'Georgia, serif', fontSize: '24px', color: '#eff4ca', letterSpacing: 2 }).setScrollFactor(0);
    this.add.text(26, 49, `LEVEL ${this.owner.level} · ${this.owner.total_stats} TOTAL STATS`, { fontFamily: 'monospace', fontSize: '11px', color: '#a9bca9' }).setScrollFactor(0);
    this.add.text(936, 26, 'A / D  WALK     ESC  RETURN', { fontFamily: 'monospace', fontSize: '10px', color: '#d5e2d8', backgroundColor: '#07110baa' }).setPadding(5, 4, 5, 4).setOrigin(1, 0).setScrollFactor(0);

    for (const decor of DECOR) {
      if (this.owner.level >= decor.level) {
        this.add.image(decor.x, decor.y, decor.key).setScale(decor.scale).setDepth(3);
        this.add.text(decor.x, decor.y + 22, decor.label, { fontFamily: 'monospace', fontSize: '9px', color: '#d8e5cf', backgroundColor: '#04100dcc' }).setPadding(3, 2, 3, 2).setOrigin(0.5, 0).setDepth(4);
      } else {
        this.add.circle(decor.x, decor.y, 18, 0x07110b, 0.58).setStrokeStyle(1, 0x68806f, 0.5).setDepth(3);
        this.add.text(decor.x, decor.y, `LV\n${decor.level}`, { fontFamily: 'monospace', fontSize: '9px', color: '#87978d', align: 'center' }).setOrigin(0.5).setDepth(4);
      }
    }

    this.generateAvatar();
    this.avatar = this.physics.add.sprite(390, 326, 'base-avatar').setOrigin(0.5, 1).setDepth(5).setCollideWorldBounds(true);
    const body = this.avatar.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setSize(18, 34);
    this.physics.world.setBounds(84, 76, 820, 278);
    this.moveKeys = this.input.keyboard?.addKeys('A,D,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TitleScene'));
    this.cameras.main.fadeIn(300, 3, 12, 10);
  }

  update(): void {
    if (!this.moveKeys) return;
    const left = this.moveKeys.A.isDown || this.moveKeys.LEFT.isDown;
    const right = this.moveKeys.D.isDown || this.moveKeys.RIGHT.isDown;
    this.avatar.setVelocityX(left === right ? 0 : left ? -105 : 105).setFlipX(left);
  }

  private generateAvatar(): void {
    if (this.textures.exists('base-avatar')) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x17241c).fillRect(5, 28, 5, 7).fillRect(13, 28, 5, 7);
    g.fillStyle(0x47795a).fillTriangle(2, 29, 20, 29, 11, 11);
    g.fillStyle(0xb97950).fillRect(7, 3, 9, 9);
    g.fillStyle(0x07110b).fillRect(5, 0, 12, 5);
    g.generateTexture('base-avatar', 22, 36);
    g.destroy();
  }
}
