import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';

// A single continuous surface for the explorer, including the neck, face,
// shoulders, arms, hands, hips, legs and feet. Bones deform this same surface.
const ellipsoid=(x,y,z,cx,cy,cz,rx,ry,rz)=>{
  const px=(x-cx)/rx,py=(y-cy)/ry,pz=(z-cz)/rz;
  return (Math.hypot(px,py,pz)-1)*Math.min(rx,ry,rz);
};
function taperedLimb(x,y,z,ax,ay,az,bx,by,bz,r0,r1){
  const vx=bx-ax,vy=by-ay,vz=bz-az;
  const t=THREE.MathUtils.clamp(((x-ax)*vx+(y-ay)*vy+(z-az)*vz)/(vx*vx+vy*vy+vz*vz),0,1);
  return Math.hypot(x-ax-vx*t,y-ay-vy*t,z-az-vz*t)-THREE.MathUtils.lerp(r0,r1,t);
}
function blend(a,b,k){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
// The body is built from three kinds of parts. Keeping them separate lets the
// skin weights ask which part a surface point actually belongs to.
function torsoField(x,y,z){
  let d=ellipsoid(x,y,z,0,1.31,0,.242,.34,.153);
  d=blend(d,ellipsoid(x,y,z,0,1.5,0,.285,.157,.17),.13);
  d=blend(d,ellipsoid(x,y,z,0,1.03,0,.216,.15,.155),.12);
  d=blend(d,taperedLimb(x,y,z,0,1.62,0,0,1.82,-.017,.078,.073),.072);
  d=blend(d,ellipsoid(x,y,z,0,1.965,-.022,.181,.205,.173),.078);
  d=blend(d,ellipsoid(x,y,z,0,1.885,-.072,.126,.101,.114),.039);
  d=blend(d,ellipsoid(x,y,z,0,1.959,-.204,.041,.064,.057),.019);
  for(const side of [-1,1])d=blend(d,ellipsoid(x,y,z,side*.187,1.93,-.015,.036,.054,.035),.025);
  return d;
}
function armField(side,x,y,z){
  return blend(taperedLimb(x,y,z,side*.278,1.525,0,side*.4,.88,-.014,.1,.07),ellipsoid(x,y,z,side*.407,.815,-.026,.076,.105,.077),.042);
}
function legField(side,x,y,z){
  return blend(taperedLimb(x,y,z,side*.14,.995,0,side*.14,.155,.017,.125,.086),ellipsoid(x,y,z,side*.142,.07,-.1,.127,.072,.18),.053);
}
function bodyField(x,y,z){
  // Arms and legs each blend into the torso but never into each other, so a
  // hand resting by the hip does not grow a web of skin to the thigh.
  const torso=torsoField(x,y,z);let upper=torso,lower=torso;
  for(const side of [-1,1]){upper=blend(upper,armField(side,x,y,z),.082);lower=blend(lower,legField(side,x,y,z),.09);}
  return Math.min(upper,lower);
}
function makeSurface(){
  const size=70,mc=new MarchingCubes(size,new THREE.MeshBasicMaterial(),false,false,55000);
  mc.isolation=0;
  for(let z=1;z<size-1;z++)for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
    // Marching Cubes occupies a [-1,1] cube. Map to player coordinates.
    mc.field[x+y*size+z*size*size]=bodyField((x/size*2-1)*.77,(y/size*2-1)*1.24+1.09,(z/size*2-1)*.64);
  }
  mc.update();
  const count=mc.count,p=mc.geometry.attributes.position,n=mc.geometry.attributes.normal;
  if(count<1000)throw new Error('Explorer body surface could not be generated');
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    // The marching field is a signed distance: reverse its inward winding.
    const source=i-i%3+(i%3===1?2:i%3===2?1:0);
    positions[i*3]=p.getX(source)*.77;positions[i*3+1]=p.getY(source)*1.24+1.09;positions[i*3+2]=p.getZ(source)*.64;
    const nx=n.getX(source)/.77,ny=n.getY(source)/1.24,nz=n.getZ(source)/.64,scale=Math.hypot(nx,ny,nz)||1;
    normals[i*3]=-nx/scale;normals[i*3+1]=-ny/scale;normals[i*3+2]=-nz/scale;
  }
  const shape=new THREE.BufferGeometry();
  shape.setAttribute('position',new THREE.BufferAttribute(positions,3));
  shape.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  shape.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*3),3));
  const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
  for(let i=0;i<count;i++){
    const influence=skinInfluence(positions[i*3],positions[i*3+1],positions[i*3+2]);
    for(let k=0;k<4;k++){indices[i*4+k]=influence[k]?.[0]??0;weights[i*4+k]=influence[k]?.[1]??0;}
  }
  shape.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));
  shape.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
  shape.computeBoundingSphere();mc.geometry.dispose();mc.material.dispose();
  return shape;
}

function paint(shape,appearance,palette){
  const p=shape.attributes.position,c=shape.attributes.color;
  const skin=new THREE.Color(palette.skin[appearance.skinIndex]||palette.skin[2]);
  const shirt=new THREE.Color(palette.shirt[appearance.shirt]||palette.shirt.moss);
  const pants=new THREE.Color(palette.pants[appearance.pants]||palette.pants.charcoal);
  const shoes=new THREE.Color('#242b25');
  for(let i=0;i<p.count;i++){
    const x=Math.abs(p.getX(i)),y=p.getY(i),z=p.getZ(i);
    let color=y>1.07?(y>1.75?skin:shirt):pants;
    if(x>.28&&y<1.13&&y>.7)color=skin;
    if(y<.14)color=shoes;
    const shade=1-.055*Math.max(0,z/.3);
    c.setXYZ(i,color.r*shade,color.g*shade,color.b*shade);
  }
  c.needsUpdate=true;
}

// Bone layout. Positions are in the figure's rest space (feet at y=0, facing -Z,
// the explorer's right hand on +X). Names follow the common Hips/Spine/Arm/Leg
// convention so authored rigs and clips can be swapped in later.
export const BONES=[
  ['Hips',null,0,1.0,0],
  ['Spine','Hips',0,1.16,0],['Chest','Spine',0,1.36,0],['Neck','Chest',0,1.6,0],['Head','Neck',0,1.735,0],
  ...['Left','Right'].flatMap(side=>{const s=side==='Left'?-1:1;return [
    [side+'Shoulder','Chest',s*.1,1.5,0],[side+'Arm',side+'Shoulder',s*.28,1.525,0],
    [side+'ForeArm',side+'Arm',s*.341,1.135,-.007],[side+'Hand',side+'ForeArm',s*.394,.9,-.012],
    [side+'UpLeg','Hips',s*.14,.985,0],[side+'Leg',side+'UpLeg',s*.14,.545,.005],[side+'Foot',side+'Leg',s*.14,.13,0]
  ];})
];
const BONE_INDEX=Object.fromEntries(BONES.map(([name],i)=>[name,i]));

const ramp=(v,a,b)=>THREE.MathUtils.smoothstep(v,Math.min(a,b),Math.max(a,b))*(a<b?1:-1)+(a<b?0:1);
// Weighted blend along a chain of bones: stops are [y, bone] from top to bottom.
function chain(y,stops){
  if(y>=stops[0][0])return [[stops[0][1],1]];
  for(let i=0;i<stops.length-1;i++){
    const [y0,a]=stops[i],[y1,b]=stops[i+1];
    if(y<=y0&&y>=y1){if(a===b)return [[a,1]];const t=THREE.MathUtils.smoothstep(y,y1,y0);return [[a,t],[b,1-t]];}
  }
  return [[stops[stops.length-1][1],1]];
}
// Each surface point follows up to four bones. Joints blend across a band so the
// torso twists, shoulders roll and knees bend without the surface tearing.
function skinInfluence(x,y,z){
  const side=x<0?'Left':'Right',sign=x<0?-1:1,total=new Map();
  const add=(list,scale)=>{if(scale<=.0005)return;for(const [name,w] of list)total.set(name,(total.get(name)||0)+w*scale);};
  // Soft assignment to the nearest part surface; the blend band is ~3 cm wide,
  // wider near the shoulder so the deltoid rolls instead of creasing.
  const soft=y>1.38&&y<1.62?.05:.024;
  const dT=torsoField(x,y,z),dA=armField(sign,x,y,z),dL=legField(sign,x,y,z);
  const m=Math.min(dT,dA,dL),eT=Math.exp(-(dT-m)/soft),eA=Math.exp(-(dA-m)/soft),eL=Math.exp(-(dL-m)/.03);
  const sum=eT+eA+eL,arm=eA/sum,leg=eL/sum;
  add(chain(y,[[1.82,'Head'],[1.71,'Neck'],[1.63,'Chest'],[1.45,'Chest'],[1.25,'Spine'],[1.08,'Hips']]),eT/sum);
  add(chain(y,[[1.48,side+'Arm'],[1.2,side+'Arm'],[1.07,side+'ForeArm'],[.94,side+'ForeArm'],[.86,side+'Hand']]),arm);
  // The top of the thigh shares the pelvis so the hip crease bends smoothly.
  const hipShare=ramp(y,.84,.98)*.5;
  add([['Hips',1]],leg*hipShare);
  add(chain(y,[[.64,side+'UpLeg'],[.47,side+'Leg'],[.21,side+'Leg'],[.12,side+'Foot']]),leg*(1-hipShare));
  const list=[...total].filter(([,w])=>w>.001).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const norm=list.reduce((s,[,w])=>s+w,0)||1;
  return list.map(([name,w])=>[BONE_INDEX[name],w/norm]);
}

export function createHumanoid(figure,palette){
  const bones=[],byName={};
  for(const [name,parent,x,y,z] of BONES){
    const b=new THREE.Bone();b.name=name;
    const p=parent?BONES.find(v=>v[0]===parent):null;
    b.position.set(x-(p?p[2]:0),y-(p?p[3]:0),z-(p?p[4]:0));
    (parent?byName[parent]:figure).add(b);bones.push(b);byName[name]=b;
  }
  const shape=makeSurface();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,side:THREE.DoubleSide});
  const mesh=new THREE.SkinnedMesh(shape,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  figure.add(mesh);figure.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));
  return {mesh,bones:byName,head:byName.Head,paint:a=>paint(shape,a,palette)};
}
