import Phaser from 'phaser';

/** Small floating "Lv N" label that follows a sprite — used above the
 * player and enemies so relative threat is readable at a glance. */
export class LevelBadge {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, level: number, backgroundColor: string) {
    this.text = scene.add
      .text(0, 0, `Lv ${level}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#0b0b0f',
        backgroundColor
      })
      .setPadding(3, 1, 3, 1)
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  follow(x: number, y: number, clearanceAboveHead: number): void {
    this.text.setPosition(x, y - clearanceAboveHead);
  }

  destroy(): void {
    this.text.destroy();
  }
}
