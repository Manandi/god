import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { GameAudio } from '../audio/GameAudio';
import { GameSave } from '../progress/GameSave';
import { PlayerProgress } from '../progress/PlayerProgress';
import { BIOMES, biomeForZone, type BiomeDefinition } from '../world/Biomes';

export class WorldScene extends Phaser.Scene {
  private globe!: Phaser.GameObjects.Container;
  private selected: BiomeDefinition = BIOMES[0];
  private detailTitle!: Phaser.GameObjects.Text;
  private detailBody!: Phaser.GameObjects.Text;
  private enterButton!: Phaser.GameObjects.Container;
  private enterLabel!: Phaser.GameObjects.Text;
  private dragging = false;
  private previousPointerX = 0;
  private markerLabels: Phaser.GameObjects.Text[] = [];

  constructor() { super('WorldScene'); }

  preload(): void {
    if (!this.textures.exists('world-globe-v1')) this.load.image('world-globe-v1', 'art/world-globe-v1.webp');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x020a0b);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03100f, 1).setOrigin(0);
    this.add.text(26, 22, 'THE LIVING WORLD', { fontFamily: 'Georgia, serif', fontSize: '27px', color: '#eef3cf', letterSpacing: 3 });
    this.add.text(27, 57, 'Drag the world to turn it · choose a realm', { fontFamily: 'monospace', fontSize: '12px', color: '#789b8b' });

    const image = this.add.image(0, 0, 'world-globe-v1').setDisplaySize(470, 470);
    this.globe = this.add.container(350, 283, [image]);
    image.setInteractive(new Phaser.Geom.Circle(image.width / 2, image.height / 2, image.width / 2), Phaser.Geom.Circle.Contains);

    for (const biome of BIOMES) {
      const unlocked = PlayerProgress.level >= biome.requiredLevel;
      const marker = this.add.circle(biome.marker.x, biome.marker.y, 14, biome.color, unlocked ? 0.95 : 0.38)
        .setStrokeStyle(3, unlocked ? 0xffffff : 0x7b8580, 0.9)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(biome.marker.x, biome.marker.y + 22, unlocked ? biome.title.split(' ')[1] ?? biome.title : `LV ${biome.requiredLevel}`, {
        fontFamily: 'monospace', fontSize: '9px', color: unlocked ? '#ffffff' : '#aab3ae', backgroundColor: '#020b0bcc'
      }).setPadding(3, 2, 3, 2).setOrigin(0.5, 0);
      marker.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.selectBiome(biome);
      });
      this.globe.add([marker, label]);
      this.markerLabels.push(label);
    }

    this.add.rectangle(775, 286, 330, 390, 0x061611, 0.94).setStrokeStyle(1, 0x668873, 0.65);
    this.detailTitle = this.add.text(632, 128, '', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#eef3cf', wordWrap: { width: 285 } });
    this.detailBody = this.add.text(632, 190, '', { fontFamily: 'monospace', fontSize: '13px', color: '#b8cbc0', lineSpacing: 8, wordWrap: { width: 285 } });
    this.enterLabel = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '13px', color: '#07110b' }).setOrigin(0.5);
    const buttonBg = this.add.rectangle(0, 0, 285, 48, 0xb9d889, 1).setStrokeStyle(2, 0xf1f5c9, 0.8);
    this.enterButton = this.add.container(775, 440, [buttonBg, this.enterLabel]).setSize(285, 48).setInteractive({ useHandCursor: true });
    this.enterButton.on('pointerdown', () => this.enterSelected());
    this.add.text(928, 500, 'ESC  TITLE', { fontFamily: 'monospace', fontSize: '10px', color: '#80978b' }).setOrigin(1, 1);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(pointer.x, pointer.y, this.globe.x, this.globe.y) > 245) return;
      this.dragging = true;
      this.previousPointerX = pointer.x;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.globe.angle += (pointer.x - this.previousPointerX) * 0.32;
      this.previousPointerX = pointer.x;
      for (const label of this.markerLabels) label.setAngle(-this.globe.angle);
    });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TitleScene'));

    this.selectBiome(biomeForZone(PlayerProgress.currentZone));
    this.cameras.main.fadeIn(350, 2, 10, 10);
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
    if (PlayerProgress.level < this.selected.requiredLevel) {
      this.cameras.main.shake(120, 0.003);
      return;
    }
    PlayerProgress.currentZone = this.selected.zoneKey;
    PlayerProgress.currentSpawn = this.selected.zoneKey === 'biosphere' ? PlayerProgress.currentSpawn : 'fromWest';
    GameSave.save();
    GameAudio.unlock();
    GameAudio.startAmbient();
    this.cameras.main.fadeOut(260, 2, 8, 7);
    this.time.delayedCall(280, () => this.scene.start('ZoneScene', { zoneKey: PlayerProgress.currentZone, spawnName: PlayerProgress.currentSpawn }));
  }
}
