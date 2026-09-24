import Phaser from 'phaser';
import { PlayerProgress } from '../progress/PlayerProgress';

/** The same explorer sprite and saved customization in the zones and home. */
export function generatePlayerTexture(scene: Phaser.Scene): void {
  const key = 'player';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const skinColors = [0x8d5c3c, 0xb97950, 0xd9a675, 0xefc394, 0x7a4930];
  const cloakColors = { moss: 0x47795a, sunroot: 0xc28b42, moonfern: 0x4c86a8, guardian: 0x7f4f78 } as const;
  const hairColors = { raven: 0x07110b, earth: 0x553522, silver: 0xb9c6bd } as const;
  const skin = skinColors[PlayerProgress.appearance.skinIndex] ?? skinColors[1];
  const cloak = cloakColors[PlayerProgress.appearance.cloak];
  const hair = hairColors[PlayerProgress.appearance.hair];
  graphics.fillStyle(hair, 1).fillRect(6, 0, 11, 3);
  graphics.fillStyle(skin, 1).fillRect(7, 3, 9, 9);
  graphics.fillStyle(hair, 1).fillRect(4, 2, 4, 9).fillRect(16, 4, 3, 7);
  graphics.fillStyle(0xbff5d0, 1).fillRect(14, 6, 2, 2);
  graphics.fillStyle(cloak, 1).fillRect(4, 12, 14, 16);
  graphics.fillStyle(cloak, 1).fillTriangle(2, 29, 20, 29, 11, 13);
  graphics.fillStyle(skin, 1).fillRect(2, 15, 3, 11).fillRect(17, 15, 3, 11);
  graphics.fillStyle(0x17241c, 1).fillRect(5, 28, 5, 7).fillRect(13, 28, 5, 7);
  graphics.fillStyle(0xcfffe0, 1).fillRect(4, 34, 6, 2).fillRect(13, 34, 6, 2);
  graphics.generateTexture(key, 22, 36);
  graphics.destroy();
}
