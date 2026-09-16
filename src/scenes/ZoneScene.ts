import Phaser from 'phaser';
import { PHYSICS, TILE_SIZE, PARTICLE_TEXTURE_KEY } from '../config';
import { Player } from '../entities/Player';
import { ZONES, FIRST_ZONE, FIRST_SPAWN, ZoneConfig } from '../zones/ZoneRegistry';
import { getObjectProperties } from '../zones/TiledObjects';
import { PlayerProgress } from '../progress/PlayerProgress';
import { CollectedItems } from '../progress/CollectedItems';

interface ZoneSceneData {
  zoneKey?: string;
  spawnName?: string;
}

interface DoorMeta {
  targetZone: string;
  targetSpawn: string;
  requiredLevel: number;
}

interface InteractableEntry {
  id: string;
  kind: string;
  x: number;
  y: number;
  image: Phaser.GameObjects.Image;
  text?: string;
  item?: string;
}

const TRANSITION_COOLDOWN_MS = 400;
const LOCKED_MESSAGE_MS = 1800;
const COLLECT_MESSAGE_MS = 2600;
const INTERACT_RADIUS = 30;
const MARKER_KEYS = ['enemy', 'boss', 'chest', 'lore'] as const;
const DECOR_KEYS = [
  'bush',
  'mushroom_red',
  'mushroom_brown',
  'cactus',
  'rock',
  'torch_on_a',
  'torch_on_b',
  'chain',
  'gem_green',
  'gem_red',
  'gem_yellow',
  'fence_broken',
  'hill_top'
] as const;

export class ZoneScene extends Phaser.Scene {
  private zoneKey = FIRST_ZONE;
  private spawnName = FIRST_SPAWN;
  private player!: Player;
  private transitionLocked = false;
  private messageText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private interactables: InteractableEntry[] = [];

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
    for (const key of DECOR_KEYS) {
      if (!this.textures.exists(`decor-${key}`)) {
        this.load.image(`decor-${key}`, `sprites/decor/${key}.png`);
      }
    }
    if (!this.textures.exists(PARTICLE_TEXTURE_KEY)) {
      this.load.image(PARTICLE_TEXTURE_KEY, 'sprites/decor/particle.png');
    }
  }

  create(): void {
    const config = ZONES[this.zoneKey];

    this.interactables = [];
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

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
    this.createAmbientParticles(config, mapWidthPx, mapHeightPx);

    this.physics.world.gravity.y = PHYSICS.gravityY;
    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);

    const spawn = this.findSpawnPosition(map, this.spawnName);
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, groundLayer);

    this.createDecor(map);
    this.createDoors(map);
    this.createEncounters(map);
    this.createInteractables(map);

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

    this.promptText = this.add
      .text(0, 0, 'Press E', { fontFamily: 'monospace', fontSize: '11px', color: '#0b0b0f', backgroundColor: '#ffe066' })
      .setPadding(4, 2, 4, 2)
      .setOrigin(0.5, 1)
      .setDepth(90)
      .setVisible(false);
  }

  update(time: number, delta: number): void {
    this.player.update(time, delta);
    this.updateInteractions();
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
      this.showMessage(`Locked — requires Level ${meta.requiredLevel} (you are Level ${PlayerProgress.level})`, LOCKED_MESSAGE_MS);
      this.transitionLocked = true;
      this.time.delayedCall(LOCKED_MESSAGE_MS / 2, () => {
        this.transitionLocked = false;
      });
      return;
    }

    this.transitionLocked = true;
    this.scene.restart({ zoneKey: meta.targetZone, spawnName: meta.targetSpawn });
  }

  private showMessage(text: string, durationMs: number): void {
    this.messageText?.setText(text).setAlpha(1);
    this.time.delayedCall(durationMs, () => {
      this.messageText?.setAlpha(0);
    });
  }

  private createEncounters(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('encounters');
    for (const obj of layer?.objects ?? []) {
      const props = getObjectProperties(obj);
      const kind = String(props.kind ?? '');
      const key = `marker-${kind}`;
      if (!this.textures.exists(key)) continue;
      this.add.image(obj.x ?? 0, obj.y ?? 0, key).setDepth(5);
    }
  }

  private createInteractables(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('interactables');
    for (const obj of layer?.objects ?? []) {
      const props = getObjectProperties(obj);
      const kind = String(props.kind ?? '');
      const id = `${this.zoneKey}:${obj.id}`;
      if (CollectedItems.has(id)) continue;

      const key = `marker-${kind}`;
      if (!this.textures.exists(key)) continue;
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      const image = this.add.image(x, y, key).setDepth(5);

      this.interactables.push({
        id,
        kind,
        x,
        y,
        image,
        text: props.text ? String(props.text) : undefined,
        item: props.item ? String(props.item) : undefined
      });
    }
  }

  private updateInteractions(): void {
    let nearest: InteractableEntry | null = null;
    let nearestDist = INTERACT_RADIUS;
    for (const entry of this.interactables) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y - 16, entry.x, entry.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entry;
      }
    }

    if (nearest) {
      this.promptText?.setPosition(nearest.x, nearest.y - 14).setVisible(true);
    } else {
      this.promptText?.setVisible(false);
    }

    if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.collectInteractable(nearest);
    }
  }

  private collectInteractable(entry: InteractableEntry): void {
    CollectedItems.add(entry.id);
    entry.image.destroy();
    this.promptText?.setVisible(false);
    this.interactables = this.interactables.filter((e) => e !== entry);

    const message = entry.kind === 'chest' ? `Found: ${entry.item ?? 'something useful'}` : entry.text ?? '...';
    this.showMessage(message, COLLECT_MESSAGE_MS);
  }

  private createDecor(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('decor');
    for (const obj of layer?.objects ?? []) {
      const props = getObjectProperties(obj);
      const kind = String(props.kind ?? '');
      const key = `decor-${kind}`;
      if (!this.textures.exists(key)) continue;
      this.add.image(obj.x ?? 0, obj.y ?? 0, key).setDepth(4);
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

  private createAmbientParticles(config: ZoneConfig, mapWidthPx: number, mapHeightPx: number): void {
    this.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      x: { min: 0, max: mapWidthPx },
      y: { min: 0, max: mapHeightPx },
      lifespan: { min: 4000, max: 7000 },
      speedY: { min: -12, max: -4 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 0, end: 0.35 },
      tint: config.backgroundTintNear,
      frequency: 220,
      quantity: 1
    }).setDepth(-5);
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
