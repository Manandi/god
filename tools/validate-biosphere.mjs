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
    const props=Object.fromEntries((o.properties||[]).map(p=>[p.name,p.value]));
    const left=o.x/16, top=o.y/16, width=o.width/16, bottom=(o.y+o.height)/16;
    for(let y=top;y<bottom;y++) for(let x=left;x<left+width;x++){
      assert(!solid(x,y),'Climb shaft obstructed at '+x+','+y);
    }
    const wallX=props.wallSide==='left'?left-1:left+width;
    let landingY=-1;
    for(let y=top;y<=top+5;y++) if(solid(wallX,y)){landingY=y;break;}
    assert(landingY>=top+2,'Climb has no reachable top landing: '+o.name);
    assert(!solid(wallX,landingY-1),'Climb top landing has no headroom: '+o.name);
    let bottomEntry=false;
    for(let x=left;x<left+width;x++) bottomEntry ||= solid(x,bottom)||solid(x,bottom+1);
    assert(bottomEntry,'Climb has no floor-level entry: '+o.name);
  }
}
const spawnNames=new Set(map.layers.find(l=>l.name==='spawns').objects.map(o=>o.name));
const checkpoints=map.layers.find(l=>l.name==='checkpoints').objects;
assert.equal(checkpoints.length,1,'Biosphere should have one sanctuary before the guardian');
for(const o of checkpoints) assert(spawnNames.has(o.name));
const encounters=map.layers.find(l=>l.name==='encounters').objects;
for(const checkpoint of checkpoints) {
  for(const enemy of encounters) {
    assert(Math.abs(checkpoint.x-enemy.x)>=10*16,'Sanctuary overlaps an enemy patrol or guardian');
  }
}
assert(map.width>=340&&map.height>=80,'Expanded Biosphere dimensions missing');
const surface=(x)=>Array.from({length:map.height},(_,y)=>y).find(y=>solid(x,y));
const guardianCourt=new Set(Array.from({length:56},(_,i)=>surface(282+i)));
assert.equal(guardianCourt.size,1,'Guardian court must remain flat so the boss cannot jam on slopes');
const climbables=map.layers.find(l=>l.name==='climbables').objects;
assert(climbables.length>=7,'Biosphere exploration branches are missing climb connections');
for(let y=1;y<map.height-1;y++) for(let x=1;x<map.width-1;x++) if(solid(x,y)) {
  const neighbors=Number(solid(x-1,y))+Number(solid(x+1,y))+Number(solid(x,y-1))+Number(solid(x,y+1));
  assert(neighbors>1,'Isolated terrain fragment at '+x+','+y);
}
assert(!solid(163,65)&&!solid(163,69),'Undercroft loft route is not connected');
const discoveries=map.layers.find(l=>l.name==='interactables').objects;
const lootNames=new Set(discoveries.flatMap(o=>(o.properties||[]).filter(p=>p.name==='item').map(p=>p.value)));
for(const expected of ['Groveheart seed','Buried relic','Guardian-carved charm']) {
  assert(lootNames.has(expected),'Optional discovery is missing: '+expected);
}
console.log('Biosphere: '+map.width+'x'+map.height+', '+count+' spawn/encounter placements, connected route loops and checkpoint links verified.');
