import * as THREE from 'three';
import { groundY } from './world.js';

const shellMaterial=new THREE.MeshStandardMaterial({color:0x556f3b,roughness:.92,flatShading:true});
const scuteMaterial=new THREE.MeshStandardMaterial({color:0x9aaa5c,roughness:.9,flatShading:true});
const skinMaterial=new THREE.MeshStandardMaterial({color:0x7b9963,roughness:.92,flatShading:true});
const darkMaterial=new THREE.MeshStandardMaterial({color:0x293c31,roughness:1});
const eyeMaterial=new THREE.MeshStandardMaterial({color:0xf0d397,emissive:0x594322,roughness:.3});
const thornMaterial=new THREE.MeshStandardMaterial({color:0x758e47,roughness:.9,flatShading:true});
const sphere=(radius=1)=>new THREE.IcosahedronGeometry(radius,1);
function part(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export class Creature {
  constructor(scene,x,z,type='shellback'){
    this.home={x,z};this.x=x;this.z=z;this.type=type;this.health=type==='shellback'?3:2;this.maxHealth=this.health;
    this.alive=true;this.angle=Math.random()*Math.PI*2;this.moveTime=Math.random()*20;this.attackTimer=.35;this.stun=0;this.hurtFlash=0;this.cooldown=0;this.lastAttack=0;
    this.root=new THREE.Group();scene.add(this.root);
    const body=new THREE.Group();this.root.add(body);this.body=body;
    const size=type==='shellback'?.64:.57;this.root.scale.setScalar(size);
    part(body,sphere(),skinMaterial,0,.95,0,1.28,.58,1.8);
    this.shell=part(body,new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,Math.PI/2),shellMaterial,0,1.05,-.27,1.43,1.22,1.65);
    for(let i=0;i<9;i++){
      const a=i*2.399,r=.82+.24*(i%2);
      const q=part(body,sphere(.23),scuteMaterial,Math.cos(a)*r,1.89-Math.abs(Math.cos(a))*.17,Math.sin(a)*r-.25,1.4,.55,1.1);q.rotation.y=a;
    }
    this.legs=[];
    for(let xSide of [-1,1])for(let zSide of [-1,1]){
      const leg=new THREE.Group();leg.position.set(xSide*.86,.76,zSide*.89);body.add(leg);
      part(leg,sphere(.48),skinMaterial,xSide*.13,-.18,.14,.65,1,.85);
      part(leg,sphere(.37),darkMaterial,xSide*.12,-.51,.32,.8,.34,1.25);
      this.legs.push({mesh:leg,phase:xSide*zSide>0?0:Math.PI});
    }
    part(body,sphere(.65),skinMaterial,0,1.2,1.56,1.02,.78,1.18);
    for(const xEye of [-.38,.38]){
      part(body,sphere(.11),eyeMaterial,xEye,1.43,2.12);
      part(body,sphere(.05),darkMaterial,xEye,1.43,2.205);
    }
    if(type==='thornling'){
      for(let i=-1;i<=1;i++){
        const thorn=part(body,new THREE.ConeGeometry(.25,.85,5),thornMaterial,i*.7,2.0,-.4,1,1,1);thorn.rotation.z=i*.24;
      }
      for(let i=0;i<4;i++){
        const leaf=part(body,new THREE.ConeGeometry(.28,.8,4),thornMaterial,(i%2?1:-1)*1.0,1.5,i<2?-.9:.35);
        leaf.rotation.z=(i%2?1:-1)*.6;
      }
    }
    this.root.position.set(x,groundY(x,z)+.06,z);
  }
  update(dt,time,player){
    if(!this.alive){this.root.visible=false;return false;}
    this.stun=Math.max(0,this.stun-dt);this.hurtFlash=Math.max(0,this.hurtFlash-dt);
    const dist=Math.hypot(player.x-this.x,player.z-this.z);
    const aware=dist<12, attacking=aware&&dist<(this.type==='shellback'?1.65:1.35);
    this.moveTime+=dt;
    if(aware&&this.stun<=0){this.angle=Math.atan2(player.x-this.x,player.z-this.z);}
    else if(this.moveTime>3.2){this.moveTime=0;this.angle+=Math.sin(this.x*2.19+time)*1.35;}
    let speed=this.stun>0?0:aware?2.85:1.05;
    if(attacking)speed=0;
    if(Math.hypot(this.x-this.home.x,this.z-this.home.z)>9&&!aware){this.angle=Math.atan2(this.home.x-this.x,this.home.z-this.z);speed=1.4;}
    this.x+=Math.sin(this.angle)*speed*dt;this.z+=Math.cos(this.angle)*speed*dt;
    this.root.position.set(this.x,groundY(this.x,this.z)+.04+Math.sin(time*7)*.013,this.z);
    this.root.rotation.y=this.angle;
    const step=Math.min(speed/2.5,1);
    this.legs.forEach(({mesh,phase})=>{mesh.rotation.x=Math.sin(time*(aware?11:6)+phase)*.46*step;});
    this.body.rotation.z=Math.sin(time*6)*.018*step;
    this.body.rotation.x=this.stun>0?-.2:0;
    this.shell.material=this.hurtFlash>0?scuteMaterial:shellMaterial;
    this.attackTimer-=dt;
    this.body.position.z=THREE.MathUtils.damp(this.body.position.z,attacking?.24:0,13,dt);
    if(attacking&&this.attackTimer<=0){this.attackTimer=1.05;return true;}
    return false;
  }
  hit(damage=1){if(!this.alive)return false;this.health-=damage;this.stun=.38;this.hurtFlash=.22;if(this.health<=0){this.alive=false;this.root.visible=false;}return true;}
}
export function createCreatures(scene){
  return [[-17,-1,'shellback'],[-44,-30,'thornling'],[-20,-73,'shellback'],[33,-56,'shellback'],[52,-106,'thornling'],[8,-125,'shellback'],[4,-169,'thornling']]
    .map(([x,z,type])=>new Creature(scene,x,z,type));
}
