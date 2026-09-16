import Phaser from 'phaser';
import { PHYSICS, TILE_SIZE } from '../config';
import { generateTestLevel, TEST_LEVEL_COLS, TEST_LEVEL_ROWS } from '../levels/TestLevel';
import { Player } from '../entities/Player';

export class PlayScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super('PlayScene');
  }

  preload(): void {
    this.generateTileTexture();
    this.generatePlayerTexture();
  }

  create(): void {
    const levelData = generateTestLevel();
    const map = this.make.tilemap({ data: levelData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tiles', 'tile-solid', TILE_SIZE, TILE_SIZE);
    if (!tileset) {
      throw new Error('Failed to create tileset');
    }
    const groundLayer = map.createLayer(0, tileset, 0, 0);
    if (!groundLayer) {
      throw new Error('Failed to create ground layer');
    }
    groundLayer.setCollision(1);

    this.physics.world.gravity.y = PHYSICS.gravityY;
    const mapWidthPx = TEST_LEVEL_COLS * TILE_SIZE;
    const mapHeightPx = TEST_LEVEL_ROWS * TILE_SIZE;
    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);

    this.player = new Player(this, 3 * TILE_SIZE, (TEST_LEVEL_ROWS - 8) * TILE_SIZE);
    this.physics.add.collider(this.player, groundLayer);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, mapWidthPx, mapHeightPx);
    camera.setDeadzone(160, 100);
    camera.startFollow(this.player, true, 0.1, 0.1);
  }

  update(time: number, delta: number): void {
    this.player.update(time, delta);
  }

  private generateTileTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x3f3f52, 1);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    graphics.fillStyle(0x6c6c8a, 1);
    graphics.fillRect(0, 0, TILE_SIZE, 3);
    graphics.generateTexture('tile-solid', TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private generatePlayerTexture(): void {
    const width = 18;
    const height = 34;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, width, height);
    // Facing marker so flipX is visible on a flat-color placeholder.
    graphics.fillStyle(0x0b0b0f, 1);
    graphics.fillRect(width - 5, 6, 4, 4);
    graphics.generateTexture('player', width, height);
    graphics.destroy();
  }
}
