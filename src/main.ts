import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { ZoneScene } from './scenes/ZoneScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  pixelArt: false,
  antialias: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [ZoneScene]
});
