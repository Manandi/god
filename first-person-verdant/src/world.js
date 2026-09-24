import * as THREE from 'three';

export const SITES = [
  { id: 'rootwell', title: 'THE ROOTWELL', x: -61, z: -42, story: 'A spring beneath the oldest roots. Its water carries the first memory.' },
  { id: 'ruins', title: 'MOSSWATCH RUINS', x: 63, z: -89, story: 'Stone sentinels once watched the valley. Their oath remains among the fallen arches.' },
  { id: 'shrine', title: 'THE CANOPY SHRINE', x: -12, z: -151, story: 'The forest kept one name hidden in the crown of its tallest tree.' }
];
export const GATE = { x: 23, z: -186 };
const START = { x: 0, z: 39 };
const clamp = THREE.MathUtils.clamp;
function fract(n) { return n - Math.floor(n); }
function rand2(x,z) { return fract(Math.sin(x*127.1+z*311.7)*43758.5453); }
function noise(x,z) {
  const a=Math.floor(x),b=Math.floor(z),fx=x-a,fz=z-b;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(rand2(a,b),rand2(a+1,b),u),THREE.MathUtils.lerp(rand2(a,b+1),rand2(a+1,b+1),u),v);
}
export function groundY(x,z) {
  const broad=Math.sin(x*.022)*2.8+Math.cos(z*.020)*3.0;
  const ridges=(noise(x*.022,z*.022)-.5)*9+(noise(x*.064,z*.064)-.5)*1.8;
  const edge=Math.max(0,(Math.hypot(x*.85,z+58)-142)/45);
  return broad+ridges+edge*edge*18;
}
function rng(seed=87122){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
const color=(value)=>new THREE.Color(value);
function mesh(geometry,material,x,y,z,scene,shadow=true){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m;}
function cylinder(scene,x,z,rTop,rBottom,height,material,offset=0){return mesh(new THREE.CylinderGeometry(rTop,rBottom,height,9),material,x,groundY(x,z)+offset+height/2,z,scene);}
function box(scene,x,z,w,h,d,material,offset=0,rot=0){const b=mesh(new THREE.BoxGeometry(w,h,d),material,x,groundY(x,z)+offset+h/2,z,scene);b.rotation.y=rot;return b;}
function path(scene,points,width,material){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],0,p[1])),false,'centripetal');
  const positions=[],colors=[],indices=[];const total=Math.ceil(curve.getLength()*1.9);
  for(let i=0;i<=total;i++){
    const t=i/total,p=curve.getPoint(t),q=curve.getTangent(t),nx=-q.z,nz=q.x;
    for(const side of [-1,1]){
      const sway=Math.sin(t*62+i*.4)*.14;const x=p.x+nx*width*side*(.5+sway),z=p.z+nz*width*side*(.5+sway);
      positions.push(x,groundY(x,z)+.075,z);const shade=.72+noise(x*.12,z*.12)*.32;colors.push(shade,shade,shade);
    }
    if(i<total){let a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  const m=mesh(g,material,0,0,0,scene,false);m.receiveShadow=true;
  return curve;
}
export function buildWorld(scene){
  const random=rng(),colliders=[],animated=[],particles=[];
  scene.background=color('#779d92');scene.fog=new THREE.FogExp2(0x83a79a,.0057);
  scene.add(new THREE.HemisphereLight(0xc6e9e4,0x33462b,2.1));
  const sun=new THREE.DirectionalLight(0xf6dda0,2.6);sun.position.set(-90,115,-130);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-175;sun.shadow.camera.right=175;sun.shadow.camera.top=125;sun.shadow.camera.bottom=-190;sun.shadow.normalBias=.05;scene.add(sun);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(510,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v; void main(){float h=clamp(normalize(v).y*.5+.5,0.,1.);gl_FragColor=vec4(mix(vec3(.63,.73,.59),vec3(.25,.50,.58),smoothstep(.1,.9,h)),1.);}' }));scene.add(sky);
  const s=420,steps=168,positions=[],colors=[],indices=[];
  const cLow=color('#365333'),cMid=color('#567b46'),cHigh=color('#87966a');
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
    const px=(x/steps-.5)*s,pz=(z/steps-.5)*s,h=groundY(px,pz);
    positions.push(px,h,pz);
    const fleck=noise(px*.22,pz*.22),tone=clamp((h+5)/17,0,1);
    const c=cLow.clone().lerp(cMid,tone).lerp(cHigh,Math.max(0,tone-.48)*.7).multiplyScalar(.82+fleck*.35);
    colors.push(c.r,c.g,c.b);
    if(x<steps&&z<steps){let a=z*(steps+1)+x;indices.push(a,a+steps+1,a+1,a+1,a+steps+1,a+steps+2);}
  }
  const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(indices);terrain.computeVertexNormals();
  const land=mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),0,0,0,scene,false);land.receiveShadow=true;
  const soil=new THREE.MeshStandardMaterial({color:0x776d4d,vertexColors:true,roughness:1,side:THREE.DoubleSide});
  const routes=[
    [[0,44],[-13,24],[-27,1],[-47,-21],[-61,-42]],
    [[-27,1],[0,-16],[30,-41],[55,-68],[63,-89]],
    [[63,-89],[37,-111],[9,-132],[-12,-151]],
    [[-61,-42],[-44,-69],[-13,-96],[9,-132]],
    [[-12,-151],[1,-168],[23,-186]]
  ];
  const curves=routes.map((p,i)=>path(scene,p,i===0?5.8:4.8,soil));
  const nearTrail=(x,z)=>curves.some(c=>{for(let i=0;i<=55;i++){const p=c.getPoint(i/55);if(Math.hypot(p.x-x,p.z-z)<7.1)return true;}return false;});
  const bark=new THREE.MeshStandardMaterial({color:0x383e2c,roughness:1}),leafMaterials=[0x1f5440,0x2e6650,0x3b7651,0x688654,0x244b3d].map(v=>new THREE.MeshStandardMaterial({color:v,roughness:1,flatShading:true}));
  const trunkGeometry=new THREE.CylinderGeometry(.32,.58,1,7),crownGeometry=new THREE.IcosahedronGeometry(1,1);
  const trees=[];for(let i=0;i<540;i++){
    const x=(random()-.5)*355,z=(random()-.5)*355;
    if(Math.hypot(x,z-38)<10||nearTrail(x,z)||SITES.some(p=>Math.hypot(x-p.x,z-p.z)<17)||Math.hypot(x-GATE.x,z-GATE.z)<15)continue;
    const ridge=Math.hypot(x*.85,z+58)>158;if(ridge&&random()<.45)continue;
    trees.push({x,z,height:5.7+random()*7.2,size:.85+random()*.75,kind:Math.floor(random()*leafMaterials.length)});
  }
  const trunkInstances=new THREE.InstancedMesh(trunkGeometry,bark,trees.length),crowns=leafMaterials.map(m=>new THREE.InstancedMesh(crownGeometry,m,trees.length*2));
  trunkInstances.castShadow=true;trunkInstances.receiveShadow=true;crowns.forEach(c=>{c.castShadow=true;c.receiveShadow=true;});
  const counts=leafMaterials.map(()=>0),dummy=new THREE.Object3D();
  trees.forEach((t,i)=>{
    const h=groundY(t.x,t.z);dummy.position.set(t.x,h+t.height/2,t.z);dummy.scale.set(t.size,t.height,t.size);dummy.rotation.set(0,random()*6.28,(random()-.5)*.13);dummy.updateMatrix();trunkInstances.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<2;j++){const c=crowns[t.kind],index=counts[t.kind]++;dummy.position.set(t.x+(j?1.2:-.4)*t.size,h+t.height+(j?-.4:1.4),t.z+(j?-.6:.3)*t.size);dummy.rotation.set(random()*.3,random()*6.28,random()*.3);dummy.scale.set((2.5+j*.55)*t.size,(2.1+j*.3)*t.size,(2.45+j*.4)*t.size);dummy.updateMatrix();c.setMatrixAt(index,dummy.matrix);}
    if(Math.hypot(t.x-START.x,t.z-START.z)<84||Math.hypot(t.x-SITES[1].x,t.z-SITES[1].z)<37)colliders.push({x:t.x,z:t.z,r:.8*t.size});
  });
  crowns.forEach((c,i)=>{c.count=counts[i];scene.add(c);});scene.add(trunkInstances);
  const rockMat=new THREE.MeshStandardMaterial({color:0x747d69,roughness:1,flatShading:true}),mossMat=new THREE.MeshStandardMaterial({color:0x52784a,roughness:1});
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rockMat,700);let nR=0;
  for(let i=0;i<700;i++){const x=(random()-.5)*345,z=(random()-.5)*345;if(nearTrail(x,z)||SITES.some(p=>Math.hypot(x-p.x,z-p.z)<9))continue;const scale=.3+random()*1.7;dummy.position.set(x,groundY(x,z)+scale*.25,z);dummy.rotation.set(random(),random()*6.28,random());dummy.scale.set(scale*1.4,scale*.65,scale);dummy.updateMatrix();rocks.setMatrixAt(nR++,dummy.matrix);if(scale>1.35&&Math.hypot(x,z-39)<80)colliders.push({x,z,r:scale*.85});}rocks.count=nR;rocks.castShadow=true;scene.add(rocks);
  const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.11,.9,3),new THREE.MeshStandardMaterial({color:0x78a46a,side:THREE.DoubleSide,roughness:1}),3900);let nG=0;
  for(let i=0;i<5500&&nG<3900;i++){const x=(random()-.5)*320,z=(random()-.5)*320;if(nearTrail(x,z)&&random()<.85)continue;const scale=.4+random()*1.9;dummy.position.set(x,groundY(x,z)+.2*scale,z);dummy.rotation.set((random()-.5)*.4,random()*6.28,(random()-.5)*.3);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(nG++,dummy.matrix);}grass.count=nG;scene.add(grass);
  // A readable entrance: the woodland trail begins beside a lantern-lit standing stone.
  const runeMat=new THREE.MeshStandardMaterial({color:0xa8b394,roughness:1}),gold=new THREE.MeshStandardMaterial({color:0xe1b96e,emissive:0xa57c32,emissiveIntensity:1.8});
  for(const [x,z] of [[-7,28],[-19,14],[-35,-9],[-49,-27],[16,-32],[40,-57],[54,-79],[35,-113],[6,-139]]){
    cylinder(scene,x,z,.15,.23,2.3,bark);mesh(new THREE.OctahedronGeometry(.37),gold,x,groundY(x,z)+2.62,z,scene,false);
    const l=new THREE.PointLight(0xffd791,1.6,11,2);l.position.set(x,groundY(x,z)+2.6,z);scene.add(l);
  }
  // The Rootwell, Mosswatch, and the Canopy Gate have distinct silhouettes.
  const rx=SITES[0].x,rz=SITES[0].z,ry=groundY(rx,rz);
  mesh(new THREE.CylinderGeometry(7,8,1.5,16),rockMat,rx,ry+.45,rz,scene);
  const pool=mesh(new THREE.CircleGeometry(5.7,48),new THREE.MeshPhysicalMaterial({color:0x48b3b4,emissive:0x135454,emissiveIntensity:.7,metalness:.22,roughness:.17,transparent:true,opacity:.83}),rx,ry+1.23,rz,scene,false);pool.rotation.x=-Math.PI/2;animated.push({mesh:pool,type:'pool'});
  for(let i=0;i<12;i++){const a=i*Math.PI/6,x=rx+Math.cos(a)*7,z=rz+Math.sin(a)*7;cylinder(scene,x,z,.8,1.2,1+random()*1.8,rockMat);}
  const ux=SITES[1].x,uz=SITES[1].z;
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=ux+Math.cos(a)*10,z=uz+Math.sin(a)*8;const h=3+random()*4;box(scene,x,z,1.6,h,1.6,rockMat,0,a);box(scene,x,z,2.2,.45,2.2,mossMat,h);colliders.push({x,z,r:1.1});}
  for(let i=0;i<5;i++){let x=ux-7+i*3,z=uz-6;box(scene,x,z,3,.7,2.4,runeMat,0,.22);}
  const sx=SITES[2].x,sz=SITES[2].z;const giantH=groundY(sx,sz);
  mesh(new THREE.CylinderGeometry(2.9,5.6,24,12),bark,sx,giantH+12,sz,scene);
  for(let i=0;i<9;i++){let a=i*2.399,r=5+random()*9;const branch=mesh(new THREE.CylinderGeometry(.4,1.2,r,7),bark,sx+Math.cos(a)*r*.32,giantH+17+random()*8,sz+Math.sin(a)*r*.32,scene);branch.rotation.z=Math.sin(a)*.65;branch.rotation.x=Math.cos(a)*.65;}
  for(let i=0;i<6;i++){const a=i*1.047;mesh(new THREE.IcosahedronGeometry(7+i%2*2,1),leafMaterials[i%5],sx+Math.cos(a)*6,giantH+24+(i%3)*2,sz+Math.sin(a)*6,scene);}
  for(let i=0;i<10;i++){let a=i*Math.PI/5,x=sx+Math.cos(a)*10,z=sz+Math.sin(a)*10;cylinder(scene,x,z,.52,.85,1.4,rockMat);}
  const gx=GATE.x,gz=GATE.z,gy=groundY(gx,gz);
  for(let side of [-1,1]){box(scene,gx+side*3.2,gz,2,10,2,rockMat);colliders.push({x:gx+side*3.2,z:gz,r:1.2});}
  const lintel=mesh(new THREE.BoxGeometry(9,2,2),rockMat,gx,gy+10,gz,scene);lintel.rotation.z=-.06;
  const gateGlow=mesh(new THREE.PlaneGeometry(5.5,8),new THREE.MeshBasicMaterial({color:0x8edbb3,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false}),gx,gy+4.5,gz,scene,false);animated.push({mesh:gateGlow,type:'gate'});
  const echoes=SITES.map((site,i)=>{
    const y=groundY(site.x,site.z)+3.3;
    const crystal=mesh(new THREE.OctahedronGeometry(1.0,0),new THREE.MeshStandardMaterial({color:[0xa8e9ce,0xc4d9ab,0xd0c19d][i],emissive:0x61cbb0,emissiveIntensity:2.2,metalness:.3,roughness:.2}),site.x,y,site.z,scene,false);
    const ring=mesh(new THREE.TorusGeometry(1.5,.07,6,32),gold,site.x,y,site.z,scene,false);ring.rotation.x=Math.PI/2;
    const light=new THREE.PointLight(0x8de7bc,3.0,20,2);light.position.set(site.x,y,site.z);scene.add(light);
    animated.push({mesh:crystal,type:'echo',baseY:y,index:i},{mesh:ring,type:'ring',baseY:y,index:i});
    return {...site,crystal,ring,light};
  });
  const motesGeom=new THREE.BufferGeometry(),motes=[];
  for(let i=0;i<480;i++){const x=(random()-.5)*280,z=(random()-.5)*280;motes.push(x,groundY(x,z)+1+random()*9,z);}
  motesGeom.setAttribute('position',new THREE.Float32BufferAttribute(motes,3));const motesMesh=new THREE.Points(motesGeom,new THREE.PointsMaterial({color:0xbfe5ba,size:.085,transparent:true,opacity:.5,depthWrite:false}));scene.add(motesMesh);particles.push(motesMesh);
  return {colliders,echoes,animated,particles,gateGlow,nearTrail};
}
