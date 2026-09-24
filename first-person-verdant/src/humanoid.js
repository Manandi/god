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
function bodyField(x,y,z){
  let d=ellipsoid(x,y,z,0,1.31,0,.242,.34,.153);
  d=blend(d,ellipsoid(x,y,z,0,1.5,0,.285,.157,.17),.13);
  d=blend(d,ellipsoid(x,y,z,0,1.03,0,.216,.15,.155),.12);
  d=blend(d,taperedLimb(x,y,z,0,1.62,0,0,1.82,-.017,.078,.073),.072);
  d=blend(d,ellipsoid(x,y,z,0,1.965,-.022,.181,.205,.173),.078);
  d=blend(d,ellipsoid(x,y,z,0,1.885,-.072,.126,.101,.114),.039);
  d=blend(d,ellipsoid(x,y,z,0,1.959,-.204,.041,.064,.057),.019);
  for(const side of [-1,1]){
    d=blend(d,ellipsoid(x,y,z,side*.187,1.93,-.015,.036,.054,.035),.025);
    d=blend(d,taperedLimb(x,y,z,side*.278,1.525,0,side*.382,.88,-.014,.1,.07),.082);
    d=blend(d,ellipsoid(x,y,z,side*.389,.815,-.026,.076,.105,.077),.042);
    d=blend(d,taperedLimb(x,y,z,side*.14,.995,0,side*.14,.155,.017,.125,.086),.09);
    d=blend(d,ellipsoid(x,y,z,side*.142,.07,-.1,.127,.072,.18),.053);
  }
  return d;
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
  function attach(i,bone,weight){indices[i*4]=bone;weights[i*4]=weight;}
  for(let i=0;i<count;i++){
    const x=positions[i*3],y=positions[i*3+1],abs=Math.abs(x),side=x<0?0:1;
    let bone=0,weight=0;
    if(y>1.7&&abs<.24){bone=9;weight=THREE.MathUtils.smoothstep(y,1.7,1.87);}
    else if(abs>.245&&y>.76&&y<1.59){bone=side?6:5;weight=THREE.MathUtils.smoothstep(abs,.245,.37);if(y<1.17){bone=side?8:7;weight*=THREE.MathUtils.smoothstep(1.24-y,0,.28);}}
    else if(y<1.08&&abs>.052){bone=side?2:1;weight=THREE.MathUtils.smoothstep(1.12-y,0,.2);if(y<.53){bone=side?4:3;weight=THREE.MathUtils.smoothstep(.73-y,0,.25);}}
    attach(i,bone,weight);indices[i*4+1]=0;weights[i*4+1]=1-weight;
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

export function createHumanoid(figure,palette){
  const bones=[];
  function bone(parent,x,y,z){const b=new THREE.Bone();b.position.set(x,y,z);parent.add(b);bones.push(b);return b;}
  const pelvis=bone(figure,0,0,0);
  const leftHip=bone(pelvis,-.14,.985,0),rightHip=bone(pelvis,.14,.985,0);
  const leftKnee=bone(leftHip,0,-.44,0),rightKnee=bone(rightHip,0,-.44,0);
  const leftShoulder=bone(pelvis,-.28,1.525,0),rightShoulder=bone(pelvis,.28,1.525,0);
  const leftElbow=bone(leftShoulder,-.065,-.39,0),rightElbow=bone(rightShoulder,.065,-.39,0);
  const head=bone(pelvis,0,1.735,0);
  const shape=makeSurface();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,side:THREE.DoubleSide});
  const mesh=new THREE.SkinnedMesh(shape,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  figure.add(mesh);figure.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));
  return {mesh,head,hips:[leftHip,rightHip],knees:[leftKnee,rightKnee],shoulders:[leftShoulder,rightShoulder],elbows:[leftElbow,rightElbow],paint:a=>paint(shape,a,palette)};
}
