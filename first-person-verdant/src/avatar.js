import * as THREE from 'three';

export const SKIN_TONES=['#74503b','#a46b49','#c89365','#e5b584','#f0d0a5','#5b3b30'];
export const SHIRTS={moss:'#476f59',ochre:'#ad8153',slate:'#576879',clay:'#a35e54',ivory:'#c3bb9c',violet:'#795d86',navy:'#344c67'};
export const TROUSERS={charcoal:'#35413c',umber:'#594c3e',olive:'#485344',indigo:'#37425e'};
export const HAIR_COLORS={raven:'#222b24',earth:'#563b2b',copper:'#9a5638',silver:'#bdc5b9',gold:'#ba9c64'};
export const HAIR_STYLES=['short','curly','swept','tied'];
export const FACE_STYLES=['soft','sharp','round'];
const smooth=(v,target,dt)=>THREE.MathUtils.damp(v,target,12,dt);
const sphere=(r=.2)=>new THREE.SphereGeometry(r,16,12);
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
  const torso=part(figure,new THREE.CylinderGeometry(.32,.27,.74,14),shirt,0,1.16,0);
  part(figure,sphere(.34),shirt,0,1.47,0).scale.set(1,.35,.82);
  part(figure,new THREE.CylinderGeometry(.275,.27,.065,12),seam,0,.78,0);
  part(figure,new THREE.TorusGeometry(.155,.024,7,22),seam,0,1.55,-.13).rotation.x=-.25;
  part(figure,new THREE.CylinderGeometry(.1,.11,.15,10),skin,0,1.59,0);
  const head=part(figure,sphere(.26),skin,0,1.82,-.03);
  const nose=part(figure,sphere(.046),skin,0,1.82,-.277);nose.scale.set(.7,1.1,1);
  const eyeParts=[],brows=[];
  for(const side of [-1,1]){
    eyeParts.push(part(figure,sphere(.023),eyes,side*.105,1.89,-.246));
    brows.push(part(figure,new THREE.BoxGeometry(.095,.017,.02),hair,side*.106,1.96,-.228));
  }
  part(figure,new THREE.BoxGeometry(.085,.012,.015),seam,0,1.73,-.25);
  const hairGroup=new THREE.Group();hairGroup.position.set(0,1.82,-.03);figure.add(hairGroup);
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const hip=new THREE.Group();hip.position.set(side*.16,.79,0);figure.add(hip);
    part(hip,new THREE.CylinderGeometry(.14,.125,.46,10),trousers,0,-.23,0);
    const shin=new THREE.Group();shin.position.y=-.46;hip.add(shin);
    part(shin,new THREE.CylinderGeometry(.11,.095,.32,10),trousers,0,-.16,0);
    part(shin,new THREE.BoxGeometry(.23,.16,.33),boot,0,-.39,-.085);
    legs.push({hip,shin,side});
    const shoulder=new THREE.Group();shoulder.position.set(side*.36,1.46,0);figure.add(shoulder);
    part(shoulder,new THREE.CylinderGeometry(.125,.106,.39,10),shirt,side*.03,-.19,0).rotation.z=side*.1;
    const elbow=new THREE.Group();elbow.position.set(side*.055,-.41,0);shoulder.add(elbow);
    part(elbow,new THREE.CylinderGeometry(.09,.079,.27,10),skin,0,-.12,0);
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
  const rigs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.45,-.58,-.75);group.add(arm);
    part(arm,new THREE.CylinderGeometry(.12,.15,.42,12),shirt,-side*.025,-.14,.05).rotation.z=-side*.22;
    part(arm,new THREE.CylinderGeometry(.09,.1,.21,12),skin,-side*.075,.16,-.115).rotation.x=.4;
    part(arm,sphere(.115),skin,-side*.078,.3,-.18).scale.set(1,.8,1.25);
    for(let i=0;i<3;i++)part(arm,sphere(.027),skin,-side*.078+(i-1)*.058,.34,-.24);
    rigs.push(arm);
  }
  return {group,setAppearance(a){shirt.color.set(SHIRTS[a.shirt]||SHIRTS.moss);skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);},
    animate(time,dt,moving,attackProgress,dashing){group.position.y=smooth(group.position.y,moving?Math.sin(time*9)*.012:0,dt);
      rigs.forEach((arm,i)=>{const punch=i===1&&attackProgress>0?Math.sin(attackProgress*Math.PI):0;
        arm.position.z=smooth(arm.position.z,-.75-punch*.68+(dashing?-.18:0),dt);
        arm.position.y=smooth(arm.position.y,-.58+punch*.18+(moving?Math.sin(time*9+i*Math.PI)*.015:0),dt);
        arm.rotation.x=smooth(arm.rotation.x,-punch*.46,dt);
      });
    }};
}
