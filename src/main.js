import * as THREE from 'three';
import { buildWorld, groundY, SITES, GATE } from './world.js';
import { createCreatures } from './creatures.js';
import { createNpcs,updateNpcs,nearestNpc,conversationFor,answerNpc } from './npcs.js';
import { createAvatar,createFirstPersonHands } from './avatar.js';
import { loadExplorer as loadCustomExplorer } from './avatarGLB.js';
import { loadKayKit } from './avatarKayKit.js';
import { createCollisionGrid,moveWithCollision } from './collision.js';
import { createGlobe } from './globe.js';
import { createShell } from './shell.js';
import { profile,stats,saveProfile,weaponEligibility,CLASS_INFO } from './profile.js';
import { PlayerCombat } from './combat/player.js';
import { MOVES,GUARD } from './combat/moves.js';
import { CombatSound,ImpactEffects } from './combat/feedback.js';
import { CombatDebug } from './combat/debug.js';
import { createMultiplayer } from './multiplayer.js';
import './style.css';
import './menu.css';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const canvas=$('game'),journal=$('journal'),ending=$('ending'),entry=$('entry'),dialogue=$('dialogue');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
let pixelRatio=Math.min(devicePixelRatio,1.25);
renderer.setPixelRatio(pixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);
const perfPanel=document.createElement('pre');
Object.assign(perfPanel.style,{position:'fixed',right:'16px',bottom:'58px',padding:'9px 12px',margin:0,zIndex:12,pointerEvents:'none',
  color:'#d5edd5',background:'#091b19e8',font:'11px/1.5 monospace',border:'1px solid #72997a',display:'none'});
document.body.appendChild(perfPanel);
let showPerf=false;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.43;
const scene=new THREE.Scene();const world=buildWorld(scene),creatures=createCreatures(scene),npcs=createNpcs(scene);
world.updateLanternLights(world.home.spawn.x,world.home.spawn.z);
world.colliders.push(...npcs.map(n=>({x:n.x,z:n.z,r:.42,top:groundY(n.x,n.z)+2.2})));
const collisionGrid=createCollisionGrid(world.colliders);
const globe=createGlobe();let shell;
const camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,.08,540);camera.rotation.order='YXZ';
// The procedural body shows until the authored explorer has loaded, and stays
// as the fallback if it cannot load.
let avatar=createAvatar(scene);const raycaster=new THREE.Raycaster();
const combat=new PlayerCombat(),sound=new CombatSound(),effects=new ImpactEffects(scene),debug=new CombatDebug(scene);
const player={x:world.home.spawn.x,z:world.home.spawn.z,yaw:0,cameraYaw:0,pitch:0,health:4,stamina:100,step:0,height:0,velocityY:0,grounded:true,jumpCount:0,vx:0,vz:0,thirdPerson:params.has('third'),zoom:5.2,emote:'idle',engaged:0,jumpT:9,landT:9,interactT:9,airTime:0,defeated:0,charging:false,heavyCharge:0,heavyPower:1};
const keyState=new Set();let started=false,paused=true,done=false,journalOpen=false,toastTimer=0,elapsed=0,audio,hitstop=0,lockTarget=null;
const devPanel=$('devPanel'),dev={open:false,invulnerable:false,noclip:false,showColliders:false};
let viewBlend=0,viewFromPosition=new THREE.Vector3(),viewFromRotation=new THREE.Quaternion();
let cueText='',cueUntil=0,cameraKick=0;

let save;try{save=JSON.parse(localStorage.getItem('verdant-reach-3d-v1')||'{}');}catch{save={};}
const memories=new Set(Array.isArray(save.memories)?save.memories.filter(v=>SITES.some(s=>s.id===v)):[]);
const QUESTS=[
  {id:'water-remembers',giver:'sela',site:'rootwell',title:'THE WATER REMEMBERS',
    opening:'The Rootwell has gone silent beneath three hungry guardians. Clear the spring and listen to what its water kept.',
    accept:'I will clear the Rootwell.',accepted:'Follow the south-west lantern road. Do not touch the memory until every guardian is still.',
    turnin:'I heard the Rootwell memory.',complete:'Then you heard our beginning: Mossgate was founded by refugees who chose shelter over conquest.'},
  {id:'broken-oath',giver:'orin',site:'ruins',title:'THE BROKEN OATH',
    opening:'Mosswatch was our shield before pride hollowed it out. Its memory is surrounded. Bring the truth back to me.',
    accept:'I will reclaim Mosswatch.',accepted:'Break the pack around the ruins. The stones will show you why the old wardens failed.',
    turnin:'I saw what happened at Mosswatch.',complete:'We obeyed a distant crown and abandoned our neighbors. Mossgate survives because we never made that choice again.'},
  {id:'name-beneath-bark',giver:'mycel',site:'shrine',title:'THE NAME BENEATH BARK',
    opening:'The Elder Crown guards the last name of this forest. Its memory has drawn a final pack. Wake it, and our road opens.',
    accept:'I will wake the Elder Crown.',accepted:'The oldest trail runs south. Clear its guardians, then let the memory speak before you approach the Canopy Gate.',
    turnin:'The Elder Crown spoke its name.',complete:'Verdant Reach was once called Avarra—the refuge that remembers every promise. Carry that name through the gate.'},
  {id:'old-shell',giver:'orin',site:'boss',title:'HUNT OF THE OLD SHELL',
    opening:'The Old Shell has nested before the Canopy Gate. Its armour remembers every failed hunter. Break the shell, survive the quake, and clear our road.',
    accept:'I will hunt the Old Shell.',accepted:'Follow the oldest southern trail. Its shell turns light blows—strike the head, or use a charged Stonebreaker to crack its back.',
    turnin:'The Old Shell is defeated.',complete:'That was no wandering beast. You read its tells, broke its armour, and returned. The Canopy Gate now recognizes a hunter of Mossgate.'}
];
const boss=creatures.find(c=>c.isBoss);
const questDone=q=>q.site==='boss'?!boss?.alive:memories.has(q.site);
const completedQuests=new Set(Array.isArray(save.completedQuests)?save.completedQuests:[]);
let activeQuest=QUESTS.some(q=>q.id===save.activeQuest)?save.activeQuest:'';
const coop=createMultiplayer(scene,player,{name:profile.name||'Wayfarer',onSharedState:shared=>{
  for(const id of shared.memories||[]){memories.add(id);const echo=world.echoes.find(e=>e.id===id);if(echo){echo.crystal.visible=false;echo.ring.visible=false;echo.light.visible=false;}}
  for(const id of shared.completed||[])completedQuests.add(id);
  if(!activeQuest&&shared.activeQuest&&!completedQuests.has(shared.activeQuest)&&QUESTS.some(q=>q.id===shared.activeQuest))activeQuest=shared.activeQuest;
  if(shared.bossDefeated&&boss?.alive){boss.health=0;boss.alive=false;boss.setState('defeated');}
  persist();
}});
npcs.forEach(npc=>{npc.stance=save.npcStances?.[npc.id]||'';});
world.echoes.forEach(e=>{if(memories.has(e.id)){e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;}});
const hands=createFirstPersonHands(camera);scene.add(camera);
const FX=new THREE.Group();scene.add(FX);
const collisionViz=new THREE.Group(),collisionVizMeshes=[];
const collisionVizGeometry=new THREE.RingGeometry(.92,1,28),collisionVizMaterial=new THREE.MeshBasicMaterial({color:0xffc86a,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false});
for(let i=0;i<48;i++){const marker=new THREE.Mesh(collisionVizGeometry,collisionVizMaterial);marker.rotation.x=-Math.PI/2;marker.visible=false;collisionViz.add(marker);collisionVizMeshes.push(marker);}collisionViz.visible=false;scene.add(collisionViz);
const motes=[];for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,6,5),new THREE.MeshBasicMaterial({color:0xc4efb0,transparent:true,opacity:.6}));
  mesh.position.set((Math.random()-.5)*20,1+Math.random()*7,(Math.random()-.5)*20);FX.add(mesh);motes.push(mesh);
}
// A small diamond over the locked creature: enough to read, never in the way.
const lockMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0xf3e6b0,transparent:true,opacity:.9,depthTest:true}));
lockMarker.renderOrder=12;lockMarker.scale.set(1,1.6,1);scene.add(lockMarker);lockMarker.visible=false;

function playTone(freq=140,duration=.1,volume=.04,type='sine'){
  if(!audio)return;
  const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.5),audio.currentTime+duration);
  g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
  o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration+.01);
}
function initAudio(){
  if(audio){audio.resume();return;}
  try{audio=new AudioContext();sound.attach(audio);const hum=audio.createOscillator(),gain=audio.createGain();hum.type='sine';hum.frequency.value=73;gain.gain.value=.014;hum.connect(gain).connect(audio.destination);hum.start();
    const breeze=audio.createOscillator(),g2=audio.createGain();breeze.type='triangle';breeze.frequency.value=108;g2.gain.value=.006;breeze.connect(g2).connect(audio.destination);breeze.start();
  }catch{/* Sound is optional on unsupported browsers. */}
}
function toast(title,detail='',kind=''){$('toast').innerHTML=title+(detail?`<small>${detail}</small>`:'');$('toast').classList.toggle('dialogue',kind==='dialogue');$('toast').classList.remove('hidden');toastTimer=kind==='dialogue'?6:3.5;}
let conversation=null;
function renderConversation(){
  if(!conversation){dialogue.classList.add('hidden');dialogue.innerHTML='';return;}
  const {npc,data,stage,reply}=conversation;
  const choices=stage==='choices'?`<div class="dialogue-choices">${data.choices.map((choice,i)=>`<button data-choice="${i}"><b>${i+1}</b>${choice}</button>`).join('')}</div>`:'';
  const body=stage==='reply'?reply:data.line;
  dialogue.innerHTML=`<section class="dialogue-card"><div class="dialogue-copy"><small>${npc.role.toUpperCase()}</small><h2>${npc.name}</h2><p>${body}</p>${choices}<em>${stage==='choices'?'Choose your response.':'LEFT CLICK TO CONTINUE'}</em></div></section>`;
  dialogue.classList.remove('hidden');
  dialogue.querySelectorAll('[data-choice]').forEach(button=>button.onclick=e=>{e.stopPropagation();chooseResponse(Number(button.dataset.choice));});
}
function availableQuest(){return QUESTS.find((q,i)=>!completedQuests.has(q.id)&&(i===0||completedQuests.has(QUESTS[i-1].id)));}
function questConversation(npc){
  const q=QUESTS.find(item=>item.giver===npc.id&&(item.id===activeQuest||(!activeQuest&&item===availableQuest())));if(!q)return null;
  if(activeQuest===q.id&&questDone(q))return{opening:q.complete,action:`quest-turnin:${q.id}`,label:q.turnin,reply:q.complete};
  if(activeQuest===q.id)return{opening:q.opening,action:`quest-remind:${q.id}`,label:'Remind me where to go.',reply:q.accepted};
  return{opening:q.opening,action:`quest-accept:${q.id}`,label:q.accept,reply:q.accepted};
}
function beginConversation(npc){
  conversation={npc,data:conversationFor(npc,questConversation(npc)),stage:'opening',reply:''};paused=true;
  npc.expression='listening';
  if(document.pointerLockElement)document.exitPointerLock();renderConversation();
}
function chooseResponse(index){
  if(!conversation)return;const answer=answerNpc(conversation.npc,index,conversation.data);const key=answer.key;
  if(key.startsWith('quest-accept:')){activeQuest=key.split(':')[1];toast('STORY QUEST ACCEPTED',QUESTS.find(q=>q.id===activeQuest)?.title||'Follow the lantern road.');}
  if(key.startsWith('quest-turnin:')){const id=key.split(':')[1];completedQuests.add(id);activeQuest='';const next=availableQuest();if(next)answer.reply+=` ${npcs.find(n=>n.id===next.giver)?.name||'Someone in Mossgate'} now carries the next chapter.`;else answer.reply+=' The Canopy Gate is ready for you.';}
  conversation.npc.expression=key.startsWith('quest-')?'resolved':key==='doubt'||key==='boast'?'stern':'warm';
  conversation.stage='reply';conversation.reply=answer.reply;persist();renderConversation();playTone(430,.08,.025,'triangle');
}
function advanceConversation(){
  if(!conversation)return;
  if(conversation.stage==='opening'){conversation.stage='choices';renderConversation();return;}
  if(conversation.stage==='choices')return;
  conversation.npc.expression='neutral';conversation=null;renderConversation();resume();
}
dialogue.addEventListener('click',advanceConversation);
function persist(){try{localStorage.setItem('verdant-reach-3d-v1',JSON.stringify({memories:[...memories],npcStances:Object.fromEntries(npcs.map(n=>[n.id,n.stance])),activeQuest,completedQuests:[...completedQuests]}));}catch{/* No storage available. */}}
function teleportPlayer(x,z,label='TEST POINT'){
  player.x=x;player.z=z;player.height=0;player.velocityY=0;player.vx=0;player.vz=0;player.grounded=true;player.jumpCount=0;player.defeated=0;cameraKick=0;viewBlend=0;lockTarget=null;
  combat.state='move';combat.t=0;toast(`DEV · ${label}`,'Position recovered on solid terrain.');updateDevTelemetry();
}
function updateCollisionViz(){
  if(!dev.showColliders){collisionViz.visible=false;return;}
  collisionViz.visible=true;
  const nearby=collisionGrid.near(player.x,player.z).filter((o,i,a)=>a.indexOf(o)===i).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  collisionVizMeshes.forEach((marker,i)=>{const c=nearby[i];marker.visible=!!c;if(!c)return;marker.position.set(c.x,groundY(c.x,c.z)+.055,c.z);marker.scale.setScalar(c.r+.43);});
}
function updateDevTelemetry(){
  if(!devPanel)return;const s=stats(),near=collisionGrid.near(player.x,player.z).filter((o,i,a)=>a.indexOf(o)===i);
  $('devTelemetry').textContent=`X ${player.x.toFixed(2)}   Z ${player.z.toFixed(2)}\nGROUND ${groundY(player.x,player.z).toFixed(2)}   HEIGHT ${player.height.toFixed(2)}\nGROUNDED ${player.grounded?'YES':'NO'}   NEAR COLLIDERS ${near.length}\nSTR ${s.strength}  SPD ${s.speed}  STA ${s.stamina}  DEF ${s.defense}\n${dev.invulnerable?'INVULNERABLE · ':''}${dev.noclip?'NO COLLISION · ':''}${dev.showColliders?'COLLIDERS VISIBLE':''}`;
  for(const button of devPanel.querySelectorAll('[data-dev]'))button.classList.toggle('active',(button.dataset.dev==='invulnerable'&&dev.invulnerable)||(button.dataset.dev==='noclip'&&dev.noclip)||(button.dataset.dev==='colliders'&&dev.showColliders));
}
function toggleDev(open=!dev.open){
  dev.open=open;devPanel.classList.toggle('hidden',!open);keyState.clear();player.charging=false;
  if(open){paused=true;if(document.pointerLockElement)document.exitPointerLock();updateDevTelemetry();}
  else if(started){paused=false;shell?.hide();$('hud').classList.remove('hidden');canvas.requestPointerLock?.()?.catch?.(()=>{});}
}
const DEV_DESTINATIONS={
  home:()=>[world.home.spawn.x,world.home.spawn.z,'HOME BASE'],city:()=>[0,45,'MOSSGATE'],
  rootwell:()=>[-56,-34,'ROOTWELL ENTRANCE'],ruins:()=>[63,-76,'MOSSWATCH'],shrine:()=>[-12,-137,'ELDER CROWN'],boss:()=>[18,-165,'BOSS ARENA']
};
$('devButton').onclick=event=>{event.stopPropagation();toggleDev(true);};
devPanel.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;event.stopPropagation();
  if(button.dataset.teleport){const [x,z,label]=DEV_DESTINATIONS[button.dataset.teleport]();teleportPlayer(x,z,label);return;}
  if(button.dataset.preset){
    const sets={default:{pushups:15,pullups:5,dashSeconds:5.5,verticalJumpCm:40,mileSeconds:600,restingHeartRate:68,plankSeconds:90,benchPressKg:60,sleepHours:7},athlete:{pushups:40,pullups:12,dashSeconds:4.9,verticalJumpCm:55,mileSeconds:480,restingHeartRate:58,plankSeconds:180,benchPressKg:90,sleepHours:8},max:{pushups:60,pullups:22,dashSeconds:4.4,verticalJumpCm:70,mileSeconds:360,restingHeartRate:45,plankSeconds:300,benchPressKg:130,sleepHours:8.5}};
    Object.assign(profile.inputs,sets[button.dataset.preset]);saveProfile();player.health=maxHealth();player.stamina=100;toast('DEV · STAT PRESET',button.dataset.preset.toUpperCase());updateDevTelemetry();return;
  }
  const action=button.dataset.dev;
  if(action==='close'){toggleDev(false);return;}
  if(action==='reset'){teleportPlayer(world.home.spawn.x,world.home.spawn.z,'UNSTUCK');return;}
  if(action==='heal'){player.health=maxHealth();player.stamina=100;player.defeated=0;toast('DEV · RESTORED');}
  if(action==='invulnerable')dev.invulnerable=!dev.invulnerable;
  if(action==='noclip')dev.noclip=!dev.noclip;
  if(action==='colliders'){dev.showColliders=!dev.showColliders;updateCollisionViz();}
  if(action==='accept-next'){const q=availableQuest();if(q){activeQuest=q.id;toast('DEV · QUEST ACCEPTED',q.title);persist();}else toast('DEV','No available chapter.');}
  if(action==='defeat-nearby'){let count=0;for(const c of creatures)if(c.alive&&Math.hypot(c.x-player.x,c.z-player.z)<28){c.health=0;c.alive=false;c.setState('defeated');count++;}toast('DEV · ENCOUNTER CLEARED',`${count} target${count===1?'':'s'} defeated.`);}
  if(action==='unlock-memories'){for(const echo of world.echoes){memories.add(echo.id);echo.crystal.visible=echo.ring.visible=echo.light.visible=false;}toast('DEV · MEMORIES UNLOCKED');persist();}
  if(action==='reset-world'){memories.clear();completedQuests.clear();activeQuest='';for(const echo of world.echoes)echo.crystal.visible=echo.ring.visible=echo.light.visible=true;for(const c of creatures)c.respawn();toast('DEV · QUEST WORLD RESET');persist();}
  updateDevTelemetry();
});
function updateJournal(){
  const questEntries=QUESTS.map((q,i)=>{const done=completedQuests.has(q.id),active=activeQuest===q.id;return `<article class="${done||active?'':'unknown'}"><strong>CHAPTER ${i+1} · ${done?'COMPLETE':active?'ACTIVE':'LOCKED'}</strong>${done||active?q.title:'Continue the story in Mossgate.'}</article>`;}).join('');
  $('journalEntries').innerHTML=questEntries+SITES.map((site,i)=>{
    const found=memories.has(site.id);
    return `<article class="${found?'':'unknown'}"><strong>${String(i+1).padStart(2,'0')} · ${found?site.title:'UNDISCOVERED'}</strong>${found?site.story:'A memory waits somewhere beyond the old trail.'}</article>`;
  }).join('');
}
function toggleJournal(open){journalOpen=open;journal.classList.toggle('hidden',!open);updateJournal();if(open){paused=true;if(document.pointerLockElement)document.exitPointerLock();}else resume();}
function resume(){if(!started)player.health=maxHealth();started=true;dev.open=false;devPanel.classList.add('hidden');paused=false;shell.hide();$('hud').classList.remove('hidden');journal.classList.add('hidden');journalOpen=false;initAudio();canvas.requestPointerLock?.()?.catch?.(()=>{});}
$('closeJournal').onclick=()=>toggleJournal(false);
$('continueExploring').onclick=()=>{ending.classList.add('hidden');done=false;resume();};
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&started&&!journalOpen&&!done&&!conversation&&!dev.open&&shell?.view==='game'){paused=true;shell.show('menu');$('hud').classList.add('hidden');}
  else if(document.pointerLockElement){paused=false;shell?.hide();}
});
const endEmote=()=>{if(player.emote!=='idle'){player.emote='idle';avatar.emote('idle');}};
function evadePressed(){if(paused)return;endEmote();combat.press('evade');}
function attackPressed(){if(paused)return;player.charging=false;endEmote();combat.press('attack');}
function beginHeavyCharge(){if(paused||combat.busy)return;endEmote();player.charging=true;player.heavyCharge=0;player.heavyPower=1;cue('HOLD R · ROOTBREAKER CHARGE',.4);}
function heavyPressed(){if(paused)return;endEmote();player.charging=false;player.heavyPower=1+Math.min(.75,player.heavyCharge*.42);combat.press('heavy');}
function cue(text,duration=.4){cueText=text;cueUntil=elapsed+duration;}
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  if(e.code==='F2'&&!e.repeat){e.preventDefault();toggleDev();return;}
  keyState.add(e.code);
  if(conversation){
    if(['Digit1','Digit2','Digit3'].includes(e.code)&&conversation.stage==='choices')chooseResponse(Number(e.code.slice(-1))-1);
    else if((e.code==='KeyE'||e.code==='Space'||e.code==='Enter')&&!e.repeat)advanceConversation();
    else if(e.code==='Escape'){conversation.npc.expression='neutral';conversation=null;renderConversation();resume();}
    return;
  }
  if(e.code==='F3'){e.preventDefault();debug.toggle();return;}
  if(e.code==='F4'){e.preventDefault();showPerf=!showPerf;perfPanel.style.display=showPerf?'block':'none';return;}
  if(e.code==='KeyJ'&&started){toggleJournal(!journalOpen);return;}
  if(e.repeat)return;
  if(e.code==='KeyM'&&started&&!journalOpen){paused=true;$('hud').classList.add('hidden');shell.show('map');if(document.pointerLockElement)document.exitPointerLock();return;}
  if(e.code==='KeyV'&&started&&!paused){
    viewFromPosition.copy(camera.position);viewFromRotation.copy(camera.quaternion);viewBlend=.28;
    player.thirdPerson=!player.thirdPerson;
    if(!player.thirdPerson){
      const sight=camera.getWorldDirection(new THREE.Vector3());
      player.cameraYaw=yawOf(sight.x,sight.z);
      if(!combat.busy)combat.facing=player.yaw=player.cameraYaw;
    }
    updateModeLabel();playTone(410,.12,.025);
  }

  if(['Digit0','Digit1','Digit2','Digit3','Digit4'].includes(e.code)&&started&&!paused&&!combat.busy){
    const name={Digit0:'idle',Digit1:'pose',Digit2:'sit',Digit3:'wave',Digit4:'cheer'}[e.code];player.emote=name;avatar.emote(name);toast(name==='idle'?'EMOTE ENDED':`${name.toUpperCase()} · MOVE TO STAND`);return;
  }
  if(e.code==='Space'&&!paused&&!combat.busy&&!player.defeated){
    const doubleReady=profile.inputs.verticalJumpCm>=55&&player.jumpCount===1&&!player.grounded,jumpCost=doubleReady?28:14*staminaCostScale();
    if((player.grounded||doubleReady)&&player.stamina>=jumpCost){endEmote();player.stamina-=jumpCost;player.velocityY=(7.1+Math.min(110,profile.inputs.verticalJumpCm)*.03)*(doubleReady?.9:1);player.grounded=false;player.jumpCount=doubleReady?2:1;player.jumpT=0;playTone(doubleReady?390:260,.13,.04);cue(doubleReady?'DOUBLE JUMP':'JUMP',.3);}
    else if(!player.grounded&&player.jumpCount===1&&profile.inputs.verticalJumpCm<55)toast('DOUBLE JUMP LOCKED',`Raise your measured vertical jump to 55 cm. Current: ${profile.inputs.verticalJumpCm} cm.`);
  }
  if(e.code==='ShiftLeft'||e.code==='ShiftRight')evadePressed();
  if(e.code==='KeyF'||e.code==='KeyK')attackPressed();
  if(e.code==='KeyR')beginHeavyCharge();
  if(e.code==='KeyC')combat.press('guard');
  if(e.code==='KeyQ'||e.code==='Tab')toggleLock();
  if(e.code==='KeyE'&&!paused&&!journalOpen&&!combat.busy){const nearby=nearestInteractable();if(nearby&&nearby.type!=='npc')player.interactT=0;interact();}
});
canvas.addEventListener('wheel',e=>{if(!player.thirdPerson)return;e.preventDefault();player.zoom=THREE.MathUtils.clamp(player.zoom+Math.sign(e.deltaY)*.65,3.3,9.5);},{passive:false});
window.addEventListener('keyup',e=>{keyState.delete(e.code);if(e.code==='KeyR'&&player.charging)heavyPressed();});
window.addEventListener('blur',()=>{keyState.clear();player.charging=false;});
document.addEventListener('mousemove',e=>{
  // First person uses normal mouse-look. Third person intentionally uses a
  // held right-button orbit, with or without browser pointer lock.
  const locked=document.pointerLockElement===canvas,rightDragging=!!(e.buttons&2)&&(locked||e.target===canvas);
  if(paused||(!player.thirdPerson&&!locked&&!rightDragging)||(player.thirdPerson&&!rightDragging))return;
  // While locked on, the camera follows the fight; a hard flick switches target.
  if(lockTarget&&player.thirdPerson){lockFlick+=e.movementX;if(Math.abs(lockFlick)>140){switchTarget(Math.sign(lockFlick));lockFlick=0;}}
  else player.cameraYaw-=e.movementX*.0021;
  player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.00185,-1.35,1.35);
});
let lockFlick=0;
canvas.addEventListener('mousedown',e=>{
  if(conversation){if(e.button===0)advanceConversation();return;}
  if(paused)return;
  if(e.button===1){e.preventDefault();toggleLock();return;}
  if(e.button===2){e.preventDefault();return;}
  if(e.button!==0)return;
  if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.()?.catch?.(()=>{});
  attackPressed();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(pixelRatio);});

// ---------------------------------------------------------------- targeting
const yawOf=(x,z)=>Math.atan2(-x,-z);
const angleTo=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function lockCandidates(){
  return creatures.filter(c=>c.alive&&Math.hypot(c.x-player.x,c.z-player.z)<18);
}
function toggleLock(){
  if(paused)return;
  if(lockTarget){lockTarget=null;playTone(300,.08,.02);return;}
  // Prefer what the camera is looking at, then what is closest.
  const view=player.cameraYaw;
  const best=lockCandidates().map(c=>({c,score:Math.abs(angleTo(view,yawOf(c.x-player.x,c.z-player.z)))*4+Math.hypot(c.x-player.x,c.z-player.z)*.25}))
    .filter(v=>v.score<9).sort((a,b)=>a.score-b.score)[0];
  if(best){lockTarget=best.c;playTone(620,.09,.03,'triangle');}
  else toast('NOTHING TO LOCK ON TO','Face a creature and press Q.');
}
function switchTarget(dir){
  const view=player.cameraYaw,list=lockCandidates().filter(c=>c!==lockTarget).map(c=>({c,a:angleTo(view,yawOf(c.x-player.x,c.z-player.z))}))
    .filter(v=>Math.sign(-v.a)===dir).sort((a,b)=>Math.abs(a.a)-Math.abs(b.a));
  if(list[0]){lockTarget=list[0].c;playTone(560,.07,.025,'triangle');}
}
/** Soft targeting for strikes: the lock, or the creature best in front within reach. */
function pickTarget(yaw){
  // In first person the reticle is authoritative, even with a target marked.
  if(lockTarget?.alive&&(player.thirdPerson||Math.abs(angleTo(yaw,yawOf(lockTarget.x-player.x,lockTarget.z-player.z)))<.45))return lockTarget;
  const cone=player.thirdPerson?1.35:.45;
  return creatures.filter(c=>c.alive).map(c=>{
    const d=Math.hypot(c.x-player.x,c.z-player.z)-c.radius,a=Math.abs(angleTo(yaw,yawOf(c.x-player.x,c.z-player.z)));
    return {c,d,a};
  }).filter(v=>v.d<2.6&&v.a<cone).sort((a,b)=>a.d+a.a-(b.d+b.a))[0]?.c||null;
}

function nearestInteractable(){
  const d=(p)=>Math.hypot(p.x-player.x,p.z-player.z);
  const npc=nearestNpc(npcs,player.x,player.z);if(npc)return{type:'npc',value:npc};
  const echo=world.echoes.find(e=>!memories.has(e.id)&&d(e)<4.9+Math.max(0,stats().intelligence-10)*.18);
  if(echo){const quest=QUESTS.find(q=>q.id===activeQuest),remaining=creatures.filter(c=>c.alive&&c.guardianFor===echo.id).length;if(quest?.site!==echo.id)return{type:'lockedEcho',value:echo};return{type:remaining?'guardedEcho':'echo',value:echo,remaining};}
  if(d(GATE)<6)return{type:'gate'};
  if((d(world.city.rest)<4.2||d(world.home.rest)<4.2)&&player.health<maxHealth())return{type:'rest'};
  if(d(world.home.rest)<4.2)return{type:'home'};
  return null;
}
function interact(){
  const nearby=nearestInteractable();if(!nearby)return;
  if(nearby.type==='npc'){
    playTone(360,.08,.025,'triangle');beginConversation(nearby.value);
  }else if(nearby.type==='echo'){
    const e=nearby.value;memories.add(e.id);e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;persist();playTone(690,.7,.11,'sine');playTone(1040,.6,.05,'triangle');
    toast(`MEMORY FOUND · ${e.title}`,e.story);
  }else if(nearby.type==='guardedEcho'){
    toast('THE MEMORY IS GUARDED',`${nearby.remaining} ${nearby.remaining===1?'guardian remains':'guardians remain'}. Clear the sacred site first.`);
  }else if(nearby.type==='lockedEcho'){
    toast('THE MEMORY DOES NOT ANSWER','Return to Mossgate. A storyteller must first give this journey meaning.');
  }else if(nearby.type==='home'){
    player.health=maxHealth();player.stamina=100;playTone(490,.4,.07);toast('ROOTWARD HOMESTEAD','Rested, restocked, and ready for the lantern road.');
  }else if(nearby.type==='gate'){
    if(memories.size<3||completedQuests.size<QUESTS.length){toast('THE GATE IS SEALED',completedQuests.size<QUESTS.length?'Return each recovered memory to its storyteller in Mossgate.':`${3-memories.size} lost ${memories.size===2?'memory':'memories'} remain.`);return;}
    done=true;paused=true;ending.classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();playTone(540,1.1,.1);
  }else if(nearby.type==='rest'){player.health=maxHealth();player.stamina=100;playTone(490,.4,.07);toast('HEARTH REST','Vitality and breath restored.');}
}
const combatClass=()=>profile.appearance.discipline||'fighter';
const staminaCostScale=()=>THREE.MathUtils.clamp(.98-(stats().stamina-10)*.025,.62,1.2);
const guardCostScale=()=>staminaCostScale()*(combatClass()==='tank'?.7:1);
const dashScale=()=>THREE.MathUtils.clamp(.86+stats().speed*.018+(combatClass()==='ranger'?.2:0),.85,1.45);
function maxHealth(){return Math.max(3,Math.min(8,3+Math.floor(stats().defense/7)+(combatClass()==='tank'?1:0)));}
// Real-world strength scales strike damage; turtles never grant XP.
const strikePower=()=>1+Math.max(-.3,Math.min(.65,(stats().strength-10)*.05))+(combatClass()==='fighter'?Math.max(0,stats().strength-8)*.015:0);
function hurtPlayer(from){
  if(dev.invulnerable){cue('DEV · NO DAMAGE',.45);return;}
  player.health--;combat.hurt(from.x,from.z,player.x,player.z);sound.bite();
  $('vignette').style.background='radial-gradient(ellipse,transparent 24%,rgba(143,42,42,.6) 100%)';
  setTimeout(()=>{$('vignette').style.background='';},240);
  hitstop=Math.max(hitstop,.08);
  if(player.health<=0){player.defeated=2.2;lockTarget=null;combat.state='move';}
}
function respawn(){
  player.defeated=0;player.health=maxHealth();player.x=world.home.spawn.x;player.z=world.home.spawn.z;player.height=0;player.velocityY=0;player.yaw=combat.facing=0;player.cameraYaw=0;
  player.pitch=0;cameraKick=0;viewBlend=0;camera.rotation.set(0,0,0,'YXZ');
  toast('THE ROOTS RETURN YOU TO THE TRAIL','The memories you found remain with you.');
}

// ------------------------------------------------------------ combat events
function handleCombatEvents(){
  for(const ev of combat.events){
    if(ev.type==='swing'){sound.swing(ev.move);player.stamina=Math.max(0,player.stamina-(ev.stamina||0)*staminaCostScale());cue(MOVES[ev.move].label.toUpperCase(),ev.move==='rootbreaker'?.5:.22);}
    else if(ev.type==='evade'){sound.evade();player.stamina-=22*staminaCostScale();cue(`LEAF STEP · ${combatClass().toUpperCase()}`,.3);}
    else if(ev.type==='tired'){sound.tired();$('staminaFill').parentElement.classList.add('flash');setTimeout(()=>$('staminaFill').parentElement.classList.remove('flash'),300);}
    else if(ev.type==='hit'){
      const m=MOVES[ev.move],dir=ev.point.clone().sub(new THREE.Vector3(player.x,ev.point.y,player.z)).normalize();
      const selected=profile.appearance.weapon||'rootbound',weapon=weaponEligibility(selected).ok?selected:'unarmed',weaponPower={unarmed:.78,rootbound:1,groveblade:1.12,stonebreaker:1.28}[weapon];
      const mageCharge=combatClass()==='mage'&&ev.move==='rootbreaker'?1+Math.max(0,stats().intelligence-8)*.025:1;
      const critical=ev.part==='head',charge=ev.move==='rootbreaker'?player.heavyPower:1,partPower=weapon==='stonebreaker'&&ev.part==='shell'?1.42:1,damage=m.damage*strikePower()*weaponPower*partPower*charge*mageCharge*(critical?1.35:1),heavy=ev.move==='heel'||ev.move==='rootbreaker';
      ev.target.hit(damage,player.x,player.z,m.push,m.stagger,ev.part);
      sound.hit(ev.move);effects.burst(ev.point,dir.negate(),heavy);effects.number(ev.point,damage.toFixed(1),critical);if(heavy)effects.ring(new THREE.Vector3(ev.target.x,groundY(ev.target.x,ev.target.z),ev.target.z));
      hitstop=Math.max(hitstop,m.hitstop);cameraKick=Math.max(cameraKick,heavy ? .075 : .04);player.engaged=4;cue(ev.target.lastEvent==='defeated'?'DRIVEN BACK':critical?'WEAK POINT':'SOLID HIT',.55);
      debug.note(`${m.label} → HIT ${ev.part} at t=${combat.t.toFixed(2)}s (active ${m.active.join('–')})  -${damage.toFixed(1)} hp, ${ev.target.lastEvent}`,elapsed);if(ev.move==='rootbreaker')player.heavyPower=1;
      if(!ev.target.alive){sound.defeated();if(lockTarget===ev.target)lockTarget=null;const site=ev.target.guardianFor&&SITES.find(s=>s.id===ev.target.guardianFor);const remain=site?creatures.filter(c=>c.alive&&c.guardianFor===site.id).length:0;toast(ev.target.isBoss?'THE OLD SHELL FALLS':remain?`${remain} ${remain===1?'GUARDIAN':'GUARDIANS'} REMAIN`:'SHELLBACK DRIVEN BACK',ev.target.isBoss?'Return to Orin in Mossgate to finish the hunt.':site&&!remain?`${site.title} is unguarded. The memory will answer you now.`:'Creatures never grant XP. Real effort does.');}
    }
    else if(ev.type==='blocked'){sound.blocked();effects.chips(ev.point);hitstop=Math.max(hitstop,.05);cue('BLOCKED',.45);debug.note(`${MOVES[ev.move].label} → BLOCKED by an obstacle`,elapsed);}
    else if(ev.type==='whiff'){sound.whiff();cue('MISSED',.3);if(ev.move==='rootbreaker')player.heavyPower=1;debug.note(`${MOVES[ev.move].label} → MISS  (${ev.nearest===Infinity?'no creature near':`${ev.nearest.toFixed(2)} m short`})`,elapsed);}
  }
}

// -------------------------------------------------------------------- update
let lastHUD=-Infinity;
function setHUDText(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
function updateHUD(force=false){
  if(!force&&elapsed-lastHUD<.1)return;
  lastHUD=elapsed;
  const hearts=Array.from({length:maxHealth()},(_,i)=>`<span class="${i<player.health?'':'lost'}">◆</span>`).join('');
  if($('hearts').innerHTML!==hearts)$('hearts').innerHTML=hearts;
  setHUDText('echoCount',`MEMORIES ${memories.size} / 3`);
  $('staminaFill').style.width=`${Math.round(player.stamina)}%`;
  const active=QUESTS.find(q=>q.id===activeQuest),offer=!activeQuest?availableQuest():null;
  const next=active?(questDone(active)?npcs.find(n=>n.id===active.giver):active.site==='boss'?boss:SITES.find(s=>s.id===active.site)):offer?npcs.find(n=>n.id===offer.giver):(SITES.filter(s=>!memories.has(s.id))[0]||GATE);
  const distance=Math.round(Math.hypot(next.x-player.x,next.z-player.z));
  const bearing=-Math.atan2(next.x-player.x,-(next.z-player.z));
  const diff=Math.atan2(Math.sin(bearing-player.cameraYaw),Math.cos(bearing-player.cameraYaw));
  setHUDText('compass',Math.abs(diff)<.32?'↑':diff>.32&&diff<2.7?'↖':diff<-.32&&diff>-2.7?'↗':'↓');
  setHUDText('distance',`${next.title||next.name||'CANOPY GATE'} · ${distance} m`);
  setHUDText('objective',active?`${active.title} · ${questDone(active)?'Return to '+npcs.find(n=>n.id===active.giver).name:active.site==='boss'?'Hunt the Old Shell at the Canopy Gate':'Defeat the memory guardians'}`:offer?`Speak with ${npcs.find(n=>n.id===offer.giver).name} for a story quest`:completedQuests.size===QUESTS.length?'Reach the Canopy Gate':`Recover the lost memories · ${memories.size}/3`);
  setHUDText('emoteStatus',player.emote==='idle'?'':`EMOTE · ${player.emote.toUpperCase()} · MOVE TO STAND`);
  let region='VERDANT REACH';for(const s of SITES)if(Math.hypot(s.x-player.x,s.z-player.z)<18)region=s.title;
  if(Math.hypot(player.x-world.city.x,player.z-world.city.z)<world.city.radius)region=world.city.name;
  if(Math.hypot(player.x-world.home.x,player.z-world.home.z)<world.home.radius)region=world.home.name;
  if(Math.hypot(GATE.x-player.x,GATE.z-player.z)<17)region='THE CANOPY GATE';setHUDText('region',region);
  const nearby=nearestInteractable();$('interaction').classList.toggle('hidden',!nearby);
  if(nearby){const questTalk=nearby.type==='npc'&&questConversation(nearby.value);const html=nearby.type==='npc'?`<b>E</b> · ${questTalk?'STORY QUEST · ':'SPEAK WITH '}${nearby.value.name}`:nearby.type==='echo'?`<b>E</b> · REMEMBER ${nearby.value.title}`:nearby.type==='guardedEcho'?`<b>E</b> · MEMORY GUARDED · ${nearby.remaining} REMAIN`:nearby.type==='lockedEcho'?'<b>E</b> · MEMORY LOCKED · RETURN TO MOSSGATE':nearby.type==='gate'?'<b>E</b> · ENTER THE CANOPY GATE':nearby.type==='home'?'<b>E</b> · REST AT YOUR HOME BASE':'<b>E</b> · REST AT THE HEARTH';if($('interaction').innerHTML!==html)$('interaction').innerHTML=html;}
}
function updateModeLabel(){setHUDText('cameraMode',player.thirdPerson?(lockTarget?'THIRD PERSON · LOCKED ON':'THIRD PERSON'):'FIRST PERSON');}

function update(rawDt){
  // Hit-stop: the fighters freeze for a few frames on impact; camera and effects keep running.
  const frozen=hitstop>0;hitstop=Math.max(0,hitstop-rawDt);
  const dt=frozen?0:rawDt;
  elapsed+=dt;
  if(player.charging){player.heavyCharge=Math.min(1.8,player.heavyCharge+dt);player.engaged=4;}
  if(lockTarget&&(!lockTarget.alive||Math.hypot(lockTarget.x-player.x,lockTarget.z-player.z)>22))lockTarget=null;
  updateModeLabel();

  // Movement intent relative to the camera, in world space.
  let f=Number(keyState.has('KeyW')||keyState.has('ArrowUp'))-Number(keyState.has('KeyS')||keyState.has('ArrowDown'));
  let side=Number(keyState.has('KeyD')||keyState.has('ArrowRight'))-Number(keyState.has('KeyA')||keyState.has('ArrowLeft'));
  if((f||side)&&player.emote!=='idle')endEmote();
  const len=Math.hypot(f,side)||1;f/=len;side/=len;
  const view=player.cameraYaw;
  const input={x:-Math.sin(view)*f+Math.cos(view)*side,z:-Math.cos(view)*f-Math.sin(view)*side};
  const hasInput=!!(f||side);
  // A new first-person press must use the mouse heading from this frame.
  // Once committed, the body keeps the strike/evade heading until its window
  // ends; mouse look remains free and the rendered hands follow that line.
  if(!player.thirdPerson&&!combat.busy)combat.facing=player.yaw=player.cameraYaw;



  // Combat decides root motion and state; bones are last frame's pose.
  const floor0=groundY(player.x,player.z);
  const chest=new THREE.Vector3(player.x,floor0+player.height+1.35,player.z);
  const staminaBefore=player.stamina;
  const guardHeld=keyState.has('KeyC');
  const motion=frozen||player.defeated?{dx:0,dz:0}:combat.update(dt,{input,guardHeld,aimWithMovement:player.thirdPerson,lockTarget,pickTarget,bones:avatar.bones,grid:collisionGrid,
    targets:creatures.filter(c=>c.alive),stamina:player.stamina/staminaCostScale(),x:player.x,z:player.z,chest});
  if(combat.state==='evade'){motion.dx*=dashScale();motion.dz*=dashScale();}
  if(!frozen)handleCombatEvents();
  if(combat.events.some(e=>e.type==='swing'||e.type==='evade'))player.engaged=4;
  player.engaged=Math.max(0,player.engaged-dt);

  const speedStat=stats().speed,staminaStat=stats().stamina;
  if(player.stamina>=staminaBefore){const classRegen=combatClass()==='support'?1.38:1;player.stamina=THREE.MathUtils.clamp(player.stamina+(combat.state==='evade'?0:10+staminaStat*.65)*classRegen*dt,0,100);}
  const nearFight=creatures.some(c=>c.alive&&['approach','circle','windup','lunge','recover','stagger','alert'].includes(c.state)&&Math.hypot(c.x-player.x,c.z-player.z)<9);
  const guarded=combat.guarding||!!lockTarget||player.engaged>0||nearFight;
  const runSpeed=5.1+(speedStat-10)*.08,guardSpeed=3.2+(speedStat-10)*.04;
  let desiredX=0,desiredZ=0;
  if(!combat.busy&&hasInput&&!player.defeated){const s=(guarded?guardSpeed:runSpeed)*(player.charging?.42:1);desiredX=input.x*s;desiredZ=input.z*s;}
  player.vx=THREE.MathUtils.damp(player.vx,desiredX,hasInput?14:18,dt);
  player.vz=THREE.MathUtils.damp(player.vz,desiredZ,hasInput?14:18,dt);
  // End tiny residual velocities instead of letting the idle body shuffle or
  // visually "auto-walk" after the key has been released.
  if(!hasInput&&!combat.busy){if(Math.abs(player.vx)<.08)player.vx=0;if(Math.abs(player.vz)<.08)player.vz=0;}
  if(combat.busy){player.vx=0;player.vz=0;}

  // Facing: toward the lock in a fight, along the path when roaming, the camera in first person.
  if(!player.thirdPerson)player.yaw=combat.facing;
  else if(!combat.busy){
    let want=null;
    if(lockTarget)want=yawOf(lockTarget.x-player.x,lockTarget.z-player.z);
    else if(hasInput)want=yawOf(input.x,input.z);
    if(want!==null)combat.facing+=angleTo(combat.facing,want)*(1-Math.exp(-(lockTarget?16:12)*dt));
  }
  player.yaw=combat.facing;

  const oldX=player.x,oldZ=player.z;
  const moveX=player.vx*dt+motion.dx,moveZ=player.vz*dt+motion.dz;
  const impact=dev.noclip?(player.x+=moveX,player.z+=moveZ,{hitX:false,hitZ:false}):moveWithCollision(player,moveX,moveZ,collisionGrid,groundY);
  if(impact.hitX)player.vx=0;if(impact.hitZ)player.vz=0;
  // Creatures are solid: slide around them rather than through.
  for(const c of creatures){if(!c.alive||dev.noclip)continue;const dx=player.x-c.x,dz=player.z-c.z,d=Math.hypot(dx,dz),min=c.radius+.36;
    if(d<min&&d>1e-4){const push=(min-d);const nx=player.x+dx/d*push,nz=player.z+dz/d*push;moveWithCollision(player,nx-player.x,nz-player.z,collisionGrid,groundY);}}
  const moved=Math.hypot(player.x-oldX,player.z-oldZ)/Math.max(dt,1e-4);

  player.velocityY-=22*dt;player.height+=player.velocityY*dt;
  // Terrain is the only floor. Collision cylinders are walls/props, never
  // invisible platforms; treating their tops as support caused half-buried
  // characters and left the player stranded above decorative geometry.
  if(player.height<=0||!Number.isFinite(player.height)){player.height=0;player.velocityY=0;player.grounded=true;player.jumpCount=0;}
  else if(player.velocityY!==0)player.grounded=false;

  // Creatures act after the explorer so a strike this frame can interrupt them.
  const playerPos={x:player.x,z:player.z,y:groundY(player.x,player.z)+player.height};
  for(const c of creatures){
    const events=frozen?[]:c.update(dt,elapsed,{player:playerPos,playerInvulnerable:combat.invulnerable,grid:collisionGrid});
    for(const ev of events){
      if(ev.type==='windup'){sound.windup(c.type);cue(c.isBoss?'OLD SHELL CHARGING':'SHELLBACK WINDING UP',.65);debug.note(`${c.type} → TELEGRAPH (rearing, shell glowing)`,elapsed);}
      else if(ev.type==='bossWindup'){sound.windup(c.type);cue('OLD SHELL · QUAKE INCOMING',1.1);cameraKick=.018;}
      else if(ev.type==='bossSlam'){
        effects.ring(new THREE.Vector3(c.x,groundY(c.x,c.z)+.07,c.z));cameraKick=.14;hitstop=.08;
        const gap=Math.hypot(c.x-player.x,c.z-player.z);
        if(gap<ev.radius){if(combat.invulnerable){cue('QUAKE EVADED',.7);sound.evadedAttack();}else if(combat.guarding&&player.stamina>=28){player.stamina-=28;cue('QUAKE GUARDED',.7);sound.blocked();}else{cue('CAUGHT IN THE QUAKE',.7);hurtPlayer(c);}}
      }
      else if(ev.type==='lunge')sound.lunge();
      else if(ev.type==='alert')sound.alert();
      else if(ev.type==='bite'){
        if(combat.parryActive){c.parry(player.x,player.z);sound.blocked();effects.ring(new THREE.Vector3(c.x,groundY(c.x,c.z)+.06,c.z));player.stamina=Math.min(100,player.stamina+12);hitstop=.12;cameraKick=.045;cue('PERFECT PARRY',.75);debug.note(`${c.type} lunge → PERFECT PARRY`,elapsed);}
        else if(combat.guarding&&player.stamina>=GUARD.stamina*guardCostScale()){player.stamina-=GUARD.stamina*guardCostScale();c.setState('recover');sound.blocked();hitstop=.06;cameraKick=.025;cue('GUARDED',.5);debug.note(`${c.type} lunge → GUARDED`,elapsed);}
        else{cue('STRUCK',.5);cameraKick=.08;debug.note(`${c.type} lunge → HIT you`,elapsed);hurtPlayer(c);}
      }
      else if(ev.type==='evaded'){const perfect=combat.state==='evade'&&combat.t<.2;sound.evadedAttack();if(perfect){player.stamina=Math.min(100,player.stamina+18);c.setState('recover');hitstop=.055;}cue(perfect?'PERFECT EVADE':'EVADED',.6);debug.note(`${c.type} lunge → ${perfect?'PERFECT ':''}EVADE`,elapsed);}
      else if(ev.type==='missed')debug.note(`${c.type} lunge → missed (${ev.gap.toFixed(2)} m wide)`,elapsed);
    }
    c.showBar(c===lockTarget||(c.health<c.maxHealth&&Math.hypot(c.x-player.x,c.z-player.z)<12),camera);
  }
  const bossHud=$('bossHud');
  if(bossHud&&boss){const show=boss.alive&&Math.hypot(boss.x-player.x,boss.z-player.z)<38;bossHud.classList.toggle('hidden',!show);if(show){$('bossHealth').style.width=`${Math.max(0,boss.health/boss.maxHealth*100)}%`;$('bossPhase').textContent=boss.shellBroken?'ENRAGED · SHELL BROKEN · HEAD EXPOSED':`ANCIENT ARMOUR · ${Math.max(0,Math.ceil(16-boss.shellDamage))} BREAK`;}}

  // ------------------------------------------------------------ animation
  const floor=groundY(player.x,player.z);
  avatar.root.position.set(player.x,floor+player.height,player.z);
  avatar.root.rotation.y=player.yaw;
  const a=avatar.animator;
  // One-shot body clips: combat first, then defeat, landing, take-off and interaction.
  if(!player.grounded)player.airTime+=dt;else{if(player.airTime>.35)player.landT=0;player.airTime=0;}
  player.jumpT+=dt;player.landT+=dt;player.interactT+=dt;
  if(player.defeated){player.defeated=Math.max(0,player.defeated-dt);if(player.defeated===0)respawn();}
  const action=player.defeated&&a.has('death')?{name:'death',time:2.2-player.defeated,fade:12}:combat.clip()
    ||(player.jumpT<.3&&a.has('jump')?{name:'jump',time:player.jumpT,fade:25}:null)
    ||(player.landT<.35&&player.grounded&&a.has('land')&&!moved?{name:'land',time:player.landT,fade:25}:null)
    ||(player.interactT<.9&&a.has('interact')?{name:'interact',time:player.interactT+.15,fade:14}:null);
  const planar=combat.busy||!hasInput?0:moved;
  if(action)a.play(action.name,action.time,action.fade);else a.stop();
  if(!player.grounded)a.setLocomotion({air:1},dt/1);
  else if(player.emote!=='idle')a.setLocomotion({[player.emote]:1},dt/a.duration(player.emote));
  else if(guarded){
    const s=THREE.MathUtils.clamp(planar/guardSpeed,0,1),fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
    const vx=player.vx,vz=player.vz,vl=Math.hypot(vx,vz)||1,fwd=(vx*fx+vz*fz)/vl,right=(vx*-fz+vz*fx)/vl;
    a.setLocomotion({guard:1-s,guard_fwd:s*Math.max(0,fwd),guard_back:s*Math.max(0,-fwd),guard_right:s*Math.max(0,right),guard_left:s*Math.max(0,-right)},dt/.76*Math.max(.35,s));
  }else{
    const s=THREE.MathUtils.clamp(planar/runSpeed,0,1.2),walk=THREE.MathUtils.clamp(1-Math.abs(s-.45)/.35,0,1)*(s<.8?1:0);
    a.setLocomotion({idle:Math.max(0,1-s*2.2),walk:s<.6?walk:0,run:Math.max(0,s-.3)*1.6},dt/(s<.6?1.1:.72)*Math.max(.3,s*1.25));
  }
  avatar.setMood(combat.state==='hurt'?'hurt':combat.state==='attack'&&combat.phase()==='active'?'strain':combat.busy||guarded?'focus':player.emote==='cheer'?'cheer':'calm');
  // Foot IK is only useful while travelling over uneven ground. Applying it
  // while idle or during authored attacks fights the pose and can kick a leg
  // into the air (or drag the whole heavy attack toward the floor).
  const plantFeet=player.grounded&&!combat.busy&&player.emote==='idle'&&hasInput&&moved>.18;
  avatar.update(frozen?0:dt,plantFeet?groundY:null);
  avatar.flicker(elapsed,combat.clock<combat.invulnerableUntil?1:0);

  // --------------------------------------------------------------- camera
  const eyeBase=floor+player.height+(player.emote==='sit'?.98:1.65);
  let closeCamera=false;
  if(player.thirdPerson){
    if(lockTarget){
      // Keep both fighters in view: swing behind the explorer, look between them.
      const want=yawOf(lockTarget.x-player.x,lockTarget.z-player.z);
      player.cameraYaw+=angleTo(player.cameraYaw,want)*(1-Math.exp(-5*rawDt));
      player.pitch=THREE.MathUtils.damp(player.pitch,-.06,3,rawDt);
    }
    const heading=new THREE.Vector3(-Math.sin(player.cameraYaw),0,-Math.cos(player.cameraYaw));
    const target=new THREE.Vector3(player.x,floor+player.height+(player.emote==='sit'?.85:1.35),player.z);
    if(lockTarget)target.lerp(new THREE.Vector3(lockTarget.x,groundY(lockTarget.x,lockTarget.z)+.7,lockTarget.z),.3);
    const zoom=lockTarget?Math.max(player.zoom,5.4):player.zoom;
    const retreat=zoom*Math.cos(player.pitch*.55);
    const desired=target.clone().addScaledVector(heading,-retreat);
    desired.y+=1.1+zoom*.21+Math.sin(player.pitch)*zoom*.7;
    const obstruction=desired.clone().sub(target),distance=obstruction.length();
    raycaster.set(target,obstruction.normalize());raycaster.far=distance;
    const hit=raycaster.intersectObjects(world.cameraObstacles,false)[0];
    if(hit)desired.copy(target).addScaledVector(obstruction,Math.max(.7,hit.distance-.38));
    camera.position.lerp(desired,1-Math.exp(-9*rawDt));camera.lookAt(target);
    closeCamera=camera.position.distanceTo(target)<1.45;
  }else{
    // First person rides the body: lunges, evades and flinches move the view a little.
    const head=avatar.bones.Head.getWorldPosition(new THREE.Vector3());
    const offset=head.clone().sub(new THREE.Vector3(player.x,floor+player.height+(avatar.headRest||1.735),player.z)).multiplyScalar(.45);
    const eye=new THREE.Vector3(player.x,eyeBase,player.z).add(offset);
    camera.position.x=eye.x;camera.position.z=eye.z;camera.position.y=THREE.MathUtils.damp(camera.position.y||eye.y,eye.y,14,rawDt);
    // Set all three axes: rotateZ below is a transient impact cue, never
    // part of the persistent mouse-look orientation.
    camera.rotation.set(player.pitch,player.cameraYaw,0,'YXZ');
  }
  // When a wall forces the third-person camera against the explorer, hide the
  // body instead of rendering the camera inside the head and torso.
  avatar.root.visible=avatar.root.visible&&player.thirdPerson&&!closeCamera;
  // Never allow the view below the terrain or into Mossgate's low stone base.
  // This also recovers old saves after a browser resumes on a malformed frame.
  camera.position.y=Math.max(camera.position.y,floor+player.height+.72);
  cameraKick=THREE.MathUtils.damp(cameraKick,0,18,rawDt);
  camera.rotateZ(Math.sin(elapsed*60)*cameraKick);
  const actionFov=combat.state==='evade'?75:combat.move==='rootbreaker'&&combat.phase()==='active'?66:player.thirdPerson?67:70;
  const nextFov=THREE.MathUtils.damp(camera.fov,actionFov,9,rawDt);if(Math.abs(nextFov-camera.fov)>.01){camera.fov=nextFov;camera.updateProjectionMatrix();}
  if(viewBlend>0){
    viewBlend=Math.max(0,viewBlend-rawDt);
    const progress=1-(viewBlend/.28)**3;
    camera.position.lerpVectors(viewFromPosition,camera.position,progress);
    camera.quaternion.slerpQuaternions(viewFromRotation,camera.quaternion,progress);
  }
  hands.group.visible=(!player.thirdPerson||closeCamera)&&viewBlend<.12&&(combat.busy||guarded);
  hands.group.rotation.y=combat.busy?angleTo(player.cameraYaw,combat.facing):0;
  hands.update(frozen?0:dt,combat,guarded,frozen);
  updateNpcs(npcs,elapsed,player,camera);
  updateCollisionViz();if(dev.open)updateDevTelemetry();
  const questNpc=QUESTS.find(q=>q.id===activeQuest)?.giver||availableQuest()?.giver;
  npcs.forEach(npc=>{const relevant=npc.id===questNpc;npc.marker.material.color.setHex(relevant?0xffdb72:0xe8d993);npc.marker.scale.setScalar(relevant?1.25+Math.sin(elapsed*5)*.12:1);});

  lockMarker.visible=!!lockTarget;
  if(lockTarget){lockMarker.position.set(lockTarget.x,groundY(lockTarget.x,lockTarget.z)+1.75+Math.sin(elapsed*4)*.05,lockTarget.z);lockMarker.rotation.y+=rawDt*2;}
  const imminent=creatures.some(c=>c.alive&&c.state==='windup'&&Math.hypot(c.x-player.x,c.z-player.z)<6);
  const cueElement=$('combatCue');
  const chargeLevel=player.heavyCharge>=1.35?'III':player.heavyCharge>=.72?'II':'I';
  cueElement.textContent=player.charging?`ROOTBREAKER CHARGE ${chargeLevel} · RELEASE R`:elapsed<cueUntil?cueText:imminent?(combat.guarding?'TIME THE PARRY':'EVADE OR PARRY THE LUNGE'):combat.guarding?(combat.parryActive?'PARRY WINDOW':'GUARDING'):combat.state==='attack'?`${combat.phase().toUpperCase()} · ${MOVES[combat.move].label.toUpperCase()}`:'';
  cueElement.classList.toggle('warning',imminent&&elapsed>=cueUntil);
  $('crosshair').classList.toggle('impact',elapsed<cueUntil&&['SOLID HIT','DRIVEN BACK'].includes(cueText));

  player.step-=dt;if(planar>.5&&player.grounded&&player.step<=0){player.step=guarded?.38:.45;playTone(74+Math.random()*20,.06,.013,'triangle');}
  effects.update(rawDt);
  debug.update({combat,bones:avatar.bones,creatures,player:playerPos,lockTarget,animator:avatar.animator,authored:!!avatar.isAuthored});
  world.sun.position.set(player.x-45,groundY(player.x,player.z)+95,player.z-50);
  world.sun.target.position.set(player.x,groundY(player.x,player.z),player.z);
  world.sun.target.updateMatrixWorld();
  world.updateLanternLights(player.x,player.z);
  world.animated.forEach(({mesh,type,baseY,index})=>{
    if(type==='echo'){mesh.position.y=baseY+Math.sin(elapsed*1.8+index)*.3;mesh.rotation.y+=dt*.6;}
    if(type==='ring'){mesh.position.y=baseY+Math.sin(elapsed*1.8+index)*.3;mesh.rotation.z+=dt*.7;}
    if(type==='pool')mesh.material.opacity=.78+Math.sin(elapsed*1.6)*.08;
    if(type==='gate')mesh.material.opacity=.13+Math.sin(elapsed*1.8)*.07;
    if(type==='cityFlame'||type==='homeLamp'){mesh.position.y=baseY+Math.sin(elapsed*4.2+index)*.09;mesh.rotation.y+=dt*1.8;mesh.scale.setScalar(.9+Math.sin(elapsed*7+index)*.08);}
  });
  FX.position.set(player.x,groundY(player.x,player.z),player.z);
  motes.forEach((m,i)=>{m.position.y+=dt*(.1+i%4*.07);if(m.position.y>8)m.position.y=1;m.material.opacity=.28+Math.sin(elapsed*1.4+i)*.22;});
  if(toastTimer>0){toastTimer-=rawDt;if(toastTimer<=0)$('toast').classList.add('hidden');}
  coop.update(rawDt,{activeQuest,memories:[...memories],completed:[...completedQuests],bossDefeated:!boss?.alive});
  updateHUD();
}
let avatarRequest=0;
async function switchAvatar(){
  const choice=profile.appearance.character||'rogue',request=++avatarRequest;
  try{
    const explorer=choice==='custom'?await loadCustomExplorer(scene):await loadKayKit(scene,choice);
    if(request!==avatarRequest){scene.remove(explorer.root);return;}
    const old=avatar;explorer.root.position.copy(old.root.position);explorer.root.rotation.y=old.root.rotation.y;
    scene.remove(old.root);avatar=explorer;avatar.setAppearance(profile.appearance);avatar.emote(player.emote);
    hands.setAppearance(profile.appearance);
  }catch(err){console.warn('Character failed to load; using the current body.',err);}
}
shell=createShell(entry,canvas,globe,{enterGame:resume,pauseGame:()=>{paused=true;},onAppearance:()=>{
  hands.setAppearance(profile.appearance);
  avatar.setAppearance(profile.appearance);
}});
shell.start();avatar.setAppearance(profile.appearance);hands.setAppearance(profile.appearance);
// The block explorer is now the canonical character: it shares the same
// square-arm silhouette as the first-person rig and keeps a readable face.
if(params.has('legacyCharacters'))switchAvatar();
const clock=new THREE.Clock(),capture=params.has('capture');
let perfSeconds=0,perfFrames=0,foliageReduced=false,pausedRender=0;
let statsSeconds=0,statsFrames=0,statsUpdateMs=0,statsDrawMs=0;
function frame(){
  requestAnimationFrame(frame);
  const rawDt=clock.getDelta(),dt=Math.min(rawDt,.045);
  if(capture)return;
  if(!paused&&shell.view==='game'){
    perfSeconds+=rawDt;perfFrames++;
    if(perfSeconds>=2){
      const frameTime=perfSeconds/perfFrames;
      if(frameTime>.027){
        if(!foliageReduced){world.setFoliageShadows(false);foliageReduced=true;}
        else if(pixelRatio>.85){pixelRatio=Math.max(.85,pixelRatio-.12);renderer.setPixelRatio(pixelRatio);}
      }
      perfSeconds=0;perfFrames=0;
    }
  }else{perfSeconds=0;perfFrames=0;}
  const updateStart=performance.now();
  if(!paused)update(dt);
  // Dialogue pauses combat, not the actors. Keeping the NPC rig alive here
  // makes eye contact, brows, mouth, breathing and listening gestures visible.
  else if(conversation&&shell.view==='game')updateNpcs(npcs,clock.elapsedTime,player,camera);
  const updateMs=performance.now()-updateStart;
  const drawStart=performance.now();
  if(shell.view==='map'){globe.update(dt,clock.elapsedTime,innerWidth,innerHeight);renderer.render(globe.scene,globe.camera);}
  else if(!paused||conversation||((pausedRender+=rawDt)>.15)){pausedRender=0;renderer.render(scene,camera);}
  if(!paused&&shell.view==='game'){
    statsSeconds+=rawDt;statsFrames++;statsUpdateMs+=updateMs;statsDrawMs+=performance.now()-drawStart;
    if(statsSeconds>=1){
      if(showPerf)perfPanel.textContent=`${Math.round(statsFrames/statsSeconds)} FPS · ${Math.round(1000*statsSeconds/statsFrames)/1000} ms/frame\n`+
        `Simulation ${Math.round(statsUpdateMs/statsFrames*10)/10} ms · draw CPU ${Math.round(statsDrawMs/statsFrames*10)/10} ms\n`+
        `${renderer.info.render.calls} draw calls · ${Math.round(renderer.info.render.triangles/1000)}k triangles\n`+
        `Resolution ${pixelRatio.toFixed(2)}× · foliage shadows ${foliageReduced?'off':'on'} · F4 hide`;
      statsSeconds=statsFrames=statsUpdateMs=statsDrawMs=0;
    }
  }else{statsSeconds=statsFrames=statsUpdateMs=statsDrawMs=0;}
}frame();
// ?capture advances the game by fixed steps on request, so footage recorded on a
// slow machine still plays back at true speed. The rules are the same code.
if(capture)window.__capture={step(frames=1,dt=1/60,draw=true){for(let i=0;i<frames;i++)if(!paused)update(dt);if(draw)renderer.render(scene,camera);}};
camera.position.set(player.x,groundY(player.x,player.z)+1.65,player.z);updateHUD(true);

// ?arena drops straight into the first encounter for testing (skips the menus).
if(params.has('arena')||params.has('city')){
  if(!profile.complete){profile.complete=true;profile.introSeen=true;saveProfile();}
  if(params.has('city')){player.x=-3.2;player.z=45.5;player.cameraYaw=player.yaw=combat.facing=Math.PI;}
  else{player.z=37;player.cameraYaw=0;}
  resume();
  window.__verdant={player,combat,creatures,camera,get avatar(){return avatar;},get lockTarget(){return lockTarget;},toggleLock,keyState,debug,attack:attackPressed,evade:evadePressed,get elapsed(){return elapsed;}};
}
