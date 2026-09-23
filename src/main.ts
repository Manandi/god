import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { TitleScene } from './scenes/TitleScene';
import { ZoneScene } from './scenes/ZoneScene';
import { WorldScene } from './scenes/WorldScene';
import { BaseScene } from './scenes/BaseScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  pixelArt: false,
  antialias: true,
  dom: {
    createContainer: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [TitleScene, WorldScene, ZoneScene, BaseScene]
});
