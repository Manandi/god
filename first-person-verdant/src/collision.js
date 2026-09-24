// A small spatial grid keeps collision checks local even when the woodland is dense.
export function createCollisionGrid(colliders,cellSize=12){
  const cells=new Map(),key=(x,z)=>`${x},${z}`;
  for(const collider of colliders){
    const minX=Math.floor((collider.x-collider.r)/cellSize),maxX=Math.floor((collider.x+collider.r)/cellSize);
    const minZ=Math.floor((collider.z-collider.r)/cellSize),maxZ=Math.floor((collider.z+collider.r)/cellSize);
    for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){
      const id=key(i,j);if(!cells.has(id))cells.set(id,[]);cells.get(id).push(collider);
    }
  }
  return {near(x,z){return cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)))||[];},count:colliders.length};
}

export function canOccupy(x,z,footY,grid,groundY,radius=.43){
  if(x*x+(z+55)*(z+55)>205*205||z< -202)return false;
  for(const o of grid.near(x,z)){
    if(footY>=o.top-.07)continue;
    const dx=x-o.x,dz=z-o.z;
    if(dx*dx+dz*dz<(o.r+radius)**2)return false;
  }
  return true;
}

export function moveWithCollision(player,dx,dz,grid,groundY){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  let hitX=false,hitZ=false;
  for(let step=0;step<steps;step++){
    const x=dx/steps,z=dz/steps;
    const feet=groundY(player.x,player.z)+player.height;
    const valid=(nx,nz)=>groundY(nx,nz)-groundY(player.x,player.z)<=1.45+player.height&&canOccupy(nx,nz,feet,grid,groundY);
    if(valid(player.x+x,player.z+z)){player.x+=x;player.z+=z;continue;}
    if(valid(player.x+x,player.z))player.x+=x;else hitX=true;
    if(valid(player.x,player.z+z))player.z+=z;else hitZ=true;
  }
  return {hitX,hitZ};
}
