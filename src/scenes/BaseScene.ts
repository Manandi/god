import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { Leaderboard } from '../online/Leaderboard';
import { loadBaseLayout, sanitizeBaseLayout, saveBaseLayout, type PlacedDecoration } from '../progress/BaseLayout';
import type { CharacterStats } from '../progress/PlayerProgress';
import { generatePlayerTexture } from '../entities/PlayerAppearance';

interface Owner {
  name: string;
  level: number;
  total_stats: number;
  stats?: Partial<CharacterStats> & { __base?: unknown };
}
export interface BaseSceneData { owner?: Owner; editable?: boolean }
type Room = 'outside' | 'inside';

const SIZE = { width: 1536, height: 1024 };
const ITEMS = [
  { id: 'planter', label: 'Flower bed', level: 1, room: 'outside', frame: 0, width: 104, height: 86 },
  { id: 'lantern', label: 'Root lantern', level: 3, room: 'outside', frame: 1, width: 70, height: 100 },
  { id: 'bench', label: 'Mushroom bench', level: 5, room: 'outside', frame: 2, width: 125, height: 80 },
  { id: 'chair', label: 'Forest chair', level: 1, room: 'inside', frame: 3, width: 82, height: 82 },
  { id: 'rug', label: 'Woven rug', level: 2, room: 'inside', frame: 4, width: 108, height: 108 },
  { id: 'table', label: 'Fern table', level: 4, room: 'inside', frame: 5, width: 112, height: 100 }
] as const;

export class BaseScene extends Phaser.Scene {
  private owner: Owner = { name: 'Explorer', level: 1, total_stats: 0 };
  private editable = false;
  private room: Room = 'outside';
  private background!: Phaser.GameObjects.Image;
  private avatar!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private prompt!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private layout: PlacedDecoration[] = [];
  private decorations: Phaser.GameObjects.Image[] = [];
  private decorMode = false;
  private selectedItem = 'planter';
  private inventory: Phaser.GameObjects.GameObject[] = [];
  private preview?: Phaser.GameObjects.Image;
  private target?: { x: number; y: number };

  constructor() { super('BaseScene'); }

  init(data: BaseSceneData = {}): void {
    this.owner = { name: 'Explorer', level: 1, total_stats: 0, ...(data.owner ?? {}) };
    this.editable = data.editable === true;
    this.layout = this.editable ? loadBaseLayout() : sanitizeBaseLayout(this.owner.stats?.__base);
    this.room = 'outside';
    this.decorMode = false;
    this.selectedItem = 'planter';
    this.target = undefined;
  }

  preload(): void {
    if (!this.textures.exists('base-island-overhead-v2')) this.load.image('base-island-overhead-v2', 'art/base-island-overhead-v2.webp');
    if (!this.textures.exists('base-home-interior-v2')) this.load.image('base-home-interior-v2', 'art/base-home-interior-v2.webp');
    if (!this.textures.exists('base-decor-atlas-v2')) this.load.spritesheet('base-decor-atlas-v2', 'art/base-decor-atlas-v2.webp', { frameWidth: 512, frameHeight: 512 });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x06150f);
    this.background = this.add.image(0, 0, 'base-island-overhead-v2').setOrigin(0).setDepth(-10);
    this.background.setDisplaySize(SIZE.width, SIZE.height);
    this.add.rectangle(0, 0, GAME_WIDTH, 78, 0x020b09, 0.83).setOrigin(0).setScrollFactor(0).setDepth(100);
    this.add.text(20, 12, `${this.owner.name.toUpperCase()}'S ROOTSTEAD`, {
      fontFamily: 'Georgia, serif', fontSize: '23px', color: '#eff4ca'
    }).setScrollFactor(0).setDepth(101);
    this.roomLabel = this.add.text(22, 45, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#c3d8c8'
    }).setScrollFactor(0).setDepth(101);
    this.add.text(940, 18, this.editable ? 'CLICK / WASD  MOVE   E  DOOR   B  DECORATE   ESC  RETURN' : 'CLICK / WASD  MOVE   E  DOOR   ESC  RETURN', {
      fontFamily: 'monospace', fontSize: '11px', color: '#e1e9db', backgroundColor: '#07110baa'
    }).setPadding(5, 4, 5, 4).setOrigin(1, 0).setScrollFactor(0).setDepth(101);
    this.prompt = this.add.text(GAME_WIDTH / 2, 448, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#f0f7d7', backgroundColor: '#09160edc'
    }).setPadding(10, 7, 10, 7).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    generatePlayerTexture(this);
    this.shadow = this.add.ellipse(640, 383, 26, 9, 0x000000, 0.48);
    this.avatar = this.add.sprite(640, 383, 'player').setDisplaySize(44, 72).setOrigin(0.5, 1);
    this.cameras.main.setBounds(0, 0, SIZE.width, SIZE.height);
    this.cameras.main.startFollow(this.avatar, true, 0.09, 0.09);
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.keyboard?.on('keydown-E', () => this.useDoor());
    this.input.keyboard?.on('keydown-B', () => { if (this.editable) this.setDecorMode(!this.decorMode); });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TitleScene'));
    for (let i = 1; i <= ITEMS.length; i++) {
      this.input.keyboard?.on(`keydown-${i}`, () => this.selectItem(i - 1));
    }
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 448) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.decorMode && this.editable) {
        if (pointer.rightButtonDown()) this.removeDecoration(world.x, world.y);
        else this.placeDecoration(world.x, world.y);
      } else if (this.canWalk(world.x, world.y)) {
        this.target = { x: world.x, y: world.y };
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.preview?.setPosition(Math.round(world.x / 20) * 20, Math.round(world.y / 20) * 20);
    });
    this.drawDecorations();
    this.roomLabel.setText(`ISLAND  ·  LV ${this.owner.level}  ·  ${this.owner.total_stats} TOTAL STATS`);
    this.cameras.main.fadeIn(330, 3, 12, 10);
  }

  update(_time: number, delta: number): void {
    const keys = this.keys;
    if (!keys) return;
    let dx = Number(keys.D.isDown || keys.RIGHT.isDown) - Number(keys.A.isDown || keys.LEFT.isDown);
    let dy = Number(keys.S.isDown || keys.DOWN.isDown) - Number(keys.W.isDown || keys.UP.isDown);
    if (dx || dy) this.target = undefined;
    else if (this.target) {
      dx = this.target.x - this.avatar.x;
      dy = this.target.y - this.avatar.y;
      if (Math.hypot(dx, dy) < 8) { dx = 0; dy = 0; this.target = undefined; }
    }
    if (dx || dy) {
      const step = Math.min(delta / 1000, 0.04) * 185 / Math.hypot(dx, dy);
      const nextX = this.avatar.x + dx * step, nextY = this.avatar.y + dy * step;
      if (this.canWalk(nextX, this.avatar.y)) this.avatar.x = nextX;
      if (this.canWalk(this.avatar.x, nextY)) this.avatar.y = nextY;
      if (Math.abs(dx) > 0.2) this.avatar.setFlipX(dx < 0);
    }
    this.avatar.setDepth(this.avatar.y + 1);
    this.shadow.setPosition(this.avatar.x, this.avatar.y + 1).setDepth(this.avatar.y - 1);
    const door = this.room === 'outside' ? { x: 435, y: 246 } : { x: 768, y: 835 };
    const nearDoor = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, door.x, door.y) < 85;
    this.prompt.setText(nearDoor ? `E  ${this.room === 'outside' ? 'ENTER HOME' : 'EXIT HOME'}` : this.decorMode ? '1–6  CHOOSE  ·  CLICK  PLACE  ·  RIGHT CLICK  REMOVE  ·  B  CLOSE' : '');
  }

  private canWalk(x: number, y: number): boolean {
    if (this.room === 'inside') return x >= 90 && x <= 1445 && y >= 270 && y <= 855;
    const nx = (x - 760) / 645, ny = (y - 485) / 370;
    if (nx * nx + ny * ny > 1) return false;
    if (x > 252 && x < 610 && y < 245) return false; // cottage roof / walls
    if (x > 1170 && y < 620) return false; // water, not a path
    return true;
  }

  private useDoor(): void {
    const door = this.room === 'outside' ? { x: 435, y: 246 } : { x: 768, y: 835 };
    if (Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, door.x, door.y) >= 85) return;
    this.room = this.room === 'outside' ? 'inside' : 'outside';
    this.target = undefined;
    this.background.setTexture(this.room === 'outside' ? 'base-island-overhead-v2' : 'base-home-interior-v2');
    this.background.setDisplaySize(SIZE.width, SIZE.height);
    this.avatar.setPosition(this.room === 'inside' ? 768 : 435, this.room === 'inside' ? 790 : 280);
    this.roomLabel.setText(`${this.room === 'inside' ? 'HOME INTERIOR' : 'ISLAND'}  ·  LV ${this.owner.level}  ·  ${this.owner.total_stats} TOTAL STATS`);
    this.setDecorMode(false);
    this.drawDecorations();
    this.cameras.main.fadeIn(200, 2, 10, 6);
  }

  private drawDecorations(): void {
    this.decorations.forEach(image => image.destroy());
    this.decorations = [];
    for (const piece of this.layout.filter(piece => piece.room === this.room)) {
      const def = ITEMS.find(item => item.id === piece.item);
      if (!def) continue;
      this.decorations.push(this.add.image(piece.x, piece.y, 'base-decor-atlas-v2', def.frame)
        .setDisplaySize(def.width, def.height).setDepth(piece.y));
    }
  }

  private setDecorMode(enabled: boolean): void {
    this.decorMode = enabled;
    this.inventory.forEach(object => object.destroy());
    this.inventory = [];
    this.preview?.destroy(); this.preview = undefined;
    if (!enabled) return;
    const panel = this.add.rectangle(480, 495, 950, 87, 0x07150f, 0.94).setScrollFactor(0).setDepth(100);
    this.inventory.push(panel);
    ITEMS.forEach((item, i) => {
      const unlocked = item.level <= this.owner.level;
      const compatible = item.room === this.room;
      const x = 91 + i * 153;
      const slot = this.add.rectangle(x, 497, 145, 72, this.selectedItem === item.id ? 0x314a31 : 0x101c15, compatible && unlocked ? 0.95 : 0.52)
        .setStrokeStyle(1, this.selectedItem === item.id ? 0xd4e79b : 0x63816c, 0.75)
        .setScrollFactor(0).setDepth(101).setInteractive({ useHandCursor: compatible && unlocked });
      const thumb = this.add.image(x - 38, 494, 'base-decor-atlas-v2', item.frame).setDisplaySize(47, 47)
        .setScrollFactor(0).setDepth(102).setAlpha(unlocked && compatible ? 1 : 0.3);
      const label = this.add.text(x - 8, 482, `${i + 1} ${item.label}\n${!compatible ? (item.room === 'inside' ? 'INDOORS' : 'OUTDOORS') : unlocked ? 'READY' : `LV ${item.level}`}`, {
        fontFamily: 'monospace', fontSize: '10px', color: unlocked && compatible ? '#e0edd4' : '#748473', lineSpacing: 3
      }).setScrollFactor(0).setDepth(102);
      slot.on('pointerdown', () => this.selectItem(i));
      this.inventory.push(slot, thumb, label);
    });
    this.selectItem(ITEMS.findIndex(item => item.room === this.room && item.level <= this.owner.level));
  }

  private selectItem(index: number): void {
    if (!this.decorMode || index < 0) return;
    const item = ITEMS[index];
    if (!item || item.room !== this.room || item.level > this.owner.level) return;
    this.selectedItem = item.id;
    // The low-cost preview tracks the pointer without altering the saved layout.
    this.preview?.destroy();
    this.preview = this.add.image(-100, -100, 'base-decor-atlas-v2', item.frame)
      .setDisplaySize(item.width, item.height).setAlpha(0.7).setDepth(900);
    this.inventory.forEach(object => {
      if (object instanceof Phaser.GameObjects.Rectangle && object.input) {
        const i = this.inventory.indexOf(object);
        const def = ITEMS[Math.floor((i - 1) / 3)];
        if (def) object.setStrokeStyle(1, def.id === item.id ? 0xd4e79b : 0x63816c, 0.75);
      }
    });
  }

  private placeDecoration(rawX: number, rawY: number): void {
    const item = ITEMS.find(value => value.id === this.selectedItem);
    if (!item || this.layout.length >= 32) return;
    const x = Math.round(rawX / 20) * 20, y = Math.round(rawY / 20) * 20;
    if (!this.canWalk(x, y) || Phaser.Math.Distance.Between(x, y, this.avatar.x, this.avatar.y) < 48 ||
      this.layout.some(piece => piece.room === this.room && Phaser.Math.Distance.Between(x, y, piece.x, piece.y) < 65) ||
      (this.room === 'outside' && Phaser.Math.Distance.Between(x, y, 435, 246) < 95) ||
      (this.room === 'inside' && y > 765 && Math.abs(x - 768) < 150)) return;
    this.layout.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, item: item.id, room: this.room, x, y });
    this.persist(); this.drawDecorations();
  }

  private removeDecoration(x: number, y: number): void {
    const index = this.layout.findIndex(piece => piece.room === this.room && Phaser.Math.Distance.Between(x, y, piece.x, piece.y) < 55);
    if (index < 0) return;
    this.layout.splice(index, 1);
    this.persist(); this.drawDecorations();
  }

  private persist(): void {
    saveBaseLayout(this.layout);
    void Leaderboard.syncBase(this.layout);
  }

}
