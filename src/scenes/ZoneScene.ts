import Phaser from 'phaser';
import { PHYSICS, TILE_SIZE, PARTICLE_TEXTURE_KEY } from '../config';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { ZONES, FIRST_ZONE, FIRST_SPAWN, ZoneConfig } from '../zones/ZoneRegistry';
import { getObjectProperties } from '../zones/TiledObjects';
import { PlayerProgress } from '../progress/PlayerProgress';
import { CollectedItems } from '../progress/CollectedItems';
import { drawBiosphereTerrain } from '../zones/BiosphereTerrain';

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

interface CheckpointEntry {
  name: string;
  x: number;
  y: number;
  light: Phaser.GameObjects.Arc;
}

const TRANSITION_COOLDOWN_MS = 400;
const LOCKED_MESSAGE_MS = 1800;
const COLLECT_MESSAGE_MS = 2600;
const INTERACT_RADIUS = 30;
const PLAYER_INVULNERABLE_MS = 800;
const MARKER_KEYS = ['enemy', 'boss', 'chest', 'lore'] as const;
const TURTLE_WALK_ANIM = 'turtle-walk';
// These two source frames share the same 62x48 canvas. The remaining legacy
// frames were tightly cropped to different widths, which made patrols pulse
// and jitter as the animation advanced.
const TURTLE_FRAME_KEYS = ['turtle_idle', 'turtle_walk_1'];
const DECOR_KEYS = [
  'bush',
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
const MAX_HEALTH = 4;

export class ZoneScene extends Phaser.Scene {
  private zoneKey = FIRST_ZONE;
  private spawnName = FIRST_SPAWN;
  private player!: Player;
  private transitionLocked = false;
  private messageText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private interactables: InteractableEntry[] = [];
  private enemies: Enemy[] = [];
  private playerInvulnerableUntil = 0;
  private health = MAX_HEALTH;
  private healthText?: Phaser.GameObjects.Text;
  private checkpoints: CheckpointEntry[] = [];
  private activeCheckpoint = FIRST_SPAWN;
  private enemyAttackIds = new WeakMap<Enemy, number>();
  private guardian?: Enemy;
  private regionText?: Phaser.GameObjects.Text;
  private mapDot?: Phaser.GameObjects.Arc;
  private mapWidth = 1;
  private mapHeight = 1;
  private regions: {x:number; name:string}[] = [];
  private dying = false;

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
    if (config.tilesetPath.endsWith('.svg')) {
      this.load.svg(`tileset-${this.zoneKey}`, config.tilesetPath);
    } else {
      this.load.image(`tileset-${this.zoneKey}`, config.tilesetPath);
    }
    this.load.image(`bg-${this.zoneKey}`, config.backgroundPath);
    if (config.heroBackgroundPath && !this.textures.exists(`hero-${this.zoneKey}`)) {
      this.load.image(`hero-${this.zoneKey}`, config.heroBackgroundPath);
    }
    for (const key of MARKER_KEYS) {
      if (!this.textures.exists(`marker-${key}`)) {
        this.load.image(`marker-${key}`, `sprites/markers/${key}.png`);
      }
    }
    for (const key of TURTLE_FRAME_KEYS) {
      if (!this.textures.exists(key)) {
        this.load.image(key, `sprites/enemies/${key}.png`);
      }
    }
    if (!this.textures.exists('turtle_boss')) {
      this.load.image('turtle_boss', 'sprites/enemies/turtle_boss.png');
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
    this.enemies = [];
    this.checkpoints = [];
    this.enemyAttackIds = new WeakMap<Enemy, number>();
    this.playerInvulnerableUntil = 0;
    this.health = MAX_HEALTH;
    this.dying = false;
    this.guardian = undefined;
    this.activeCheckpoint = this.spawnName;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.transitionLocked = true;
    this.time.delayedCall(TRANSITION_COOLDOWN_MS, () => {
      this.transitionLocked = false;
    });

    this.generatePlayerTexture();
    if (!this.anims.exists(TURTLE_WALK_ANIM)) {
      this.anims.create({
        key: TURTLE_WALK_ANIM,
        frames: TURTLE_FRAME_KEYS.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1
      });
    }

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
    if (this.zoneKey === 'biosphere') drawBiosphereTerrain(this, map, groundLayer);

    const mapWidthPx = map.widthInPixels;
    const mapHeightPx = map.heightInPixels;
    this.mapWidth = mapWidthPx;
    this.mapHeight = mapHeightPx;
    this.regions = (map.getObjectLayer('regions')?.objects ?? []).map(o=>({x:o.x ?? 0,name:o.name}));

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
    this.createEncounters(map, groundLayer);
    this.createInteractables(map);
    this.createClimbables(map);
    this.createHazards(map);
    this.createCheckpoints(map);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, mapWidthPx, mapHeightPx);
    camera.setDeadzone(160, 100);
    camera.startFollow(this.player, true, 0.1, 0.1);

    this.messageText = this.add
      .text(18, 108, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066', backgroundColor: '#000000cc', wordWrap: {width:570} })
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

    this.createHud();
    if(this.zoneKey === 'biosphere') this.createWorldMap(map,groundLayer);
    this.cameras.main.fadeIn(500,6,17,14);
  }

  update(time: number, delta: number): void {
    if(this.dying) return;
    this.player.update(time, delta);
    this.updateInteractions();
    for (const enemy of this.enemies) {
      if (!enemy.isDefeated) enemy.update(this.player.x, this.player.y);
    }
    this.updatePlayerAttacks();
    this.mapDot?.setPosition(747 + this.player.x / this.mapWidth * 192, 20 + this.player.y / this.mapHeight * 57);
    const region = [...this.regions].reverse().find(r=>this.player.x>=r.x);
    this.regionText?.setText(region?.name.toUpperCase() ?? 'BIOSPHERE');
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
      if(this.zoneKey === 'biosphere') {
        this.add.rectangle(obj.x!+width/2,obj.y!+height/2,12,height,0xb4d5a0,0.32).setStrokeStyle(2,0xe4e6bb,0.8).setDepth(4);
        this.add.text(obj.x!-14,obj.y!-20,'RUSTSEA →',{fontFamily:'monospace',fontSize:'12px',color:'#f3d9a0'}).setOrigin(1,0).setDepth(4);
      }

      this.physics.add.overlap(this.player, zone, () => this.handleDoorOverlap(meta));
    }
  }

  private handleDoorOverlap(meta: DoorMeta): void {
    if (this.transitionLocked) return;
    if(this.zoneKey === 'biosphere' && meta.targetZone === 'rustsea' && this.guardian && !this.guardian.isDefeated) {
      this.showMessage('The keeper seals the eastern passage. Defeat it to continue.',1800);
      return;
    }

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

  private createEncounters(map: Phaser.Tilemaps.Tilemap, groundLayer: Phaser.Tilemaps.TilemapLayer): void {
    const layer = map.getObjectLayer('encounters');
    for (const obj of layer?.objects ?? []) {
      const props = getObjectProperties(obj);
      const kind = String(props.kind ?? '');
      const x = obj.x ?? 0;
      // markerOnSurface anchors icons a tile above the surface for the
      // generic 16px markers; physics sprites use a bottom origin instead so
      // their feet actually touch the ground, hence the +TILE_SIZE.
      const y = (obj.y ?? 0) + TILE_SIZE;

      if (kind === 'turtle') {
        this.enemies.push(
          new Enemy(this, x, y, 'turtle_idle', groundLayer, {
            patrols: true,
            animKey: TURTLE_WALK_ANIM,
            elite: this.zoneKey === 'biosphere',
            level: 1
          })
        );
        continue;
      }
      if (kind === 'turtle-boss') {
        if (this.textures.exists('turtle_boss')) {
          this.guardian = new Enemy(this, x, y, 'turtle_boss', groundLayer, { patrols: true, level: 3, isBoss: true, elite: this.zoneKey === 'biosphere' });
          this.enemies.push(this.guardian);
        }
        continue;
      }

      const key = `marker-${kind}`;
      if (!this.textures.exists(key)) continue;
      const isBoss = kind === 'boss';
      this.enemies.push(
        new Enemy(this, x, y, key, groundLayer, { patrols: !isBoss, level: isBoss ? 3 : 1, isBoss })
      );
    }

    if (this.enemies.length > 0) {
      this.physics.add.collider(this.enemies, groundLayer);
      this.physics.add.overlap(this.player, this.enemies, (_player, enemyObj) => {
        this.handleEnemyOverlap(enemyObj as Enemy);
      });
    }
  }

  private handleEnemyOverlap(enemy: Enemy): void {
    if (enemy.isDefeated) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    const isStomp = body.velocity.y > 0 && body.bottom <= enemyBody.top + 14;

    if (isStomp) {
      enemy.takeHit(this.player.x);
      body.setVelocityY(PHYSICS.jumpVelocity * 0.6);
      this.cameras.main.shake(60, 0.002);
      return;
    }

    this.hurtPlayer(enemy.x);
  }

  private hurtPlayer(sourceX: number): void {
    if (this.dying || this.time.now < this.playerInvulnerableUntil || this.player.isDashInvulnerable) return;
    this.playerInvulnerableUntil = this.time.now + PLAYER_INVULNERABLE_MS;
    this.health = Math.max(0, this.health - 1);
    this.updateHealthHud();
    const pushDir = this.player.x < sourceX ? -1 : 1;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(pushDir * 200, -200);
    this.player.setHurtFlash(600);
    this.cameras.main.shake(100, 0.003);
    if (this.health === 0) {
      this.dying = true;
      body.setVelocity(0,0);
      body.enable = false;
      this.cameras.main.fadeOut(350, 8, 12, 12);
      this.time.delayedCall(380, () => this.scene.restart({ zoneKey: this.zoneKey, spawnName: this.activeCheckpoint }));
    }
  }

  private updatePlayerAttacks(): void {
    if (!this.player.isAttackActive) return;
    const attackBounds = this.player.getAttackBounds();
    for (const enemy of this.enemies) {
      if (enemy.isDefeated || this.enemyAttackIds.get(enemy) === this.player.currentAttackId) continue;
      const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
      const enemyBounds = new Phaser.Geom.Rectangle(enemyBody.x, enemyBody.y, enemyBody.width, enemyBody.height);
      if (!Phaser.Geom.Intersects.RectangleToRectangle(attackBounds, enemyBounds)) continue;
      this.enemyAttackIds.set(enemy, this.player.currentAttackId);
      enemy.takeHit(this.player.x);
      this.cameras.main.shake(45, 0.0015);
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
    if(entry.kind === 'chest') {
      this.health = MAX_HEALTH;
      this.updateHealthHud();
    }

    const message = entry.kind === 'chest' ? `Relic recovered: ${entry.item ?? 'unknown'} • Vitality restored` : entry.text ?? '...';
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

  private createClimbables(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('climbables');
    for (const obj of layer?.objects ?? []) {
      const width = obj.width ?? TILE_SIZE;
      const height = obj.height ?? TILE_SIZE * 4;
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      const zone = this.add.zone(x + width / 2, y + height / 2, width, height);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.player.markTouchingClimbZone());

      const vine = this.add.graphics().setDepth(3);
      // Climb grips extend along a clearly bounded traverse shaft.
      vine.lineStyle(2,0xd5d8a0,0.6);
      for(let stepY=y+8;stepY<y+height;stepY+=16) vine.lineBetween(x+8,stepY,x+width-8,stepY);
      vine.lineStyle(4, 0x234e38, 0.95).beginPath().moveTo(x + width * 0.35, y).lineTo(x + width * 0.58, y + height).strokePath();
      vine.lineStyle(2, 0x62a66e, 0.9).beginPath().moveTo(x + width * 0.65, y).lineTo(x + width * 0.42, y + height).strokePath();
      for (let leafY = y + 12; leafY < y + height; leafY += 24) {
        vine.fillStyle(0x78b96f, 0.85).fillEllipse(x + (leafY % 48 === 0 ? width * 0.25 : width * 0.72), leafY, 10, 5);
      }
    }
  }

  private createHazards(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('hazards');
    for (const obj of layer?.objects ?? []) {
      const width = obj.width ?? TILE_SIZE;
      const height = obj.height ?? TILE_SIZE;
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      const zone = this.add.zone(x + width / 2, y + height / 2, width, height);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.hurtPlayer(x + width / 2));

      const spikes = this.add.graphics().setDepth(3).fillStyle(0xb9e6c5, 0.85);
      for (let spikeX = x; spikeX < x + width; spikeX += 12) {
        spikes.fillTriangle(spikeX, y + height, spikeX + 6, y, spikeX + 12, y + height);
      }
    }
  }

  private createCheckpoints(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('checkpoints');
    for (const obj of layer?.objects ?? []) {
      const name = obj.name || 'start';
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      const light = this.add.circle(x, y - 12, 9, 0x79f2b2, 0.35).setStrokeStyle(2, 0xd9ffe8, 0.9).setDepth(4);
      const zone = this.add.zone(x, y - 12, 32, 54);
      this.physics.add.existing(zone, true);
      const checkpoint = { name, x, y, light };
      this.checkpoints.push(checkpoint);
      this.physics.add.overlap(this.player, zone, () => {
        if (this.activeCheckpoint === name) return;
        this.activeCheckpoint = name;
        this.health = MAX_HEALTH;
        this.updateHealthHud();
        light.setFillStyle(0xd9ffe8, 0.8).setScale(1.25);
        this.showMessage('Sanctuary awakened • Vitality restored • Return here after defeat', 2200);
      });
      this.tweens.add({ targets: light, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  private createHud(): void {
    const objectives: Record<string, string> = {
      biosphere: 'Cross the canopy • Defeat the eastern guardian',
      rustsea: 'Follow the tide terraces east',
      forge: 'Climb the furnace chimney',
      crystal: 'Reach the crown of the spire'
    };
    this.healthText = this.add.text(18, 18, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#d9ffe8', stroke: '#07110b', strokeThickness: 4
    }).setScrollFactor(0).setDepth(110);
    this.add.text(18, 46, `${this.zoneKey.toUpperCase()}  •  ${objectives[this.zoneKey] ?? 'Explore'}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#b8c8bf', backgroundColor: '#07110bbb'
    }).setPadding(5, 3, 5, 3).setScrollFactor(0).setDepth(110);
    this.add.text(942, 520, 'MOVE  A/D   JUMP  W/↑   STRIKE  J/X   DASH  SHIFT/C   USE  E', {
      fontFamily: 'monospace', fontSize: '10px', color: '#d7e7dc', backgroundColor: '#07110baa'
    }).setPadding(6, 4, 6, 4).setOrigin(1, 1).setScrollFactor(0).setDepth(110);
    this.updateHealthHud();
  }

  private createWorldMap(map: Phaser.Tilemaps.Tilemap, layer: Phaser.Tilemaps.TilemapLayer): void {
    this.add.rectangle(840,49,208,76,0x061510,0.9).setStrokeStyle(1,0x638275,0.6).setScrollFactor(0).setDepth(109);
    const g=this.add.graphics().setScrollFactor(0).setDepth(110).fillStyle(0x47755a,0.8);
    for(let y=0;y<map.height;y+=2) for(let x=0;x<map.width;x+=2) {
      if(layer.getTileAt(x,y)?.collides) g.fillRect(747+x/map.width*192,20+y/map.height*57,1.6,1.6);
    }
    this.mapDot=this.add.circle(747,20,3,0xf6d898).setScrollFactor(0).setDepth(111);
    this.regionText=this.add.text(18,78,'WAKING GROVE',{fontFamily:'monospace',fontSize:'13px',color:'#f0d8ab',letterSpacing:2}).setScrollFactor(0).setDepth(110);
    this.add.text(18,496,'CLIMB  W/S + A/D     LEAP OFF  C     SANCTUARIES RESTORE HEALTH',{fontFamily:'monospace',fontSize:'11px',color:'#b7cabb',backgroundColor:'#07110baa'}).setPadding(5).setScrollFactor(0).setDepth(110);
  }

  private updateHealthHud(): void {
    this.healthText?.setText(`VITALITY  ${'◆'.repeat(this.health)}${'◇'.repeat(MAX_HEALTH - this.health)}`);
  }

  private createParallax(config: ZoneConfig, mapWidthPx: number, mapHeightPx: number): void {
    const bgKey = `bg-${this.zoneKey}`;
    const width = mapWidthPx + 2000;
    const height = mapHeightPx + 400;

    // Tinted repeating texture as a guaranteed-full-coverage base layer —
    // keeps working at the level's far edges even where a hero painting
    // (below) doesn't reach.
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

    if (config.heroBackgroundPath) {
      const heroKey = `hero-${this.zoneKey}`;
      const source = this.textures.get(heroKey).getSourceImage();
      // Centered and scrolling slower than the camera (scrollFactor < 1),
      // the image has to be as wide as the whole map or the untouched edges
      // peek out from behind it as the camera nears either end — see the
      // parallax-coverage math this replaced for the derivation.
      const displayWidth = mapWidthPx;
      const displayHeight = displayWidth * (source.height / source.width);
      this.add
        .image(mapWidthPx / 2, mapHeightPx, heroKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(displayWidth, displayHeight)
        .setScrollFactor(0.45)
        .setDepth(-9);
    }
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
    const width = 22;
    const height = 36;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Compact moss-cloaked explorer: still procedural, but with a readable
    // silhouette and palette instead of the original featureless rectangle.
    graphics.fillStyle(0x07110b, 1).fillRect(6, 0, 11, 3);
    graphics.fillStyle(0xd9b98c, 1).fillRect(7, 3, 9, 9);
    graphics.fillStyle(0x233b2c, 1).fillRect(4, 2, 4, 9).fillRect(16, 4, 3, 7);
    graphics.fillStyle(0xbff5d0, 1).fillRect(14, 6, 2, 2);
    graphics.fillStyle(0x315b42, 1).fillRect(4, 12, 14, 16);
    graphics.fillStyle(0x47795a, 1).fillTriangle(2, 29, 20, 29, 11, 13);
    graphics.fillStyle(0x9fd8af, 1).fillRect(2, 15, 3, 11).fillRect(17, 15, 3, 11);
    graphics.fillStyle(0x17241c, 1).fillRect(5, 28, 5, 7).fillRect(13, 28, 5, 7);
    graphics.fillStyle(0xcfffe0, 1).fillRect(4, 34, 6, 2).fillRect(13, 34, 6, 2);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
