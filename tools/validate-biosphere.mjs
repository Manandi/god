import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const map=JSON.parse(readFileSync(new URL('../public/maps/biosphere.json',import.meta.url)));
const ground=map.layers.find(l=>l.name==='ground').data;
const solid=(x,y)=>x>=0&&x<map.width&&y>=0&&y<map.height&&ground[y*map.width+x]>0;
const hazardLayer=map.layers.find(l=>l.name==='hazards');
for(const hazard of hazardLayer.objects) assert(hazard.width<=4*16,hazard.name+' exceeds reliable jump width');
assert.equal(ground.length,map.width*map.height);
let count=0;
for(const layer of map.layers.filter(l=>l.objects)) for(const o of layer.objects){
  assert(o.x>=0&&o.x+(o.width||0)<=map.width*16,layer.name+':'+o.name+' x bounds');
  assert(o.y>=0&&o.y+(o.height||0)<=map.height*16,layer.name+':'+o.name+' y bounds');
  if(layer.name==='spawns'||layer.name==='checkpoints'||layer.name==='encounters'){
    const feetY=o.y+(layer.name==='encounters'?16:0);
    const height=layer.name==='encounters'&&o.name==='turtle-boss'?96:36;
    for(let y=Math.floor((feetY-height)/16);y<Math.floor(feetY/16);y++){
      assert(!solid(Math.floor(o.x/16),y),layer.name+':'+o.name+' embedded in terrain');
    }
    count++;
    if(layer.name==='encounters') {
      for(const hazard of hazardLayer.objects) {
        assert(o.x < hazard.x || o.x > hazard.x + hazard.width, 'Enemy '+o.name+' placed over '+hazard.name);
      }
      if(o.name==='turtle') {
        const col=Math.floor(o.x/16);
        const surface=(x)=>Array.from({length:map.height},(_,y)=>y).find(y=>solid(x,y));
        assert.equal(surface(col-1),surface(col),'Turtle spawn is not on flat terrain at '+col);
        assert.equal(surface(col+1),surface(col),'Turtle spawn is not on flat terrain at '+col);
      }
    }
  }
  if(layer.name==='climbables'){
    for(let y=o.y/16;y<(o.y+o.height)/16;y++) for(let x=o.x/16;x<(o.x+o.width)/16;x++){
      assert(!solid(x,y),'Climb shaft obstructed at '+x+','+y);
    }
  }
}
const spawnNames=new Set(map.layers.find(l=>l.name==='spawns').objects.map(o=>o.name));
const checkpoints=map.layers.find(l=>l.name==='checkpoints').objects;
assert.equal(checkpoints.length,1,'Biosphere should have one sanctuary before the guardian');
for(const o of checkpoints) assert(spawnNames.has(o.name));
assert(map.width>=340&&map.height>=80,'Expanded Biosphere dimensions missing');
console.log('Biosphere: '+map.width+'x'+map.height+', '+count+' spawn/encounter placements, connected route loops and checkpoint links verified.');
