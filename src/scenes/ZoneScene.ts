import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS, TILE_SIZE, PARTICLE_TEXTURE_KEY } from '../config';
import { Player } from '../entities/Player';
import { Enemy, GuardianAttack } from '../entities/Enemy';
import { ZONES, FIRST_ZONE, FIRST_SPAWN, ZoneConfig } from '../zones/ZoneRegistry';
import { getObjectProperties } from '../zones/TiledObjects';
import { PlayerProgress } from '../progress/PlayerProgress';
import { CollectedItems } from '../progress/CollectedItems';
import { GameSave } from '../progress/GameSave';
import { GameAudio } from '../audio/GameAudio';
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
  requiredLevel: number;
}

const TRANSITION_COOLDOWN_MS = 400;
const LOCKED_MESSAGE_MS = 1800;
const COLLECT_MESSAGE_MS = 2600;
const INTERACT_RADIUS = 30;
const PLAYER_INVULNERABLE_MS = 800;
const MARKER_KEYS = ['enemy', 'boss', 'chest', 'lore'] as const;
const TURTLE_WALK_ANIM = 'turtle-walk';
const GUARDIAN_WALK_ANIM = 'guardian-walk-v3';
// These two source frames share the same 62x48 canvas. The remaining legacy
// frames were tightly cropped to different widths, which made patrols pulse
// and jitter as the animation advanced.
const TURTLE_FRAME_KEYS = ['turtle_idle', 'turtle_walk_1'];
const BIOSPHERE_TERRAIN_KEY = 'biosphere-terrain-seamless-v2';
const OVERWORLD_PORTAL_X = 4704;
const GUARDIAN_ARENA_LEFT = 6048;
const GUARDIAN_ARENA_RIGHT = 7248;
const GUARDIAN_ARENA_FLOOR_Y = 928;
const GUARDIAN_ARENA_CENTER_X = (GUARDIAN_ARENA_LEFT + GUARDIAN_ARENA_RIGHT) / 2;
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
  private health = 4;
  private maxHealth = 4;
  private healthText?: Phaser.GameObjects.Text;
  private checkpoints: CheckpointEntry[] = [];
  private activeCheckpoint = FIRST_SPAWN;
  private enemyAttackIds = new WeakMap<Enemy, number>();
  private guardian?: Enemy;
  private regionText?: Phaser.GameObjects.Text;
  private mapDot?: Phaser.GameObjects.Arc;
  private mapWidth = 1;
  private mapHeight = 1;
  private worldMapObjects: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics | Phaser.GameObjects.Arc> = [];
  private regions: {x:number; name:string}[] = [];
  private dying = false;
  private bossProjectiles?: Phaser.Physics.Arcade.Group;
  private bossWaves?: Phaser.Physics.Arcade.Group;
  private menuKey!: Phaser.Input.Keyboard.Key;
  private portalPrompt?: Phaser.GameObjects.Text;
  private bossInLair = false;
  private guardianCutsceneActive = false;
  private guardianCutsceneCanSkip = false;
  private guardianCutsceneObjects: Phaser.GameObjects.GameObject[] = [];
  private guardianCutsceneTimers: Phaser.Time.TimerEvent[] = [];
  private checkpointLockedMessageUntil = 0;

  constructor() {
    super('ZoneScene');
  }

  init(data: ZoneSceneData): void {
    this.zoneKey = data.zoneKey ?? PlayerProgress.currentZone ?? FIRST_ZONE;
    this.spawnName = data.spawnName ?? PlayerProgress.currentSpawn ?? FIRST_SPAWN;
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
    for (const [key, file] of [
      ['turtle_boss_walk_a_v3', 'turtle_boss_walk_a_v3.png'],
      ['turtle_boss_walk_b_v3', 'turtle_boss_walk_b_v3.png']
    ] as const) {
      if (!this.textures.exists(key)) this.load.image(key, `sprites/enemies/${file}`);
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
    this.maxHealth = Phaser.Math.Clamp(3 + Math.floor((PlayerProgress.stats.defense - 8) / 3), 3, 7);
    this.health = this.maxHealth;
    this.dying = false;
    this.guardian = undefined;
    this.bossInLair = false;
    this.guardianCutsceneActive = false;
    this.guardianCutsceneCanSkip = false;
    this.guardianCutsceneObjects = [];
    this.guardianCutsceneTimers = [];
    this.checkpointLockedMessageUntil = 0;
    this.worldMapObjects = [];
    this.activeCheckpoint = this.spawnName;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.menuKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    PlayerProgress.currentZone = this.zoneKey;
    PlayerProgress.currentSpawn = this.spawnName;
    GameSave.save();

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
    if (!this.anims.exists(GUARDIAN_WALK_ANIM)) {
      this.anims.create({
        key: GUARDIAN_WALK_ANIM,
        frames: [{ key: 'turtle_boss_walk_a_v3' }, { key: 'turtle_boss_walk_b_v3' }],
        frameRate: 5,
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
    // The overworld map ends at the guardian doorway. The separate lair is
    // deliberately excluded from navigation and minimap coordinates.
    this.mapWidth = this.zoneKey === 'biosphere' ? OVERWORLD_PORTAL_X : mapWidthPx;
    this.mapHeight = mapHeightPx;
    this.regions = (map.getObjectLayer('regions')?.objects ?? []).map(o=>({x:o.x ?? 0,name:o.name}));

    this.createParallax(config, mapWidthPx, mapHeightPx);
    this.createAmbientParticles(config, mapWidthPx, mapHeightPx);

    this.physics.world.gravity.y = PHYSICS.gravityY;
    const worldWidthPx = this.zoneKey === 'biosphere' ? GUARDIAN_ARENA_RIGHT + 96 : mapWidthPx;
    this.physics.world.setBounds(0, 0, worldWidthPx, mapHeightPx);

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
    camera.setBounds(0, 0, worldWidthPx, mapHeightPx);
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

    this.createBossPortal();

    this.createHud();
    if(this.zoneKey === 'biosphere') this.createWorldMap(map,groundLayer);
    this.cameras.main.fadeIn(500,6,17,14);
    GameAudio.startAmbient();
  }

  update(time: number, delta: number): void {
    if(this.dying) return;
    if (this.guardianCutsceneActive) {
      if (this.guardianCutsceneCanSkip && Phaser.Input.Keyboard.JustDown(this.interactKey)) this.finishGuardianCutscene();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      PlayerProgress.currentZone = this.zoneKey;
      PlayerProgress.currentSpawn = this.activeCheckpoint;
      GameSave.save();
      this.scene.start('TitleScene');
      return;
    }
    this.player.update(time, delta);
    this.portalPrompt?.setVisible(false);
    this.updateInteractions();
    for (const enemy of this.enemies) {
      if (enemy.active && !enemy.isDefeated) enemy.update(this.player.x, this.player.y);
    }
    this.updatePlayerAttacks();
    this.mapDot?.setPosition(747 + Phaser.Math.Clamp(this.player.x / this.mapWidth, 0, 1) * 192, 20 + this.player.y / this.mapHeight * 57);
    if (this.bossInLair && !PlayerProgress.guardianDefeated) {
      this.regionText?.setText('HEARTSEED PRISON');
    } else {
      const region = [...this.regions].reverse().find(r=>this.player.x>=r.x);
      this.regionText?.setText(region?.name.toUpperCase() ?? 'BIOSPHERE');
    }
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
    PlayerProgress.currentZone = meta.targetZone;
    PlayerProgress.currentSpawn = meta.targetSpawn;
    GameSave.save();
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
        const isOpeningTurtle = this.zoneKey === 'biosphere' && x < 32 * TILE_SIZE;
        this.enemies.push(
          new Enemy(this, x, y, 'turtle_idle', groundLayer, {
            patrols: true,
            animKey: TURTLE_WALK_ANIM,
            elite: this.zoneKey === 'biosphere',
            level: 1,
            // Keep the tutorial turtle on its broad opening shelf. Other
            // turtles still traverse the stepped terrain, but this one no
            // longer oscillates forever on the very first staircase.
            patrolMinX: isOpeningTurtle ? 12 * TILE_SIZE : undefined,
            patrolMaxX: isOpeningTurtle ? 20 * TILE_SIZE : undefined
          })
        );
        continue;
      }
      if (kind === 'turtle-boss') {
        if (PlayerProgress.guardianDefeated) continue;
        if (this.textures.exists('turtle_boss_idle_v2')) {
          this.guardian = new Enemy(this, x, y, 'turtle_boss_idle_v2', groundLayer, {
            patrols: true,
            level: 3,
            isBoss: true,
            elite: this.zoneKey === 'biosphere',
            patrolMinX: 282 * TILE_SIZE,
            patrolMaxX: 337 * TILE_SIZE,
            onGuardianAttack: (attack, enemy) => this.handleGuardianAttack(attack, enemy),
            onBossCue: () => GameAudio.playSfx('charge'),
            onDefeated: () => {
              PlayerProgress.guardianDefeated = true;
              GameSave.save();
              GameAudio.startAmbient();
              this.completeGuardianEncounter();
            }
          });
          this.guardian.setEncounterActive(false);
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
    const enemyBounds = enemy.getCombatBounds();
    const previousBottom = body.prev.y + body.height;
    const stompY = enemy.stompSurfaceY;
    const horizontalContact = body.right > enemyBounds.left + 3 && body.left < enemyBounds.right - 3;
    const crossedShell = previousBottom <= stompY + 10 && body.bottom >= stompY - 3;
    const isStomp = body.velocity.y > 70 && horizontalContact && crossedShell;

    // A charging guardian leads with its shell, so there is no safe landing on
    // it and no opening to strike — contact hurts however you make it.
    if (enemy.isArmoured) {
      this.hurtPlayer(enemy.x);
      return;
    }

    if (isStomp) {
      // Separate the player from the shell before the next overlap pass and
      // grant a very short stomp-only grace window. Without both, Arcade can
      // report another overlap one frame later and hurt the player for the
      // same successful stomp.
      this.player.setY(stompY - 2);
      body.updateFromGameObject();
      this.playerInvulnerableUntil = Math.max(this.playerInvulnerableUntil, this.time.now + 260);
      enemy.takeHit(this.player.x);
      GameAudio.playSfx('stomp');
      body.setVelocityY(PHYSICS.jumpVelocity * 0.68);
      this.cameras.main.shake(60, 0.002);
      return;
    }

    if (this.player.isAttackActive) {
      const attackBounds = this.player.getAttackBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(attackBounds, enemyBounds)) {
        this.enemyAttackIds.set(enemy, this.player.currentAttackId);
        const damage = PlayerProgress.stats.strength >= 17 ? 2 : 1;
        enemy.takeHit(this.player.x, damage);
        GameAudio.playSfx('hit');
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
      const enemyBounds = enemy.getCombatBounds();
      if (!Phaser.Geom.Intersects.RectangleToRectangle(attackBounds, enemyBounds)) continue;
      this.enemyAttackIds.set(enemy, this.player.currentAttackId);
      const damage = PlayerProgress.stats.strength >= 17 ? 2 : 1;
      enemy.takeHit(this.player.x, damage);
      GameAudio.playSfx('hit');
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
    let nearestDist = INTERACT_RADIUS + Math.max(0, PlayerProgress.stats.intelligence - 10) * 1.2;
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
    GameSave.save();
    entry.image.destroy();
    this.promptText?.setVisible(false);
    this.interactables = this.interactables.filter((e) => e !== entry);
    const message = entry.kind === 'chest' ? `Relic recovered: ${entry.item ?? 'unknown'}` : entry.text ?? '...';
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
    for (const [climbIndex, obj] of (layer?.objects ?? []).entries()) {
      const width = obj.width ?? TILE_SIZE;
      const height = obj.height ?? TILE_SIZE * 4;
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      // The object starts above the landing so the player's full body can
      // clear the lip. Artwork covers that complete height too, making every
      // climbable pixel visible and keeping the exit fully player-controlled.
      const tileBottom = Math.round((y + height) / TILE_SIZE);
      const artTop = y;
      const artBottom = tileBottom * TILE_SIZE + 5;
      const artHeight = artBottom - artTop;
      const faceWidth = width + 18;
      const faceX = x + width / 2;
      const zone = this.add.zone(x + width / 2, artTop + artHeight / 2, width, artHeight);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.player.markTouchingClimbZone(x + width / 2));

      const roots = this.add.graphics().setDepth(0.9);
      const left = faceX - faceWidth / 2;
      const right = faceX + faceWidth / 2;
      const center = faceX;
      const leftEdge: Phaser.Math.Vector2[] = [];
      const rightEdge: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 12; i += 1) {
        const t = i / 12;
        const yy = artTop + artHeight * t;
        const sway = Math.sin(t * Math.PI * 4.2) * 5;
        leftEdge.push(new Phaser.Math.Vector2(center - faceWidth * 0.38 + sway, yy));
        rightEdge.push(new Phaser.Math.Vector2(center + faceWidth * 0.38 + sway, yy));
      }
      roots.fillStyle(0x14271b, 0.98).fillPoints([...leftEdge, ...rightEdge.reverse()], true);
      roots.lineStyle(12, 0x263c25, 0.98).beginPath()
        .moveTo(center - 9, artTop)
        .lineTo(center + 8, artTop + artHeight * 0.25)
        .lineTo(center - 7, artTop + artHeight * 0.52)
        .lineTo(center + 7, artTop + artHeight * 0.78)
        .lineTo(center - 5, artBottom)
        .strokePath();
      roots.lineStyle(4, 0x607b43, 0.88).beginPath()
        .moveTo(center - 8, artTop)
        .lineTo(center + 7, artTop + artHeight * 0.25)
        .lineTo(center - 6, artTop + artHeight * 0.52)
        .lineTo(center + 8, artTop + artHeight * 0.78)
        .lineTo(center - 4, artBottom)
        .strokePath();
      roots.lineStyle(5, 0x243b27, 0.86).beginPath()
        .moveTo(left + 5, artTop + 8)
        .lineTo(right - 5, artTop + artHeight * 0.36)
        .lineTo(left + 7, artTop + artHeight * 0.7)
        .lineTo(right - 4, artBottom - 5)
        .strokePath();
      // Ground roots physically merge the trunk into the floor. They angle
      // downward rather than reading as another floating platform.
      roots.lineStyle(8, 0x405d34, 0.95)
        .lineBetween(center, artBottom - 9, left - 14, artBottom)
        .lineBetween(center, artBottom - 9, right + 14, artBottom);

      // Distinct crowns make above-ledge handholds intentional instead of
      // looking like alignment mistakes. Every crown grows directly from the
      // same continuous trunk and is only decorative—the climb bounds remain
      // identical to the visible art.
      const crownY = artTop + 9;
      const crownWidth = Math.max(108, faceWidth + 32);
      // A broad opaque calyx locks every crown into the trunk instead of
      // leaving a thin icon hovering over a much heavier root silhouette.
      roots.fillStyle(0x101f16, 1).fillEllipse(center, crownY + 10, crownWidth, 34);
      roots.fillStyle(0x29452a, 1).fillEllipse(center, crownY + 8, crownWidth - 10, 25);
      roots.fillStyle(0x547642, 1)
        .fillEllipse(center - crownWidth * 0.3, crownY + 5, 34, 17)
        .fillEllipse(center + crownWidth * 0.3, crownY + 5, 34, 17);

      // The broad blossom is a real one-way landing. Players can climb or
      // jump upward through it, then stand and jump from its visible crown.
      const crownPlatform = this.add.zone(center, crownY - 10, crownWidth - 16, 10);
      this.physics.add.existing(crownPlatform, true);
      const crownBody = crownPlatform.body as Phaser.Physics.Arcade.StaticBody;
      crownBody.checkCollision.left = false;
      crownBody.checkCollision.right = false;
      crownBody.checkCollision.down = false;
      crownBody.checkCollision.up = true;
      this.physics.add.collider(this.player, crownPlatform);

      if (climbIndex % 3 === 0) {
        const petal = climbIndex % 2 === 0 ? 0xb9e879 : 0x8fd7be;
        for (let p = 0; p < 8; p += 1) {
          const angle = p * Math.PI / 4;
          const px = center + Math.cos(angle) * crownWidth * 0.27;
          const py = crownY + Math.sin(angle) * 13;
          roots.fillStyle(0x213a24, 1).fillEllipse(px, py, 47, 31);
          roots.fillStyle(petal, 1).fillEllipse(px, py - 1, 40, 25);
          roots.fillStyle(0xdaf5a4, 0.72).fillEllipse(px - 4, py - 5, 16, 7);
        }
        roots.fillStyle(0x5f4c21, 1).fillCircle(center, crownY, 19);
        roots.fillStyle(0xf2d56f, 1).fillCircle(center, crownY - 1, 15);
        roots.fillStyle(0xfff0a3, 1).fillCircle(center - 4, crownY - 5, 5);
      } else if (climbIndex % 3 === 1) {
        for (let p = 0; p < 6; p += 1) {
          const angle = p * Math.PI / 3;
          const px = center + Math.cos(angle) * crownWidth * 0.27;
          const py = crownY + Math.sin(angle) * 11;
          roots.fillStyle(0x1d3523, 1).fillEllipse(px, py, 45, 25);
          roots.fillStyle(p % 2 === 0 ? 0x79ae55 : 0x5d914b, 1).fillEllipse(px, py - 1, 38, 19);
          roots.lineStyle(2, 0xb8d977, 0.8).lineBetween(center, crownY, px, py);
        }
        roots.fillStyle(0x365f3b, 1).fillCircle(center, crownY, 17);
        roots.fillStyle(0xa5d66d, 1).fillCircle(center, crownY - 1, 12);
        roots.fillStyle(0xe2f4a0, 0.9).fillCircle(center - 3, crownY - 5, 4);
      } else {
        roots.fillStyle(0x203c2c, 1)
          .fillEllipse(center - crownWidth * 0.31, crownY + 1, 42, 22)
          .fillEllipse(center + crownWidth * 0.31, crownY + 1, 42, 22);
        roots.fillStyle(0x6da65a, 1)
          .fillEllipse(center - crownWidth * 0.31, crownY - 1, 34, 16)
          .fillEllipse(center + crownWidth * 0.31, crownY - 1, 34, 16);
        roots.fillStyle(0x203b31, 1).fillEllipse(center, crownY, 76, 46);
        roots.fillStyle(0x70c395, 1).fillEllipse(center, crownY - 2, 66, 37);
        roots.fillStyle(0xa8edb7, 1).fillEllipse(center - 7, crownY - 8, 32, 14);
        roots.fillStyle(0xe4ffd5, 1).fillCircle(center - 10, crownY - 10, 6);
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

      const hazardBounds = new Phaser.Geom.Rectangle(x, y, width, height);
      for (const enemy of this.enemies) enemy.addHazardBounds(hazardBounds);

      // Stop an enemy's whole silhouette before the spikes, not merely its
      // center/body edge. The old five-pixel offset let turtles appear to sit
      // on a hazard even though their physics center was technically outside.
      for (const edgeX of [x - 30, x + width + 30]) {
        const blocker = this.add.zone(edgeX, y - 24, 10, 96);
        this.physics.add.existing(blocker, true);
        for (const enemy of this.enemies) {
          this.physics.add.collider(enemy, blocker, () => enemy.turnAwayFrom(x + width / 2));
        }
      }

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
      const props = getObjectProperties(obj);
      const requiredLevel = Math.max(0, Number(props.requiredLevel ?? 0));
      const locked = PlayerProgress.level < requiredLevel;
      const light = this.add.circle(x, y - 12, 9, locked ? 0x34463b : 0x79f2b2, locked ? 0.5 : 0.35)
        .setStrokeStyle(2, locked ? 0x718076 : 0xd9ffe8, locked ? 0.65 : 0.9)
        .setDepth(4);
      if (requiredLevel > 0) {
        this.add.text(x, y - 35, `LV ${requiredLevel}`, {
          fontFamily: 'monospace', fontSize: '10px', color: locked ? '#829087' : '#d9ffe8', backgroundColor: '#07110bcc'
        }).setPadding(4, 2, 4, 2).setOrigin(0.5, 1).setDepth(5);
      }
      const zone = this.add.zone(x, y - 12, 32, 54);
      this.physics.add.existing(zone, true);
      const checkpoint = { name, x, y, light, requiredLevel };
      this.checkpoints.push(checkpoint);
      this.physics.add.overlap(this.player, zone, () => {
        if (PlayerProgress.level < requiredLevel) {
          if (this.time.now >= this.checkpointLockedMessageUntil) {
            this.checkpointLockedMessageUntil = this.time.now + LOCKED_MESSAGE_MS;
            this.showMessage(`Dormant sanctuary — reach Level ${requiredLevel} to awaken it`, LOCKED_MESSAGE_MS);
          }
          return;
        }
        if (this.activeCheckpoint === name) return;
        this.activeCheckpoint = name;
        PlayerProgress.currentZone = this.zoneKey;
        PlayerProgress.currentSpawn = name;
        this.health = this.maxHealth;
        this.updateHealthHud();
        GameSave.save();
        light.setFillStyle(0xd9ffe8, 0.8).setScale(1.25);
        this.showMessage('Sanctuary awakened • Vitality restored • Return here after defeat', 2200);
      });
      this.tweens.add({ targets: light, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  private createBossPortal(): void {
    if (this.zoneKey !== 'biosphere' || !this.guardian || PlayerProgress.guardianDefeated) return;
    const portalX = OVERWORLD_PORTAL_X;
    const portalFloorY = 928;
    this.createGuardianLairAtmosphere();
    const portal = this.add.graphics().setDepth(7);
    portal.fillStyle(0x071b18, 0.82).fillEllipse(portalX, portalFloorY - 48, 58, 94);
    portal.lineStyle(5, 0x79e5ad, 0.85).strokeEllipse(portalX, portalFloorY - 48, 58, 94);
    portal.lineStyle(2, 0xd8ffb0, 0.7).strokeEllipse(portalX, portalFloorY - 48, 38, 70);
    this.add.ellipse(portalX, portalFloorY - 48, 42, 76, 0x80f2b4, 0.2).setDepth(6);

    const gate = this.add.graphics().setDepth(8);
    gate.fillStyle(0x07140f, 0.94).fillRect(4760, 704, 22, 224);
    gate.lineStyle(3, 0x66875a, 0.9);
    for (let y = 704; y < portalFloorY; y += 32) gate.lineBetween(4763, y, 4779, y + 18);
    const gateZone = this.add.zone(4771, 816, 24, 224);
    this.physics.add.existing(gateZone, true);
    this.physics.add.collider(this.player, gateZone);

    this.portalPrompt = this.add.text(portalX, portalFloorY - 105, 'E  ENTER GUARDIAN LAIR', {
      fontFamily: 'monospace', fontSize: '11px', color: '#07110b', backgroundColor: '#d8ffb0'
    }).setPadding(5, 3, 5, 3).setOrigin(0.5, 1).setDepth(90).setVisible(false);

    const zone = this.add.zone(portalX, portalFloorY - 46, 76, 108);
    this.physics.add.existing(zone, true);
    const enterLair = (): void => {
      if (this.bossInLair || this.transitionLocked) return;
      this.bossInLair = true;
      this.transitionLocked = true;
      this.portalPrompt?.setVisible(false);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
      GameAudio.playSfx('portal');
      this.cameras.main.fadeOut(260, 5, 18, 13);
      this.time.delayedCall(290, () => {
        gate.setVisible(false);
        (gateZone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        for (const object of this.worldMapObjects) object.setVisible(false);
        this.regionText?.setText('HEARTSEED PRISON');
        this.player.setPosition(GUARDIAN_ARENA_LEFT + 150, GUARDIAN_ARENA_FLOOR_Y);
        body.updateFromGameObject();
        this.guardian?.setPosition(GUARDIAN_ARENA_RIGHT - 210, GUARDIAN_ARENA_FLOOR_Y);
        this.guardian?.setPatrolBounds(GUARDIAN_ARENA_LEFT + 70, GUARDIAN_ARENA_RIGHT - 70);
        this.guardian?.setExternalArenaFloor(true);
        const guardianBody = this.guardian?.body as Phaser.Physics.Arcade.Body | undefined;
        guardianBody?.updateFromGameObject();
        GameAudio.startBoss();
        this.beginGuardianCutscene(body);
      });
    };
    this.physics.add.overlap(this.player, zone, () => {
      if (this.bossInLair || this.transitionLocked) return;
      this.portalPrompt?.setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) enterLair();
    });
  }

  private createGuardianLairAtmosphere(): void {
    const left = GUARDIAN_ARENA_LEFT;
    const right = GUARDIAN_ARENA_RIGHT;
    const floorY = GUARDIAN_ARENA_FLOOR_Y;
    this.add.rectangle((left + right) / 2, floorY - 180, right - left, 360, 0x020b0b, 0.52).setDepth(-7);
    const roots = this.add.graphics().setDepth(-6);
    roots.fillStyle(0x061813, 0.96);
    for (const x of [left + 42, left + 210, right - 210, right - 42]) {
      roots.fillEllipse(x, floorY - 180, 76, 360);
      roots.fillTriangle(x - 38, floorY, x + 38, floorY, x, floorY - 250);
    }
    roots.lineStyle(5, 0x315d44, 0.55);
    for (let x = left + 35; x < right; x += 110) roots.lineBetween(x, floorY - 330, x + 42, floorY - 20);
    for (const x of [left + 190, GUARDIAN_ARENA_CENTER_X, right - 190]) {
      const light = this.add.circle(x, floorY - 126, 10, 0xa8ff9a, 0.78).setDepth(-4);
      const halo = this.add.circle(x, floorY - 126, 48, 0x76d890, 0.1).setDepth(-5);
      this.tweens.add({ targets: [light, halo], alpha: { from: 0.45, to: 0.95 }, scale: { from: 0.88, to: 1.12 }, duration: 850, yoyo: true, repeat: -1 });
    }

    const terrain = this.add.graphics().setDepth(2);
    terrain.fillStyle(0x0b1812, 1).fillRect(left, floorY, right - left, 240);
    terrain.fillStyle(0x203b2a, 1).fillRect(left, floorY, right - left, 18);
    terrain.lineStyle(5, 0x6c9254, 0.88).lineBetween(left, floorY, right, floorY);
    const floor = this.add.zone(GUARDIAN_ARENA_CENTER_X, floorY + 24, right - left, 48);
    const leftWall = this.add.zone(left - 12, floorY - 150, 24, 300);
    const rightWall = this.add.zone(right + 12, floorY - 150, 24, 300);
    for (const zone of [floor, leftWall, rightWall]) this.physics.add.existing(zone, true);
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.player, leftWall);
    this.physics.add.collider(this.player, rightWall);
    if (this.guardian) {
      this.physics.add.collider(this.guardian, floor);
      this.physics.add.collider(this.guardian, leftWall, () => this.guardian?.turnAwayFrom(left));
      this.physics.add.collider(this.guardian, rightWall, () => this.guardian?.turnAwayFrom(right));
    }
  }

  private beginGuardianCutscene(playerBody: Phaser.Physics.Arcade.Body): void {
    this.guardianCutsceneActive = true;
    this.guardianCutsceneCanSkip = false;
    this.cameras.main.stopFollow();
    this.cameras.main.fadeIn(380, 3, 10, 9);
    this.cameras.main.pan(GUARDIAN_ARENA_CENTER_X, 820, 1300, 'Sine.easeInOut');

    const topBar = this.add.rectangle(0, 0, GAME_WIDTH, 68, 0x020706, 0.96).setOrigin(0).setScrollFactor(0).setDepth(180);
    const bottomBar = this.add.rectangle(0, GAME_HEIGHT - 104, GAME_WIDTH, 104, 0x020706, 0.96).setOrigin(0).setScrollFactor(0).setDepth(180);
    const title = this.add.text(GAME_WIDTH / 2, 25, 'BENEATH THE EASTERN ROOTS', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#dff2a3', letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(181);
    const dialogue = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 64, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#e6f4e9', align: 'center', wordWrap: { width: 760 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(181);
    const skip = this.add.text(GAME_WIDTH - 18, GAME_HEIGHT - 17, 'E  SKIP', {
      fontFamily: 'monospace', fontSize: '10px', color: '#82998b'
    }).setOrigin(1).setScrollFactor(0).setDepth(181);
    this.guardianCutsceneObjects = [topBar, bottomBar, title, dialogue, skip];

    const later = (delay: number, callback: () => void): void => {
      this.guardianCutsceneTimers.push(this.time.delayedCall(delay, callback));
    };
    later(900, () => { this.guardianCutsceneCanSkip = true; });
    this.typeGuardianDialogue(dialogue, 'The roots remember a war the surface forgot.', 450);
    this.typeGuardianDialogue(dialogue, 'At the forest\'s heart sleeps the last Heartseed—\nand below it, the Blight still claws upward.', 3400);
    later(7600, () => {
      this.guardian?.setEncounterActive(true);
      const guardianBody = this.guardian?.body as Phaser.Physics.Arcade.Body | undefined;
      if (guardianBody) guardianBody.enable = false;
      GameAudio.playSfx('roar');
      this.cameras.main.shake(240, 0.006);
    });
    this.typeGuardianDialogue(dialogue, 'VERDANT GUARDIAN\n“I held it below while your world forgot my name.”', 7900, 42);
    this.typeGuardianDialogue(dialogue, '“Prove you can bear the Heartseed...\nor become another root in its prison.”', 12000, 42);
    later(16400, () => this.finishGuardianCutscene());
    playerBody.setVelocity(0, 0);
  }

  private typeGuardianDialogue(dialogue: Phaser.GameObjects.Text, text: string, delay: number, characterDelay = 38): void {
    const start = this.time.delayedCall(delay, () => {
      if (!this.guardianCutsceneActive || !dialogue.active) return;
      dialogue.setText('');
      let visibleCharacters = 0;
      const typing = this.time.addEvent({
        delay: characterDelay,
        repeat: Math.max(0, text.length - 1),
        callback: () => {
          if (!this.guardianCutsceneActive || !dialogue.active) return;
          visibleCharacters += 1;
          dialogue.setText(text.slice(0, visibleCharacters));
        }
      });
      this.guardianCutsceneTimers.push(typing);
    });
    this.guardianCutsceneTimers.push(start);
  }

  private finishGuardianCutscene(): void {
    if (!this.guardianCutsceneActive) return;
    for (const timer of this.guardianCutsceneTimers) timer.remove(false);
    this.guardianCutsceneTimers = [];
    for (const object of this.guardianCutsceneObjects) object.destroy();
    this.guardianCutsceneObjects = [];
    this.guardianCutsceneActive = false;
    this.guardianCutsceneCanSkip = false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.updateFromGameObject();
    const needsRoar = this.guardian?.visible !== true;
    this.guardian?.setEncounterActive(true);
    // The cutscene freezes the guardian's body so it holds its pose; without
    // this the boss stays inert once the cutscene plays out in full.
    const guardianBody = this.guardian?.body as Phaser.Physics.Arcade.Body | undefined;
    if (guardianBody) {
      guardianBody.enable = true;
      guardianBody.updateFromGameObject();
    }
    if (needsRoar) GameAudio.playSfx('roar');
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.shake(150, 0.004);
    this.transitionLocked = false;
    this.showMessage('THE VERDANT GUARDIAN · WARDEN OF THE HEARTSEED', 2100);
  }

  private completeGuardianEncounter(): void {
    if (!this.bossInLair) {
      this.showMessage('Guardian defeated • Guardian cloak unlocked • Autosaved', 2800);
      return;
    }
    this.transitionLocked = true;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.bossProjectiles?.clear(true, true);
    this.bossWaves?.clear(true, true);
    this.cameras.main.fadeOut(420, 3, 10, 9);
    this.time.delayedCall(460, () => {
      this.player.setPosition(4832, 928);
      body.enable = true;
      body.updateFromGameObject();
      for (const object of this.worldMapObjects) object.setVisible(true);
      this.regionText?.setText('GUARDIAN COURT');
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.fadeIn(420, 6, 17, 14);
      this.transitionLocked = false;
      this.showMessage('Guardian defeated • Guardian cloak unlocked • Passage opened • Autosaved', 3000);
    });
  }

  private generateCombatTextures(): void {
    if (!this.textures.exists('guardian-fireball')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x5ddfff, 0.22).fillCircle(10, 10, 10);
      g.fillStyle(0x86ffc7, 0.7).fillCircle(10, 10, 7);
      g.fillStyle(0xf4ffe1, 1).fillCircle(10, 10, 3);
      g.generateTexture('guardian-fireball', 20, 20);
      g.destroy();
    }
    if (!this.textures.exists('guardian-wave')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x9ce678, 0.28).fillTriangle(0, 12, 16, 0, 32, 12);
      g.lineStyle(3, 0xe8ffad, 0.95).lineBetween(0, 11, 16, 1).lineBetween(16, 1, 32, 11);
      g.generateTexture('guardian-wave', 32, 13);
      g.destroy();
    }
  }

  private createBossAttackPhysics(groundLayer: Phaser.Tilemaps.TilemapLayer): void {
    this.bossProjectiles = this.physics.add.group({ allowGravity: false });
    this.bossWaves = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.bossProjectiles, groundLayer, (projectile) => projectile.destroy());
    const damagePlayer: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, attack) => {
      const sprite = attack as Phaser.Physics.Arcade.Sprite;
      this.hurtPlayer(sprite.x);
      sprite.destroy();
    };
    this.physics.add.overlap(this.player, this.bossProjectiles, damagePlayer);
    this.physics.add.overlap(this.player, this.bossWaves, damagePlayer);
  }

  private handleGuardianAttack(attack: GuardianAttack, enemy: Enemy): void {
    if (attack === 'fireball') {
      const baseAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y - 48, this.player.x, this.player.y - 18);
      for (const offset of [-0.24, 0, 0.24]) {
        const fireball = this.bossProjectiles?.create(enemy.x, enemy.y - 48, 'guardian-fireball') as Phaser.Physics.Arcade.Sprite | undefined;
        if (!fireball) continue;
        fireball.setCircle(7, 3, 3).setDepth(12).setAngularVelocity(260);
        const speed = offset === 0 ? 250 : 215;
        this.physics.velocityFromRotation(baseAngle + offset, speed, (fireball.body as Phaser.Physics.Arcade.Body).velocity);
        this.time.delayedCall(2600, () => fireball.active && fireball.destroy());
      }
      return;
    }

    for (const direction of [-1, 1]) {
      const wave = this.bossWaves?.create(enemy.x + direction * 36, enemy.y - 7, 'guardian-wave') as Phaser.Physics.Arcade.Sprite | undefined;
      if (!wave) continue;
      wave.setFlipX(direction < 0).setDepth(12).setVelocityX(direction * 245);
      const body = wave.body as Phaser.Physics.Arcade.Body;
      body.setSize(26, 9).setOffset(3, 3);
      this.time.delayedCall(1700, () => wave.active && wave.destroy());
    }
  }

  private createHud(): void {
    const objectives: Record<string, string> = {
      biosphere: 'Cross the canopy • Enter the guardian lair',
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
    this.add.text(942, 520, 'MOVE A/D  JUMP W/↑  STRIKE J/X  DASH SHIFT/C  USE E  MENU M', {
      fontFamily: 'monospace', fontSize: '10px', color: '#d7e7dc', backgroundColor: '#07110baa'
    }).setPadding(6, 4, 6, 4).setOrigin(1, 1).setScrollFactor(0).setDepth(110);
    this.updateHealthHud();
  }

  private createWorldMap(map: Phaser.Tilemaps.Tilemap, layer: Phaser.Tilemaps.TilemapLayer): void {
    const frame = this.add.rectangle(840,49,208,76,0x061510,0.9).setStrokeStyle(1,0x638275,0.6).setScrollFactor(0).setDepth(109);
    const g=this.add.graphics().setScrollFactor(0).setDepth(110).fillStyle(0x47755a,0.8);
    const visibleCols = this.zoneKey === 'biosphere' ? Math.floor(OVERWORLD_PORTAL_X / TILE_SIZE) : map.width;
    for(let y=0;y<map.height;y+=2) for(let x=0;x<visibleCols;x+=2) {
      if(layer.getTileAt(x,y)?.collides) g.fillRect(747+x/visibleCols*192,20+y/map.height*57,1.6,1.6);
    }
    this.mapDot=this.add.circle(747,20,3,0xf6d898).setScrollFactor(0).setDepth(111);
    this.worldMapObjects = [frame, g, this.mapDot];
    this.regionText=this.add.text(18,78,'WAKING GROVE',{fontFamily:'monospace',fontSize:'13px',color:'#f0d8ab',letterSpacing:2}).setScrollFactor(0).setDepth(110);
    this.add.text(18,496,'CLIMB  W/S + A/D     LEAP OFF  C     SANCTUARIES RESTORE HEALTH',{fontFamily:'monospace',fontSize:'11px',color:'#b7cabb',backgroundColor:'#07110baa'}).setPadding(5).setScrollFactor(0).setDepth(110);
  }

  private updateHealthHud(): void {
    this.healthText?.setText(`VITALITY  ${'◆'.repeat(this.health)}${'◇'.repeat(this.maxHealth - this.health)}`);
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
    if (this.zoneKey === 'biosphere') {
      this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x041b18, 0.34)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(-8);
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
    if (this.textures.exists(key)) this.textures.remove(key);
    const width = 22;
    const height = 36;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const skinColors = [0x8d5c3c, 0xb97950, 0xd9a675, 0xefc394, 0x7a4930];
    const cloakColors = { moss: 0x47795a, sunroot: 0xc28b42, moonfern: 0x4c86a8, guardian: 0x7f4f78 } as const;
    const hairColors = { raven: 0x07110b, earth: 0x553522, silver: 0xb9c6bd } as const;
    const skin = skinColors[PlayerProgress.appearance.skinIndex] ?? skinColors[1];
    const cloak = cloakColors[PlayerProgress.appearance.cloak];
    const hair = hairColors[PlayerProgress.appearance.hair];
    // Compact moss-cloaked explorer: still procedural, but with a readable
    // silhouette and palette instead of the original featureless rectangle.
    graphics.fillStyle(hair, 1).fillRect(6, 0, 11, 3);
    graphics.fillStyle(skin, 1).fillRect(7, 3, 9, 9);
    graphics.fillStyle(hair, 1).fillRect(4, 2, 4, 9).fillRect(16, 4, 3, 7);
    graphics.fillStyle(0xbff5d0, 1).fillRect(14, 6, 2, 2);
    graphics.fillStyle(cloak, 1).fillRect(4, 12, 14, 16);
    graphics.fillStyle(cloak, 1).fillTriangle(2, 29, 20, 29, 11, 13);
    graphics.fillStyle(skin, 1).fillRect(2, 15, 3, 11).fillRect(17, 15, 3, 11);
    graphics.fillStyle(0x17241c, 1).fillRect(5, 28, 5, 7).fillRect(13, 28, 5, 7);
    graphics.fillStyle(0xcfffe0, 1).fillRect(4, 34, 6, 2).fillRect(13, 34, 6, 2);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
