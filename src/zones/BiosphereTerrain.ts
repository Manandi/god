import Phaser from 'phaser';

/** Visible terrain is drawn from the SAME cells used by Arcade collision.
 * No painted prop can imply a wall where the physics has no wall. */
export function drawBiosphereTerrain(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, layer: Phaser.Tilemaps.TilemapLayer): void {
  layer.setVisible(false);
  const solid = (x: number, y: number) => !!layer.getTileAt(x, y)?.collides;
  const size = map.tileWidth;
  const width = map.widthInPixels;
  const height = map.heightInPixels;

  // A single tiled material is clipped to the exact collision silhouette.
  // Because the mask and collision both read from this layer, the painted
  // terrain can never imply a ledge, wall, or opening that physics disagrees
  // with. It also eliminates the visible rectangular asset seams.
  const maskShape = scene.make.graphics({ x: 0, y: 0 });
  maskShape.fillStyle(0xffffff, 1);
  for (let y = 0; y < map.height; y++) {
    let start = -1;
    for (let x = 0; x <= map.width; x++) {
      if (solid(x,y) && start < 0) start=x;
      if (!solid(x,y) && start >= 0) {
        maskShape.fillRect(start*size,y*size,(x-start)*size,size);
        start=-1;
      }
    }
  }
  const material = scene.add.tileSprite(width / 2, height / 2, width, height, 'biosphere-terrain-seamless-v2')
    .setTileScale(0.46)
    .setTint(0x94aa82)
    .setDepth(0);
  material.setMask(maskShape.createGeometryMask());

  const g = scene.add.graphics().setDepth(1);
  for (let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) {
    if(!solid(x,y)) continue;
    const px=x*size, py=y*size;
    if(!solid(x,y-1)) {
      g.fillStyle(0x07150f,0.34).fillRect(px,py+7,size,8);
      g.fillStyle(0x52723c,0.9).fillRect(px,py,size,6);
      g.fillStyle(0x72924b,0.75).fillRect(px,py,size,2);
      if ((x * 5 + y * 3) % 7 === 0) {
        g.fillStyle(0x91a95a, 0.8).fillEllipse(px + 7, py + 2, 14, 4);
      }
    }
    if(!solid(x-1,y)) {
      g.fillStyle(0x07150f,0.55).fillRect(px,py,4,size);
      g.lineStyle(1,0x587348,0.55).lineBetween(px,py,px,py+size);
    }
    if(!solid(x+1,y)) g.fillStyle(0x06130e,0.65).fillRect(px+size-4,py,4,size);
    if(!solid(x,y+1)) g.fillStyle(0x06130e,0.65).fillRect(px,py+size-4,size,4);
  }
}
