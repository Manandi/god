import * as THREE from 'three';
import {createHumanoid} from './humanoid.js';
import {Animator,solveLeg} from './anim/animator.js';
import {buildClips} from './anim/clips.js';

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
  const animator=new Animator(figure,buildClips()),bones=body.bones;
  let blinkTimer=2,mood='calm';
  return {root,bones,animator,setAppearance(a){
    body.paint(a);
    skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);hair.color.set(HAIR_COLORS[a.hairColor]||HAIR_COLORS.raven);
    hairStyle(HAIR_STYLES.includes(a.hairStyle)?a.hairStyle:'short');
    eyeParts.forEach(p=>p.scale.setScalar(a.face==='round'?1.14:a.face==='sharp'?.87:1));
    brows.forEach((b,i)=>b.rotation.z=(i?1:-1)*(a.face==='sharp'?.17:.04));
  },emote(name){currentEmote=name;},get emoteName(){return currentEmote;},
  /** mood: 'calm' | 'focus' | 'strain' | 'hurt' | 'cheer' drives the face. */
  setMood(next){mood=next;},
  /** Pose the body for this frame, then plant the feet on the terrain. */
  update(dt,groundAt){
    animator.update(dt);
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
const FP_GUARD={L:[-.27,-.34,-.52,.95,-.25,-.2],R:[.3,-.4,-.46,1.05,.3,.25],Leg:[.12,-1.6,-.4,-.4,0,0]};
const fp=(o)=>({...FP_GUARD,...o});
const FP_CLIPS={
  fp_palm:[[0,FP_GUARD],[.07,fp({L:[-.3,-.38,-.4,.7,-.3,-.25]})],[.12,fp({L:[-.06,-.24,-.98,.08,-.05,-.1],R:[.34,-.44,-.42,1.1,.35,.3]})],
    [.19,fp({L:[-.07,-.25,-.95,.1,-.05,-.1]})],[.32,fp({L:[-.2,-.32,-.62,.6,-.2,-.2]})],[.46,FP_GUARD]],
  fp_swing:[[0,FP_GUARD],[.12,fp({R:[.62,-.3,-.3,.35,-.55,.2],L:[-.3,-.36,-.5,1,-.3,-.25]})],[.2,fp({R:[.08,-.2,-.78,.25,1.25,-.15]})],
    [.26,fp({R:[-.3,-.24,-.62,.3,1.55,-.2]})],[.42,fp({R:[.2,-.38,-.5,.9,.6,.2]})],[.6,FP_GUARD]],
  fp_heel:[[0,FP_GUARD],[.16,fp({Leg:[.14,-.95,-.5,.6,0,0],L:[-.42,-.32,-.46,.9,-.4,-.4],R:[.44,-.36,-.42,.9,.4,.4]})],
    [.27,fp({Leg:[.1,-.56,-1.15,-.15,0,0],L:[-.5,-.3,-.44,.8,-.5,-.6],R:[.52,-.34,-.4,.8,.5,.6]})],[.34,fp({Leg:[.1,-.58,-1.12,-.12,0,0],L:[-.5,-.3,-.44,.8,-.5,-.6],R:[.52,-.34,-.4,.8,.5,.6]})],
    [.47,fp({Leg:[.14,-.95,-.55,.5,0,0]})],[.62,FP_GUARD],[.82,FP_GUARD]],
  fp_evade:[[0,FP_GUARD],[.16,fp({L:[-.22,-.3,-.44,1.25,-.2,-.2],R:[.24,-.34,-.4,1.3,.25,.25]})],[.28,fp({L:[-.22,-.3,-.44,1.25,-.2,-.2],R:[.24,-.34,-.4,1.3,.25,.25]})],[.5,FP_GUARD]],
  fp_hurt:[[0,FP_GUARD],[.07,fp({L:[-.42,-.2,-.44,1.4,-.6,-.6],R:[.46,-.24,-.42,1.3,.6,.6]})],[.42,FP_GUARD]],
  fp_guard:[[0,FP_GUARD],[.7,fp({L:[-.27,-.35,-.52,.93,-.25,-.2],R:[.3,-.41,-.46,1.03,.3,.25]})],[1.4,FP_GUARD]]
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
  const shirt=new THREE.MeshStandardMaterial({color:SHIRTS.moss,roughness:.94});
  const skin=new THREE.MeshStandardMaterial({color:SKIN_TONES[2],roughness:.89});
  const trousers=new THREE.MeshStandardMaterial({color:TROUSERS.charcoal,roughness:.95});
  const boot=new THREE.MeshStandardMaterial({color:'#242b25',roughness:1});
  function arm(name,side){
    const g=new THREE.Group();g.name=name;group.add(g);
    // Sleeve runs back toward the shoulder, off screen; forearm and fist lead.
    const sleeve=part(g,new THREE.CapsuleGeometry(.075,.34,6,14),shirt,side*.02,.02,.3);sleeve.rotation.x=Math.PI/2;
    const fore=part(g,new THREE.CapsuleGeometry(.058,.2,6,14),skin,0,0,.02);fore.rotation.x=Math.PI/2;
    const fist=part(g,new THREE.SphereGeometry(.078,18,14),skin,0,.005,-.13);fist.scale.set(1.05,.85,1.05);
    for(let i=0;i<4;i++)part(g,new THREE.SphereGeometry(.024,10,8),skin,-.05+i*.033,.035,-.185);
    return g;
  }
  arm('fpL',-1);arm('fpR',1);
  const leg=new THREE.Group();leg.name='fpLeg';group.add(leg);
  const shin=part(leg,new THREE.CapsuleGeometry(.09,.5,6,14),trousers,0,0,.2);shin.rotation.x=Math.PI/2;
  const sole=part(leg,new THREE.SphereGeometry(.13,16,12),boot,0,.02,-.16);sole.scale.set(.9,.7,1.3);
  const animator=new Animator(group,Object.entries(FP_CLIPS).map(([n,k])=>fpClip(n,k)));
  return {group,setAppearance(a){shirt.color.set(SHIRTS[a.shirt]||SHIRTS.moss);skin.color.set(SKIN_TONES[a.skinIndex]||SKIN_TONES[2]);trousers.color.set(TROUSERS[a.pants]||TROUSERS.charcoal);},
    update(dt,combat,guarded,frozen){
      const clip=combat.clip(),map={palm:'fp_palm',swing:'fp_swing',heel:'fp_heel',hurt:'fp_hurt'};
      if(clip)animator.play(clip.name.startsWith('evade')?'fp_evade':map[clip.name],clip.time,clip.fade);else animator.stop();
      animator.setLocomotion({fp_guard:1},frozen?0:dt/1.4);
      animator.update(dt);
    }};
}
