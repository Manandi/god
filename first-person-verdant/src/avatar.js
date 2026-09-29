import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createHumanoid} from './humanoid.js';
import {Animator,solveLeg} from './anim/animator.js';
import {buildClips} from './anim/clips.js';
import {loadWeaponModels,mountWeapon,holdWeapon,WEAPON_MODELS,GRIP,FP_GRIP} from './weapons.js';

export const SKIN_TONES=['#74503b','#a46b49','#c89365','#e5b584','#f0d0a5','#5b3b30'];
export const SHIRTS={moss:'#476f59',ochre:'#ad8153',slate:'#576879',clay:'#a35e54',ivory:'#c3bb9c',violet:'#795d86',navy:'#344c67'};
export const TROUSERS={charcoal:'#35413c',umber:'#594c3e',olive:'#485344',indigo:'#37425e'};
export const HAIR_COLORS={raven:'#222b24',earth:'#563b2b',copper:'#9a5638',silver:'#bdc5b9',gold:'#ba9c64'};
export const HAIR_STYLES=['short','curly','swept','tied','braid'];
export const OUTFITS=['ranger','warden'];
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
  const blockCloth=new THREE.MeshStandardMaterial({color:SHIRTS.moss,roughness:1});
  const blockLeather=new THREE.MeshStandardMaterial({color:0x524537,roughness:.94});
  const blockTrim=new THREE.MeshStandardMaterial({color:0x9a8359,roughness:.82});
  const blockPants=new THREE.MeshStandardMaterial({color:TROUSERS.charcoal,roughness:1});
  const bootMat=new THREE.MeshStandardMaterial({color:0x202a27,roughness:1});
  body.mesh.visible=false;
  part(body.bones.Hips,new RoundedBoxGeometry(.48,.34,.31,3,.045),blockLeather,0,.17,0);
  part(body.bones.Spine,new RoundedBoxGeometry(.57,.44,.34,3,.055),blockCloth,0,.2,0);
  part(body.bones.Chest,new RoundedBoxGeometry(.62,.28,.36,3,.055),blockCloth,0,.12,0);
  // A two-piece neck/collar closes the visible gap between the block torso and
  // head while still following the neck bone during attacks and emotes.
  part(body.bones.Neck,new RoundedBoxGeometry(.21,.22,.2,3,.035),skin,0,.07,0);
  part(body.bones.Neck,new RoundedBoxGeometry(.34,.11,.29,3,.035),blockCloth,0,-.045,0);
  const headBlock=part(body.bones.Head,new RoundedBoxGeometry(.38,.43,.35,4,.065),skin,0,.2,0);
  for(const side of ['Left','Right']){
    const sign=side==='Left'?-1:1;
    const upper=part(body.bones[side+'Arm'],new RoundedBoxGeometry(.24,.43,.27,2,.035),blockCloth,sign*.03,-.18,0);upper.rotation.z=sign*.15;
    const bracer=part(body.bones[side+'ForeArm'],new RoundedBoxGeometry(.23,.3,.25,2,.025),blockLeather,sign*.02,-.12,0);bracer.rotation.z=sign*.19;
    part(body.bones[side+'Hand'],new RoundedBoxGeometry(.22,.2,.23,2,.035),skin,0,-.05,-.01);
    const thigh=part(body.bones[side+'UpLeg'],new RoundedBoxGeometry(.29,.53,.31,2,.035),blockPants,0,-.235,0);thigh.rotation.z=-sign*.01;
    part(body.bones[side+'Leg'],new RoundedBoxGeometry(.27,.48,.29,2,.03),blockPants,0,-.215,0);
    part(body.bones[side+'Foot'],new RoundedBoxGeometry(.27,.18,.42,2,.035),bootMat,0,-.03,-.12);
  }
  const face=new THREE.Group();body.head.add(face);
  const eyeParts=[],brows=[],eyelids=[];
  for(const side of [-1,1]){
    part(face,new RoundedBoxGeometry(.095,.064,.025,2,.012),eyeWhite,side*.092,.255,-.184);
    const pupil=part(face,new RoundedBoxGeometry(.035,.047,.014,2,.007),iris,side*.092,.255,-.202);eyeParts.push(pupil);
    const lid=part(face,new RoundedBoxGeometry(.104,.02,.029,2,.007),skin,side*.092,.287,-.194);eyelids.push(lid);
    const brow=part(face,new RoundedBoxGeometry(.115,.026,.022,2,.008),hair,side*.092,.328,-.196);brows.push(brow);
  }
  const nose=part(face,new RoundedBoxGeometry(.045,.06,.035,2,.01),skin,0,.205,-.2);
  const mouth=part(face,new RoundedBoxGeometry(.105,.025,.018,2,.008),lip,0,.145,-.205);
  const hairGroup=new THREE.Group();hairGroup.position.set(0,.23,-.025);face.add(hairGroup);
  function hairStyle(style){
    hairGroup.clear();
    const cap=part(hairGroup,new RoundedBoxGeometry(.405,.13,.37,3,.045),hair,0,.18,.02);
    const fringe=part(hairGroup,new RoundedBoxGeometry(.38,.1,.08,3,.025),hair,style==='swept'?-.035:0,.105,-.17);fringe.rotation.z=style==='swept'?-.16:0;
    if(style==='curly')for(let i=0;i<24;i++){
      const a=i*2.399,r=.06+i%4*.031;
      const lock=part(hairGroup,sphere(.036),hair,Math.cos(a)*r,.145+i%3*.012,Math.sin(a)*r-.025);
      lock.scale.set(.9,.72,.9);
    }
    else if(style==='tied'){
      const bun=part(hairGroup,sphere(.063),hair,0,.09,.17);bun.scale.set(1,.82,.83);
    }
  }
  hairStyle('short');let currentEmote='idle';
  const animator=new Animator(figure,buildClips()),bones=body.bones;
  let blinkTimer=2,mood='calm';
  // Weapons (ChatGPT Sites models) ride in the right hand; the equipped one shows.
  const weaponMat=new THREE.MeshStandardMaterial({color:0x9a8359,metalness:.25,roughness:.7}),weaponDark=new THREE.MeshStandardMaterial({color:0x3a3128,roughness:1});
  const groveblade=new THREE.Group(),stonebreaker=new THREE.Group();body.bones.RightHand.add(groveblade,stonebreaker);
  groveblade.rotation.set(0,0,-.12);part(groveblade,new THREE.BoxGeometry(.07,.72,.08),weaponDark,0,-.28,0);const blade=part(groveblade,new THREE.BoxGeometry(.11,.78,.055),weaponMat,0,-.96,0);blade.rotation.z=-.08;
  stonebreaker.rotation.set(0,0,-.08);part(stonebreaker,new THREE.BoxGeometry(.09,.88,.1),weaponDark,0,-.38,0);part(stonebreaker,new RoundedBoxGeometry(.43,.25,.25,2,.04),weaponMat,0,-.88,0);
  groveblade.visible=stonebreaker.visible=false;
  // The Blender weapons (weapons.js) replace these box stand-ins once loaded;
  // their WeaponBase/WeaponTip markers then become the strike hitbox.
  const IK_BONES=['LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
  const ikRest={q:IK_BONES.map(()=>new THREE.Quaternion()),hipsY:null};
  let current='unarmed';const mounted={};
  const showWeapon=()=>{
    groveblade.visible=!mounted.groveblade&&current==='groveblade';stonebreaker.visible=!mounted.stonebreaker&&current==='stonebreaker';
    for(const [name,m] of Object.entries(mounted))m.group.visible=name===current;
    if(mounted[current]){bones.WeaponBase=mounted[current].base;bones.WeaponTip=mounted[current].tip;}else{delete bones.WeaponBase;delete bones.WeaponTip;}
  };
  loadWeaponModels().then(models=>{for(const name of WEAPON_MODELS)if(models[name])mounted[name]=mountWeapon(body.bones.RightHand,models[name],GRIP[name]);showWeapon();}).catch(e=>console.warn('Weapon models failed to load',e));
  let striking=false;
  return {root,bones,animator,weaponMounts:mounted,setWeapon(w){current=w;showWeapon();},
  /** Attacking, charging or guarding: the striking grip; otherwise the carry grip. */
  setWeaponStance(strike){striking=strike;},
  /** After posing: hold the weapon, and keep it out of the ground. */
  holdWeapon(dt,groundAt){if(mounted[current])holdWeapon(mounted[current],striking,dt,groundAt);},setAppearance(a){
    body.paint(a);
    skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);hair.color.set(HAIR_COLORS[a.hairColor]||HAIR_COLORS.raven);
    hairStyle(HAIR_STYLES.includes(a.hairStyle)?a.hairStyle:'short');
    blockCloth.color.set(SHIRTS[a.shirt]||SHIRTS.moss);blockLeather.color.set(a.outfit==='warden'?0x414a45:0x524537);blockPants.color.set(TROUSERS[a.pants]||TROUSERS.charcoal);
    eyeParts.forEach(p=>p.scale.setScalar(a.face==='round'?1.14:a.face==='sharp'?.87:1));
    brows.forEach((b,i)=>b.rotation.z=(i?1:-1)*(a.face==='sharp'?.17:.04));
  },emote(name){currentEmote=name;},get emoteName(){return currentEmote;},
  /** mood: 'calm' | 'focus' | 'strain' | 'hurt' | 'cheer' drives the face. */
  setMood(next){mood=next;},
  /** Pose the body for this frame, then plant the feet on the terrain. */
  update(dt,groundAt){
    // Undo last frame's foot placement first. Clips that do not key the legs
    // (idle, for one) would otherwise keep each frame's correction and stack
    // them, until a leg twists up past the head.
    if(ikRest.hipsY!==null){ikRest.q.forEach((q,i)=>bones[IK_BONES[i]].quaternion.copy(q));bones.Hips.position.y=ikRest.hipsY;}
    animator.update(dt);
    IK_BONES.forEach((n,i)=>ikRest.q[i].copy(bones[n].quaternion));ikRest.hipsY=bones.Hips.position.y;
    root.updateMatrixWorld(true);
    if(groundAt){
      const base=root.position.y,lifts=[];
      for(const side of ['Left','Right']){
        const ankle=bones[side+'Foot'].getWorldPosition(new THREE.Vector3());
        const planted=THREE.MathUtils.clamp(1-(ankle.y-base-.13)/.22,0,1);
        lifts.push(THREE.MathUtils.clamp(groundAt(ankle.x,ankle.z)-base,-.4,.4)*planted);
      }
      // Drop the hips for a downhill foot so the leg can reach it.
      const drop=Math.min(0,...lifts);
      if(drop<0){bones.Hips.position.y+=drop;root.updateMatrixWorld(true);}
      ['Left','Right'].forEach((side,i)=>solveLeg(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],lifts[i]-drop));
    }
    blinkTimer-=dt;if(blinkTimer<0)blinkTimer=2.4+Math.random()*2.8;
    const squint=mood==='hurt'?.9:mood==='strain'?.45:mood==='focus'?.3:0;
    const blink=blinkTimer<.12?.86:.19;
    eyelids.forEach(lid=>lid.scale.y=smooth(lid.scale.y,Math.max(blink,.19+squint*.6),dt*2));
    brows.forEach((b,i)=>{b.position.y=smooth(b.position.y,.314-(mood==='focus'||mood==='strain'?.012:0)+(mood==='hurt'?.01:0),dt*2);});
    mouth.scale.y=smooth(mouth.scale.y,mood==='strain'?.45:mood==='hurt'?.55:mood==='cheer'?.62:.12,dt*2);
    mouth.scale.x=smooth(mouth.scale.x,mood==='strain'?1.35:1.2,dt*2);
  },
  flicker(time,invuln){root.visible=!(invuln>0&&Math.floor(time*15)%3===0);}
  };
}

// First-person arms. They play clips keyed to exactly the same timeline as the
// body's strikes (see combat/moves.js), so a first-person palm lands on the
// same frame as a third-person one. Values are camera-space [x,y,z,rx,ry,rz]
// with the forearm pointing along -Z.
const FP_GUARD={L:[-.3,-.28,-.62,.45,-.2,-.16],R:[.32,-.3,-.58,.48,.2,.16],Leg:[.12,-1.6,-.4,-.4,0,0]};
const fp=(o)=>({...FP_GUARD,...o});
const FP_CLIPS={
  fp_heavy:[[0,FP_GUARD],[.16,fp({L:[-.34,-.18,-.38,-.35,-.45,-.18],R:[.35,-.18,-.38,-.35,.45,.18]})],
    [.3,fp({L:[-.2,.02,-.35,-1.05,-.25,-.12],R:[.2,.02,-.35,-1.05,.25,.12]})],
    [.42,fp({L:[-.08,-.27,-1.08,.28,-.08,-.08],R:[.09,-.28,-1.05,.3,.08,.08]})],
    [.52,fp({L:[-.08,-.3,-1.02,.34,-.08,-.08],R:[.09,-.31,-1,.36,.08,.08]})],[.78,FP_GUARD],[1.02,FP_GUARD]],
  fp_palm:[[0,FP_GUARD],[.07,fp({L:[-.3,-.38,-.4,.7,-.3,-.25]})],[.12,fp({L:[-.06,-.24,-.98,.08,-.05,-.1],R:[.34,-.44,-.42,1.1,.35,.3]})],
    [.19,fp({L:[-.07,-.25,-.95,.1,-.05,-.1]})],[.32,fp({L:[-.2,-.32,-.62,.6,-.2,-.2]})],[.46,FP_GUARD]],
  fp_swing:[[0,FP_GUARD],[.12,fp({R:[.62,-.3,-.3,.35,-.55,.2],L:[-.3,-.36,-.5,1,-.3,-.25]})],[.2,fp({R:[.08,-.2,-.78,.25,1.25,-.15]})],
    [.26,fp({R:[-.3,-.24,-.62,.3,1.55,-.2]})],[.42,fp({R:[.2,-.38,-.5,.9,.6,.2]})],[.6,FP_GUARD]],
  fp_heel:[[0,FP_GUARD],[.16,fp({Leg:[.14,-.95,-.5,.6,0,0],L:[-.42,-.32,-.46,.9,-.4,-.4],R:[.44,-.36,-.42,.9,.4,.4]})],
    [.27,fp({Leg:[.1,-.56,-1.15,-.15,0,0],L:[-.5,-.3,-.44,.8,-.5,-.6],R:[.52,-.34,-.4,.8,.5,.6]})],[.34,fp({Leg:[.1,-.58,-1.12,-.12,0,0],L:[-.5,-.3,-.44,.8,-.5,-.6],R:[.52,-.34,-.4,.8,.5,.6]})],
    [.47,fp({Leg:[.14,-.95,-.55,.5,0,0]})],[.62,FP_GUARD],[.82,FP_GUARD]],
  fp_evade:[[0,FP_GUARD],[.16,fp({L:[-.22,-.3,-.44,1.25,-.2,-.2],R:[.24,-.34,-.4,1.3,.25,.25]})],[.28,fp({L:[-.22,-.3,-.44,1.25,-.2,-.2],R:[.24,-.34,-.4,1.3,.25,.25]})],[.5,FP_GUARD]],
  fp_hurt:[[0,FP_GUARD],[.07,fp({L:[-.42,-.2,-.44,1.4,-.6,-.6],R:[.46,-.24,-.42,1.3,.6,.6]})],[.42,FP_GUARD]],
  fp_guard:[[0,FP_GUARD],[.7,fp({L:[-.27,-.35,-.52,.66,-.25,-.2],R:[.3,-.41,-.46,.71,.3,.25]})],[1.4,FP_GUARD]]
};
function fpClip(name,keys){
  const times=keys.map(k=>k[0]),tracks=[],q=new THREE.Quaternion(),e=new THREE.Euler();
  for(const part of ['L','R','Leg']){
    tracks.push(new THREE.VectorKeyframeTrack(`fp${part}.position`,times,keys.flatMap(k=>k[1][part].slice(0,3))));
    tracks.push(new THREE.QuaternionKeyframeTrack(`fp${part}.quaternion`,times,keys.flatMap(k=>{const v=k[1][part];q.setFromEuler(e.set(v[3],v[4],v[5]));return [q.x,q.y,q.z,q.w];})));
  }
  return new THREE.AnimationClip(name,times[times.length-1],tracks);
}
export function createFirstPersonHands(camera){
  const group=new THREE.Group();camera.add(group);
  // Keep the guard below the sight line. The authored explorer still supplies
  // the world-space strike pose and hitbox; this rig only frames the action.
  group.position.set(0,-.12,-.24);group.scale.setScalar(.75);
  const shirt=new THREE.MeshStandardMaterial({color:SHIRTS.moss,roughness:1});
  const skin=new THREE.MeshStandardMaterial({color:SKIN_TONES[2],roughness:.94});
  const leather=new THREE.MeshStandardMaterial({color:'#524537',roughness:.9});
  const seam=new THREE.MeshStandardMaterial({color:'#8b7551',roughness:.95});
  const trousers=new THREE.MeshStandardMaterial({color:TROUSERS.charcoal,roughness:1});
  const boot=new THREE.MeshStandardMaterial({color:'#292d28',roughness:1});
  // A deliberate block style, matching the low-poly world. No faux fingers
  // or floating knuckles; the sleeve, cuff and hand form one clear silhouette.
  function arm(name){
    const g=new THREE.Group();g.name=name;group.add(g);
    part(g,new THREE.BoxGeometry(.22,.22,.64),shirt,0,0,.21);
    part(g,new THREE.BoxGeometry(.235,.235,.09),leather,0,0,-.15);
    part(g,new THREE.BoxGeometry(.18,.18,.15),skin,0,0,-.275);
    part(g,new THREE.BoxGeometry(.23,.012,.015),seam,0,.118,-.14);
    return g;
  }
  arm('fpL');const fpR=arm('fpR');
  // First-person weapons extend forward from the right fist.
  const metal=new THREE.MeshStandardMaterial({color:0x9a8359,metalness:.25,roughness:.7}),grip=new THREE.MeshStandardMaterial({color:0x3a3128,roughness:1});
  const fpBlade=new THREE.Group(),fpHammer=new THREE.Group();fpR.add(fpBlade,fpHammer);
  part(fpBlade,new THREE.BoxGeometry(.07,.07,.3),grip,0,0,-.38);part(fpBlade,new THREE.BoxGeometry(.05,.11,.9),metal,0,0,-.98);
  part(fpHammer,new THREE.BoxGeometry(.08,.08,.8),grip,0,0,-.66);part(fpHammer,new THREE.BoxGeometry(.28,.26,.42),metal,0,0,-1.1);
  fpBlade.visible=fpHammer.visible=false;
  let fpCurrent='unarmed';const fpMounted={};
  const showFp=()=>{fpBlade.visible=!fpMounted.groveblade&&fpCurrent==='groveblade';fpHammer.visible=!fpMounted.stonebreaker&&fpCurrent==='stonebreaker';for(const [name,m] of Object.entries(fpMounted))m.group.visible=name===fpCurrent;};
  loadWeaponModels().then(models=>{for(const name of WEAPON_MODELS)if(models[name]){fpMounted[name]=mountWeapon(fpR,models[name],FP_GRIP[name]);fpMounted[name].group.traverse(o=>{if(o.isMesh)o.castShadow=false;});}showFp();}).catch(()=>{});
  const leg=new THREE.Group();leg.name='fpLeg';group.add(leg);
  part(leg,new THREE.BoxGeometry(.2,.2,.53),trousers,0,0,.2);
  part(leg,new THREE.BoxGeometry(.22,.17,.29),boot,0,-.01,-.18);
  group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  const animator=new Animator(group,Object.entries(FP_CLIPS).map(([n,k])=>fpClip(n,k)));
  return {group,weaponMounts:fpMounted,setWeapon(w){fpCurrent=w;showFp();},setAppearance(a){shirt.color.set(SHIRTS[a.shirt]||SHIRTS.moss);skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);trousers.color.set(TROUSERS[a.pants]||TROUSERS.charcoal);leather.color.set(a.outfit==='warden'?'#4a4b43':'#524537');},
    update(dt,combat,guarded,frozen){
      const clip=combat.clip(),map={palm:'fp_palm',swing:'fp_swing',heel:'fp_heel',rootbreaker:'fp_heavy',hurt:'fp_hurt'};
      const fpName=clip&&(clip.name.startsWith('evade')?'fp_evade':clip.fp||map[clip.name]);
      if(fpName)animator.play(fpName,clip.time,clip.fade);else animator.stop();
      animator.setLocomotion({fp_guard:1},frozen?0:dt/1.4);
      animator.update(dt);
    }};
}
