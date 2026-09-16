import Phaser from 'phaser';

/** Visible terrain is drawn from the SAME cells used by Arcade collision.
 * No painted prop can imply a wall where the physics has no wall. */
export function drawBiosphereTerrain(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, layer: Phaser.Tilemaps.TilemapLayer): void {
  layer.setVisible(false);
  const g = scene.add.graphics().setDepth(0);
  const solid = (x: number, y: number) => !!layer.getTileAt(x, y)?.collides;
  const size = map.tileWidth;
  // Merge horizontal spans, giving rock bodies an uninterrupted silhouette.
  for (let y = 0; y < map.height; y++) {
    let start = -1;
    for (let x = 0; x <= map.width; x++) {
      if (solid(x,y) && start < 0) start=x;
      if (!solid(x,y) && start >= 0) {
        g.fillStyle(y % 4 === 0 ? 0x152f29 : 0x18372e, 1);
        g.fillRect(start*size,y*size,(x-start)*size,size);
        start=-1;
      }
    }
  }
  for (let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) {
    if(!solid(x,y)) continue;
    const px=x*size, py=y*size;
    if(!solid(x,y-1)) {
      g.fillStyle(0x091e19,0.4).fillRect(px,py+5,size,8);
      g.fillStyle(0x477556).fillRect(px,py,size,5);
      g.lineStyle(2,0xa5c68b,0.95).lineBetween(px,py+1,px+size,py+1);
    }
    if(!solid(x-1,y)) {
      g.fillStyle(0x0a211e).fillRect(px,py,3,size);
      g.lineStyle(1,0x5a8767,0.6).lineBetween(px,py,px,py+size);
    }
    if(!solid(x+1,y)) g.fillStyle(0x0b231f).fillRect(px+size-3,py,3,size);
    if(!solid(x,y+1)) g.fillStyle(0x071b18).fillRect(px,py+size-4,size,4);
    // Deterministic stone strata, not independently scattered decor sprites.
    if((x*7+y*11)%13===0 && solid(x,y-1)) {
      g.lineStyle(1,0x658475,0.2).lineBetween(px+2,py+8,px+13,py+6);
    }
  }
}
