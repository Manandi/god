import Phaser from 'phaser';
import { PHYSICS, TILE_SIZE, PARTICLE_TEXTURE_KEY } from '../config';
import { Player } from '../entities/Player';
import { Enemy, GuardianAttack } from '../entities/Enemy';
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
const CLIMB_VINE_KEY = 'biosphere-climb-vine-v2';
const BIOSPHERE_TERRAIN_KEY = 'biosphere-terrain-seamless-v2';
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
  private bossProjectiles?: Phaser.Physics.Arcade.Group;
  private bossWaves?: Phaser.Physics.Arcade.Group;

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
    for (const [key, file] of [
      ['turtle_boss_idle_v2', 'turtle_boss_idle_v2.png'],
      ['turtle_boss_charge_v2', 'turtle_boss_charge_v2.png'],
      ['turtle_boss_jump_v2', 'turtle_boss_jump_v2.png']
    ] as const) {
      if (!this.textures.exists(key)) this.load.image(key, `sprites/enemies/${file}`);
    }
    if (this.zoneKey === 'biosphere' && !this.textures.exists(CLIMB_VINE_KEY)) {
      this.load.image(CLIMB_VINE_KEY, 'sprites/biosphere/climb-vine-v2.png');
    }
    if (this.zoneKey === 'biosphere' && !this.textures.exists(BIOSPHERE_TERRAIN_KEY)) {
      this.load.image(BIOSPHERE_TERRAIN_KEY, 'sprites/biosphere/terrain-seamless-v2.jpg');
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
    this.generateCombatTextures();
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
    this.createBossAttackPhysics(groundLayer);

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
        if (this.textures.exists('turtle_boss_idle_v2')) {
          this.guardian = new Enemy(this, x, y, 'turtle_boss_idle_v2', groundLayer, {
            patrols: true,
            level: 3,
            isBoss: true,
            elite: this.zoneKey === 'biosphere',
            onGuardianAttack: (attack, enemy) => this.handleGuardianAttack(attack, enemy)
          });
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
    const previousBottom = body.prev.y + body.height;
    const stompY = enemy.stompSurfaceY;
    const horizontalContact = body.right > enemyBody.left + 3 && body.left < enemyBody.right - 3;
    const crossedShell = previousBottom <= stompY + 10 && body.bottom >= stompY - 3;
    const isStomp = body.velocity.y > 70 && horizontalContact && crossedShell;

    if (isStomp) {
      this.player.setY(stompY);
      enemy.takeHit(this.player.x);
      body.setVelocityY(PHYSICS.jumpVelocity * 0.68);
      this.cameras.main.shake(60, 0.002);
      return;
    }

    if (this.player.isAttackActive) {
      const attackBounds = this.player.getAttackBounds();
      const enemyBounds = new Phaser.Geom.Rectangle(enemyBody.x, enemyBody.y, enemyBody.width, enemyBody.height);
      if (Phaser.Geom.Intersects.RectangleToRectangle(attackBounds, enemyBounds)) {
        this.enemyAttackIds.set(enemy, this.player.currentAttackId);
        enemy.takeHit(this.player.x);
        return;
      }
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
      const y = obj.y 