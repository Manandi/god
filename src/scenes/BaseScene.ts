import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { Leaderboard } from '../online/Leaderboard';
import { loadBaseLayout, sanitizeBaseLayout, saveBaseLayout, type PlacedDecoration } from '../progress/BaseLayout';
import type { CharacterStats } from '../progress/PlayerProgress';
import { generatePlayerTexture } from '../entities/PlayerAppearance';
import { canBuildFootprint, canWalkTerrain, HOME_DOOR, HOME_EXIT, intersects, WORLD_BRIDGE, type GroundRect } from '../world/BaseGround';

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
  { id: 'planter', label: 'Flower bed', level: 1, room: 'outside', frame: 0, width: 104, height: 86, footW: 86, footH: 54 },
  { id: 'lantern', label: 'Root lantern', level: 3, room: 'outside', frame: 1, width: 70, height: 100, footW: 40, footH: 36 },
  { id: 'bench', label: 'Mushroom bench', level: 5, room: 'outside', frame: 2, width: 125, height: 80, footW: 110, footH: 48 },
  { id: 'chair', label: 'Forest chair', level: 1, room: 'inside', frame: 3, width: 82, height: 82, footW: 62, footH: 56 },
  { id: 'rug', label: 'Woven rug', level: 2, room: 'inside', frame: 4, width: 108, height: 108, footW: 98, footH: 76 },
  { id: 'table', label: 'Fern table', level: 4, room: 'inside', frame: 5, width: 112, height: 100, footW: 88, footH: 68 }
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
  private bridgeSign!: Phaser.GameObjects.Container;
  private layout: PlacedDecoration[] = [];
  private decorations: Phaser.GameObjects.Image[] = [];
  private decorMode = false;
  private selectedItem = 'planter';
  private inventory: Phaser.GameObjects.GameObject[] = [];
  private preview?: Phaser.GameObjects.Image;
  private route: Array<{ x: number; y: number }> = [];
  private rotation = 0;
  private placementHint = '';

  constructor() { super('BaseScene'); }

  init(data: BaseSceneData = {}): void {
    this.owner = { name: 'Explorer', level: 1, total_stats: 0, ...(data.owner ?? {}) };
    this.editable = data.editable === true;
    this.layout = this.editable ? loadBaseLayout() : sanitizeBaseLayout(this.owner.stats?.__base);
    this.room = 'outside';
    this.decorMode = false;
    this.selectedItem = 'planter';
    this.route = [];
    this.rotation = 0;
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
    this.add.text(940, 18, this.editable ? 'CLICK / WASD  MOVE   E  USE   B  DECORATE   ESC  RETURN' : 'CLICK / WASD  MOVE   E  USE   ESC  RETURN', {
      fontFamily: 'monospace', fontSize: '11px', color: '#e1e9db', backgroundColor: '#07110baa'
    }).setPadding(5, 4, 5, 4).setOrigin(1, 0).setScrollFactor(0).setDepth(101);
    this.prompt = this.add.text(GAME_WIDTH / 2, 448, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#f0f7d7', backgroundColor: '#09160edc'
    }).setPadding(10, 7, 10, 7).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // The illustrated southwest bridge is the island's physical exit.
    const bridgeGlow = this.add.circle(0, 0, 17, 0x98e4bd, 0.28)
      .setStrokeStyle(2, 0xcceec8, 0.75);
    const bridgeLabel = this.add.text(16, -39, 'WORLD MAP  ◀', {
      fontFamily: 'monospace', fontSize: '12px', color: '#eaf7db', backgroundColor: '#0c2417c9'
    }).setPadding(5, 3, 5, 3);
    this.bridgeSign = this.add.container(WORLD_BRIDGE.x, WORLD_BRIDGE.y, [bridgeGlow, bridgeLabel]).setDepth(15);

    generatePlayerTexture(this);
    this.shadow = this.add.ellipse(640, 383, 19, 6, 0x000000, 0.45);
    this.avatar = this.add.sprite(640, 383, 'player').setDisplaySize(30, 49).setOrigin(0.5, 1);
    this.cameras.main.setBounds(0, 0, SIZE.width, SIZE.height);
    this.cameras.main.startFollow(this.avatar, true, 0.09, 0.09);
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.keyboard?.on('keydown-E', () => this.useDoor());
    this.input.keyboard?.on('keydown-B', () => { if (this.editable) this.setDecorMode(!this.decorMode); });
    this.input.keyboard?.on('keydown-R', () => {
      if (this.decorMode) { this.rotation = (this.rotation + 1) % 4; this.preview?.setAngle(this.rotation * 90); }
    });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TitleScene'));
    for (let i = 1; i <= ITEMS.length; i++) {
      this.input.keyboard?.on(`keydown-${i}`, () => this.selectItem(i - 1));
    }
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.decorMode && pointer.y > 448) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.decorMode && this.editable) {
        if (pointer.rightButtonDown()) this.removeDecoration(world.x, world.y);
        else this.placeDecoration(world.x, world.y);
      } else if (this.canWalk(world.x, world.y)) {
        this.route = this.findRoute(world.x, world.y);
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.preview?.setPosition(Math.round(world.x / 20) * 20, Math.round(world.y / 20) * 20);
      if (this.preview) {
        const valid = this.canPlace(this.preview.x, this.preview.y, this.selectedItem, this.rotation);
        this.preview.setTint(valid ? 0xffffff : 0xff7777);
      }
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
    if (dx || dy) this.route = [];
    else if (this.route.length) {
      while (this.route.length && Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, this.route[0].x, this.route[0].y) < 9)
        this.route.shift();
      if (this.route.length) {
        dx = this.route[0].x - this.avatar.x;
        dy = this.route[0].y - this.avatar.y;
      }
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
    const door = this.room === 'outside' ? HOME_DOOR : HOME_EXIT;
    const nearDoor = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, door.x, door.y) < 85;
    const nearBridge = this.room === 'outside' && Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, WORLD_BRIDGE.x, WORLD_BRIDGE.y) < 70;
    this.prompt.setText(nearBridge ? 'E  CROSS BRIDGE TO WORLD MAP'
      : nearDoor ? `E  ${this.room === 'outside' ? 'ENTER HOME' : 'EXIT HOME'}`
      : this.placementHint || (this.decorMode ? '1–6  ITEM  ·  R  ROTATE  ·  CLICK  PLACE  ·  RIGHT CLICK  REMOVE' : ''));
  }

  private canWalk(x: number, y: number): boolean {
    if (!canWalkTerrain(this.room, x, y)) return false;
    return !this.layout.some(piece => {
      if (piece.room !== this.room || piece.item === 'rug') return false;
      return intersects(this.footprint(piece.x, piece.y, piece.item, piece.rotation),
        { x: x - 7, y: y - 7, width: 14, height: 14 });
    });
  }

  private useDoor(): void {
    if (this.room === 'outside' && Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, WORLD_BRIDGE.x, WORLD_BRIDGE.y) < 70) {
      this.scene.start('WorldScene');
      return;
    }
    const door = this.room === 'outside' ? HOME_DOOR : HOME_EXIT;
    if (Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, door.x, door.y) >= 85) return;
    this.room = this.room === 'outside' ? 'inside' : 'outside';
    this.route = [];
    this.background.setTexture(this.room === 'outside' ? 'base-island-overhead-v2' : 'base-home-interior-v2');
    this.background.setDisplaySize(SIZE.width, SIZE.height);
    this.avatar.setPosition(this.room === 'inside' ? 768 : 435, this.room === 'inside' ? 790 : 280);
    this.bridgeSign.setVisible(this.room === 'outside');
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
        .setDisplaySize(def.width, def.height).setAngle(piece.rotation * 90).setDepth(piece.y));
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
      .setDisplaySize(item.width, item.height).setAngle(this.rotation * 90).setAlpha(0.7).setDepth(900);
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
    if (!this.canPlace(x, y, item.id, this.rotation)) {
      this.placementHint = 'NO SPACE HERE  ·  FIND A CLEAR PLOT OR ROTATE WITH R';
      this.time.delayedCall(1700, () => { this.placementHint = ''; });
      return;
    }
    this.layout.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, item: item.id, room: this.room, x, y, rotation: this.rotation });
    this.persist(); this.drawDecorations();
  }

  private removeDecoration(x: number, y: number): void {
    const index = this.layout.findIndex(piece => piece.room === this.room &&
      intersects(this.footprint(piece.x, piece.y, piece.item, piece.rotation), { x, y, width: 1, height: 1 }, 8));
    if (index < 0) return;
    this.layout.splice(index, 1);
    this.persist(); this.drawDecorations();
  }

  private persist(): void {
    saveBaseLayout(this.layout);
    void Leaderboard.syncBase(this.layout);
  }

  private footprint(x: number, y: number, itemId: string, rotation: number): GroundRect {
    const def = ITEMS.find(item => item.id === itemId)!;
    const sideways = rotation % 2 === 1;
    const width = sideways ? def.footH : def.footW;
    const height = sideways ? def.footW : def.footH;
    return { x: x - width / 2, y: y - height / 2, width, height };
  }

  private canPlace(x: number, y: number, itemId: string, rotation: number): boolean {
    const def = ITEMS.find(item => item.id === itemId);
    if (!def || def.room !== this.room || def.level > this.owner.level || this.layout.length >= 32) return false;
    const bounds = this.footprint(x, y, itemId, rotation);
    if (!canBuildFootprint(this.room, bounds)) return false;
    if (intersects(bounds, { x: this.avatar.x - 15, y: this.avatar.y - 12, width: 30, height: 24 }, 12)) return false;
    if (this.room === 'outside' &&
      (intersects(bounds, { x: HOME_DOOR.x - 75, y: HOME_DOOR.y - 20, width: 150, height: 120 }) ||
        intersects(bounds, { x: WORLD_BRIDGE.x - 62, y: WORLD_BRIDGE.y - 55, width: 124, height: 110 }))) return false;
    if (this.room === 'inside' && intersects(bounds, { x: HOME_EXIT.x - 110, y: HOME_EXIT.y - 70, width: 220, height: 95 })) return false;
    return !this.layout.some(piece => piece.room === this.room &&
      intersects(bounds, this.footprint(piece.x, piece.y, piece.item, piece.rotation), 10));
  }

  /** Route around scenery and solid furniture for click-to-walk. */
  private findRoute(x: number, y: number): Array<{ x: number; y: number }> {
    if (this.lineClear(this.avatar.x, this.avatar.y, x, y)) return [{ x, y }];
    const grid = 20, cols = 77, rows = 52;
    const coord = (index: number) => ({ x: index % cols * grid, y: Math.floor(index / cols) * grid });
    const nearest = (px: number, py: number): number => {
      const gx = Math.round(px / grid), gy = Math.round(py / grid);
      for (let radius = 0; radius <= 3; radius++) {
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
          const cx = gx + dx, cy = gy + dy;
          if (cx >= 0 && cy >= 0 && cx < cols && cy < rows && this.canWalk(cx * grid, cy * grid)) return cy * cols + cx;
        }
      }
      return -1;
    };
    const start = nearest(this.avatar.x, this.avatar.y), end = nearest(x, y);
    if (start < 0 || end < 0) return [];
    const parents = new Int32Array(cols * rows).fill(-1);
    const queue = new Int32Array(cols * rows);
    let head = 0, tail = 0;
    queue[tail++] = start; parents[start] = start;
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (head < tail && parents[end] < 0) {
      const current = queue[head++], cx = current % cols, cy = Math.floor(current / cols);
      for (const [dx, dy] of directions) {
        const nx = cx + dx, ny = cy + dy, next = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || parents[next] >= 0 || !this.canWalk(nx * grid, ny * grid)) continue;
        if (dx && dy && (!this.canWalk(nx * grid, cy * grid) || !this.canWalk(cx * grid, ny * grid))) continue;
        parents[next] = current; queue[tail++] = next;
      }
    }
    if (parents[end] < 0) return [];
    const nodes: Array<{ x: number; y: number }> = [];
    for (let node = end; node !== start; node = parents[node]) nodes.unshift(coord(node));
    nodes.push({ x, y });
    const path: Array<{ x: number; y: number }> = [];
    let from = { x: this.avatar.x, y: this.avatar.y };
    for (let i = 0; i < nodes.length;) {
      let best = i;
      for (let j = i + 1; j < nodes.length; j++) if (this.lineClear(from.x, from.y, nodes[j].x, nodes[j].y)) best = j;
      path.push(nodes[best]); from = nodes[best]; i = best + 1;
    }
    return path;
  }

  private lineClear(x1: number, y1: number, x2: number, y2: number): boolean {
    const steps = Math.ceil(Phaser.Math.Distance.Between(x1, y1, x2, y2) / 8);
    for (let i = 1; i <= steps; i++) if (!this.canWalk(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps)) return false;
    return true;
  }

}
