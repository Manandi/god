import * as THREE from 'three';
import {createHumanoid} from './humanoid.js';

export const SKIN_TONES=['#74503b','#a46b49','#c89365','#e5b584','#f0d0a5','#5b3b30'];
export const SHIRTS={moss:'#476f59',ochre:'#ad8153',slate:'#576879',clay:'#a35e54',ivory:'#c3bb9c',violet:'#795d86',navy:'#344c67'};
export const TROUSERS={charcoal:'#35413c',umber:'#594c3e',olive:'#485344',indigo:'#37425e'};
export const HAIR_COLORS={raven:'#222b24',earth:'#563b2b',copper:'#9a5638',silver:'#bdc5b9',gold:'#ba9c64'};
export const HAIR_STYLES=['short','curly','swept','tied'];
export const FACE_STYLES=['soft','sharp','round'];
const smooth=(v,target,dt)=>THREE.MathUtils.damp(v,target,12,dt);
const sphere=(r=.2)=>new THREE.SphereGeometry(r,24,18);
function part(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}

export function createAvatar(scene){
  const root=new THREE.Group(),figure=new THREE.Group();root.add(figure);scene.add(root);
  const body=createHumanoid(figure,{skin:SKIN_TONES,shirt:SHIRTS,pants:TROUSERS});
  const skin=new THREE.MeshStandardMaterial({color:SKIN_TONES[2],roughness:.9});
  const hair=new THREE.MeshStandardMaterial({color:HAIR_COLORS.raven,roughness:.96});
  const eyeWhite=new THREE.MeshStandardMaterial({color:0xf4f0e7,roughness:.8});
  const iris=new THREE.MeshStandardMaterial({color:0x283b32,roughness:.65});
  const lip=new THREE.MeshStandardMaterial({color:0x805948,roughness:1});
  const face=new THREE.Group();body.head.add(face);
  const eyeParts=[],brows=[],eyelids=[];
  for(const side of [-1,1]){
    const white=part(face,sphere(.023),eyeWhite,side*.072,.26,-.18);white.scale.set(.98,.84,.44);
    const pupil=part(face,sphere(.013),iris,side*.072,.26,-.19);pupil.scale.set(.82,.93,.36);eyeParts.push(pupil);
    const lid=part(face,sphere(.028),skin,side*.072,.284,-.177);lid.scale.set(1.04,.19,.5);eyelids.push(lid);
    const brow=part(face,sphere(.038),hair,side*.074,.314,-.168);brow.scale.set(1.15,.13,.32);brows.push(brow);
  }
  const mouth=part(face,sphere(.03),lip,0,.144,-.193);mouth.scale.set(1.2,.12,.26);
  const hairGroup=new THREE.Group();hairGroup.position.set(0,.23,-.025);face.add(hairGroup);
  function hairStyle(style){
    hairGroup.clear();
    const cap=part(hairGroup,new THREE.SphereGeometry(.184,32,16,0,Math.PI*2,0,Math.PI*(style==='swept'?.42:.38)),hair,0,.01,0);
    cap.scale.set(1.01,1.11,1.04);
    if(style==='curly')for(let i=0;i<24;i++){
      const a=i*2.399,r=.06+i%4*.031;
      const lock=part(hairGroup,sphere(.036),hair,Math.cos(a)*r,.145+i%3*.012,Math.sin(a)*r-.025);
      lock.scale.set(.9,.72,.9);
    }
    else if(style==='tied'){
      const bun=part(hairGroup,sphere(.063),hair,0,.09,.17);bun.scale.set(1,.82,.83);
    }else if(style==='swept'){
      const fringe=part(hairGroup,sphere(.085),hair,-.063,.09,-.12);
      fringe.scale.set(1.17,.34,.62);fringe.rotation.z=-.3;
    }
  }
  hairStyle('short');let currentEmote='idle';
  return {root,setAppearance(a){
    body.paint(a);
    skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);hair.color.set(HAIR_COLORS[a.hairColor]||HAIR_COLORS.raven);
    hairStyle(HAIR_STYLES.includes(a.hairStyle)?a.hairStyle:'short');
    eyeParts.forEach(p=>p.scale.setScalar(a.face==='round'?1.14:a.face==='sharp'?.87:1));
    brows.forEach((b,i)=>b.rotation.z=(i?1:-1)*(a.face==='sharp'?.17:.04));
  },emote(name){currentEmote=name;},get emoteName(){return currentEmote;},
  animate(time,dt,moving,speed,attackProgress,invuln){
    const cycle=Math.sin(time*(speed>7?13:9)),sit=currentEmote==='sit',pose=currentEmote==='pose',wave=currentEmote==='wave',cheer=currentEmote==='cheer';
    figure.position.y=smooth(figure.position.y,sit?-.23:0,dt);
    body.hips.forEach((hip,i)=>{
      hip.rotation.x=smooth(hip.rotation.x,sit?-1.08:pose?(i?-.12:.12):moving?cycle*(i?-.48:.48):0,dt);
      body.knees[i].rotation.x=smooth(body.knees[i].rotation.x,sit?1.42:moving?Math.max(0,-cycle*(i?1:-1))*.26:0,dt);
    });
    body.shoulders.forEach((shoulder,i)=>{
      let target=moving?cycle*(i?-.32:.32):0;
      if(pose)target=i?.37:-.35;if(wave&&i===1)target=2.3+Math.sin(time*6)*.11;
      if(cheer)target=2.5;if(sit)target=-.13;
      if(attackProgress>0&&i===1)target=1.1+Math.sin(attackProgress*Math.PI)*.48;
      shoulder.rotation.x=smooth(shoulder.rotation.x,target,dt);
      shoulder.rotation.z=smooth(shoulder.rotation.z,cheer?(i?-1:1)*.28:pose?(i?-.18:.18):0,dt);
      body.elbows[i].rotation.x=smooth(body.elbows[i].rotation.x,wave&&i===1?-.35:attackProgress>0&&i===1?-.24:0,dt);
    });
    body.head.rotation.x=smooth(body.head.rotation.x,sit?.08:Math.sin(time*1.2)*.025,dt);
    const blink=(Math.sin(time*1.25)+Math.sin(time*.53))>1.79;
    eyelids.forEach(lid=>lid.scale.y=smooth(lid.scale.y,blink?.86:.19,dt));
    mouth.scale.y=smooth(mouth.scale.y,cheer?.62:.12,dt);
    figure.rotation.y=smooth(figure.rotation.y,pose?-.27:0,dt);
    root.visible=!(invuln>0&&Math.floor(time*15)%3===0);
  }};
}

export function createFirstPersonHands(camera){
  const group=new THREE.Group();camera.add(group);
  const shirt=new THREE.MeshStandardMaterial({color:SHIRTS.moss,roughness:.94});
  const skin=new THREE.MeshStandardMaterial({color:SKIN_TONES[2],roughness:.89});
  // The shoulder stays off screen. A forearm follows the fist through the strike.
  const arm=new THREE.Group();arm.position.set(.58,-.76,-.58);group.add(arm);
  const upper=part(arm,new THREE.CapsuleGeometry(.09,.39,6,16),shirt,.08,-.2,.18);upper.rotation.z=.34;upper.rotation.x=-.65;
  const forearm=new THREE.Group();forearm.position.set(0,0,-.1);arm.add(forearm);
  const sleeve=part(forearm,new THREE.CapsuleGeometry(.09,.3,5,16),shirt,0,.02,-.04);sleeve.rotation.x=.8;
  const wrist=part(forearm,new THREE.CapsuleGeometry(.07,.16,5,16),skin,-.05,.19,-.22);wrist.rotation.x=.8;
  part(forearm,sphere(.105),skin,-.055,.29,-.33).scale.set(1.07,.83,1.1);
  for(let i=0;i<4;i++)part(forearm,sphere(.029),skin,-.12+i*.043,.34,-.406);
  return {group,setAppearance(a){shirt.color.set(SHIRTS[a.shirt]||SHIRTS.moss);skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);},
    animate(time,dt,moving,attackProgress){
      const drive=Math.sin(Math.PI*Math.max(0,attackProgress));
      arm.position.x=smooth(arm.position.x,.58-drive*.39,dt);
      arm.position.y=smooth(arm.position.y,-.76+drive*.38,dt);
      arm.position.z=smooth(arm.position.z,-.58-drive*.94,dt);
      arm.rotation.x=smooth(arm.rotation.x,-drive*.38,dt);
      forearm.rotation.z=smooth(forearm.rotation.z,-drive*.19,dt);
    }};
}
