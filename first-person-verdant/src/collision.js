// A small spatial grid keeps collision checks local even when the woodland is dense.
export function createCollisionGrid(colliders,cellSize=12){
  const cells=new Map(),key=(x,z)=>`${x},${z}`;let count=0;
  function add(collider){
    const minX=Math.floor((collider.x-collider.r)/cellSize),maxX=Math.floor((collider.x+collider.r)/cellSize);
    const minZ=Math.floor((collider.z-collider.r)/cellSize),maxZ=Math.floor((collider.z+collider.r)/cellSize);
    for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){
      const id=key(i,j);if(!cells.has(id))cells.set(id,[]);cells.get(id).push(collider);
    }
    count++;
  }
  colliders.forEach(add);
  // add() takes colliders that arrive later (the arena loads after the world).
  return {near(x,z){return cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)))||[];},add,get count(){return count;}};
}

// (fromX, fromZ): where you are now. If you are already overlapping something (you
// landed a jump on a rock's edge, dashed or were knocked into it), a step that moves
// you out of it is allowed, so nothing can pin you in place.
export function canOccupy(x,z,footY,grid,groundY,radius=.43,fromX=null,fromZ=null){
  if(x*x+(z+55)*(z+55)>205*205||z< -202)return false;
  for(const o of grid.near(x,z)){
    if(footY>=o.top-.07)continue;
    const dx=x-o.x,dz=z-o.z,reach=(o.r+radius)**2,d2=dx*dx+dz*dz;
    if(d2>=reach)continue;
    if(fromX!==null){const fx=fromX-o.x,fz=fromZ-o.z,f2=fx*fx+fz*fz;if(f2<reach&&d2>f2+1e-6)continue;}
    return false;
  }
  return true;
}

export function moveWithCollision(player,dx,dz,grid,groundY){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  let hitX=false,hitZ=false;
  for(let step=0;step<steps;step++){
    const x=dx/steps,z=dz/steps;
    const feet=groundY(player.x,player.z)+player.height;
    const valid=(nx,nz)=>groundY(nx,nz)-groundY(player.x,player.z)<=1.45+player.height&&canOccupy(nx,nz,feet,grid,groundY,.43,player.x,player.z);
    if(valid(player.x+x,player.z+z)){player.x+=x;player.z+=z;continue;}
    if(valid(player.x+x,player.z))player.x+=x;else hitX=true;
    if(valid(player.x,player.z+z))player.z+=z;else hitZ=true;
  }
  return {hitX,hitZ};
}

// A walker wedged in a gap too small to leave (props crowding together, a rock on a
// slope): flood the half-metre cells around them; if the free space never reaches
// `reach` metres out it is a closed pocket, and the nearest open cell that does
// lead out is returned. Null when the walker is not boxed in.
export function escapePocket(x,z,grid,groundY,reach=6){
  const S=.5,N=Math.ceil(reach/S),free=(i,j)=>{const cx=x+i*S,cz=z+j*S;return canOccupy(cx,cz,groundY(cx,cz),grid,groundY);};
  const flood=(si,sj,seed)=>{const seen=new Set([si+','+sj]),st=[[si,sj]];if(!seed&&!free(si,sj))return {open:false,seen};
    while(st.length){const [i,j]=st.pop();if(Math.abs(i-si)>=N||Math.abs(j-sj)>=N)return {open:true,seen};
      for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(i+a)+','+(j+b);if(seen.has(k)||!free(i+a,j+b))continue;seen.add(k);st.push([i+a,j+b]);}}
    return {open:false,seen};};
  const here=flood(0,0,true);if(here.open)return null;
  for(let r=1;r<=N;r++)for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){if(Math.max(Math.abs(i),Math.abs(j))!==r||here.seen.has(i+','+j))continue;
    if(flood(i,j,false).open)return {x:x+i*S,z:z+j*S};}
  return null;
}
