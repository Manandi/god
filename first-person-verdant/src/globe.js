import * as THREE from 'three';
import {BIOMES} from './profile.js';

export function createGlobe(){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#071612');
  scene.add(new THREE.AmbientLight(0xa8b7a6,1.25));
  const sun=new THREE.DirectionalLight(0xffebc4,2.8);sun.position.set(-4,5,8);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(39,1,.1,70);camera.position.set(0,0,12.7);camera.lookAt(0,0,0);
  const holder=new THREE.Group();scene.add(holder);
  const surface=new THREE.Mesh(new THREE.SphereGeometry(3,96,64),new THREE.MeshStandardMaterial({color:0xc3e2cc,roughness:.94,map:new THREE.TextureLoader().load('/art/world-surface-v2.webp')}));
  holder.add(surface);
  holder.add(new THREE.Mesh(new THREE.SphereGeometry(3.052,48,32),new THREE.MeshBasicMaterial({color:0xa9d2be,transparent:true,opacity:.085,side:THREE.BackSide,depthWrite:false})));
  const markers=[];
  for(const biome of BIOMES){
    const theta=biome.longitude*Math.PI*2,phi=(.5-biome.latitude/Math.PI)*Math.PI;
    const normal=new THREE.Vector3(-Math.cos(theta)*Math.sin(phi),Math.cos(phi),Math.sin(theta)*Math.sin(phi));
    const marker=new THREE.Group();marker.position.copy(normal.clone().multiplyScalar(3.09));marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    const mat=new THREE.MeshBasicMaterial({color:biome.color,depthTest:false});
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.105,14,10),mat);marker.add(orb);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.017,6,28),mat);marker.add(ring);
    holder.add(marker);orb.userData.biome=biome.id;ring.userData.biome=biome.id;markers.push({biome,marker,orb,ring,normal});
  }
  // Dim stars behind the atlas maintain a sense of scale without hiding it.
  const points=[];for(let i=0;i<280;i++){const a=i*2.39996,h=(i%31)/15-1,r=21+Math.sin(i*19.2)*2;points.push(Math.cos(a)*Math.sqrt(1-h*h)*r,h*r,Math.sin(a)*Math.sqrt(1-h*h)*r);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:0xb5decf,size:.09,transparent:true,opacity:.58})));
  const raycaster=new THREE.Raycaster();let target=Math.PI/2-BIOMES[0].longitude*Math.PI*2,angle=target,dragging=false;
  return {scene,camera,markers,
    turn(delta){angle+=delta;target=angle;dragging=true;},
    face(biome){const desired=Math.PI/2-biome.longitude*Math.PI*2;target=angle+Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle));dragging=false;},
    pick(x,y){raycaster.setFromCamera(new THREE.Vector2(x,y),camera);const visible=markers.filter(m=>m.normal.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle).z>.24);
      const hits=raycaster.intersectObjects(visible.flatMap(m=>[m.orb,m.ring]),false);return BIOMES.find(b=>b.id===hits[0]?.object.userData.biome)||null;},
    update(dt,time,width,height){camera.aspect=width/height;camera.updateProjectionMatrix();if(!dragging)angle=THREE.MathUtils.damp(angle,target,5,dt);holder.rotation.y=angle;
      markers.forEach(m=>{const front=m.normal.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle).z>0;m.marker.visible=front;m.ring.scale.setScalar(1+Math.sin(time*2+m.biome.longitude*7)*.12);});}
  };
}
