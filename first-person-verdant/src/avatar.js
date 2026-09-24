import * as THREE from 'three';

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
  const shirt=new THREE.MeshStandardMaterial({color:SHIRTS.moss,roughness:.93});
  const trousers=new THREE.MeshStandardMaterial({color:TROUSERS.charcoal,roughness:.98});
  const skin=new THREE.MeshStandardMaterial({color:SKIN_TONES[2],roughness:.9});
  const hair=new THREE.MeshStandardMaterial({color:HAIR_COLORS.raven,roughness:.96});
  const seam=new THREE.MeshStandardMaterial({color:0x899681,roughness:.94});
  const boot=new THREE.MeshStandardMaterial({color:0x292e2a,roughness:.96});
  const eyes=new THREE.MeshStandardMaterial({color:0x202920,roughness:.56});
  const eyeWhite=new THREE.MeshStandardMaterial({color:0xe6e5d4,roughness:.65});
  const torso=part(figure,new THREE.LatheGeometry([
    new THREE.Vector2(0,.77),new THREE.Vector2(.22,.77),new THREE.Vector2(.275,.81),new THREE.Vector2(.29,.92),
    new THREE.Vector2(.275,.82),new THREE.Vector2(.34,1.08),new THREE.Vector2(.32,1.32),
    new THREE.Vector2(.22,1.45),new THREE.Vector2(.105,1.49),new THREE.Vector2(0,1.49)
  ],32),shirt,0,0,0);
  part(figure,new THREE.CylinderGeometry(.267,.266,.04,24),seam,0,.81,0);
  part(figure,new THREE.TorusGeometry(.155,.024,7,22),seam,0,1.55,-.13).rotation.x=-.25;
  part(figure,new THREE.CylinderGeometry(.1,.11,.15,10),skin,0,1.59,0);
  const head=part(figure,sphere(.255),skin,0,1.82,-.03);
  part(figure,sphere(.14),skin,0,1.715,-.095).scale.set(1.25,.59,1.12);
  const nose=part(figure,sphere(.046),skin,0,1.82,-.277);nose.scale.set(.7,1.1,1);
  const eyeParts=[],brows=[];
  for(const side of [-1,1]){
    part(figure,sphere(.046),skin,side*.257,1.8,-.035).scale.set(.48,1.05,.62);
    part(figure,sphere(.036),eyeWhite,side*.1,1.875,-.247).scale.set(.87,.76,.35);
    eyeParts.push(part(figure,sphere(.019),eyes,side*.1,1.875,-.259));
    const brow=part(figure,sphere(.05),hair,side*.105,1.955,-.23);brow.scale.set(1.15,.16,.24);brows.push(brow);
  }
  part(figure,sphere(.036),seam,0,1.733,-.253).scale.set(1.3,.13,.27);
  const hairGroup=new THREE.Group();hairGroup.position.set(0,1.82,-.03);figure.add(hairGroup);
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const hip=new THREE.Group();hip.position.set(side*.16,.79,0);figure.add(hip);
    part(hip,sphere(.156),trousers,0,-.095,0).scale.set(1,.92,.98);
    part(hip,new THREE.CylinderGeometry(.145,.117,.43,20),trousers,0,-.255,0);
    const shin=new THREE.Group();shin.position.y=-.46;hip.add(shin);
    part(shin,sphere(.12),trousers,0,0,0);
    part(shin,new THREE.CylinderGeometry(.114,.088,.34,20),trousers,0,-.16,0);
    part(shin,sphere(.14),boot,0,-.38,-.083).scale.set(.92,.61,1.45);
    legs.push({hip,shin,side});
    const shoulder=new THREE.Group();shoulder.position.set(side*.36,1.46,0);figure.add(shoulder);
    part(shoulder,sphere(.16),shirt,0,-.08,0).scale.set(1,.84,.94);
    part(shoulder,new THREE.CylinderGeometry(.127,.102,.39,18),shirt,side*.03,-.19,0).rotation.z=side*.1;
    const elbow=new THREE.Group();elbow.position.set(side*.055,-.41,0);shoulder.add(elbow);
    part(elbow,sphere(.1),skin,0,0,0);
    part(elbow,new THREE.CylinderGeometry(.097,.079,.27,16),skin,0,-.12,0);
    part(elbow,sphere(.105),skin,0,-.29,-.025).scale.set(1,.8,1.2);
    arms.push({shoulder,elbow,side});
  }
  function hairStyle(style){
    hairGroup.clear();
    if(style==='curly')for(let i=0;i<21;i++){
      const a=i*2.399,r=.08+(i%3)*.065;
      part(hairGroup,sphere(.087),hair,Math.cos(a)*r,.15+i%5*.018,Math.sin(a)*r-.01);
    }
    else if(style==='tied'){
      part(hairGroup,new THREE.SphereGeometry(.257,16,10,0,Math.PI*2,0,Math.PI*.53),hair,0,.03,0);
      part(hairGroup,sphere(.13),hair,0,.07,.25);
      part(hairGroup,new THREE.CylinderGeometry(.09,.055,.25,10),hair,0,-.15,.27);
    }else{
      part(hairGroup,new THREE.SphereGeometry(.258,16,10,0,Math.PI*2,0,Math.PI*(style==='swept'?.56:.46)),hair,0,.03,0);
      const fringe=part(hairGroup,sphere(style==='swept'?.13:.105),hair,style==='swept'?-.1:0,.13,-.17);
      fringe.scale.set(style==='swept'?1.3:1.7,.45,1.2);
    }
  }
  hairStyle('short');let currentEmote='idle';
  return {root,setAppearance(a){
    shirt.color.set(SHIRTS[a.shirt]||SHIRTS.moss);trousers.color.set(TROUSERS[a.pants]||TROUSERS.charcoal);
    skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);hair.color.set(HAIR_COLORS[a.hairColor]||HAIR_COLORS.raven);
    hairStyle(HAIR_STYLES.includes(a.hairStyle)?a.hairStyle:'short');
    head.scale.set(a.face==='round'?1.12:a.face==='sharp'?.88:.96,a.face==='round'?.99:1.06,.9);
    eyeParts.forEach(p=>p.scale.setScalar(a.face==='soft'?1.18:1));
    brows.forEach((b,i)=>b.rotation.z=(i?1:-1)*(a.face==='sharp'?.17:.04));
  },emote(name){currentEmote=name;},get emoteName(){return currentEmote;},
  animate(time,dt,moving,speed,attackProgress,invuln){
    const cycle=Math.sin(time*(speed>7?13:9)),sit=currentEmote==='sit',pose=currentEmote==='pose',wave=currentEmote==='wave',cheer=currentEmote==='cheer';
    figure.position.y=smooth(figure.position.y,sit?-.27:0,dt);
    torso.rotation.x=smooth(torso.rotation.x,sit?.16:pose?-.08:0,dt);
    legs.forEach(({hip,shin,side},i)=>{
      hip.rotation.x=smooth(hip.rotation.x,sit?-1.12:pose?side*.13:moving?cycle*(i?-.46:.46):0,dt);
      shin.rotation.x=smooth(shin.rotation.x,sit?1.55:moving?Math.max(0,-cycle*(i?1:-1))*.15:0,dt);
    });
    arms.forEach(({shoulder,elbow,side},i)=>{
      let target=moving?cycle*(i?.35:-.35):0;
      if(pose)target=i?-.5:.35;if(wave&&i===1)target=-2.3+Math.sin(time*6)*.16;
      if(cheer)target=-2.65;if(sit)target=.15;
      if(attackProgress>0&&i===1)target=-1.1-Math.sin(attackProgress*Math.PI)*.7;
      shoulder.rotation.x=smooth(shoulder.rotation.x,target,dt);
      shoulder.rotation.z=smooth(shoulder.rotation.z,cheer?side*.25:pose?side*.27:side*.12,dt);
      elbow.rotation.x=smooth(elbow.rotation.x,wave&&i===1?-.65:attackProgress>0&&i===1?-.42:0,dt);
    });
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
