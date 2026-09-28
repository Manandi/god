import * as THREE from 'three';

export const SITES = [
  { id: 'rootwell', title: 'THE ROOTWELL', x: -61, z: -42, story: 'A spring beneath the oldest roots. Its water carries the first memory.' },
  { id: 'ruins', title: 'MOSSWATCH RUINS', x: 63, z: -89, story: 'Stone sentinels once watched the valley. Their oath remains among the fallen arches.' },
  { id: 'shrine', title: 'THE CANOPY SHRINE', x: -12, z: -151, story: 'The forest kept one name hidden in the crown of its tallest tree.' }
];
export const GATE = { x: 23, z: -186 };
export const CITY = { name:'MOSSGATE', x:0, z:53, radius:22 };
export const HOME = { name:'ROOTWARD HOMESTEAD', x:0, z:88, radius:15 };
const START = { x: 0, z: 39 };
const clamp = THREE.MathUtils.clamp;
function fract(n) { return n - Math.floor(n); }
function rand2(x,z) { return fract(Math.sin(x*127.1+z*311.7)*43758.5453); }
function noise(x,z) {
  const a=Math.floor(x),b=Math.floor(z),fx=x-a,fz=z-b;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(rand2(a,b),rand2(a+1,b),u),THREE.MathUtils.lerp(rand2(a,b+1),rand2(a+1,b+1),u),v);
}
function rawGroundY(x,z) {
  const broad=Math.sin(x*.022)*2.8+Math.cos(z*.020)*3.0;
  const ridges=(noise(x*.022,z*.022)-.5)*9+(noise(x*.064,z*.064)-.5)*1.8;
  const edge=Math.max(0,(Math.hypot(x*.85,z+58)-142)/45);
  return broad+ridges+edge*edge*18;
}
export function groundY(x,z) {
  let height=rawGroundY(x,z);
  // Town squares and the home island are deliberately level gameplay spaces.
  // Their decorative slabs used to span rolling terrain, which made a correctly
  // grounded explorer look waist-deep in stone near the slab's high side.
  for(const [cx,cz,r,feather] of [[CITY.x,CITY.z,14,5],[HOME.x,HOME.z,13,4]]){
    const d=Math.hypot(x-cx,z-cz),blend=1-THREE.MathUtils.smoothstep(d,r,r+feather);
    if(blend>0)height=THREE.MathUtils.lerp(height,rawGroundY(cx,cz),blend);
  }
  return height;
}
function rng(seed=87122){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
const color=(value)=>new THREE.Color(value);
function barkTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
  const context=canvas.getContext('2d');const random=rng(44091);
  context.fillStyle='#474634';context.fillRect(0,0,128,256);
  for(let i=0;i<1450;i++){
    const x=random()*128,y=random()*256,width=.5+random()*3,height=6+random()*45;
    context.fillStyle=random()>.55?'rgba(16,27,21,.26)':'rgba(174,181,125,.12)';
    context.fillRect(x,y,width,height);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,2);
  return texture;
}
function forestDetail(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d'),random=rng(198402);
  ctx.fillStyle='#eee9df';ctx.fillRect(0,0,256,256);
  for(let i=0;i<10500;i++){
    const v=Math.floor(175+random()*80),x=random()*256,y=random()*256;
    ctx.fillStyle=`rgba(${v-24},${v},${v-29},${.06+random()*.26})`;
    ctx.fillRect(x,y,1+random()*4,1+random()*3);
  }
  for(let i=0;i<310;i++){
    const x=random()*256,y=random()*256;
    ctx.strokeStyle=random()>.46?'rgba(102,87,49,.21)':'rgba(95,127,65,.19)';
    ctx.lineWidth=.4+random()*1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*7-3,y+random()*11-5);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;return texture;
}
function mesh(geometry,material,x,y,z,scene,shadow=true){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m;}
function organicCrown(){
  const shape=new THREE.SphereGeometry(1,20,14),p=shape.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const swell=1+.075*Math.sin(x*11+z*7)*Math.cos(y*9-z*5)+.065*Math.sin(x*5-y*8+z*3);
    p.setXYZ(i,x*swell,y*swell,z*swell);
  }
  shape.computeVertexNormals();return shape;
}
function leafCluster(){
  const positions=[],indices=[];
  function blade(angle,length,width,lean){
    const first=positions.length/3;
    for(let i=0;i<=4;i++){
      const t=i/4,r=lean*t*t+.08*Math.sin(t*Math.PI),w=width*Math.sin(Math.PI*(t*.87+.06));
      const x=Math.cos(angle)*r,z=Math.sin(angle)*r,y=length*t;
      positions.push(x-Math.sin(angle)*w,y,z+Math.cos(angle)*w,x+Math.sin(angle)*w,y,z-Math.cos(angle)*w);
      if(i<4)indices.push(first+i*2,first+i*2+1,first+i*2+2,first+i*2+1,first+i*2+3,first+i*2+2);
    }
  }
  blade(0,.73,.085,.28);blade(2.2,.58,.077,.24);blade(4.3,.81,.085,.3);
  const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shape.setIndex(indices);shape.computeVertexNormals();return shape;
}
function fernFronds(){
  const positions=[],indices=[];
  for(let blade=0;blade<7;blade++){
    const angle=blade*Math.PI*2/7,first=positions.length/3;
    for(let i=0;i<=5;i++){
      const t=i/5,r=t*t*.74,w=.19*Math.sin(Math.PI*(t*.88+.04)),y=.12+1.13*t-.37*t*t;
      positions.push(Math.cos(angle)*r-Math.sin(angle)*w,y,Math.sin(angle)*r+Math.cos(angle)*w,
        Math.cos(angle)*r+Math.sin(angle)*w,y,Math.sin(angle)*r-Math.cos(angle)*w);
      if(i<5)indices.push(first+i*2,first+i*2+1,first+i*2+2,first+i*2+1,first+i*2+3,first+i*2+2);
    }
  }
  const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shape.setIndex(indices);shape.computeVertexNormals();return shape;
}
function cylinder(scene,x,z,rTop,rBottom,height,material,offset=0){return mesh(new THREE.CylinderGeometry(rTop,rBottom,height,16),material,x,groundY(x,z)+offset+height/2,z,scene);}
function box(scene,x,z,w,h,d,material,offset=0,rot=0){const b=mesh(new THREE.BoxGeometry(w,h,d),material,x,groundY(x,z)+offset+h/2,z,scene);b.rotation.y=rot;return b;}
function path(scene,points,width,material){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],0,p[1])),false,'centripetal');
  const positions=[],colors=[],indices=[];const total=Math.ceil(curve.getLength()*1.9);
  for(let i=0;i<=total;i++){
    const t=i/total,p=curve.getPoint(t),q=curve.getTangent(t),nx=-q.z,nz=q.x;
    for(const [side,alpha] of [[-.69,0],[-.43,.88],[.43,.88],[.69,0]]){
      const sway=Math.sin(t*62+i*.4)*.09;const x=p.x+nx*width*(side+sway),z=p.z+nz*width*(side+sway);
      positions.push(x,groundY(x,z)+.083,z);const shade=.72+noise(x*.12,z*.12)*.32;colors.push(shade,shade,shade,alpha);
    }
    if(i<total){let a=i*4;for(let j=0;j<3;j++)indices.push(a+j,a+j+1,a+j+4,a+j+1,a+j+5,a+j+4);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(indices);g.computeVertexNormals();
  const m=mesh(g,material,0,0,0,scene,false);m.receiveShadow=true;
  return curve;
}

function buildCity(scene,colliders,animated,stone,moss,cameraObstacles){
  const timber=new THREE.MeshStandardMaterial({color:0x695b45,roughness:1});
  const plaster=new THREE.MeshStandardMaterial({color:0xb3ad91,roughness:.98});
  const roof=new THREE.MeshStandardMaterial({color:0x3f5d4b,roughness:1,flatShading:true});
  const bronze=new THREE.MeshStandardMaterial({color:0xb89554,emissive:0x6d4a21,emissiveIntensity:.65,roughness:.68});
  const localBox=(parent,w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const proxyMaterial=new THREE.MeshBasicMaterial({visible:false});
  const addCollider=(x,z,r,h)=>{
    colliders.push({x,z,r,top:groundY(x,z)+h});
    const proxy=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),proxyMaterial);
    proxy.position.set(x,groundY(x,z)+h/2,z);scene.add(proxy);cameraObstacles.push(proxy);
  };
  const y=groundY(CITY.x,CITY.z);
  mesh(new THREE.CylinderGeometry(9.8,10.5,.42,24),stone,CITY.x,y-.19,CITY.z,scene);
  const squareProxy=new THREE.Mesh(new THREE.CylinderGeometry(9.8,10.5,.42,24),proxyMaterial);squareProxy.position.set(CITY.x,y-.19,CITY.z);scene.add(squareProxy);cameraObstacles.push(squareProxy);
  const compass=mesh(new THREE.RingGeometry(2.3,2.55,8),new THREE.MeshStandardMaterial({color:0xa7b875,roughness:.8,side:THREE.DoubleSide}),CITY.x,y+.29,CITY.z,scene,false);compass.rotation.x=-Math.PI/2;compass.rotation.z=Math.PI/8;
  for(const [x,z,rot] of [[-11,50,.16],[11,50,-.16],[-10,61,.34],[10,62,-.28],[0,67,.02]]){
    const home=new THREE.Group();home.position.set(x,groundY(x,z),z);home.rotation.y=rot;scene.add(home);
    localBox(home,6.2,.7,5.2,stone,0,.35,0);localBox(home,5.6,3.4,4.6,plaster,0,2.35,0);
    for(const sx of [-1,1])for(const sz of [-1,1])localBox(home,.28,3.55,.28,timber,sx*2.55,2.35,sz*2.05);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(4.5,2.5,4),roof);cap.position.y=5.22;cap.rotation.y=Math.PI/4;cap.castShadow=true;home.add(cap);
    localBox(home,1.25,2.15,.18,timber,0,1.42,-2.4);const lamp=localBox(home,.18,.32,.18,bronze,1.55,2.15,-2.52);lamp.rotation.z=Math.PI/4;
    addCollider(x,z,3.25,5.7);
  }
  for(let i=0;i<34;i++){
    const a=i/34*Math.PI*2,x=CITY.x+Math.cos(a)*19,z=CITY.z+Math.sin(a)*15;if(z<40&&Math.abs(x)<4.2)continue;
    const h=2.7+(i%3)*.22;const post=cylinder(scene,x,z,.17,.3,h,timber);post.rotation.z=Math.sin(a)*.04;addCollider(x,z,.34,h);
  }
  for(const side of [-1,1]){const x=side*4.6,z=39.4;box(scene,x,z,1.3,5.4,1.3,stone);addCollider(x,z,.85,5.4);const banner=mesh(new THREE.PlaneGeometry(1.3,2.4),new THREE.MeshStandardMaterial({color:side<0?0x66815a:0x7e694c,side:THREE.DoubleSide,roughness:1}),x,groundY(x,z)+4,z-.72,scene,false);banner.rotation.y=Math.PI;}
  const lintel=mesh(new THREE.BoxGeometry(11,1.15,1.2),stone,0,groundY(0,39.4)+5.1,39.4,scene);lintel.rotation.z=.025;
  mesh(new THREE.CylinderGeometry(.75,.95,.65,8),stone,0,y+.65,CITY.z,scene);
  const flame=mesh(new THREE.OctahedronGeometry(.72,0),bronze,0,y+1.65,CITY.z,scene,false);animated.push({mesh:flame,type:'cityFlame',baseY:y+1.65,index:0});
  const cityLight=new THREE.PointLight(0xd8c07d,2.1,17,2);cityLight.position.set(0,y+2,CITY.z);scene.add(cityLight);
  for(const [x,z,rot] of [[-5.8,54,.14],[5.8,57,-.12]]){box(scene,x,z,3.5,.25,2.1,timber,2.05,rot);box(scene,x,z,3.8,.18,2.5,roof,3.15,rot);for(const sx of [-1,1]){const px=x+sx*1.55*Math.cos(rot),pz=z-sx*1.55*Math.sin(rot);cylinder(scene,px,pz,.1,.13,3.15,timber);}}
  box(scene,-1.6,61.2,3.2,2.1,.25,timber,0,.05);box(scene,-1.6,61.2,3.5,.2,.4,moss,2.15,.05);
  return {name:CITY.name,x:CITY.x,z:CITY.z,radius:CITY.radius,rest:{x:0,z:CITY.z}};
}
function buildHome(scene,colliders,animated,stone,moss,cameraObstacles){
  const timber=new THREE.MeshStandardMaterial({color:0x594834,roughness:1}),cloth=new THREE.MeshStandardMaterial({color:0x426b59,roughness:1}),gold=new THREE.MeshStandardMaterial({color:0xe0b96e,emissive:0x6f4b1e,emissiveIntensity:.8});
  const y=groundY(HOME.x,HOME.z),add=(x,z,r,h)=>{colliders.push({x,z,r,top:groundY(x,z)+h});const p=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),new THREE.MeshBasicMaterial({visible:false}));p.position.set(x,groundY(x,z)+h/2,z);scene.add(p);cameraObstacles.push(p);};
  // A raised rootwood deck marks the player's actual starter base.
  mesh(new THREE.CylinderGeometry(12.5,14,.7,16),stone,HOME.x,y-.33,HOME.z,scene);
  const cabin=new THREE.Group();cabin.position.set(-4,y+.3,91);scene.add(cabin);
  const local=(w,h,d,mat,x0,y0,z0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x0,y0,z0);m.castShadow=m.receiveShadow=true;cabin.add(m);return m;};
  local(6,.6,5,stone,0,.3,0);local(5.5,3.6,4.5,timber,0,2.35,0);const roof=new THREE.Mesh(new THREE.ConeGeometry(4.5,2.2,4),cloth);roof.position.y=5.15;roof.rotation.y=Math.PI/4;roof.castShadow=true;cabin.add(roof);local(1.35,2.3,.2,cloth,0,1.45,-2.35);add(-4,91,3.2,6);
  // Forge, storage, bedroll and mission table are readable home-base stations.
  box(scene,5.2,91,2.8,1.1,1.7,stone,.55);box(scene,5.2,91,2.2,.18,1.25,gold,1.25);
  box(scene,4.8,85,2.8,.9,1.5,timber,.45);box(scene,4.8,85,2.1,.12,1.1,cloth,1.05);
  box(scene,-5.1,84.7,3.1,.35,1.5,cloth,.28);box(scene,-6.15,84.7,.85,.5,1.55,moss,.5);
  for(const [x,z] of [[-10,84],[10,84],[-10,94],[10,94]]){cylinder(scene,x,z,.12,.18,3.2,timber);const lamp=mesh(new THREE.OctahedronGeometry(.32),gold,x,groundY(x,z)+3.55,z,scene,false);animated.push({mesh:lamp,type:'homeLamp',baseY:lamp.position.y,index:x+z});}
  const hearth=mesh(new THREE.OctahedronGeometry(.6),gold,0,y+1.05,84.5,scene,false);animated.push({mesh:hearth,type:'cityFlame',baseY:y+1.05,index:44});
  return {...HOME,rest:{x:0,z:84.5},spawn:{x:0,z:82.5}};
}
export function buildWorld(scene){
  const random=rng(),colliders=[],animated=[],particles=[];
  scene.background=color('#779d92');scene.fog=new THREE.FogExp2(0x83a79a,.0057);
  scene.add(new THREE.HemisphereLight(0xc6e9e4,0x33462b,1.8));
  const sun=new THREE.DirectionalLight(0xf6dda0,2.45);sun.position.set(-45,95,-50);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-48;sun.shadow.camera.right=48;sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;sun.shadow.camera.near=.5;sun.shadow.camera.far=230;sun.shadow.normalBias=.035;sun.shadow.bias=-.00012;scene.add(sun,sun.target);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(510,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v; void main(){float h=clamp(normalize(v).y*.5+.5,0.,1.);gl_FragColor=vec4(mix(vec3(.63,.73,.59),vec3(.25,.50,.58),smoothstep(.1,.9,h)),1.);}' }));scene.add(sky);
  const s=420,steps=168,positions=[],colors=[],indices=[],uvs=[];
  const cLow=color('#365333'),cMid=color('#567b46'),cHigh=color('#87966a');
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
    const px=(x/steps-.5)*s,pz=(z/steps-.5)*s,h=groundY(px,pz);
    positions.push(px,h,pz);
    uvs.push(px*.115,pz*.115);
    const fleck=noise(px*.22,pz*.22),tone=clamp((h+5)/17,0,1);
    const c=cLow.clone().lerp(cMid,tone).lerp(cHigh,Math.max(0,tone-.48)*.7).multiplyScalar(.82+fleck*.35);
    colors.push(c.r,c.g,c.b);
    if(x<steps&&z<steps){let a=z*(steps+1)+x;indices.push(a,a+steps+1,a+1,a+1,a+steps+1,a+steps+2);}
  }
  const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));terrain.setIndex(indices);terrain.computeVertexNormals();
  const detail=forestDetail();
  const land=mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,map:detail,bumpMap:detail,bumpScale:.075,roughness:1,side:THREE.DoubleSide}),0,0,0,scene,false);land.receiveShadow=true;
  const soil=new THREE.MeshStandardMaterial({color:0x776d4d,vertexColors:true,transparent:true,depthWrite:false,roughness:1,side:THREE.DoubleSide});
  const routes=[
    [[0,44],[-13,24],[-27,1],[-47,-21],[-61,-42]],
    [[-27,1],[0,-16],[30,-41],[55,-68],[63,-89]],
    [[63,-89],[37,-111],[9,-132],[-12,-151]],
    [[-61,-42],[-44,-69],[-13,-96],[9,-132]],
    [[-12,-151],[1,-168],[23,-186]]
  ];
  const curves=routes.map((p,i)=>path(scene,p,i===0?5.8:4.8,soil));
  const nearTrail=(x,z)=>curves.some(c=>{for(let i=0;i<=55;i++){const p=c.getPoint(i/55);if(Math.hypot(p.x-x,p.z-z)<7.1)return true;}return false;});
  const bark=new THREE.MeshStandardMaterial({color:0xa9a797,map:barkTexture(),roughness:1}),leafMaterials=[0x1f5440,0x2e6650,0x3b7651,0x688654,0x244b3d].map(v=>new THREE.MeshStandardMaterial({color:v,roughness:1}));
  const trunkGeometry=new THREE.CylinderGeometry(.32,.58,1,14),crownGeometry=organicCrown();
  const trees=[];for(let i=0;i<540;i++){
    const x=(random()-.5)*355,z=(random()-.5)*355;
    if((Math.abs(x-CITY.x)<CITY.radius&&Math.abs(z-CITY.z)<18)||Math.hypot(x-HOME.x,z-HOME.z)<HOME.radius+5||Math.hypot(x,z-38)<10||nearTrail(x,z)||SITES.some(p=>Math.hypot(x-p.x,z-p.z)<17)||Math.hypot(x-GATE.x,z-GATE.z)<15)continue;
    const ridge=Math.hypot(x*.85,z+58)>158;if(ridge&&random()<.45)continue;
    trees.push({x,z,height:5.7+random()*7.2,size:.85+random()*.75,kind:Math.floor(random()*leafMaterials.length)});
  }
  const trunkInstances=new THREE.InstancedMesh(trunkGeometry,bark,trees.length),crowns=leafMaterials.map(m=>new THREE.InstancedMesh(crownGeometry,m,trees.length*3));
  const limbs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.25,1,12),bark,trees.length*2);let limbCount=0;
  trunkInstances.castShadow=true;trunkInstances.receiveShadow=true;crowns.forEach(c=>{c.castShadow=true;c.receiveShadow=true;});
  const counts=leafMaterials.map(()=>0),dummy=new THREE.Object3D();
  trees.forEach((t,i)=>{
    const h=groundY(t.x,t.z);dummy.position.set(t.x,h+t.height/2,t.z);dummy.scale.set(t.size,t.height,t.size);dummy.rotation.set(0,random()*6.28,(random()-.5)*.13);dummy.updateMatrix();trunkInstances.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<3;j++){
      const a=j*2.094+random()*.7,reach=(1.25+j*.23)*t.size;
      const c=crowns[t.kind],index=counts[t.kind]++;
      dummy.position.set(t.x+Math.cos(a)*reach,h+t.height+(j===0?1.4:-.1-j*.36),t.z+Math.sin(a)*reach);
      dummy.rotation.set(random()*.3,random()*6.28,random()*.3);
      dummy.scale.set((2.15+j*.22)*t.size,(1.55+j*.18)*t.size,(2.1+j*.25)*t.size);dummy.updateMatrix();c.setMatrixAt(index,dummy.matrix);
      if(j<2){const limb=new THREE.Vector3(t.x+Math.cos(a)*reach*.55,h+t.height*.83,t.z+Math.sin(a)*reach*.55);
        dummy.position.copy(limb);dummy.rotation.set(Math.sin(a)*.65,0,-Math.cos(a)*.65);
        dummy.scale.set(t.size,reach*1.35,t.size);dummy.updateMatrix();limbs.setMatrixAt(limbCount++,dummy.matrix);}
    }
    colliders.push({x:t.x,z:t.z,r:.57*t.size,top:h+t.height+1});
  });
  crowns.forEach((c,i)=>{c.count=counts[i];scene.add(c);});scene.add(trunkInstances);limbs.count=limbCount;limbs.castShadow=true;scene.add(limbs);
  const rockMat=new THREE.MeshStandardMaterial({color:0x747d69,roughness:1}),mossMat=new THREE.MeshStandardMaterial({color:0x52784a,roughness:1});
  const cameraObstacles=[land];
  const city=buildCity(scene,colliders,animated,rockMat,mossMat,cameraObstacles);
  const home=buildHome(scene,colliders,animated,rockMat,mossMat,cameraObstacles);
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,1),rockMat,700),lichens=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mossMat,420);let nR=0,nL=0;
  for(let i=0;i<700;i++){const x=(random()-.5)*345,z=(random()-.5)*345;if((Math.abs(x-CITY.x)<CITY.radius&&Math.abs(z-CITY.z)<18)||Math.hypot(x-HOME.x,z-HOME.z)<HOME.radius+2||nearTrail(x,z)||SITES.some(p=>Math.hypot(x-p.x,z-p.z)<9))continue;const scale=.3+random()*1.7,y=groundY(x,z);dummy.position.set(x,y+scale*.25,z);dummy.rotation.set(random(),random()*6.28,random());dummy.scale.set(scale*1.4,scale*.65,scale);dummy.updateMatrix();rocks.setMatrixAt(nR++,dummy.matrix);rocks.setColorAt(nR-1,new THREE.Color().setHSL(.25+random()*.08,.09+random()*.11,.54+random()*.15));if(scale>.43)colliders.push({x,z,r:scale*.94,top:y+scale*.9});if(nL<420&&scale>.7&&random()<.76){dummy.position.set(x+(random()-.5)*scale*.7,y+scale*.78,z+(random()-.5)*scale*.6);dummy.rotation.set(0,random()*6.28,0);dummy.scale.set(scale*.43,.045+random()*.08,scale*.34);dummy.updateMatrix();lichens.setMatrixAt(nL++,dummy.matrix);}}
  rocks.count=nR;rocks.castShadow=true;lichens.count=nL;scene.add(rocks,lichens);
  const grass=new THREE.InstancedMesh(leafCluster(),new THREE.MeshStandardMaterial({color:0x78a46a,side:THREE.DoubleSide,roughness:1}),3900);let nG=0;
  for(let i=0;i<5500&&nG<3900;i++){const x=(random()-.5)*320,z=(random()-.5)*320;if((Math.abs(x-CITY.x)<CITY.radius&&Math.abs(z-CITY.z)<18)||Math.hypot(x-HOME.x,z-HOME.z)<HOME.radius||(nearTrail(x,z)&&random()<.85))continue;const scale=.4+random()*1.9;dummy.position.set(x,groundY(x,z),z);dummy.rotation.set((random()-.5)*.22,random()*6.28,(random()-.5)*.18);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(nG,dummy.matrix);grass.setColorAt(nG++,new THREE.Color().setHSL(.25+random()*.09,.27+random()*.13,.35+random()*.16));}grass.count=nG;scene.add(grass);
  // Curved fern fronds and grass blades soften the path without blocking movement.
  const fernMat=new THREE.MeshStandardMaterial({color:0x3a7853,roughness:1,side:THREE.DoubleSide});
  const fernShape=fernFronds(),ferns=new THREE.InstancedMesh(fernShape,fernMat,1700);let fernCount=0;
  const flowerStem=new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.035,.6,5),new THREE.MeshStandardMaterial({color:0x477749}),520);
  const petals=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.17,0),new THREE.MeshStandardMaterial({color:0xe5c688,roughness:.95}),520);let flowerCount=0;
  for(let i=0;i<2200;i++){
    const x=(random()-.5)*300,z=(random()-.5)*300;
    if(Math.hypot(x,z-39)<4||SITES.some(p=>Math.hypot(x-p.x,z-p.z)<3))continue;
    const y=groundY(x,z),near=nearTrail(x,z);
    if(near&&random()<.42&&flowerCount<520){
      const a=flowerCount++;dummy.position.set(x,y+.33,z);dummy.rotation.set(0,random()*6.28,(random()-.5)*.3);dummy.scale.setScalar(.75+random()*.8);dummy.updateMatrix();flowerStem.setMatrixAt(a,dummy.matrix);
      dummy.position.y=y+.68;dummy.scale.setScalar(.7+random()*.9);dummy.updateMatrix();petals.setMatrixAt(a,dummy.matrix);
    }else if(fernCount<1700){for(let j=0;j<2&&fernCount<1700;j++){
      dummy.position.set(x+(random()-.5)*.7,y,z+(random()-.5)*.7);
      dummy.rotation.set((random()-.5)*.3,random()*6.28,(random()-.5)*.55);dummy.scale.setScalar(.55+random()*.85);
      dummy.updateMatrix();ferns.setMatrixAt(fernCount++,dummy.matrix);
    }}
  }
  ferns.count=fernCount;flowerStem.count=flowerCount;petals.count=flowerCount;
  scene.add(ferns,flowerStem,petals);
  // Small shaded mushrooms by the trail give close-up scale detail and are decorative.
  const stemMat=new THREE.MeshStandardMaterial({color:0xb7b39a,roughness:.98});
  const capMat=new THREE.MeshStandardMaterial({color:0x9f8059,roughness:.83,side:THREE.DoubleSide});
  const stalks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.08,.28,7),stemMat,280);
  const caps=new THREE.InstancedMesh(new THREE.SphereGeometry(.25,10,6,0,Math.PI*2,0,Math.PI/2),capMat,280);let fungusCount=0;
  for(let i=0;i<950&&fungusCount<280;i++){
    const x=(random()-.5)*270,z=(random()-.5)*270;
    if(!nearTrail(x,z)||Math.hypot(x,z-39)<4||random()<.35)continue;
    const y=groundY(x,z),scale=.55+random()*1.25,idx=fungusCount++;
    dummy.position.set(x,y+.14*scale,z);dummy.rotation.set(0,random()*6.28,0);dummy.scale.setScalar(scale);dummy.updateMatrix();stalks.setMatrixAt(idx,dummy.matrix);
    dummy.position.y=y+.28*scale;dummy.scale.setScalar(scale);dummy.updateMatrix();caps.setMatrixAt(idx,dummy.matrix);
  }
  stalks.count=caps.count=fungusCount;scene.add(stalks,caps);
  // A readable entrance: the woodland trail begins beside a lantern-lit standing stone.
  const runeMat=new THREE.MeshStandardMaterial({color:0xa8b394,roughness:1}),gold=new THREE.MeshStandardMaterial({color:0xe1b96e,emissive:0xa57c32,emissiveIntensity:1.8});
  const lanternSites=[[-7,28],[-19,14],[-35,-9],[-49,-27],[16,-32],[40,-57],[54,-79],[35,-113],[6,-139]];
  for(const [x,z] of lanternSites){
    cylinder(scene,x,z,.15,.23,2.3,bark);mesh(new THREE.OctahedronGeometry(.37),gold,x,groundY(x,z)+2.62,z,scene,false);
  }
  // Keep the nearest lanterns lit. Distant lanterns retain their glowing
  // crystals, but they no longer add nine lights to every forest shader.
  const lanternLights=Array.from({length:3},()=>{const light=new THREE.PointLight(0xffd791,1.6,11,2);scene.add(light);return light;});
  const lanternPositions=lanternSites.map(([x,z])=>({x,z,y:groundY(x,z)+2.6}));
  let lastLightX=Infinity,lastLightZ=Infinity;
  function updateLanternLights(x,z){
    if(Math.hypot(x-lastLightX,z-lastLightZ)<1.5)return;
    lastLightX=x;lastLightZ=z;
    const nearest=lanternPositions.map(p=>({p,d:(p.x-x)**2+(p.z-z)**2})).sort((a,b)=>a.d-b.d);
    lanternLights.forEach((light,i)=>{
      const {p,d}=nearest[i];light.position.set(p.x,p.y,p.z);
      light.intensity=d<24*24?1.6:0;
    });
  }
  // The Rootwell, Mosswatch, and the Canopy Gate have distinct silhouettes.
  const rx=SITES[0].x,rz=SITES[0].z,ry=groundY(rx,rz);
  mesh(new THREE.CylinderGeometry(7,8,1.5,16),rockMat,rx,ry+.45,rz,scene);
  const pool=mesh(new THREE.CircleGeometry(5.7,48),new THREE.MeshPhysicalMaterial({color:0x48b3b4,emissive:0x135454,emissiveIntensity:.7,metalness:.22,roughness:.17,transparent:true,opacity:.83}),rx,ry+1.23,rz,scene,false);pool.rotation.x=-Math.PI/2;animated.push({mesh:pool,type:'pool'});
  // The basin is a ring, not one giant blocker. Leave a clear entrance toward
  // the lantern road and make every visible rim segment solid.
  const rootwellEntrance=Math.atan2(CITY.z-rz,CITY.x-rx);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,x=rx+Math.cos(a)*7,z=rz+Math.sin(a)*7;
    cylinder(scene,x,z,.8,1.2,1+random()*1.8,rockMat);
    const gap=Math.abs(Math.atan2(Math.sin(a-rootwellEntrance),Math.cos(a-rootwellEntrance)));
    if(gap>.34)colliders.push({x,z,r:1.02,top:groundY(x,z)+2.8,kind:'rootwell-rim'});
  }
  const ux=SITES[1].x,uz=SITES[1].z;
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=ux+Math.cos(a)*10,z=uz+Math.sin(a)*8;const h=3+random()*4;box(scene,x,z,1.6,h,1.6,rockMat,0,a);box(scene,x,z,2.2,.45,2.2,mossMat,h);colliders.push({x,z,r:1.1,top:groundY(x,z)+h+.45});}
  for(let i=0;i<5;i++){let x=ux-7+i*3,z=uz-6;box(scene,x,z,3,.7,2.4,runeMat,0,.22);}
  const sx=SITES[2].x,sz=SITES[2].z;const giantH=groundY(sx,sz);
  mesh(new THREE.CylinderGeometry(2.9,5.6,24,24),bark,sx,giantH+12,sz,scene);
  for(let i=0;i<9;i++){let a=i*2.399,r=5+random()*9;const branch=mesh(new THREE.CylinderGeometry(.4,1.2,r,7),bark,sx+Math.cos(a)*r*.32,giantH+17+random()*8,sz+Math.sin(a)*r*.32,scene);branch.rotation.z=Math.sin(a)*.65;branch.rotation.x=Math.cos(a)*.65;}
  for(let i=0;i<6;i++){const a=i*1.047,m=mesh(crownGeometry,leafMaterials[i%5],sx+Math.cos(a)*6,giantH+24+(i%3)*2,sz+Math.sin(a)*6,scene);m.scale.set(7+i%2*2,6+i%2*1.5,7+i%2*2);}
  for(let i=0;i<10;i++){let a=i*Math.PI/5,x=sx+Math.cos(a)*10,z=sz+Math.sin(a)*10;cylinder(scene,x,z,.52,.85,1.4,rockMat);}
  const gx=GATE.x,gz=GATE.z,gy=groundY(gx,gz);
  for(let side of [-1,1]){box(scene,gx+side*3.2,gz,2,10,2,rockMat);colliders.push({x:gx+side*3.2,z:gz,r:1.2,top:groundY(gx+side*3.2,gz)+10});}
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
  return {colliders,echoes,animated,particles,gateGlow,city,home,nearTrail,cameraObstacles,sun,updateLanternLights,
    setFoliageShadows(enabled){ crowns.forEach(c=>{c.castShadow=enabled;}); }};
}
