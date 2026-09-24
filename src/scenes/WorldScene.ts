import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { GameAudio } from '../audio/GameAudio';
import { GameSave } from '../progress/GameSave';
import { PlayerProgress } from '../progress/PlayerProgress';
import { BIOMES, biomeForZone, type BiomeDefinition } from '../world/Biomes';

const SIZE = 540, RADIUS = SIZE / 2 - 3, TAU = Math.PI * 2;
const WORLD_X = 300, WORLD_Y = 283;

/** Samples an original terrain atlas as a sphere. Turning through 360 degrees
 * exposes the far side rather than merely spinning one painted disc. */
export class WorldScene extends Phaser.Scene {
  private selected: BiomeDefinition = BIOMES[0];
  private detailTitle!: Phaser.GameObjects.Text;
  private detailBody!: Phaser.GameObjects.Text;
  private enterButton!: Phaser.GameObjects.Container;
  private enterLabel!: Phaser.GameObjects.Text;
  private markers: Array<{ biome: BiomeDefinition; dot: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }> = [];
  private yaw = BIOMES[0].longitude * TAU;
  private velocity = 0;
  private dragging = false;
  private previousPointerX = 0;
  private source!: Uint8ClampedArray;
  private sourceWidth = 0;
  private sourceHeight = 0;
  private canvasTexture!: Phaser.Textures.CanvasTexture;
  private pixels!: ImageData;
  private lastRender = 0;

  constructor() { super('WorldScene'); }

  preload(): void {
    if (!this.textures.exists('world-surface-v2')) this.load.image('world-surface-v2', 'art/world-surface-v2.webp');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x020a0b);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03100f).setOrigin(0);
    this.add.text(628, 11, 'THE LIVING WORLD', { fontFamily: 'Georgia, serif', fontSize: '26px', color: '#eef3cf', letterSpacing: 3 });
    this.add.text(629, 47, 'Drag to spin 360° · choose a realm', { fontFamily: 'monospace', fontSize: '11px', color: '#a8c9bb' });

    const atlas = this.textures.get('world-surface-v2').getSourceImage() as HTMLImageElement;
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = atlas.width; sourceCanvas.height = atlas.height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
    sourceContext.drawImage(atlas, 0, 0);
    this.source = sourceContext.getImageData(0, 0, atlas.width, atlas.height).data;
    this.sourceWidth = atlas.width; this.sourceHeight = atlas.height;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = SIZE; outputCanvas.height = SIZE;
    this.canvasTexture = this.textures.addCanvas('world-projected', outputCanvas)!;
    this.pixels = this.canvasTexture.context.createImageData(SIZE, SIZE);
    this.add.circle(WORLD_X, WORLD_Y, 263, 0x193c42, 0.15).setStrokeStyle(1, 0x477779, 0.4);
    this.add.image(WORLD_X, WORLD_Y, 'world-projected').setDisplaySize(520, 520);
    this.drawSphere();

    for (const biome of BIOMES) {
      const unlocked = PlayerProgress.level >= biome.requiredLevel;
      const dot = this.add.circle(0, 0, 12, biome.color, unlocked ? 1 : 0.82)
        .setStrokeStyle(2, 0xffffff, 0.9).setInteractive({ useHandCursor: true });
      const label = this.add.text(0, 0, unlocked ? biome.shortName : `LV ${biome.requiredLevel}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#f5fae9', backgroundColor: '#06120ddf'
      }).setPadding(5, 3, 5, 3).setOrigin(0.5, 0);
      dot.on('pointerdown', () => { this.velocity = 0; this.selectBiome(biome); });
      this.markers.push({ biome, dot, label });
    }
    this.positionMarkers();

    this.add.rectangle(774, 280, 342, 400, 0x061611, 0.97).setStrokeStyle(1, 0x668873, 0.68);
    this.detailTitle = this.add.text(628, 108, '', { fontFamily: 'Georgia, serif', fontSize: '23px', color: '#eef3cf', wordWrap: { width: 300 } });
    this.detailBody = this.add.text(628, 163, '', { fontFamily: 'monospace', fontSize: '14px', color: '#b8cbc0', lineSpacing: 7, wordWrap: { width: 300 } });
    this.enterLabel = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '14px', color: '#07110b' }).setOrigin(0.5);
    const buttonBg = this.add.rectangle(0, 0, 290, 48, 0xb9d889).setStrokeStyle(2, 0xf1f5c9, 0.8);
    this.enterButton = this.add.container(774, 433, [buttonBg, this.enterLabel]).setSize(290, 48).setInteractive({ useHandCursor: true });
    this.enterButton.on('pointerdown', () => this.enterSelected());
    this.add.text(628, 499, '← / →  TURN                 ESC  TITLE', { fontFamily: 'monospace', fontSize: '11px', color: '#9bb8a9' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(pointer.x, pointer.y, WORLD_X, WORLD_Y) > 260) return;
      this.dragging = true; this.velocity = 0; this.previousPointerX = pointer.x;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dx = pointer.x - this.previousPointerX;
      this.velocity = -dx * 0.006;
      this.yaw = Phaser.Math.Wrap(this.yaw + this.velocity, 0, TAU);
      this.previousPointerX = pointer.x;
      this.renderIfDue(true);
    });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.keyboard?.on('keydown-LEFT', () => { this.yaw = Phaser.Math.Wrap(this.yaw - Math.PI / 8, 0, TAU); this.renderIfDue(true); });
    this.input.keyboard?.on('keydown-RIGHT', () => { this.yaw = Phaser.Math.Wrap(this.yaw + Math.PI / 8, 0, TAU); this.renderIfDue(true); });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TitleScene'));
    this.selectBiome(biomeForZone(PlayerProgress.currentZone));
    this.cameras.main.fadeIn(300, 2, 10, 10);
  }

  update(_time: number, delta: number): void {
    if (this.dragging || Math.abs(this.velocity) < 0.0001) return;
    this.yaw = Phaser.Math.Wrap(this.yaw + this.velocity * Math.min(delta, 40) / 16, 0, TAU);
    this.velocity *= Math.pow(0.9, delta / 16);
    this.renderIfDue(false);
  }

  private renderIfDue(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastRender < 33) return;
    this.lastRender = now; this.drawSphere(); this.positionMarkers();
  }

  private drawSphere(): void {
    const output = this.pixels.data;
    const sw = this.sourceWidth, sh = this.sourceHeight, atlas = this.source;
    let index = 0;
    for (let y = 0; y < SIZE; y++) {
      const ny = (y + 0.5 - SIZE / 2) / RADIUS;
      for (let x = 0; x < SIZE; x++, index += 4) {
        const nx = (x + 0.5 - SIZE / 2) / RADIUS;
        const d = nx * nx + ny * ny;
        if (d >= 1) { output[index + 3] = 0; continue; }
        const nz = Math.sqrt(1 - d);
        const longitude = Phaser.Math.Wrap(Math.atan2(nx, nz) + this.yaw, 0, TAU);
        const latitude = Math.asin(-ny);
        const sx = Math.min(sw - 1, Math.floor(longitude / TAU * sw));
        const sy = Math.min(sh - 1, Math.max(0, Math.floor((0.5 - latitude / Math.PI) * sh)));
        const src = (sy * sw + sx) * 4;
        const light = 0.38 + 0.57 * nz + 0.15 * Math.max(0, -nx);
        output[index] = atlas[src] * light;
        output[index + 1] = atlas[src + 1] * light;
        output[index + 2] = atlas[src + 2] * light;
        output[index + 3] = Math.min(255, (1 - d) * 6500);
      }
    }
    this.canvasTexture.context.putImageData(this.pixels, 0, 0);
    this.canvasTexture.refresh();
  }

  private positionMarkers(): void {
    for (const { biome, dot, label } of this.markers) {
      const delta = Phaser.Math.Angle.Wrap(biome.longitude * TAU - this.yaw);
      const lat = biome.latitude;
      const visible = Math.cos(delta) * Math.cos(lat) > 0.17;
      dot.setVisible(visible); label.setVisible(visible);
      if (!visible) continue;
      const x = WORLD_X + Math.sin(delta) * Math.cos(lat) * 242;
      const y = WORLD_Y - Math.sin(lat) * 242;
      dot.setPosition(x, y); label.setPosition(x, y + 17);
    }
  }

  private selectBiome(biome: BiomeDefinition): void {
    this.selected = biome;
    const unlocked = PlayerProgress.level >= biome.requiredLevel;
    this.detailTitle.setText(biome.title).setColor(`#${biome.color.toString(16).padStart(6, '0')}`);
    this.detailBody.setText(`${biome.subtitle}\n\nCREATURES\n${biome.mobs}\n\nREGION BOSS\n${biome.boss}\n\n${unlocked ? 'Path available.' : `Sealed until Level ${biome.requiredLevel}. You are Level ${PlayerProgress.level}.`}`);
    this.enterLabel.setText(unlocked ? 'ENTER REALM' : `LOCKED · LEVEL ${biome.requiredLevel}`);
    this.enterButton.setAlpha(unlocked ? 1 : 0.45);
  }

  private enterSelected(): void {
    if (PlayerProgress.level < this.selected.requiredLevel) { this.cameras.main.shake(120, 0.003); return; }
    PlayerProgress.currentZone = this.selected.zoneKey;
    PlayerProgress.currentSpawn = this.selected.zoneKey === 'biosphere' ? PlayerProgress.currentSpawn : 'fromWest';
    GameSave.save(); GameAudio.unlock(); GameAudio.startAmbient();
    this.cameras.main.fadeOut(260, 2, 8, 7);
    this.time.delayedCall(280, () => this.scene.start('ZoneScene', { zoneKey: PlayerProgress.currentZone, spawnName: PlayerProgress.currentSpawn }));
  }
}
