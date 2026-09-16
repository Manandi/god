import Phaser from 'phaser';
import { PHYSICS, TILE_SIZE } from '../config';
import { Player } from '../entities/Player';
import { ZONES, FIRST_ZONE, FIRST_SPAWN, ZoneConfig } from '../zones/ZoneRegistry';
import { getObjectProperties } from '../zones/TiledObjects';
import { PlayerProgress } from '../progress/PlayerProgress';

interface ZoneSceneData {
  zoneKey?: string;
  spawnName?: string;
}

interface DoorMeta {
  targetZone: string;
  targetSpawn: string;
  requiredLevel: number;
}

const TRANSITION_COOLDOWN_MS = 400;
const LOCKED_MESSAGE_MS = 1800;
const MARKER_KEYS = ['enemy', 'boss', 'chest', 'lore'] as const;

export class ZoneScene extends Phaser.Scene {
  private zoneKey = FIRST_ZONE;
  private spawnName = FIRST_SPAWN;
  private player!: Player;
  private transitionLocked = false;
  private messageText?: Phaser.GameObjects.Text;

  constructor() {
    super('ZoneScene');
  }

  init(data: ZoneSceneData): void {
    this.zoneKey = data.zoneKey ?? FIRST_ZONE;
    this.spawnName = data.spawnName ?? FIRST_SPAWN;
  }

  preload(): void {
    const config = ZONES[this.zoneKey];
    this.load.tilemapTiledJSON(this.zoneKey, config.mapPath);
    this.load.image(`tileset-${this.zoneKey}`, config.tilesetPath);
    this.load.image(`bg-${this.zoneKey}`, config.backgroundPath);
    for (const key of MARKER_KEYS) {
      if (!this.textures.exists(`marker-${key}`)) {
        this.load.image(`marker-${key}`, `sprites/markers/${key}.png`);
      }
    }
  }

  create(): void {
    const config = ZONES[this.zoneKey];

    this.transitionLocked = true;
    this.time.delayedCall(TRANSITION_COOLDOWN_MS, () => {
      this.transitionLocked = false;
    });

    this.generatePlayerTexture();

    const map = this.make.tilemap({ key: this.zoneKey });
    const tileset = map.addTilesetImage('terrain', `tileset-${this.zoneKey}`);
    if (!tileset) {
      throw new Error(`Failed to create tileset for zone "${this.zoneKey}"`);
    }
    const groundLayer = map.createLayer('ground', tileset, 0, 0);
    if (!groundLayer) {
      throw new Error(`Failed to create ground layer for zone "${this.zoneKey}"`);
    }
    groundLayer.setCollisionByExclusion([-1, 0]);

    const mapWidthPx = map.widthInPixels;
    const mapHeightPx = map.heightInPixels;

    this.createParallax(config, mapWidthPx, mapHeightPx);

    this.physics.world.gravity.y = PHYSICS.gravityY;
    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);

    const spawn = this.findSpawnPosition(map, this.spawnName);
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, groundLayer);

    this.createDoors(map);
    this.createMarkers(map, 'encounters');
    this.createMarkers(map, 'interactables');

    const camera = this.cameras.main;
    camera.setBounds(0, 0, mapWidthPx, mapHeightPx);
    camera.setDeadzone(160, 100);
    camera.startFollow(this.player, true, 0.1, 0.1);

    this.messageText = this.add
      .text(16, 16, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066', backgroundColor: '#00000099' })
      .setPadding(6, 4, 6, 4)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0);
  }

  update(time: number, delta: number): void {
    this.player.update(time, delta);
  }

  private findSpawnPosition(map: Phaser.Tilemaps.Tilemap, spawnName: string): { x: number; y: number } {
    const spawnsLayer = map.getObjectLayer('spawns');
    const objects = spawnsLayer?.objects ?? [];
    const match = objects.find((obj) => obj.name === spawnName) ?? objects[0];
    if (!match) {
      throw new Error(`Zone "${this.zoneKey}" has no spawn points defined`);
    }
    return { x: match.x ?? 0, y: match.y ?? 0 };
  }

  private createDoors(map: Phaser.Tilemaps.Tilemap): void {
    const doorsLayer = map.getObjectLayer('doors');
    for (const obj of doorsLayer?.objects ?? []) {
      const props = getObjectProperties(obj);
      const meta: DoorMeta = {
        targetZone: String(props.targetZone),
        targetSpawn: String(props.targetSpawn),
        requiredLevel: Number(props.requiredLevel ?? 0)
      };

      const width = obj.width ?? TILE_SIZE;
      const height = obj.height ?? TILE_SIZE;
      const zone = this.add.zone(obj.x! + width / 2, obj.y! + height / 2, width, height);
      this.physics.add.existing(zone, true);

      this.physics.add.overlap(this.player, zone, () => this.handleDoorOverlap(meta));
    }
  }

  private handleDoorOverlap(meta: DoorMeta): void {
    if (this.transitionLocked) return;

    if (PlayerProgress.level < meta.requiredLevel) {
      this.showMessage(`Locked — requires Level ${meta.requiredLevel} (you are Level ${PlayerProgress.level})`);
      this.transitionLocked = true;
      this.time.delayedCall(LOCKED_MESSAGE_MS / 2, () => {
        this.transitionLocked = false;
      });
      return;
    }

    this.transitionLocked = true;
    this.scene.restart({ zoneKey: meta.targetZone, spawnName: meta.targetSpawn });
  }

  private showMessage(text: string): void {
    this.messageText?.setText(text).setAlpha(1);
    this.time.delayedCall(LOCKED_MESSAGE_MS, () => {
      this.messageText?.setAlpha(0);
    });
  }

  private createMarkers(map: Phaser.Tilemaps.Tilemap, layerName: string): void {
    const layer = map.getObjectLayer(layerName);
    for (const obj of layer?.objects ?? []) {
      const props = getObjectProperties(obj);
      const kind = String(props.kind ?? '');
      const key = `marker-${kind}`;
      if (!this.textures.exists(key)) continue;
      this.add.image(obj.x ?? 0, obj.y ?? 0, key).setDepth(5);
    }
  }

  private createParallax(config: ZoneConfig, mapWidthPx: number, mapHeightPx: number): void {
    const bgKey = `bg-${this.zoneKey}`;
    const width = mapWidthPx + 2000;
    const height = mapHeightPx + 400;

    this.add
      .tileSprite(mapWidthPx / 2, mapHeightPx / 2, width, height, bgKey)
      .setScrollFactor(0.15)
      .setTint(config.backgroundTintFar)
      .setDepth(-11);

    this.add
      .tileSprite(mapWidthPx / 2, mapHeightPx / 2, width, height, bgKey)
      .setScrollFactor(0.4)
      .setTint(config.backgroundTintNear)
      .setDepth(-10);
  }

  private generatePlayerTexture(): void {
    const key = 'player';
    if (this.textures.exists(key)) return;
    const width = 18;
    const height = 34;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.fillStyle(0x0b0b0f, 1);
    graphics.fillRect(width - 5, 6, 4, 4);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
