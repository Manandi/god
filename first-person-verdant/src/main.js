import * as THREE from 'three';
import { buildWorld, groundY, SITES, GATE, HUNT, ARENA } from './world.js';
import { createCreatures,extraHollowed,SHOCKWAVE } from './creatures.js';
import { createAvatar,createFirstPersonHands } from './avatar.js';
import { loadExplorer } from './avatarGLB.js';
import { createNpcs,updateNpcs } from './npcs.js';
import { createStory,NPCS,CHAPTERS,STAGES,keeperName } from './story.js';
import { createChronicles,CHRONICLES,TOPICS } from './chronicles.js';
import { createCoop } from './coop.js';
import { loadWardenAndArena,BED } from './boss.js';
import { loadSites } from './sites.js';
import { createCollisionGrid,moveWithCollision } from './collision.js';
import { angleTo,yawOf } from './angles.js';
import { ShoulderCamera,MIN_ELEVATION,MAX_ELEVATION } from './camera.js';
import { mechanics,equippedWeapon,movesetFor,weaponPower,devOverrides } from './mechanics.js';
import { createGlobe } from './globe.js';
import { createNarrator } from './narrator.js';
import { createShell } from './shell.js';
import { profile,stats,saveProfile,units } from './profile.js';
import { PlayerCombat } from './combat/player.js';
import { MOVES, STAMINA, GUARD, SPRINT, FLASK } from './combat/moves.js';
import { CombatSound,ImpactEffects } from './combat/feedback.js';
import { CombatDebug } from './combat/debug.js';
import './style.css';
import './menu.css';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const canvas=$('game'),journal=$('journal'),ending=$('ending'),entry=$('entry');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
let pixelRatio=Math.min(devicePixelRatio,1.25);
renderer.setPixelRatio(pixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.43;
const scene=new THREE.Scene();const world=buildWorld(scene),creatures=createCreatures(scene,CHAPTERS);
creatures.forEach((c,i)=>{c.netId='c'+i;});   // stable ids for team fights (creation order is the same in every game)
// The keepers of the trail are solid, like everything else you can see.
for(const n of Object.values(NPCS))world.colliders.push({x:n.x,z:n.z,r:.42*(n.scale||1),top:groundY(n.x,n.z)+2.2*(n.scale||1)});
const collisionGrid=createCollisionGrid(world.colliders);
const globe=createGlobe(),narrator=createNarrator();let shell;
const camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,.08,540);camera.rotation.order='YXZ';
const shoulderCam=new ShoulderCamera(camera,{obstacles:world.cameraObstacles,grid:collisionGrid,ground:groundY});
// The procedural body shows until the authored explorer has loaded, and stays
// as the fallback if it cannot load.
let avatar=createAvatar(scene);const raycaster=new THREE.Raycaster();
const combat=new PlayerCombat(),sound=new CombatSound(),effects=new ImpactEffects(scene),debug=new CombatDebug(scene);
// A new day starts at the Rootward Homestead, south of Mossgate.
const player={x:world.home.spawn.x,z:world.home.spawn.z,yaw:0,cameraYaw:0,pitch:0,health:4,stamina:100,step:0,height:0,velocityY:0,grounded:true,vx:0,vz:0,thirdPerson:params.has('third'),zoom:5.2,camElev:.28,jumpCount:0,winded:false,emote:'idle',engaged:0,jumpT:9,landT:9,interactT:9,airTime:0,defeated:0,flasks:FLASK.charges,sprinting:false};
const keyState=new Set();let started=false,paused=true,done=false,journalOpen=false,toastTimer=0,elapsed=0,audio,hitstop=0,lockTarget=null,slowmo={scale:1,left:0},staminaRest=0,combo=0,comboTimer=0;
let viewBlend=0,viewFromPosition=new THREE.Vector3(),viewFromRotation=new THREE.Quaternion();
let cueText='',cueUntil=0,cameraKick=0;
let save;try{save=JSON.parse(localStorage.getItem('verdant-reach-3d-v1')||'{}');}catch{save={};}
const memories=new Set(Array.isArray(save.memories)?save.memories.filter(v=>SITES.some(s=>s.id===v)):[]);
world.echoes.forEach(e=>{if(memories.has(e.id)){e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;}});
const story=createStory(save.story,memories);
// Mossgate Chronicles: the town's side quests (ChatGPT Sites), done when a memory is found or the Old Shell falls.
const chronicles=createChronicles(save.chronicles,site=>memories.has(site));
const npcs=createNpcs(scene,NPCS);let dialogue=null;const spawned=new Set();
// Orrun, the Hollow Warden, and its arena load after the world; until then the gate is just a gate.
let warden=null,gateRoots=null,bossShown=null,bossTrail=1;
const SPEAKERS={orrun:{name:'ORRUN',title:'THE WARDEN, REMEMBERED',get x(){return warden?.x??BED.x;},get z(){return warden?.z??BED.z;}}};
const speakerOf=id=>NPCS[id]||SPEAKERS[id];
const RELEASE_LINES=[
  'You speak the name the forest kept for it: Orrun. The one who carries.',
  'The word falls into the Hollow like a stone into still water. The teal light drains out of its shell.',
  'Its eyes clear. It remembers the spring it hatched in, the stones it carried for the gate, the oath it swore at Mosswatch.',
  'Behind you the Heartseed drifts down the road on Mycel’s light and settles into the roots of the gate. Strength that was earned holds; the rot has nothing left to feed on.',
  'The forest remembers Orrun, so its watch is over. The roots loosen, and Orrun bows its head, as it bowed on the oath-stones long ago. Then it sets the weight down.'
];
const hands=createFirstPersonHands(camera);scene.add(camera);
const FX=new THREE.Group();scene.add(FX);
const motes=[];for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,6,5),new THREE.MeshBasicMaterial({color:0xc4efb0,transparent:true,opacity:.6}));
  mesh.position.set((Math.random()-.5)*20,1+Math.random()*7,(Math.random()-.5)*20);FX.add(mesh);motes.push(mesh);
}
// A small diamond over the locked creature: enough to read, never in the way.
const lockMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0xf3e6b0,transparent:true,opacity:.9,depthTest:true}));
lockMarker.renderOrder=12;lockMarker.scale.set(1,1.6,1);scene.add(lockMarker);lockMarker.visible=false;

const playTone=(freq=140,duration=.1,volume=.04,type='sine')=>sound.tone(freq,duration,volume,type);
function initAudio(){
  if(audio){audio.resume();return;}
  try{audio=new AudioContext();sound.attach(audio);const hum=audio.createOscillator(),gain=audio.createGain();hum.type='sine';hum.frequency.value=73;gain.gain.value=.014;hum.connect(gain).connect(audio.destination);hum.start();
    const breeze=audio.createOscillator(),g2=audio.createGain();breeze.type='triangle';breeze.frequency.value=108;g2.gain.value=.006;breeze.connect(g2).connect(audio.destination);breeze.start();
  }catch{/* Sound is optional on unsupported browsers. */}
}
function toast(title,detail=''){$('toast').innerHTML=title+(detail?`<small>${detail}</small>`:'');$('toast').classList.remove('hidden');toastTimer=3.5;}
function persist(){try{localStorage.setItem('verdant-reach-3d-v1',JSON.stringify({memories:[...memories],story:story.serialize(),chronicles:chronicles.serialize()}));}catch{/* No storage available. */}}
function updateJournal(){
  const chronicleEntries=CHRONICLES.map((q,i)=>{const done=chronicles.completed.has(q.id),active=chronicles.active?.id===q.id;
    return `<article class="${done||active?'':'unknown'}"><strong>CHRONICLE ${i+1} · ${done?'TOLD':active?'ACTIVE':'UNTOLD'}</strong>${done?`${q.title}. ${q.complete}`:active?`${q.title}. ${q.accepted}`:'Mossgate’s townsfolk will tell this one.'}</article>`;}).join('');
  $('journalEntries').innerHTML=story.journal().map((page,i)=>
    `<article class="${page.open?'':'unknown'}"><strong>${String(i+1).padStart(2,'0')} · ${page.open?page.title:'NOT YET WRITTEN'}</strong>${page.open?page.text:'The trail has more to tell.'}</article>`).join('')+chronicleEntries;
}
function toggleJournal(open){journalOpen=open;journal.classList.toggle('hidden',!open);updateJournal();if(open){paused=true;if(document.pointerLockElement)document.exitPointerLock();}else resume();}
function resume(){if(!started)player.health=maxHealth();started=true;paused=false;dev.open=false;devPanel.classList.add('hidden');shell.hide();$('hud').classList.remove('hidden');journal.classList.add('hidden');journalOpen=false;initAudio();canvas.requestPointerLock?.()?.catch?.(()=>{});}
$('closeJournal').onclick=()=>toggleJournal(false);
$('continueExploring').onclick=()=>{ending.classList.add('hidden');done=false;resume();};
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&started&&!journalOpen&&!done&&!dev.open&&!dialogue?.choices&&shell?.view==='game'){paused=true;shell.show('menu');$('hud').classList.add('hidden');}
  else if(document.pointerLockElement){paused=false;shell?.hide();}
});
const endEmote=()=>{if(player.emote!=='idle'){player.emote='idle';avatar.emote('idle');}};
function evadePressed(){if(paused||dialogue)return;endEmote();combat.press('evade');}
function attackPressed(){if(paused)return;if(dialogue){advanceDialogue();return;}endEmote();combat.press('light');}
function heavyPressed(down){if(paused||(dialogue&&down))return;combat.heavyHeld=down;if(down){endEmote();combat.press('heavy');}}
function cue(text,duration=.4){cueText=text;cueUntil=elapsed+duration;}
function guardPressed(down){if((paused||dialogue)&&down)return;if(down)endEmote();combat.raiseGuard(down);}
let shiftDownAt=-1;
const sprintHeld=()=>shiftDownAt>=0&&(performance.now()-shiftDownAt)/1000>=SPRINT.hold;
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  keyState.add(e.code);
  if(e.code===DEV_KEY&&!e.repeat){e.preventDefault();toggleDev();return;}
  if(e.code==='F4'&&!e.repeat){e.preventDefault();togglePerf();return;}
  if(e.code==='F3'){e.preventDefault();debug.toggle();return;}
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
  if(['Digit0','Digit1','Digit2','Digit3','Digit4'].includes(e.code)&&started&&!paused&&!dialogue&&!combat.busy){
    const name={Digit0:'idle',Digit1:'pose',Digit2:'sit',Digit3:'wave',Digit4:'cheer'}[e.code];player.emote=name;avatar.emote(name);toast(name==='idle'?'EMOTE ENDED':`${name.toUpperCase()} · MOVE TO STAND`);return;
  }
  if(e.code==='Space'&&!paused&&!dialogue&&!combat.busy&&!player.defeated){
    // Jump height follows your measured vertical jump; 55 cm or more unlocks a double jump.
    const second=!player.grounded&&player.jumpCount===1&&mech.doubleJump;
    if(player.grounded||second){endEmote();player.velocityY=mech.jumpVelocity*(second?.88:1);player.grounded=false;player.jumpCount=second?2:1;player.jumpT=0;
      if(second){spend(12);cue('DOUBLE JUMP',.35);effects.ring(new THREE.Vector3(player.x,groundY(player.x,player.z)+player.height,player.z));}playTone(second?390:260,.13,.04);}
    else if(!player.grounded&&player.jumpCount===1)cue(`DOUBLE JUMP AT 55 CM VERTICAL · YOURS ${profile.inputs.verticalJumpCm} CM`,1.2);
  }
  if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!paused)shiftDownAt=performance.now();
  if(e.code==='KeyC')guardPressed(true);
  if(e.code==='KeyX'&&!paused&&!dialogue){endEmote();combat.press('flask');}
  if(e.code==='KeyF')attackPressed();
  if(e.code==='KeyR')heavyPressed(true);
  if(e.code==='KeyQ'||e.code==='Tab')toggleLock();
  if(dialogue?.choices&&/^Digit[1-9]$/.test(e.code)){chooseDialogue(Number(e.code.slice(5))-1);return;}
  if(dialogue&&e.code==='Escape'){closeDialogue(false);return;}
  if(e.code==='KeyE'&&!paused&&!journalOpen){if(dialogue){advanceDialogue();return;}if(combat.busy)return;const n=nearestInteractable();if(n&&n.type!=='npc')player.interactT=0;interact();}
});
canvas.addEventListener('wheel',e=>{if(!player.thirdPerson)return;e.preventDefault();player.zoom=THREE.MathUtils.clamp(player.zoom+Math.sign(e.deltaY)*.65,3.3,9.5);},{passive:false});
window.addEventListener('keyup',e=>{keyState.delete(e.code);if(e.code==='KeyR')heavyPressed(false);if(e.code==='KeyC')guardPressed(false);
  // Dash on a tap of Shift; holding it sprints instead (released without dashing).
  if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&shiftDownAt>=0){if((performance.now()-shiftDownAt)/1000<SPRINT.hold)evadePressed();shiftDownAt=-1;}});
window.addEventListener('blur',()=>{keyState.clear();shiftDownAt=-1;guardPressed(false);heavyPressed(false);});
document.addEventListener('mousemove',e=>{
  if(paused)return;
  const locked=document.pointerLockElement===canvas,rightDrag=!!(e.buttons&2)&&(locked||e.target===canvas);
  if(player.thirdPerson){
    // Third person: hold the right mouse button to orbit (with or without pointer lock).
    if(!rightDrag)return;
    // While locked on, the camera follows the fight; a hard flick switches target.
    if(lockTarget){lockFlick+=e.movementX;if(Math.abs(lockFlick)>140){switchTarget(Math.sign(lockFlick));lockFlick=0;}}
    else player.cameraYaw-=e.movementX*.0024;
    player.camElev=THREE.MathUtils.clamp(player.camElev+e.movementY*.0022,MIN_ELEVATION,MAX_ELEVATION);
    return;
  }
  // First person: normal mouse-look (pointer lock), or right-drag without it.
  if(!locked&&!rightDrag)return;
  player.cameraYaw-=e.movementX*.0021;
  player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.00185,-1.35,1.35);
});
let lockFlick=0;
canvas.addEventListener('mousedown',e=>{
  if(paused)return;
  if(e.button===1){e.preventDefault();toggleLock();return;}
  if(e.button===2){e.preventDefault();return;}          // right button: camera orbit
  if(e.button!==0)return;
  if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.()?.catch?.(()=>{});
  attackPressed();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(pixelRatio);});

// ---------------------------------------------------------------- targeting
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

// The Rootwell's memory floats over the pool and the Shrine's inside the giant tree, so both answer from their edges.
const ECHO_REACH={rootwell:9,ruins:4.9,shrine:7.8};
function nearestInteractable(){
  const d=(p)=>Math.hypot(p.x-player.x,p.z-player.z);
  const npc=Object.entries(NPCS).map(([id,n])=>({id,n,dist:d(n)})).filter(v=>v.dist<3.3).sort((a,b)=>a.dist-b.dist)[0];
  if(npc)return{type:'npc',id:npc.id,value:npc.n};
  if(warden?.state==='released'&&story.stage==='gate'&&d(warden)<8)return{type:'orrun'};
  const echo=world.echoes.find(e=>!memories.has(e.id)&&d(e)<ECHO_REACH[e.id]+mech.echoReach);
  if(echo)return{type:'echo',value:echo};
  if(d(GATE)<6)return{type:'gate'};
  // The brazier in Mossgate's square and the homestead hearth both restore you.
  if((d(world.city.rest)<4.2||d(world.home.rest)<4.2)&&(player.health<maxHealth()||player.flasks<mech.flasks))return{type:'rest'};
  return null;
}
function interact(){
  const nearby=nearestInteractable();if(!nearby)return;
  if(nearby.type==='npc')openDialogue(nearby.id);
  else if(nearby.type==='orrun')openDialogue('orrun',{lines:RELEASE_LINES});
  else if(nearby.type==='echo'){
    const e=nearby.value,locked=story.memoryLocked(e.id);
    if(locked){toast(...locked);playTone(180,.3,.04);return;}
    const c=CHAPTERS.find(c=>c.id===e.id);
    memories.add(e.id);story.remember(e.id);e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;persist();playTone(690,.7,.11,'sine');playTone(1040,.6,.05,'triangle');
    toast(`MEMORY FOUND · ${c.memoryTitle}`,`${c.memoryText}<br><br>${story.info.objective}`);toastTimer=7;
  }else if(nearby.type==='gate'){
    if(story.before('gate')){toast('THE GATE IS SEALED','Roots have grown through the stone, and something beneath it is holding on. The forest has not remembered it yet.');return;}
    if(story.stage==='gate'){toast('ORRUN HOLDS THE GATE','Its roots bind the stone shut. Face it, and remember its name.');return;}
    done=true;paused=true;ending.classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();playTone(540,1.1,.1);
  }else if(nearby.type==='rest'){player.health=maxHealth();player.flasks=mech.flasks;player.secondWindUsed=false;playTone(490,.4,.07);toast(Math.hypot(world.home.rest.x-player.x,world.home.rest.z-player.z)<4.2?'ROOTWARD HOMESTEAD':'THE BRAZIER RESTORES YOU','Vitality restored. Sap Flasks refilled.');}
}

// ----------------------------------------------------------------- dialogue
// E (or click) reveals the rest of a line, then moves to the next; walking
// away ends the conversation. Story conversations advance the quest when
// they finish, and may wake the chapter's hollowed.
function openDialogue(id,conversation=null){
  const conv=conversation||story.talk(id,profile.name),who=speakerOf(id),lines=[...conv.lines];
  if(!conversation){
    // Idle talk remembers what you chose to discuss (ChatGPT Sites design); a chronicle offer follows the story.
    const stance=chronicles.stances[id],topic=stance&&TOPICS[id]?.find(t=>t[0]===stance);
    if(!conv.then&&topic)lines[0]+=` Last time you asked me, “${topic[1]}” I remember.`;
    const offer=chronicles.openingFor(id);if(offer)lines.push(offer);
  }
  dialogue={id,...conv,lines,i:0,chars:0,opened:elapsed,custom:!!conversation,choices:null};if(npcs[id])npcs[id].talking=true;
  $('dialogueName').textContent=who.name;$('dialogueTitle').textContent=who.title;
  $('dialogue').classList.remove('hidden');renderDialogue();playTone(520,.12,.025,'triangle');
}
function renderDialogue(){
  const d=dialogue,line=d.lines[d.i],shown=Math.min(line.length,Math.floor(d.chars));
  $('dialogueText').textContent=line.slice(0,shown);
  $('dialogueChoices').innerHTML=d.choices?d.choices.map(([,label],i)=>`<button type="button" data-choice="${i}"><b>${i+1}</b>${esc(label)}</button>`).join(''):'';
  $('dialogueHint').innerHTML=d.choices?'<b>1–'+d.choices.length+'</b> OR CLICK · CHOOSE':shown<line.length?'<b>E</b> · SKIP':d.i<d.lines.length-1?`<b>E</b> · CONTINUE <em>${d.i+1} / ${d.lines.length}</em>`:d.custom?'<b>E</b> · FAREWELL':'<b>E</b> · CONTINUE';
}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/** A story conversation moves the quest on as soon as its last line is heard. */
function applyStoryStep(d){
  if(d.applied||!d.then)return;d.applied=true;
  const from=story.stage;story.advance(d.then);
  if(from==='trial_report'){player.flasks=mech.flasks;player.health=maxHealth();}
  if(d.spawn)spawnEncounter(d.spawn);
  persist();toast('NEW OBJECTIVE',story.info.objective);playTone(620,.35,.05,'sine');
}
/** Dialogue choices: a chronicle action if this person has one, what you can ask about, and farewell. */
function showChoices(){
  const d=dialogue,quest=chronicles.choiceFor(d.id);
  d.choices=[...(quest?[quest]:[]),...(TOPICS[d.id]||[]),['farewell','Farewell.','']];
  if(document.pointerLockElement)document.exitPointerLock();renderDialogue();
}
function chooseDialogue(index){
  const d=dialogue;if(!d?.choices)return;const choice=d.choices[index];if(!choice)return;
  const [key,,reply]=choice;
  if(key==='farewell'){closeDialogue(true);return;}
  let text=reply;
  if(/^(accept|turnin|remind):/.test(key)){
    const q=CHRONICLES.find(q=>q.id===key.split(':')[1]),extra=chronicles.choose(key);
    if(key.startsWith('accept'))toast('CHRONICLE ACCEPTED',q.title);
    if(key.startsWith('turnin')){toast('CHRONICLE COMPLETE',q.title);playTone(660,.5,.05,'sine');}
    if(extra)text+=` ${extra}`;
  }else chronicles.stances[d.id]=key;
  if(npcs[d.id])npcs[d.id].expression=/^(accept|turnin)/.test(key)?'warm':key==='doubt'||key==='boast'?'stern':'warm';
  persist();d.lines=[text];d.i=0;d.chars=0;d.choices=null;d.replying=true;renderDialogue();playTone(430,.08,.025,'triangle');
}
function advanceDialogue(){
  const d=dialogue;if(!d||d.choices)return;
  const line=d.lines[d.i];
  if(d.chars<line.length){d.chars=line.length;renderDialogue();return;}
  if(++d.i<d.lines.length){d.chars=0;renderDialogue();playTone(460,.05,.012,'triangle');return;}
  d.i=d.lines.length-1;applyStoryStep(d);
  if(d.custom){closeDialogue(true);return;}
  showChoices();
}
function closeDialogue(finished){
  const d=dialogue;if(!d)return;dialogue=null;
  $('dialogue').classList.add('hidden');if(npcs[d.id]){npcs[d.id].talking=false;npcs[d.id].expression='neutral';}
  if(finished&&d.id==='orrun'){finishStory();return;}
  if(d.choices!==undefined&&started&&!paused)canvas.requestPointerLock?.()?.catch?.(()=>{});
}
function updateDialogue(dt){
  if(!dialogue)return;
  const n=speakerOf(dialogue.id);
  if(Math.hypot(n.x-player.x,n.z-player.z)>(dialogue.id==='orrun'?11:5.5)){closeDialogue(false);return;}
  const line=dialogue.lines[dialogue.i];
  if(dialogue.chars<line.length){dialogue.chars=Math.min(line.length,dialogue.chars+dt*62);renderDialogue();}
  else if(dialogue.replying){dialogue.replying=false;}
}
$('dialogue').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b){e.stopPropagation();chooseDialogue(Number(b.dataset.choice));}});

/** Orrun is released: the gate roots wither, the story ends, the gate opens. */
function finishStory(){
  story.advance('end');persist();witherT=0;
  toast('THE FOREST REMEMBERS','Orrun is released. The Canopy Gate stands open.');playTone(540,1.4,.1);playTone(810,1.2,.05,'triangle');
  setTimeout(()=>{if(story.stage!=='end')return;done=true;paused=true;ending.classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();},3500);
}
let witherT=-1;
function updateBoss(rawDt){
  if(warden){
    warden.setSealed(story.before('gate'));
    if(gateRoots&&witherT>=0){witherT+=rawDt;const k=Math.max(0,1-witherT/3.5);gateRoots.scale.set(1,k,1);gateRoots.visible=k>0;}
  }
  // One boss bar: the Warden while it fights, otherwise the Old Shell once it is roused.
  const boss=warden?.awake&&warden.alive?warden:null;
  if(boss!==bossShown){bossShown=boss;bossTrail=1;$('bossBar').classList.toggle('hidden',!boss);}
  if(boss){
    const f=boss.health/boss.maxHealth;bossTrail=Math.max(f,bossTrail-rawDt*.25);
    $('bossName').textContent=boss.name;
    $('bossFill').style.width=`${f*100}%`;$('bossTrail').style.width=`${bossTrail*100}%`;$('bossBar').classList.toggle('phase2',warden.phase>1);
  }
}
// Boss intro shots (Monster Hunter style): the camera swings low beside the
// boss as it wakes, holds on it, then eases back to the shoulder. Once each per visit.
const introsSeen=new Set();
function introShot(c,duration){
  if(!player.thirdPerson||introsSeen.has(c)||dev.open)return;introsSeen.add(c);
  const gy=groundY(c.x,c.z),dx=player.x-c.x,dz=player.z-c.z,d=Math.hypot(dx,dz)||1,reach=c===warden?9:6;
  const to=new THREE.Vector3(c.x+(dx*reach-dz*reach*.45)/d,gy+1.1,c.z+(dz*reach+dx*reach*.45)/d);
  to.y=Math.max(to.y,groundY(to.x,to.z)+.8);
  const lookTo=new THREE.Vector3(c.x,gy+(c.focusHeight??1.5),c.z);
  shoulderCam.playCinematic({from:camera.position,to,lookFrom:new THREE.Vector3(player.x,groundY(player.x,player.z)+1.6,player.z),lookTo,duration});
}
function handleBossEvent(c,ev){
  if(ev.type==='awaken'){introShot(c,2.2);sound.roar();toast('ORRUN, THE HOLLOW WARDEN','It wakes. Strike its head and legs to topple it; parry the bite.');lockTarget=lockTarget||c;return true;}
  if(ev.type==='roar'){sound.roar();cameraKick=Math.max(cameraKick,.12);cue('ROAR',.7);return true;}
  if(ev.type==='phase'){toast('THE HOLLOWING DEEPENS','The memories on its back burn brighter. Roots will rise beneath you.');return true;}
  if(ev.type==='tailBroken'){sound.topple();slowMo(.35,.35);shoulderCam.punch(.3);toast('TAIL CLUB BROKEN','Its tail strikes are shorter and lighter now, and the hammer no longer cracks the ground.');return true;}
  if(ev.type==='enrage'){sound.enrage();toast('ORRUN IS ENRAGED','Faster, and more roots');return true;}
  if(ev.type==='shockwave'){effects.shockwave(ev.point,ev.from,ev.to,ev.duration);kick(c,.12);cameraKick=Math.max(cameraKick,.1);return true;}
  if(ev.type==='erupt'){sound.erupt();effects.chips(new THREE.Vector3(ev.x,groundY(ev.x,ev.z)+.3,ev.z));return true;}
  if(ev.type==='skid'){effects.ring(new THREE.Vector3(ev.x,groundY(ev.x,ev.z),ev.z));return true;}
  if(ev.type==='leash'){toast('ORRUN RETURNS TO ITS ROOTS','Leave the Hollow and it heals.');return true;}
  if(ev.type==='windup'){sound.wardenWindup(ev.attack);cue(BOSS_CUES[ev.attack],.8);debug.note(`Warden → TELEGRAPH ${ev.attack}`,elapsed);return true;}
  if(ev.type==='attack'){sound.wardenAttack(ev.attack);return true;}
  return false;
}
const BOSS_CUES={tailspin:'TAIL SPIN · DASH THROUGH OR BACK OFF',tailslam:'TAIL HAMMER · SIDESTEP THE TIP',pounce:'POUNCE · DASH UNDER IT',bite:'BITE · PARRY OR DASH',stomp:'STOMP · JUMP OR DASH THROUGH THE WAVE',sweep:'TAIL SWEEP · GET CLEAR',charge:'CHARGE · DASH ASIDE',erupt:'ROOTS STIRRING · KEEP MOVING'};

// ------------------------------------------------------------------ dev mode
// F2 and the password: test any part of the map, any weapon, any class and
// any point in the story without playing up to it. Adapted from the ChatGPT
// Sites developer panel.
const dev={open:false,invulnerable:false,noclip:false,showColliders:false,breath:false};
const devPanel=$('devPanel');
const perfPanel=document.createElement('pre');perfPanel.id='perfPanel';perfPanel.style.display='none';document.body.appendChild(perfPanel);
let showPerf=false,fpsFrames=0,fpsTime=0;
function togglePerf(){showPerf=!showPerf;perfPanel.style.display=showPerf?'block':'none';}
const collisionViz=new THREE.Group(),collisionVizMeshes=[];
{const g=new THREE.RingGeometry(.92,1,28),m=new THREE.MeshBasicMaterial({color:0xffc86a,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false});
  for(let i=0;i<64;i++){const r=new THREE.Mesh(g,m);r.rotation.x=-Math.PI/2;r.visible=false;collisionViz.add(r);collisionVizMeshes.push(r);}}
scene.add(collisionViz);
function updateCollisionViz(){
  collisionViz.visible=dev.showColliders;if(!dev.showColliders)return;
  const near=[...new Set([[0,0],[8,0],[-8,0],[0,8],[0,-8]].flatMap(([dx,dz])=>collisionGrid.near(player.x+dx,player.z+dz)))]
    .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  collisionVizMeshes.forEach((r,i)=>{const c=near[i];r.visible=!!c;if(c){r.position.set(c.x,groundY(c.x,c.z)+.06,c.z);r.scale.setScalar(c.r+.43);}});
}
$('devStage').innerHTML=STAGES.map(s=>`<option value="${s.id}">${s.id.toUpperCase().replace(/_/g,' ')} · ${s.objective}</option>`).join('');
function updateDevTelemetry(){
  const s=stats(),w=equippedWeapon();
  $('devTelemetry').textContent=`X ${player.x.toFixed(1)}  Z ${player.z.toFixed(1)}  GROUND ${groundY(player.x,player.z).toFixed(2)}\nSTAGE ${story.stage}  ·  ${story.info.objective}\nSTR ${s.strength}  SPD ${s.speed}  STA ${s.stamina}  DEF ${s.defense}  INT ${s.intelligence}  DIS ${s.discipline}\nCLASS ${mech.klass.toUpperCase()}  ·  WEAPON ${w.toUpperCase()}${devOverrides.anyWeapon?' (DEV)':''}\nHP ${player.health}/${maxHealth()}  BREATH ${Math.round(player.stamina)}  JUMP ${mech.doubleJump?'DOUBLE':'SINGLE'}`;
  devPanel.querySelectorAll('[data-dev]').forEach(b=>b.classList.toggle('active',!!({invulnerable:dev.invulnerable,noclip:dev.noclip,colliders:dev.showColliders,breath:dev.breath,fps:showPerf,debug:debug.enabled})[b.dataset.dev]));
  devPanel.querySelectorAll('[data-weapon]').forEach(b=>b.classList.toggle('active',b.dataset.weapon==='locks'?!devOverrides.anyWeapon:devOverrides.anyWeapon&&profile.appearance.weapon===b.dataset.weapon));
  devPanel.querySelectorAll('[data-class]').forEach(b=>b.classList.toggle('active',profile.appearance.discipline===b.dataset.class));
  $('devStage').value=story.stage;
}
// Dev mode is hidden (no button or hint): F2 asks for the password once per tab.
// It only keeps players out of the panel by accident; it is not real security.
const DEV_KEY='F2',DEV_PASSWORD='bob';
function devUnlocked(){
  try{if(sessionStorage.getItem('verdant-dev')==='1')return true;}catch{}
  if(document.pointerLockElement)document.exitPointerLock();
  const ok=(prompt('Password')||'').trim().toLowerCase()===DEV_PASSWORD;
  if(ok)try{sessionStorage.setItem('verdant-dev','1');}catch{}
  return ok;
}
function toggleDev(open=!dev.open){
  if(!started)return;
  if(open&&!devUnlocked()){canvas.requestPointerLock?.()?.catch?.(()=>{});return;}
  dev.open=open;devPanel.classList.toggle('hidden',!open);keyState.clear();
  if(open){paused=true;if(document.pointerLockElement)document.exitPointerLock();updateDevTelemetry();}
  else{paused=false;shell?.hide();$('hud').classList.remove('hidden');canvas.requestPointerLock?.()?.catch?.(()=>{});}
}
function teleport(x,z,label){
  player.x=x;player.z=z;player.height=0;player.velocityY=0;player.vx=player.vz=0;player.grounded=true;player.jumpCount=0;player.defeated=0;
  lockTarget=null;combat.state='move';combat.t=0;cameraKick=0;viewBlend=0;toast(`DEV · ${label}`,'Moved to solid ground.');
}
const DEV_PLACES={home:[world.home.spawn.x,world.home.spawn.z,'HOME BASE'],city:[0,45,'MOSSGATE'],trial:[1,33,'TRIAL SLOPE'],rootwell:[-52,-33,'ROOTWELL'],
  ruins:[53,-76,'MOSSWATCH'],shrine:[4,-139,'CANOPY SHRINE'],hollow:[ARENA.x-2,ARENA.z+17,"WARDEN'S HOLLOW"],hunt:[HUNT.x,HUNT.z+13,'THE SCORCHED HOLLOW']};
// Real-life stat presets on the adult norms (profile.js): median adult, top ~5%, top 0.1%, and bottom ~5%.
const STAT_PRESETS={
  weak:{pushups:1,pullups:0,dashSeconds:8.8,verticalJumpCm:20,mileSeconds:1100,benchPressKg:12},
  default:{pushups:10,pullups:0,dashSeconds:6.4,verticalJumpCm:37,mileSeconds:690,benchPressKg:35},
  athlete:{pushups:40,pullups:10,dashSeconds:5.1,verticalJumpCm:56,mileSeconds:420,benchPressKg:75},
  max:{pushups:100,pullups:25,dashSeconds:4.45,verticalJumpCm:75,mileSeconds:300,benchPressKg:140}};
/** Jump straight to a story stage: earlier chapters count as done. */
function devJumpTo(stage){
  const at=STAGES.findIndex(s=>s.id===stage);
  const idx=id=>STAGES.findIndex(s=>s.id===id);
  for(const c of CHAPTERS){
    if(idx(`${c.id}_fight`)<at)story.cleared.add(c.id);
    if(idx(`${c.id}_memory`)<at){memories.add(c.id);const e=world.echoes.find(e=>e.id===c.id);if(e)e.crystal.visible=e.ring.visible=e.light.visible=false;}
  }
  resetEncounters();story.advance(stage);
  if(story.reached('end')){warden?.release(true);if(gateRoots)gateRoots.visible=false;}else if(warden&&!warden.alive){warden.reset();if(gateRoots){gateRoots.visible=true;gateRoots.scale.set(1,1,1);}witherT=-1;}
  persist();toast('DEV · STORY',story.info.objective);
}
devPanel.addEventListener('change',e=>{if(e.target.id==='devStage')devJumpTo(e.target.value);updateDevTelemetry();});
devPanel.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;e.stopPropagation();
  if(b.dataset.teleport){const [x,z,label]=DEV_PLACES[b.dataset.teleport];teleport(x,z,label);}
  else if(b.dataset.weapon){
    if(b.dataset.weapon==='locks'){devOverrides.anyWeapon=false;toast('DEV · STAT LOCKS ON',`In hand: ${equippedWeapon().toUpperCase()}`);}
    else{devOverrides.anyWeapon=true;profile.appearance.weapon=b.dataset.weapon;saveProfile();toast('DEV · WEAPON',b.dataset.weapon.toUpperCase());}
    equipWeapon();
  }
  else if(b.dataset.class){profile.appearance.discipline=b.dataset.class;saveProfile();mech=mechanics();player.health=Math.min(player.health,maxHealth());toast('DEV · CLASS',b.dataset.class.toUpperCase());}
  else if(b.dataset.preset){Object.assign(profile.inputs,STAT_PRESETS[b.dataset.preset]);saveProfile();mech=mechanics();player.health=maxHealth();player.stamina=100;equipWeapon();toast('DEV · STAT PRESET',b.dataset.preset.toUpperCase());}
  else switch(b.dataset.dev){
    case 'close':toggleDev(false);return;
    case 'reset':teleport(world.home.spawn.x,world.home.spawn.z,'UNSTUCK');break;
    case 'heal':player.health=maxHealth();player.stamina=100;player.winded=false;player.flasks=mech.flasks;player.defeated=0;toast('DEV · RESTORED');break;
    case 'invulnerable':dev.invulnerable=!dev.invulnerable;break;
    case 'breath':dev.breath=!dev.breath;break;
    case 'noclip':dev.noclip=!dev.noclip;break;
    case 'colliders':dev.showColliders=!dev.showColliders;updateCollisionViz();break;
    case 'fps':togglePerf();break;
    case 'debug':debug.toggle();break;
    case 'stage':devJumpTo($('devStage').value);break;
    case 'next':{const i=STAGES.findIndex(s=>s.id===story.stage);if(i<STAGES.length-1)devJumpTo(STAGES[i+1].id);break;}
    case 'defeat-nearby':{let n=0;for(const c of creatures)if(c.alive&&c!==warden&&Math.hypot(c.x-player.x,c.z-player.z)<30){c.hit({damage:1e6,poise:0,fromX:player.x,fromZ:player.z,push:0,stagger:0,part:'head'});n++;}
      if(warden?.alive&&warden.awake&&Math.hypot(warden.x-player.x,warden.z-player.z)<30){warden.hit({damage:1e6,poise:0,fromX:player.x,fromZ:player.z,stagger:0,part:'head'});n++;}
      toast('DEV · CLEARED',`${n} defeated.`);break;}
    case 'unlock-memories':devJumpTo('gate');break;
    case 'wake':if(story.before('gate'))devJumpTo('gate');warden?.setSealed(false);warden?.wake();teleport(ARENA.x,ARENA.z+8,"WARDEN'S HOLLOW");break;
    case 'reset-world':
      memories.clear();story.cleared.clear();resetEncounters();story.advance('meet_sela');
      for(const e of world.echoes)e.crystal.visible=e.ring.visible=e.light.visible=true;
      warden?.reset();if(gateRoots){gateRoots.visible=true;gateRoots.scale.set(1,1,1);}witherT=-1;chronicles.reset();persist();toast('DEV · STORY RESET');break;
    case 'new-game':
      // Erase this browser's explorer and story, then start from the intro as a new player would.
      if(!confirm('Start a new game? This erases the explorer, measurements, training log and story saved in this browser.'))break;
      try{localStorage.removeItem('hollow-roots-verdant-3d-profile-v1');localStorage.removeItem('verdant-reach-3d-v1');}catch{}
      location.href=location.pathname;return;
  }
  updateDevTelemetry();
});

// --------------------------------------------------------------------- co-op
// Lobby codes (ChatGPT Sites design) over Supabase Realtime: friends appear as
// block figures, and recovered memories and cleared nests are shared.
const coop=createCoop(scene,{player,groundY,getName:()=>profile.name||'Wayfarer',getAppearance:()=>profile.appearance,onWorld:applyWorld,onHit:applyTeamHit,onSpawn:id=>{if(CHAPTERS.some(c=>c.id===id))spawnEncounter(id);},
  getShared:()=>({memories:[...memories],cleared:[...story.cleared]}),
  onShared:shared=>{
    let changed=false;
    for(const id of shared.memories||[])if(SITES.some(s=>s.id===id)&&!memories.has(id)){memories.add(id);const e=world.echoes.find(e=>e.id===id);if(e)e.crystal.visible=e.ring.visible=e.light.visible=false;changed=true;}
    for(const id of shared.cleared||[])if(CHAPTERS.some(c=>c.id===id)&&!story.cleared.has(id)){
      story.cleared.add(id);if(spawned.has(id)){creatures.filter(c=>c.chapter===id).forEach(c=>c.sleep());spawned.delete(id);}changed=true;}
    if(changed){const before=story.stage;story.advance(story.stage);persist();toast('CO-OP · PROGRESS SHARED',story.stage!==before?story.info.objective:'Your party’s discoveries are yours too.');}
  }});

// ---------------------------------------------------------------- encounters
// The hollowed gather only at the site of the chapter being played: they rise
// out of the roots when its keeper sends you in, or when you walk into the
// site first. A chapter's nest stays cleared once it is cleared; if you fall,
// the survivors sink back and rise again when you return.
function spawnEncounter(id){
  if(spawned.has(id)||story.cleared.has(id))return;
  spawned.add(id);
  const mobs=creatures.filter(c=>c.chapter===id&&c.extra===undefined);
  mobs.forEach(c=>{c.emerge();effects.ring(new THREE.Vector3(c.x,groundY(c.x,c.z),c.z));});
  raised[id]=0;raiseExtras(id);
  sound.attack('slam');sound.enrage();cue('THE HOLLOWED RISE',1.4);
  debug.note(`encounter ${id}: ${mobs.length+raised[id]} hollowed rise`,elapsed);
}
// Team fights: each nest gets two more hollowed for every extra explorer, so
// everyone has two to deal with. Someone joining mid-fight raises two more.
const raised={};
function extraFor(ch,k){let m=byNet(`x:${ch.id}:${k}`);if(!m){m=extraHollowed(scene,ch,k,collisionGrid);creatures.push(m);}return m;}
function raiseExtras(id){
  if(!coop.authority)return;
  const ch=CHAPTERS.find(c=>c.id===id),want=2*(coop.teamSize-1);
  for(let k=raised[id]||0;k<want;k++){const m=extraFor(ch,k);m.emerge();effects.ring(new THREE.Vector3(m.x,groundY(m.x,m.z),m.z));}
  raised[id]=Math.max(raised[id]||0,want);
}
let askedAt=-9;
function updateEncounters(){
  if(story.stage==='trial'&&creatures.some(c=>c.id==='trial'&&c.state==='defeated')){story.advance('trial_report');persist();toast('THE TRIAL IS PASSED',story.info.objective);playTone(620,.35,.05,'sine');}
  const ch=story.chapter,step=story.info.step;
  if(ch&&!story.cleared.has(ch.id)&&!spawned.has(ch.id)&&(step==='find'||step==='fight')){
    const d=Math.hypot(player.x-ch.site.x,player.z-ch.site.z);
    // A guest asks the host, whose game runs the nest (it rises for everyone).
    if(d<(step==='fight'?24:12)){if(!coop.guest)spawnEncounter(ch.id);else if(elapsed-askedAt>1){askedAt=elapsed;coop.sendSpawn(ch.id);}}
  }
  for(const id of spawned){
    const mobs=creatures.filter(c=>c.chapter===id);
    if(mobs.every(c=>c.state==='dormant')){spawned.delete(id);continue;}   // the host's nest sank back
    raiseExtras(id);
    if(mobs.some(c=>c.alive))continue;
    spawned.delete(id);delete raised[id];story.clear(id);persist();
    const c=CHAPTERS.find(c=>c.id===id);
    playTone(560,.6,.06,'triangle');playTone(840,.5,.03,'sine');
    toast(`${c.site.title} IS CLEAR`,story.info.step==='memory'?story.info.objective:`Speak with ${keeperName(c.npc)}.`);
  }
}
function resetEncounters(){
  for(const id of spawned)creatures.filter(c=>c.chapter===id).forEach(c=>c.sleep());
  spawned.clear();for(const id in raised)delete raised[id];
}
// Real-life stats and class decide these numbers (mechanics.js); refreshed every frame.
let mech=mechanics();
function maxHealth(){return mech.maxHealth;}
/** Show the weapon actually in hand (stat-gated; dev mode can override). */
function equipWeapon(){const w=equippedWeapon();avatar.setWeapon?.(w);hands.setWeapon(w);}
// Real-world strength scales strike damage; turtles never grant XP.
const strikePower=()=>mech.damage*weaponPower(equippedWeapon());
function hurtPlayer(from,kind='light',damage=1){
  closeDialogue(false);
  if(dev.invulnerable){cue('DEV · NO DAMAGE',.45);return;}
  // Stoneframe: heavy blows stagger instead of knocking you down (the damage still lands).
  if(kind==='heavy'&&mech.steadfast){kind='light';cue('STEADFAST',.5);}
  player.health=Math.max(0,player.health-damage);combat.hurt(from.x,from.z,player.x,player.z,kind);sound.bite();
  $('vignette').style.background='radial-gradient(ellipse,transparent 24%,rgba(143,42,42,.6) 100%)';
  setTimeout(()=>{$('vignette').style.background='';},240);
  hitstop=Math.max(hitstop,kind==='heavy'?.12:.08);kick(from,kind==='heavy'?.14:.07);shoulderCam.punch(kind==='heavy'?.3:.12);combo=0;
  checkDefeated();
}
function checkDefeated(){
  // Trueframe: once per rest, a blow that would drop you leaves you standing.
  if(player.health<=0&&mech.secondWind&&!player.secondWindUsed){player.health=1;player.secondWindUsed=true;slowMo(.3,.6);cue('SECOND WIND',1.1);toast(mech.frame==='balanced'?'SECOND WIND':'UNBROKEN WILL',`${mech.frame==='balanced'?'Your balanced frame':'Your discipline'} keeps you standing · rest to renew it`);return;}
  if(player.health<=0){player.defeated=2.2;lockTarget=null;combat.state='move';}
}
function respawn(){
  // You wake at the homestead; once the story reaches the gate, at Pip's lookout below the Hollow.
  const checkpoint=story.reached('gate')&&!story.reached('end');
  if(warden?.awake&&warden.alive)warden.reset();
  player.defeated=0;player.health=maxHealth();player.x=checkpoint?2:world.home.spawn.x;player.z=checkpoint?-147:world.home.spawn.z;player.height=0;player.velocityY=0;player.yaw=combat.facing=0;player.cameraYaw=0;
  player.pitch=0;cameraKick=0;viewBlend=0;camera.rotation.set(0,0,0,'YXZ');resetEncounters();player.flasks=mech.flasks;player.secondWindUsed=false;
  if(checkpoint){player.yaw=combat.facing=player.cameraYaw=yawOf(BED.x-player.x,BED.z-player.z);}
  toast('THE ROOTS RETURN YOU TO THE TRAIL',checkpoint?'You wake below the Hollow. Orrun sleeps again.':'The memories you found remain with you.');
}

// ------------------------------------------------------------ combat events
// Game-feel helpers: brief slow motion, a camera nudge along the blow (never a
// shake), a small field-of-view punch, and floating damage numbers.
function slowMo(scale,seconds){if(scale<slowmo.scale||slowmo.left<=0)slowmo={scale,left:seconds};}
const camKick=new THREE.Vector3();let fovKick=0;
function kick(from,amount){const d=new THREE.Vector3(player.x-from.x,0,player.z-from.z);if(d.lengthSq()>1e-6)camKick.addScaledVector(d.normalize(),amount);}
const damageLayer=document.createElement('div');damageLayer.id='damageLayer';document.body.appendChild(damageLayer);const numbers=[];
function damageNumber(point,value,effect){
  const el=document.createElement('span');el.className=`dmg ${effect}`;el.textContent=Math.round(value);damageLayer.appendChild(el);
  numbers.push({el,point:point.clone(),life:.9,drift:(Math.random()-.5)*.4});
}
function updateNumbers(dt){
  for(let i=numbers.length-1;i>=0;i--){const n=numbers[i];n.life-=dt;n.point.y+=dt*.9;n.point.x+=n.drift*dt;
    const v=n.point.clone().project(camera),show=v.z<1&&n.life>0;
    n.el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-50%) scale(${.9+Math.max(0,n.life-.7)*1.5})`;
    n.el.style.opacity=show?Math.min(1,n.life*2.5):0;if(n.life<=0){n.el.remove();numbers.splice(i,1);}}
}
function spend(amount){if(!amount)return;player.stamina=Math.max(0,player.stamina-amount*mech.staminaCost);staminaRest=STAMINA.delay;
  // Emptying Breath leaves you winded: no attacks or dashes until it refills to 30 (after Rotten Souls, MIT).
  if(player.stamina<=0&&!player.winded){player.winded=true;cue('WINDED',.8);sound.tired();}}
function critTarget(){
  // A toppled or parried creature within reach opens the Root Strike.
  return creatures.find(c=>c.alive&&c.exposed&&Math.hypot(c.x-player.x,c.z-player.z)-c.radius<1.7)||null;
}
function handleCombatEvents(){
  for(const ev of combat.events){
    if(ev.type==='swing'){coop.sendAct();sound.swing(ev.move);cue(MOVES[ev.move].label.toUpperCase(),.22);}
    else if(ev.type==='spend')spend(ev.amount);
    else if(ev.type==='evade'){sound.evade();cue('DASH',.3);}
    else if(ev.type==='perfect'){sound.evadedAttack();slowMo(.3,.4);player.stamina=Math.min(100,player.stamina+15);cue('PERFECT EVADE · COUNTER',.9);debug.note('PERFECT EVADE → slow motion, counter window 1.4 s',elapsed);}
    else if(ev.type==='rootbreaker'){cue(`${MOVES[ev.move].label.toUpperCase()} · HOLD TO CHARGE`,.6);sound.charge(0);}
    else if(ev.type==='slam'){
      // The Earthsplitter's shockwave: everything within reach of the impact takes a share.
      const at=new THREE.Vector3(ev.x,groundY(ev.x,ev.z),ev.z);
      effects.shockwave(at,.5,ev.radius,.35);shoulderCam.punch(.35+ev.chargeLevel*.12);sound.attack('slam');
      for(const c of creatures){
        if(!c.alive||Math.hypot(c.x-ev.x,c.z-ev.z)>ev.radius+(c.radius||1))continue;
        const res=strikeCreature(c,{damage:ev.damage*strikePower()*(ev.chargeLevel>0?mech.chargedDamage:1),poise:ev.poise*strikePower()*mech.poise,fromX:ev.x,fromZ:ev.z,push:1.2,stagger:.8,part:c===warden?'leg':'shell',pierce:ev.pierce});
        if(res){damageNumber(new THREE.Vector3(c.x,groundY(c.x,c.z)+1,c.z),res.damage,res.effect);if(res.toppled){sound.topple();toast('TOPPLED','Its belly is exposed · strike now for a ROOT STRIKE');}}
      }
      cue(MOVES[ev.move].label.toUpperCase(),.7);
    }
    else if(ev.type==='charge'){sound.charge(ev.level);cue(`${(MOVES[combat.move]?.label||'Rootbreaker').toUpperCase()} · CHARGE ${'I'.repeat(ev.level+1)}`,.4);effects.ring(new THREE.Vector3(player.x,groundY(player.x,player.z),player.z));fovKick=Math.max(fovKick,1.5*ev.level);}
    else if(ev.type==='release'&&ev.level)debug.note(`${MOVES[combat.move]?.label||'Heavy'} released at charge ${ev.level}`,elapsed);
    else if(ev.type==='guardUp')sound.guardUp();
    else if(ev.type==='flask'){sound.flask();cue('SAP FLASK',.6);}
    else if(ev.type==='noFlask'){sound.tired();cue('NO SAP LEFT · REST AT THE TRAIL STONE',1.2);}
    else if(ev.type==='heal'){player.flasks--;player.health=Math.min(maxHealth(),player.health+mech.flaskHeal);sound.heal();cue('RESTORED',.6);}
    else if(ev.type==='tired'){sound.tired();$('staminaFill').parentElement.classList.add('flash');setTimeout(()=>$('staminaFill').parentElement.classList.remove('flash'),300);}
    else if(ev.type==='hit'){
      const m=MOVES[ev.move],dir=ev.point.clone().sub(new THREE.Vector3(player.x,ev.point.y,player.z)).normalize();
      const power=strikePower();
      // Mages put Intelligence into charged Rootbreakers; fighters stagger harder.
      const chargePower=/rootbreaker/.test(ev.move)?mech.chargePower:1;
      const charged=ev.chargeLevel>0?mech.chargedDamage:1;   // Titan's Strike
      const res=strikeCreature(ev.target,{damage:ev.damage*power*chargePower*charged,poise:ev.poise*power*chargePower*mech.poise,fromX:player.x,fromZ:player.z,push:ev.push,stagger:ev.stagger*mech.stagger,part:ev.part,pierce:ev.pierce});
      if(!res)continue;
      combo++;comboTimer=2;
      const heavy=ev.heavy;
      sound.hit(ev.move,res.effect,combo);
      if(res.effect==='armored')effects.chips(ev.point);else effects.burst(ev.point,dir.clone().negate(),heavy);
      if(heavy){effects.ring(new THREE.Vector3(ev.target.x,groundY(ev.target.x,ev.target.z),ev.target.z));shoulderCam.punch(res.effect==='armored'?.08:.16);}
      if(ev.ring){effects.shockwave(new THREE.Vector3(ev.point.x,groundY(ev.point.x,ev.point.z),ev.point.z),.4,2.2+ev.chargeLevel*.6,.3);shoulderCam.punch(.25+ev.chargeLevel*.12);}
      damageNumber(ev.point,res.damage,ev.critical?'crit':res.effect);
      hitstop=Math.max(hitstop,ev.hitstop*(res.effect==='armored'?.7:1));player.engaged=4;
      kick({x:ev.target.x,z:ev.target.z},heavy?-.12:-.04);cameraKick=Math.max(cameraKick,heavy?.065:.04);
      cue(ev.critical?'ROOT STRIKE':res.toppled?'TOPPLED':res.defeated?'DRIVEN BACK':ev.counter?'COUNTER':res.effect==='weak'?'WEAK POINT':res.effect==='armored'?'ARMOURED':res.effect==='belly'?'EXPOSED':'SOLID HIT',.5);if(heavy)fovKick=Math.max(fovKick,2.5+ev.chargeLevel*1.5);
      if(ev.critical){slowMo(.35,.45);}
      debug.note(`${m.label}${ev.chargeLevel?` (charge ${ev.chargeLevel})`:''}${ev.counter?' COUNTER':''} → HIT ${ev.part} at t=${ev.t.toFixed(2)}s (active ${m.active.join('–')})  ${res.damage.toFixed(1)} dmg [${res.effect}] · ${ev.target.lastEvent}`,elapsed);
      if(res.toppled){sound.topple();slowMo(.45,.3);toast('TOPPLED','Its belly is exposed · strike now for a ROOT STRIKE');}
      if(res.defeated)creatureDefeated(ev.target);
    }
    else if(ev.type==='blocked'){sound.blocked();effects.chips(ev.point);hitstop=Math.max(hitstop,.05);cue('BLOCKED',.45);debug.note(`${MOVES[ev.move].label} → BLOCKED by an obstacle`,elapsed);}
    else if(ev.type==='whiff'){sound.whiff();cue('MISSED',.3);debug.note(`${MOVES[ev.move].label} → MISS  (${ev.nearest===Infinity?'no creature near':`${ev.nearest.toFixed(2)} m short`})`,elapsed);}
  }
}
// Attack tokens: at most one creature commits to an attack at a time (two once
// any of them is enraged), so a group circles and takes turns instead of swarming.
function mayAttack(self){
  // In a team fight each explorer has their own tokens: count only those after the same one.
  const t=self.target||player,key=self.targetKey??'me';
  const busy=creatures.filter(c=>c!==self&&c.alive&&(c.state==='windup'||c.state==='attack')&&(c.targetKey??'me')===key&&Math.hypot(c.x-t.x,c.z-t.z)<12).length;
  return busy<(creatures.some(c=>c.alive&&c.enraged)?2:1);
}
const ev_attack_slam=c=>c.state==='attack'&&c.attack==='slam'&&c.t<.02;
/** A creature's attack reached the explorer: evade, absorb with hyper-armour, or take it. */
// ------------------------------------------------------------- team fights
// Host-authoritative (coop.js): the host's game runs every creature and sends a
// snapshot ten times a second; guests follow it and send their hits to the host.
const SNAP_KEYS=['x','z','heading','state','t','attack','health','maxHealth','alive','enraged','poise'];
const byNet=id=>creatures.find(c=>c.netId===id);
let snapTimer=0,snapTick=0;
function sendWorld(dt){
  if((snapTimer-=dt)>0)return;snapTimer=.1;snapTick++;
  const out=[];
  for(const c of creatures){
    if(!c.netId||(c.state==='dormant'&&snapTick%10))continue;   // sleeping ones once a second
    const s={id:c.netId,vis:c.root.visible};for(const k of SNAP_KEYS)s[k]=c[k];
    if(c.isBoss)s.shellBroken=!!c.shellBroken;
    if(c===warden){Object.assign(s,{phase:c.phase,awake:c.awake,clubBroken:!!c.clubBroken,chargeRun:!!c.chargeRun,sealed:!!c.sealed});if(c.attack==='erupt'&&c.plan)s.plan=c.plan;}
    out.push(s);
  }
  coop.sendWorld({c:out});
}
function applyWorld(world){
  for(const s of world.c||[]){
    const [x,chId,k]=s.id.split(':'),ch=x==='x'&&CHAPTERS.find(c=>c.id===chId);
    const c=byNet(s.id)||(ch&&s.state!=='dormant'?extraFor(ch,+k):null);if(!c)continue;
    c.net=s;
    // The host's nest rising: show it rising here too.
    if(c.chapter&&c.state==='dormant'&&s.state!=='dormant'&&!spawned.has(c.chapter)&&!story.cleared.has(c.chapter)){spawned.add(c.chapter);sound.attack('slam');sound.enrage();cue('THE HOLLOWED RISE',1.4);}
    if(c===warden&&s.sealed!==undefined&&!!c.sealed!==s.sealed)c.setSealed(s.sealed);
    const wasAlive=c.alive;
    // A new state, or a new attack (the Warden chains attacks inside one state): take the host's timing.
    if(s.state!==c.state||(s.attack??null)!==(c.attack??null)){
      if(c.state==='defeated'&&s.state!=='defeated'&&c!==warden&&c.respawn)c.respawn();
      if(s.state==='dormant'&&c.sleep){c.sleep();continue;}
      if(s.state==='released'&&c===warden){c.release();continue;}
      const newAttack=s.attack&&s.attack!==c.attack;
      c.attack=s.attack??null;c.setState(s.state);c.t=s.t;
      if(newAttack&&['windup','attack','charge'].includes(s.state))(c===warden?c.pending:(c.netEvents||=[])).push({type:'windup',attack:s.attack});
    }else if(Math.abs(c.t-s.t)>.2)c.t=s.t;
    c.health=s.health;c.maxHealth=s.maxHealth;c.alive=s.alive;c.enraged=s.enraged;c.poise=s.poise;c.root.visible=s.vis;
    if(c===warden){c.phase=s.phase;c.awake=s.awake;c.chargeRun=s.chargeRun;if(s.plan&&!c.plan)c.plan=s.plan.map(p=>({...p}));
      if(s.clubBroken&&!c.clubBroken){c.clubBroken=true;if(c.club)c.club.visible=false;}}
    if(wasAlive&&!s.alive&&s.state!=='dormant')creatureDefeated(c);
  }
}
function applyTeamHit(h){
  const c=byNet(h.id);if(!c||!c.alive)return;
  if(h.deflect){c.deflect();return;}
  const res=c.hit(h);
  if(res){damageNumber(new THREE.Vector3(c.x,groundY(c.x,c.z)+1.2,c.z),res.damage,res.effect);if(res.defeated)creatureDefeated(c);}
}
/**
 * Host: whom each creature goes after. Bosses take the nearest explorer. The
 * small hollowed spread out, at most two to an explorer while another nearby
 * has room, and keep their explorer while they can.
 */
function assignTargets(local){
  const who=[{...local,key:'me',ref:local},...coop.others().map(o=>({...o,ref:o}))],load=new Map(who.map(o=>[o.key,0])),out=new Map();
  const d=(c,o)=>Math.hypot(c.x-o.x,c.z-o.z),near=c=>Math.min(...who.map(o=>d(c,o)));
  const small=[];
  for(const c of creatures){
    if(c===warden||c.isBoss||!c.alive||c.state==='dormant')out.set(c,{o:teamTarget(c,local),key:null});
    else small.push(c);
  }
  small.sort((a,b)=>near(a)-near(b));
  for(const c of small){
    const byDist=[...who].sort((a,b)=>d(c,a)-d(c,b)),reach=d(c,byDist[0])+15;
    const free=o=>load.get(o.key)<2&&d(c,o)<reach;
    const pick=byDist.find(o=>o.key===c.targetKey&&free(o))||byDist.find(free)||byDist[0];
    load.set(pick.key,load.get(pick.key)+1);out.set(c,{o:pick.ref,key:pick.key});
  }
  return out;
}
/** Host: the explorer each creature goes after (the nearest one). */
function teamTarget(c,local){
  let best=local,bd=Math.hypot(c.x-local.x,c.z-local.z);
  for(const o of coop.others()){const d=Math.hypot(c.x-o.x,c.z-o.z);if(d<bd){bd=d;best=o;}}
  return best;
}
/** Host, when a creature is after someone else: does its attack still catch you? */
function strikesLocal(c){
  if(!['attack','charge'].includes(c.state)||!c.damageVolumes)return false;
  const feet=groundY(player.x,player.z)+player.height;
  return c.damageVolumes().some(v=>{const d=Math.hypot(v.x-player.x,v.z-player.z);return v.ring?Math.abs(d-v.r)<.55&&player.grounded:d<v.r+.4&&feet<v.y+v.r+.3&&feet+1.8>v.y-v.r;});
}
/** Bosses get tougher with more explorers: +50% health per extra member. */
function scaleBosses(){
  const k=1+.5*(coop.teamSize-1);
  for(const c of [warden]){if(!c)continue;c.baseMax??=c.maxHealth;const want=c.baseMax*k;if(Math.abs(c.maxHealth-want)>.5){c.health*=want/c.maxHealth;c.maxHealth=want;}}
}

/** A creature went down (by your hand, or in a team fight by anyone's). */
function creatureDefeated(c){
  if(c===warden){sound.defeated();sound.roar();slowMo(.2,1.2);lockTarget=null;toast('ORRUN FALLS STILL','The Hollowing drains out of it. Go to it and speak its name.');}
  else{sound.defeated();slowMo(.25,.6);if(lockTarget===c)lockTarget=null;toast('SHELLBACK DRIVEN BACK','Creatures never grant XP. Real effort does.');}
}
/** Strike a creature. In a team fight a guest's hit is also sent to the host, whose game decides. */
function strikeCreature(c,params){
  const res=c.hit(params);
  if(coop.guest&&c.netId)coop.sendHit({id:c.netId,...params});
  return res;
}
function incomingStrike(c,ev){
  if(combat.invulnerable){
    const perfect=combat.perfectWindow;
    if(perfect)combat.perfectEvade();else{sound.evadedAttack();cue('EVADED',.5);}
    debug.note(`${c.type} ${ev.label} → ${perfect?'PERFECT EVADE':'EVADED'} (i-frames)`,elapsed);return;
  }
  // Guard: only attacks from the front arc are blocked.
  const facing={x:-Math.sin(combat.facing),z:-Math.cos(combat.facing)},toward={x:c.x-player.x,z:c.z-player.z},tl=Math.hypot(toward.x,toward.z)||1;
  const inFront=Math.acos(Math.max(-1,Math.min(1,(facing.x*toward.x+facing.z*toward.z)/tl)))<GUARD.arc/2;
  // The Old Shell's quake comes from all around and can be guarded; other rings must be jumped or dashed.
  if(combat.guarding&&(inFront||ev.quake)&&(!ev.ring||ev.quake)){
    if(combat.parrying&&c.deflect()){
      if(coop.guest&&c.netId)coop.sendHit({id:c.netId,deflect:true});
      sound.parry();slowMo(.35,.35);hitstop=Math.max(hitstop,.12);effects.burst(new THREE.Vector3(player.x+toward.x/tl*.6,groundY(player.x,player.z)+1.2,player.z+toward.z/tl*.6),new THREE.Vector3(-toward.x/tl,0,-toward.z/tl),true);
      player.stamina=Math.min(STAMINA.max,player.stamina+mech.parryReward);player.winded=false;
      cue('PARRY · RIPOSTE',.9);debug.note(`${c.type} ${ev.label} → PARRIED (guard raised ${(combat.clock-combat.guardSince).toFixed(2)} s before)`,elapsed);return;
    }
    const cost=GUARD.cost[ev.kind]*mech.guardCost;
    if(player.stamina>=cost){
      spend(cost);combat.onBlocked();sound.block(ev.kind);hitstop=Math.max(hitstop,.06);kick(c,.06);
      const chip=Math.round(ev.damage*GUARD.chip[ev.kind]);if(chip)player.health=Math.max(0,player.health-chip);
      cue(chip?'GUARD · CHIPPED':'BLOCKED',.5);debug.note(`${c.type} ${ev.label} → BLOCKED (-${cost} Breath${chip?`, -${chip} vitality`:''})`,elapsed);
      checkDefeated();
      return;
    }
    player.stamina=0;cue('GUARD BROKEN',.7);debug.note(`${c.type} ${ev.label} → GUARD BROKEN (out of Breath)`,elapsed);hurtPlayer(c,'heavy',ev.damage);return;
  }
  if(combat.state==='flask'&&!combat.healed)cue('FLASK SPILLED',.6);
  if(combat.armored&&ev.kind==='light'){
    player.health=Math.max(0,player.health-ev.damage);sound.bite();hitstop=Math.max(hitstop,.05);
    debug.note(`${c.type} ${ev.label} → absorbed by hyper-armour (-${ev.damage})`,elapsed);
    checkDefeated();
    return;
  }
  cue(ev.kind==='heavy'?'KNOCKED DOWN':'STRUCK',.5);cameraKick=Math.max(cameraKick,ev.kind==='heavy'?.1:.08);
  debug.note(`${c.type} ${ev.label} → HIT you (${ev.kind}${ev.ring?', shockwave':''})`,elapsed);hurtPlayer(c,ev.kind,ev.damage);
}

// -------------------------------------------------------------------- update
function updateHUD(){
  $('hearts').innerHTML=Array.from({length:maxHealth()},(_,i)=>`<span class="${i<player.health?'':'lost'}">◆</span>`).join('')+`<em class="flasks" title="Sap Flasks (X)">${'●'.repeat(player.flasks)}${'○'.repeat(mech.flasks-player.flasks)}</em>`;
  $('echoCount').textContent=`MEMORIES ${memories.size} / 3`;
  $('staminaFill').style.width=`${player.stamina}%`;
  const next=story.target();
  const distance=Math.round(Math.hypot(next.x-player.x,next.z-player.z));
  $('distance').textContent=`${next.title||'CANOPY GATE'} · ${units.dist(distance)}`;
  updateWaypoint(next,distance);
  $('objective').textContent=story.info.objective;
  const cq=chronicles.active,offer=!cq&&chronicles.available(),giver=q=>NPCS[q.giver].name[0]+NPCS[q.giver].name.slice(1).toLowerCase();
  $('sideObjective').textContent=cq?`CHRONICLE · ${cq.title} · ${chronicles.goalMet(cq)?'return to '+giver(cq):'recover the memory'}`:offer?`CHRONICLE · speak with ${giver(offer)} in Mossgate`:'';
  $('emoteStatus').textContent=player.emote==='idle'?'':`EMOTE · ${player.emote.toUpperCase()} · MOVE TO STAND`;
  let region='VERDANT REACH';for(const s of SITES)if(Math.hypot(s.x-player.x,s.z-player.z)<18)region=s.title;
  if(Math.hypot(player.x-world.city.x,player.z-world.city.z)<world.city.radius)region=world.city.name;
  if(Math.hypot(player.x-world.home.x,player.z-world.home.z)<world.home.radius)region=world.home.name;
  if(Math.hypot(GATE.x-player.x,GATE.z-player.z)<17)region='THE CANOPY GATE';$('region').textContent=region;
  const crit=!combat.busy&&critTarget(),nearby=nearestInteractable();
  $('interaction').classList.toggle('hidden',!!dialogue||(!nearby&&!crit&&!combat.charging));
  if(combat.charging)$('interaction').innerHTML=`CHARGING · ${'◆'.repeat(combat.chargeLevel)}${'◇'.repeat(2-combat.chargeLevel)}`;
  else if(crit)$('interaction').innerHTML='<b>CLICK</b> · ROOT STRIKE';
  else if(nearby?.type==='orrun')$('interaction').innerHTML='<b>E</b> · SPEAK ITS NAME <small>ORRUN</small>';
  else if(nearby?.type==='npc')$('interaction').innerHTML=`<b>E</b> · TALK TO ${nearby.value.name}${story.speaker===nearby.id?' <b>◆</b>':''} <small>${nearby.value.title}</small>`;
  else if(nearby)$('interaction').innerHTML=nearby.type==='echo'?`<b>E</b> · REMEMBER ${nearby.value.title}`:nearby.type==='gate'?'<b>E</b> · ENTER THE CANOPY GATE':'<b>E</b> · REST AT THE TRAIL STONE';
}
// --------------------------------------------------------- quest waypoint
// A compass strip that turns with the view, a diamond pinned to the objective
// on screen (clamped to the edge with an arrow when it is behind you), and a
// pillar of light over the objective that can be seen from anywhere.
const COMPASS_SPAN=Math.PI*.9,HEADINGS=[['N',0],['NE',-Math.PI/4],['E',-Math.PI/2],['SE',-Math.PI*.75],['S',Math.PI],['SW',Math.PI*.75],['W',Math.PI/2],['NW',Math.PI/4]];
$('compassTicks').innerHTML=HEADINGS.map(([n])=>`<span class="${n.length>1?'minor':''}">${n}</span>`).join('');
const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,70,10,1,true),new THREE.MeshBasicMaterial({color:0xf0c86a,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
beacon.renderOrder=3;scene.add(beacon);
function updateWaypoint(target,distance){
  const width=$('compassBar').clientWidth||420,view=camera.getWorldDirection(new THREE.Vector3()),viewYaw=yawOf(view.x,view.z);
  const place=yaw=>{const d=angleTo(viewYaw,yaw);return{d,x:width/2-d/COMPASS_SPAN*width};};
  [...$('compassTicks').children].forEach((el,i)=>{const {d,x}=place(HEADINGS[i][1]);el.style.left=`${x}px`;el.style.display=Math.abs(d)<COMPASS_SPAN*.55?'':'none';});
  const {d,x}=place(yawOf(target.x-player.x,target.z-player.z)),edge=Math.abs(d)>COMPASS_SPAN*.46,marker=$('compassMarker');
  marker.style.left=`${edge?(d>0?10:width-10):x}px`;marker.className=edge?`edge ${d>0?'left':'right'}`:'';
  // On-screen marker over the objective.
  const y=groundY(target.x,target.z)+(NPCS[story.info.target]?2.9:3.2),p=new THREE.Vector3(target.x,y,target.z).project(camera),wp=$('waypoint');
  const behind=p.z>1,margin=48;let sx=(p.x*.5+.5)*innerWidth,sy=(-p.y*.5+.5)*innerHeight;
  const off=behind||sx<margin||sx>innerWidth-margin||sy<margin||sy>innerHeight-margin;
  if(off){
    // Point from the screen centre toward the objective, pinned to the edge.
    let dx=sx-innerWidth/2,dy=sy-innerHeight/2;if(behind){dx=-dx;dy=-dy;if(Math.abs(dx)<1&&Math.abs(dy)<1)dy=innerHeight;}
    const k=Math.min((innerWidth/2-margin)/Math.abs(dx||1e-6),(innerHeight/2-margin)/Math.abs(dy||1e-6));
    sx=innerWidth/2+dx*k;sy=innerHeight/2+dy*k;wp.querySelector('i').style.transform=`rotate(${Math.atan2(dy,dx)+Math.PI/2}rad)`;
  }else wp.querySelector('i').style.transform='';
  wp.classList.toggle('edge',off);wp.classList.toggle('hidden',!!dialogue||distance<3);
  wp.style.transform=`translate(${sx}px,${sy}px) translate(-50%,-50%)`;wp.querySelector('small').textContent=off?'':units.dist(distance);
  beacon.position.set(target.x,groundY(target.x,target.z)+35,target.z);
  beacon.material.opacity=THREE.MathUtils.clamp((distance-8)/30,0,1)*.24;beacon.visible=distance>8;
}
function updateModeLabel(){$('cameraMode').textContent=player.thirdPerson?(lockTarget?'THIRD PERSON · LOCKED ON':'THIRD PERSON'):'FIRST PERSON';}

function update(rawDt){
  // Hit-stop: the fighters freeze for a few frames on impact; camera and effects keep running.
  const frozen=hitstop>0;hitstop=Math.max(0,hitstop-rawDt);
  if(slowmo.left>0)slowmo.left-=rawDt;
  const dt=frozen?0:rawDt*(slowmo.left>0?slowmo.scale:1);
  elapsed+=dt;
  if(lockTarget&&(!lockTarget.alive||Math.hypot(lockTarget.x-player.x,lockTarget.z-player.z)>22))lockTarget=null;
  updateModeLabel();

  // Movement intent relative to the camera, in world space.
  let f=Number(keyState.has('KeyW')||keyState.has('ArrowUp'))-Number(keyState.has('KeyS')||keyState.has('ArrowDown'));
  let side=Number(keyState.has('KeyD')||keyState.has('ArrowRight'))-Number(keyState.has('KeyA')||keyState.has('ArrowLeft'));
  if(dialogue){f=0;side=0;}
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
  const motion=frozen||player.defeated?{dx:0,dz:0}:combat.update(dt,{input,aimWithMovement:player.thirdPerson,lockTarget,pickTarget,bones:avatar.bones,grid:collisionGrid,
    targets:creatures.filter(c=>c.alive),stamina:player.stamina,x:player.x,z:player.z,chest,critTarget:critTarget(),
    sprinting:player.sprinting,airborne:!player.grounded,flasks:player.flasks,winded:player.winded,
    moveset:movesetFor(equippedWeapon()),iframeBonus:mech.iframeBonus,parryBonus:mech.parryBonus});
  // Speed stretches the dash (and rangers go further still).
  if(combat.state==='evade'){motion.dx*=mech.dash;motion.dz*=mech.dash;}
  if(!frozen)handleCombatEvents();
  if(combat.events.some(e=>e.type==='swing'||e.type==='evade'))player.engaged=4;
  player.engaged=Math.max(0,player.engaged-dt);

  mech=mechanics();
  // Breath recovers after a short pause; real-world Stamina sets how fast.
  staminaRest=Math.max(0,staminaRest-dt);
  player.sprinting=sprintHeld()&&hasInput&&combat.state==='move'&&player.grounded&&player.stamina>0;
  if(player.sprinting){player.stamina=Math.max(0,player.stamina-SPRINT.drain*dt);staminaRest=.3;}
  if(!staminaRest&&!combat.busy)player.stamina=Math.min(STAMINA.max,player.stamina+STAMINA.regen*mech.regen*dt);
  if(player.winded&&player.stamina>=STAMINA.winded)player.winded=false;
  else if(!staminaRest&&combat.state==='attack'&&!combat.charging)player.stamina=Math.min(STAMINA.max,player.stamina+STAMINA.regen*.35*dt);
  comboTimer-=dt;if(comboTimer<=0)combo=0;
  const nearFight=creatures.some(c=>c.alive&&['approach','circle','windup','attack','recover','stagger','alert','toppled','rising','reeling'].includes(c.state)&&Math.hypot(c.x-player.x,c.z-player.z)<9);
  const guarded=!!lockTarget||player.engaged>0||nearFight;
  const runSpeed=mech.runSpeed,guardSpeed=mech.guardSpeed;
  let desiredX=0,desiredZ=0;
  if(combat.mobile&&hasInput&&!player.defeated){const s=combat.state==='guard'?GUARD.speed:combat.state==='flask'?runSpeed*FLASK.moveSpeed:player.sprinting?runSpeed*SPRINT.speed:guarded?guardSpeed:runSpeed;desiredX=input.x*s;desiredZ=input.z*s;}
  player.vx=THREE.MathUtils.damp(player.vx,desiredX,hasInput?14:18,dt);
  player.vz=THREE.MathUtils.damp(player.vz,desiredZ,hasInput?14:18,dt);
  if(!combat.mobile){player.vx=0;player.vz=0;}

  // Facing: toward the lock in a fight, along the path when roaming, the camera in first person.
  if(!player.thirdPerson)player.yaw=combat.facing;
  else if(!combat.busy){
    let want=null;
    if(dialogue)want=yawOf(speakerOf(dialogue.id).x-player.x,speakerOf(dialogue.id).z-player.z);
    else if(lockTarget)want=yawOf(lockTarget.x-player.x,lockTarget.z-player.z);
    else if(hasInput)want=yawOf(input.x,input.z);
    if(want!==null)combat.facing+=angleTo(combat.facing,want)*(1-Math.exp(-(lockTarget?16:12)*dt));
  }
  player.yaw=combat.facing;

  const oldX=player.x,oldZ=player.z;
  const impact=dev.noclip?(player.x+=player.vx*dt+motion.dx,player.z+=player.vz*dt+motion.dz,{hitX:false,hitZ:false}):moveWithCollision(player,player.vx*dt+motion.dx,player.vz*dt+motion.dz,collisionGrid,groundY);
  if(impact.hitX)player.vx=0;if(impact.hitZ)player.vz=0;
  // Creatures are solid: slide around them rather than through.
  for(const c of creatures){if((!c.alive&&c!==warden)||dev.noclip)continue;
    for(const b of c.bodyCircles?.()||[{x:c.x,z:c.z,r:c.radius}]){const dx=player.x-b.x,dz=player.z-b.z,d=Math.hypot(dx,dz),min=b.r+.36;
    if(d<min&&d>1e-4){const push=(min-d);const nx=player.x+dx/d*push,nz=player.z+dz/d*push;moveWithCollision(player,nx-player.x,nz-player.z,collisionGrid,groundY);}}}
  const moved=Math.hypot(player.x-oldX,player.z-oldZ)/Math.max(dt,1e-4);

  const oldFeet=groundY(player.x,player.z)+player.height;
  player.velocityY-=22*dt;player.height+=player.velocityY*dt;
  const terrain=groundY(player.x,player.z);
  if(player.velocityY<=0){
    const support=collisionGrid.near(player.x,player.z).filter(o=>o.top-terrain<1.95&&o.top>terrain+.17&&Math.hypot(player.x-o.x,player.z-o.z)<o.r-.05&&oldFeet>=o.top-.07&&terrain+player.height<=o.top).sort((a,b)=>b.top-a.top)[0];
    if(support){player.height=support.top-terrain;player.velocityY=0;player.grounded=true;player.jumpCount=0;}
  }
  if(player.height<=0){player.height=0;player.velocityY=0;player.grounded=true;player.jumpCount=0;}
  else if(player.velocityY!==0)player.grounded=false;

  // The story: conversations, the active chapter's hollowed, the keepers.
  updateDialogue(rawDt);updateEncounters();updateBoss(rawDt);coop.update(rawDt,elapsed);
  if(coop.teamSize>1&&coop.authority)sendWorld(rawDt);
  if(dev.breath){player.stamina=STAMINA.max;player.winded=false;}if(dev.showColliders)updateCollisionViz();
  if(dialogue&&elapsed-dialogue.opened<.9){const n=speakerOf(dialogue.id);player.cameraYaw+=angleTo(player.cameraYaw,yawOf(n.x-player.x,n.z-player.z))*(1-Math.exp(-6*rawDt));player.pitch=THREE.MathUtils.damp(player.pitch,-.05,5,rawDt);}
  updateNpcs(npcs,elapsed,rawDt,player,story.speaker);world.updateLanternLights(player.x,player.z);

  // Creatures act after the explorer so a strike this frame can interrupt them.
  const playerPos={x:player.x,z:player.z,y:groundY(player.x,player.z)+player.height};
  const team=coop.teamSize>1,guest=coop.guest;
  if(team&&coop.authority)scaleBosses();
  const targets=team&&!guest?assignTargets(playerPos):null;
  for(const c of creatures){
    c.remote=guest;
    // The host's creatures go after their explorer (assignTargets); a guest's follow the host's snapshots.
    const pick=targets?.get(c),target=pick?.o||playerPos;
    c.target=target;c.targetKey=pick?.key??'me';
    const events=frozen?[]:c.update(dt,elapsed,{player:target,playerGrounded:target===playerPos?player.grounded:target.y-groundY(target.x,target.z)<.3,grid:collisionGrid,mayAttack,canWake:story.stage==='gate'});
    if(guest&&c.net){const k=1-Math.exp(-8*dt);c.x+=(c.net.x-c.x)*k;c.z+=(c.net.z-c.z)*k;c.heading+=angleTo(c.heading,c.net.heading)*k;c.place?.();}
    // Chasing someone else, its blows are judged against that explorer; check whether one also catches you.
    if(target!==playerPos){const key=c.state+c.attack;if(c.localKey!==key){c.localKey=key;c.localHit=false;}
      if(!c.localHit&&strikesLocal(c)){c.localHit=true;const a=c.attackInfo||{};incomingStrike(c,{attack:c.attack,label:a.label||c.attack,kind:a.kind||'heavy',damage:a.damage||1});}
      for(let i=events.length-1;i>=0;i--)if(events[i].type==='strike')events.splice(i,1);}
    for(const ev of events){
      if(c===warden&&handleBossEvent(c,ev))continue;
      if(ev.type==='quake'){effects.shockwave(new THREE.Vector3(ev.x,groundY(ev.x,ev.z),ev.z),1,ev.radius,.25);shoulderCam.punch(.55);sound.attack('slam');hitstop=Math.max(hitstop,.06);}
      else if(ev.type==='shellBroken'){sound.topple();slowMo(.4,.35);toast('THE SHELL BREAKS','Its head is exposed and it is enraged.');}
      else if(ev.type==='windup'){sound.windup(c.type,ev.attack==='quake'?'slam':ev.attack);cue({quake:'QUAKE · DASH THROUGH OR GUARD',lunge:'LUNGE COMING',spin:'SHELL SPIN · GET CLEAR',slam:'SLAM · JUMP OR DASH THROUGH'}[ev.attack],.7);debug.note(`${c.type} → TELEGRAPH ${ev.attack}`,elapsed);}
      else if(ev.type==='attack')sound.attack(ev.attack);
      else if(ev.type==='alert')sound.alert();
      else if(ev.type==='strike')incomingStrike(c,ev);
      else if(ev.type==='missed')debug.note(`${c.type} ${ev.label} → missed (${ev.gap.toFixed(2)} m clear)`,elapsed);
      else if(ev.type==='enrage'){sound.enrage();toast(c.type==='thornling'?'THE THORNLING IS ENRAGED':'THE SHELLBACK IS ENRAGED','Faster attacks · shorter openings');}
      else if(ev.type==='rising')debug.note(`${c.type} rights itself`,elapsed);
    }
    if(ev_attack_slam(c)){const cx=c.x+Math.sin(c.heading)*.64,cz=c.z+Math.cos(c.heading)*.64;effects.shockwave(new THREE.Vector3(cx,groundY(cx,cz),cz),SHOCKWAVE.from,SHOCKWAVE.to,SHOCKWAVE.duration);kick(c,.05);}
    c.showBar(c===lockTarget||(c.health<c.maxHealth&&Math.hypot(c.x-player.x,c.z-player.z)<12),camera);
  }

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
  const planar=combat.busy?0:moved;
  if(action&&a.has(action.name))a.play(action.name,action.time,action.fade);else a.stop();
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
  avatar.setMood(combat.state==='hurt'?'hurt':combat.state==='attack'&&(combat.phase()==='active'||combat.charging)?'strain':combat.busy||guarded?'focus':player.emote==='cheer'?'cheer':'calm');
  avatar.setWeaponStance?.(combat.state==='attack'||combat.charging||combat.state==='guard');
  avatar.update(frozen?0:dt,player.grounded?groundY:null);
  avatar.holdWeapon?.(frozen?0:dt,groundY);
  avatar.flicker(elapsed,combat.clock<combat.invulnerableUntil?1:0);
  avatar.root.visible=avatar.root.visible&&player.thirdPerson;

  // --------------------------------------------------------------- camera
  const eyeBase=floor+player.height+(player.emote==='sit'?.98:1.65);
  if(player.thirdPerson){
    // The shoulder camera (camera.js): right-drag orbit, lock-on framing, world collision.
    const view={yaw:player.cameraYaw,elevation:player.camElev,zoom:player.zoom};
    const focus=lockTarget&&{x:lockTarget.x,y:groundY(lockTarget.x,lockTarget.z),z:lockTarget.z,focus:lockTarget.focusHeight??.7,big:lockTarget===warden||!!lockTarget.isBoss};
    shoulderCam.update(rawDt,{x:player.x,y:floor+player.height-(player.emote==='sit'?.6:0),z:player.z},view,focus);
    player.cameraYaw=view.yaw;player.camElev=view.elevation;camera.position.add(camKick);
  }else{
    // First person rides the body: lunges, evades and flinches move the view a little.
    const head=avatar.bones.Head.getWorldPosition(new THREE.Vector3());
    const offset=head.clone().sub(new THREE.Vector3(player.x,floor+player.height+(avatar.headRest||1.735),player.z)).multiplyScalar(.45);
    const eye=new THREE.Vector3(player.x,eyeBase,player.z).add(offset);
    camera.position.x=eye.x;camera.position.z=eye.z;camera.position.y=THREE.MathUtils.damp(camera.position.y||eye.y,eye.y,14,rawDt);
    // Set all three axes: rotateZ below is a transient impact cue, never
    // part of the persistent mouse-look orientation.
    camera.rotation.set(player.pitch,player.cameraYaw,0,'YXZ');camera.position.addScaledVector(camKick,.5);
  }
  cameraKick=THREE.MathUtils.damp(cameraKick,0,18,rawDt);
  camera.rotateZ(Math.sin(elapsed*60)*cameraKick);
  if(viewBlend>0){
    viewBlend=Math.max(0,viewBlend-rawDt);
    const progress=1-(viewBlend/.28)**3;
    camera.position.lerpVectors(viewFromPosition,camera.position,progress);
    camera.quaternion.slerpQuaternions(viewFromRotation,camera.quaternion,progress);
  }
  hands.group.visible=!player.thirdPerson&&viewBlend<.12&&(combat.busy||guarded);
  hands.group.rotation.y=combat.busy?angleTo(player.cameraYaw,combat.facing):0;
  hands.update(frozen?0:dt,combat,guarded,frozen);

  lockMarker.visible=!!lockTarget;
  if(lockTarget){lockMarker.position.set(lockTarget.x,groundY(lockTarget.x,lockTarget.z)+(lockTarget.markerHeight??1.75)+Math.sin(elapsed*4)*.05,lockTarget.z);lockMarker.rotation.y+=rawDt*2;}
  const imminent=creatures.find(c=>c.alive&&c.state==='windup'&&Math.hypot(c.x-player.x,c.z-player.z)<6);
  const cueElement=$('combatCue');
  const bossThreat=warden?.alive&&warden.winding&&Math.hypot(warden.x-player.x,warden.z-player.z)<14?BOSS_CUES[warden.winding]:null;
  const threat=bossThreat||imminent&&{lunge:'EVADE THE LUNGE',spin:'GET CLEAR OF THE SPIN',slam:'JUMP OR DASH THROUGH THE SLAM'}[imminent.attack];
  cueElement.textContent=elapsed<cueUntil?cueText:threat||(combat.state==='attack'?`${combat.phase().toUpperCase()} · ${MOVES[combat.move].label.toUpperCase()}`:'');
  cueElement.classList.toggle('warning',!!(imminent||bossThreat)&&elapsed>=cueUntil);
  $('crosshair').classList.toggle('impact',elapsed<cueUntil&&['SOLID HIT','DRIVEN BACK','WEAK POINT','EXPOSED','ROOT STRIKE','COUNTER','TOPPLED'].includes(cueText));

  player.step-=dt;if(planar>.5&&player.grounded&&player.step<=0){player.step=guarded?.38:.45;playTone(74+Math.random()*20,.06,.013,'triangle');}
  effects.update(rawDt);
  debug.update({combat,bones:avatar.bones,creatures,player:playerPos,lockTarget,animator:avatar.animator,authored:!!avatar.isAuthored});
  world.sun.position.set(player.x-45,groundY(player.x,player.z)+95,player.z-50);
  world.sun.target.position.set(player.x,groundY(player.x,player.z),player.z);
  world.sun.target.updateMatrixWorld();
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
  // The nudge and FOV punch spring back quickly.
  camKick.multiplyScalar(Math.exp(-12*rawDt));fovKick=THREE.MathUtils.damp(fovKick,combat.charging?combat.chargeLevel*1.2+1:0,combat.charging?4:7,rawDt);
  if(Math.abs(camera.fov-(70-fovKick))>.01){camera.fov=70-fovKick;camera.updateProjectionMatrix();}
  updateNumbers(rawDt);
  updateHUD();
}
shell=createShell(entry,canvas,globe,{narrator,enterGame:resume,pauseGame:()=>{paused=true;},onAppearance:()=>{avatar.setAppearance(profile.appearance);hands.setAppearance(profile.appearance);equipWeapon();}});
avatar.setAppearance(profile.appearance);hands.setAppearance(profile.appearance);equipWeapon();shell.start();
// The Blender memory sites and Mossgate's props (sites.js); their colliders join the grid as they arrive.
loadSites(scene,{addCollider:c=>collisionGrid.add(c),crownGeometry:world.crownGeometry,leafMaterials:world.leafMaterials}).catch(e=>console.warn('Memory sites failed to load',e));
loadWardenAndArena(scene).then(res=>{
  warden=res.warden;warden.netId='warden';gateRoots=res.gateRoots;res.colliders.forEach(c=>collisionGrid.add(c));creatures.push(warden);
  warden.setSealed(story.before('gate'));
  if(story.reached('end')){warden.release(true);if(gateRoots)gateRoots.visible=false;}
}).catch(err=>console.warn('The Warden or its arena failed to load.',err));
// The block explorer (ChatGPT Sites design) is the player. ?legacyCharacters
// loads the earlier Blender-authored explorer instead.
if(params.has('legacyCharacters'))loadExplorer(scene).then(explorer=>{
  const old=avatar;explorer.root.position.copy(old.root.position);explorer.root.rotation.y=old.root.rotation.y;
  scene.remove(old.root);avatar=explorer;avatar.setAppearance(profile.appearance);avatar.emote(player.emote);
}).catch(err=>console.warn('Explorer model failed to load; using the procedural body.',err));
const clock=new THREE.Clock(),capture=params.has('capture');
let perfSeconds=0,perfFrames=0,foliageReduced=false,pausedRender=0;
function frame(){
  requestAnimationFrame(frame);
  const rawDt=clock.getDelta(),dt=Math.min(rawDt,.045);
  if(showPerf){fpsFrames++;fpsTime+=rawDt;if(fpsTime>=.5){const info=renderer.info.render;perfPanel.textContent=`FPS ${Math.round(fpsFrames/fpsTime)}  ·  ${(fpsTime/fpsFrames*1000).toFixed(1)} ms\nDRAW CALLS ${info.calls}  ·  TRIANGLES ${(info.triangles/1000).toFixed(0)}k\nPIXEL RATIO ${pixelRatio.toFixed(2)}`;fpsFrames=0;fpsTime=0;}}
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
  if(!paused)update(dt);
  if(shell.view==='map'){globe.update(dt,clock.elapsedTime,innerWidth,innerHeight);renderer.render(globe.scene,globe.camera);}
  else if(shell.view==='intro'){narrator.update(rawDt,clock.elapsedTime,innerWidth,innerHeight);renderer.render(narrator.scene,narrator.camera);}
  else if(!paused||((pausedRender+=rawDt)>.15)){pausedRender=0;renderer.render(scene,camera);}
}frame();
// ?capture advances the game by fixed steps on request, so footage recorded on a
// slow machine still plays back at true speed. The rules are the same code.
if(capture)window.__capture={step(frames=1,dt=1/60,draw=true){for(let i=0;i<frames;i++)if(!paused)update(dt);if(draw)renderer.render(scene,camera);}};
camera.position.set(player.x,groundY(player.x,player.z)+1.65,player.z);updateHUD();

// ?arena drops straight into the first encounter for testing (skips the menus).
if(params.has('arena')){
  if(!profile.complete){profile.complete=true;profile.introSeen=true;saveProfile();}
  player.z=37;player.cameraYaw=0;resume();
  window.__verdant={player,combat,creatures,camera,world,collisionGrid,hands,groundY,get avatar(){return avatar;},get lockTarget(){return lockTarget;},toggleLock,keyState,debug,attack:attackPressed,heavy:heavyPressed,evade:evadePressed,guard:guardPressed,flask:()=>combat.press('flask'),sprint:on=>{shiftDownAt=on?performance.now()-1000:-1;},get elapsed(){return elapsed;},story,npcs,talk:openDialogue,advanceDialogue,get dialogue(){return dialogue;},interact,spawned,get warden(){return warden;},chronicles,chooseDialogue,coop,respawn,dev,devJumpTo,teleport,equipWeapon,profile,devOverrides,get mech(){return mech;},get lockTarget2(){return lockTarget;},camera,shoulderCam};
}
