import * as THREE from 'three';
import { buildWorld, groundY, SITES, GATE } from './world.js';
import { createCreatures } from './creatures.js';
import { createAvatar,createFirstPersonHands } from './avatar.js';
import { loadExplorer } from './avatarGLB.js';
import { createCollisionGrid,moveWithCollision } from './collision.js';
import { createGlobe } from './globe.js';
import { createShell } from './shell.js';
import { profile,stats,saveProfile } from './profile.js';
import { PlayerCombat } from './combat/player.js';
import { MOVES } from './combat/moves.js';
import { CombatSound,ImpactEffects } from './combat/feedback.js';
import { CombatDebug } from './combat/debug.js';
import './style.css';
import './menu.css';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const canvas=$('game'),journal=$('journal'),ending=$('ending'),entry=$('entry');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.43;
const scene=new THREE.Scene();const world=buildWorld(scene),creatures=createCreatures(scene);
const collisionGrid=createCollisionGrid(world.colliders);
const globe=createGlobe();let shell;
const camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,.08,540);camera.rotation.order='YXZ';
// The procedural body shows until the authored explorer has loaded, and stays
// as the fallback if it cannot load.
let avatar=createAvatar(scene);const raycaster=new THREE.Raycaster();
const combat=new PlayerCombat(),sound=new CombatSound(),effects=new ImpactEffects(scene),debug=new CombatDebug(scene);
const player={x:0,z:39,yaw:0,cameraYaw:0,pitch:0,health:4,stamina:100,step:0,height:0,velocityY:0,grounded:true,vx:0,vz:0,thirdPerson:!params.has('fp'),zoom:5.2,emote:'idle',engaged:0,jumpT:9,landT:9,interactT:9,airTime:0,defeated:0};
const keyState=new Set();let started=false,paused=true,done=false,journalOpen=false,toastTimer=0,elapsed=0,audio,hitstop=0,lockTarget=null;
let save;try{save=JSON.parse(localStorage.getItem('verdant-reach-3d-v1')||'{}');}catch{save={};}
const memories=new Set(Array.isArray(save.memories)?save.memories.filter(v=>SITES.some(s=>s.id===v)):[]);
world.echoes.forEach(e=>{if(memories.has(e.id)){e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;}});
const hands=createFirstPersonHands(camera);scene.add(camera);
const FX=new THREE.Group();scene.add(FX);
const motes=[];for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,6,5),new THREE.MeshBasicMaterial({color:0xc4efb0,transparent:true,opacity:.6}));
  mesh.position.set((Math.random()-.5)*20,1+Math.random()*7,(Math.random()-.5)*20);FX.add(mesh);motes.push(mesh);
}
// A small diamond over the locked creature: enough to read, never in the way.
const lockMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0xf3e6b0,transparent:true,opacity:.9,depthTest:false}));
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
function toast(title,detail=''){$('toast').innerHTML=title+(detail?`<small>${detail}</small>`:'');$('toast').classList.remove('hidden');toastTimer=3.5;}
function persist(){try{localStorage.setItem('verdant-reach-3d-v1',JSON.stringify({memories:[...memories]}));}catch{/* No storage available. */}}
function updateJournal(){
  $('journalEntries').innerHTML=SITES.map((site,i)=>{
    const found=memories.has(site.id);
    return `<article class="${found?'':'unknown'}"><strong>${String(i+1).padStart(2,'0')} · ${found?site.title:'UNDISCOVERED'}</strong>${found?site.story:'A memory waits somewhere beyond the old trail.'}</article>`;
  }).join('');
}
function toggleJournal(open){journalOpen=open;journal.classList.toggle('hidden',!open);updateJournal();if(open){paused=true;if(document.pointerLockElement)document.exitPointerLock();}else resume();}
function resume(){if(!started)player.health=maxHealth();started=true;paused=false;shell.hide();$('hud').classList.remove('hidden');journal.classList.add('hidden');journalOpen=false;initAudio();canvas.requestPointerLock?.()?.catch?.(()=>{});}
$('closeJournal').onclick=()=>toggleJournal(false);
$('continueExploring').onclick=()=>{ending.classList.add('hidden');done=false;resume();};
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&started&&!journalOpen&&!done&&shell?.view==='game'){paused=true;shell.show('menu');$('hud').classList.add('hidden');}
  else if(document.pointerLockElement){paused=false;shell?.hide();}
});
const endEmote=()=>{if(player.emote!=='idle'){player.emote='idle';avatar.emote('idle');}};
function evadePressed(){if(paused)return;endEmote();combat.press('evade');}
function attackPressed(){if(paused)return;endEmote();combat.press('attack');}
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  keyState.add(e.code);
  if(e.code==='F3'){e.preventDefault();debug.toggle();return;}
  if(e.code==='KeyJ'&&started){toggleJournal(!journalOpen);return;}
  if(e.repeat)return;
  if(e.code==='KeyM'&&started&&!journalOpen){paused=true;$('hud').classList.add('hidden');shell.show('map');if(document.pointerLockElement)document.exitPointerLock();return;}
  if(e.code==='KeyV'&&started&&!paused){player.thirdPerson=!player.thirdPerson;if(player.thirdPerson)player.cameraYaw=player.yaw;else player.cameraYaw=player.yaw;updateModeLabel();playTone(410,.12,.025);}
  if(['Digit0','Digit1','Digit2','Digit3','Digit4'].includes(e.code)&&started&&!paused&&!combat.busy){
    const name={Digit0:'idle',Digit1:'pose',Digit2:'sit',Digit3:'wave',Digit4:'cheer'}[e.code];player.emote=name;avatar.emote(name);toast(name==='idle'?'EMOTE ENDED':`${name.toUpperCase()} · MOVE TO STAND`);return;
  }
  if(e.code==='Space'&&!paused&&player.grounded&&!combat.busy&&!player.defeated){endEmote();player.velocityY=8.3;player.grounded=false;player.jumpT=0;playTone(260,.13,.04);}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight')evadePressed();
  if(e.code==='KeyF'||e.code==='KeyK')attackPressed();
  if(e.code==='KeyQ'||e.code==='Tab')toggleLock();
  if(e.code==='KeyE'&&!paused&&!journalOpen&&!combat.busy){if(nearestInteractable())player.interactT=0;interact();}
});
canvas.addEventListener('wheel',e=>{if(!player.thirdPerson)return;e.preventDefault();player.zoom=THREE.MathUtils.clamp(player.zoom+Math.sign(e.deltaY)*.65,3.3,9.5);},{passive:false});
window.addEventListener('keyup',e=>keyState.delete(e.code));
window.addEventListener('blur',()=>keyState.clear());
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==canvas||paused)return;
  // While locked on, the camera follows the fight; a hard flick switches target.
  if(lockTarget&&player.thirdPerson){lockFlick+=e.movementX;if(Math.abs(lockFlick)>140){switchTarget(Math.sign(lockFlick));lockFlick=0;}}
  else player.cameraYaw-=e.movementX*.0021;
  player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.00185,-1.35,1.35);
});
let lockFlick=0;
canvas.addEventListener('mousedown',e=>{
  if(paused)return;
  if(e.button===1){e.preventDefault();toggleLock();return;}
  if(e.button===2){evadePressed();return;}
  if(e.button!==0)return;
  if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.()?.catch?.(()=>{});
  attackPressed();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));});

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
  const view=player.thirdPerson?player.cameraYaw:player.yaw;
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
  if(lockTarget?.alive)return lockTarget;
  const cone=player.thirdPerson?1.35:.45;
  return creatures.filter(c=>c.alive).map(c=>{
    const d=Math.hypot(c.x-player.x,c.z-player.z)-c.radius,a=Math.abs(angleTo(yaw,yawOf(c.x-player.x,c.z-player.z)));
    return {c,d,a};
  }).filter(v=>v.d<2.6&&v.a<cone).sort((a,b)=>a.d+a.a-(b.d+b.a))[0]?.c||null;
}

function nearestInteractable(){
  const d=(p)=>Math.hypot(p.x-player.x,p.z-player.z);
  const echo=world.echoes.find(e=>!memories.has(e.id)&&d(e)<4.9+Math.max(0,stats().intelligence-10)*.18);
  if(echo)return{type:'echo',value:echo};
  if(d(GATE)<6)return{type:'gate'};
  if(Math.hypot(player.x,player.z-39)<5.8&&player.health<maxHealth())return{type:'rest'};
  return null;
}
function interact(){
  const nearby=nearestInteractable();if(!nearby)return;
  if(nearby.type==='echo'){
    const e=nearby.value;memories.add(e.id);e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;persist();playTone(690,.7,.11,'sine');playTone(1040,.6,.05,'triangle');
    toast(`MEMORY FOUND · ${e.title}`,e.story);
  }else if(nearby.type==='gate'){
    if(memories.size<3){toast('THE GATE IS SEALED',`${3-memories.size} lost ${memories.size===2?'memory':'memories'} remain.`);return;}
    done=true;paused=true;ending.classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();playTone(540,1.1,.1);
  }else if(nearby.type==='rest'){player.health=maxHealth();playTone(490,.4,.07);toast('THE ROOTS RESTORE YOUR VITALITY');}
}
function maxHealth(){return Math.max(3,Math.min(6,3+Math.floor(stats().defense/7)));}
// Real-world strength scales strike damage; turtles never grant XP.
const strikePower=()=>1+Math.max(-.3,Math.min(.5,(stats().strength-10)*.05));
function hurtPlayer(from){
  player.health--;combat.hurt(from.x,from.z,player.x,player.z);sound.bite();
  $('vignette').style.background='radial-gradient(ellipse,transparent 24%,rgba(143,42,42,.6) 100%)';
  setTimeout(()=>{$('vignette').style.background='';},240);
  hitstop=Math.max(hitstop,.08);
  if(player.health<=0){player.defeated=2.2;lockTarget=null;combat.state='move';}
}
function respawn(){
  player.defeated=0;player.health=maxHealth();player.x=0;player.z=39;player.height=0;player.velocityY=0;player.yaw=combat.facing=0;player.cameraYaw=0;
  toast('THE ROOTS RETURN YOU TO THE TRAIL','The memories you found remain with you.');
}

// ------------------------------------------------------------ combat events
function handleCombatEvents(){
  for(const ev of combat.events){
    if(ev.type==='swing')sound.swing(ev.move);
    else if(ev.type==='evade'){sound.evade();player.stamina-=22;}
    else if(ev.type==='tired'){sound.tired();$('staminaFill').parentElement.classList.add('flash');setTimeout(()=>$('staminaFill').parentElement.classList.remove('flash'),300);}
    else if(ev.type==='hit'){
      const m=MOVES[ev.move],dir=ev.point.clone().sub(new THREE.Vector3(player.x,ev.point.y,player.z)).normalize();
      ev.target.hit(m.damage*strikePower(),player.x,player.z,m.push,m.stagger);
      sound.hit(ev.move);effects.burst(ev.point,dir.negate(),ev.move==='heel');if(ev.move==='heel')effects.ring(new THREE.Vector3(ev.target.x,groundY(ev.target.x,ev.target.z),ev.target.z));
      hitstop=Math.max(hitstop,m.hitstop);player.engaged=4;
      debug.note(`${m.label} → HIT ${ev.part} at t=${combat.t.toFixed(2)}s (active ${m.active.join('–')})  -${(m.damage*strikePower()).toFixed(1)} hp, ${ev.target.lastEvent}`,elapsed);
      if(!ev.target.alive){sound.defeated();if(lockTarget===ev.target)lockTarget=null;toast('SHELLBACK DRIVEN BACK','Creatures never grant XP. Real effort does.');}
    }
    else if(ev.type==='blocked'){sound.blocked();effects.chips(ev.point);hitstop=Math.max(hitstop,.05);debug.note(`${MOVES[ev.move].label} → BLOCKED by an obstacle`,elapsed);}
    else if(ev.type==='whiff'){sound.whiff();debug.note(`${MOVES[ev.move].label} → MISS  (${ev.nearest===Infinity?'no creature near':`${ev.nearest.toFixed(2)} m short`})`,elapsed);}
  }
}

// -------------------------------------------------------------------- update
function updateHUD(){
  $('hearts').innerHTML=Array.from({length:maxHealth()},(_,i)=>`<span class="${i<player.health?'':'lost'}">◆</span>`).join('');
  $('echoCount').textContent=`MEMORIES ${memories.size} / 3`;
  $('staminaFill').style.width=`${player.stamina}%`;
  const next=SITES.filter(s=>!memories.has(s.id)).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]||GATE;
  const distance=Math.round(Math.hypot(next.x-player.x,next.z-player.z));
  const bearing=-Math.atan2(next.x-player.x,-(next.z-player.z));
  const diff=Math.atan2(Math.sin(bearing-player.cameraYaw),Math.cos(bearing-player.cameraYaw));
  $('compass').textContent=Math.abs(diff)<.32?'↑':diff>.32&&diff<2.7?'↖':diff<-.32&&diff>-2.7?'↗':'↓';
  $('distance').textContent=`${next.title||'CANOPY GATE'} · ${distance} m`;
  $('objective').textContent=memories.size===3?'Reach the Canopy Gate':`Recover the lost memories · ${memories.size}/3`;
  $('emoteStatus').textContent=player.emote==='idle'?'':`EMOTE · ${player.emote.toUpperCase()} · MOVE TO STAND`;
  let region='VERDANT REACH';for(const s of SITES)if(Math.hypot(s.x-player.x,s.z-player.z)<18)region=s.title;
  if(Math.hypot(GATE.x-player.x,GATE.z-player.z)<17)region='THE CANOPY GATE';$('region').textContent=region;
  const nearby=nearestInteractable();$('interaction').classList.toggle('hidden',!nearby);
  if(nearby)$('interaction').innerHTML=nearby.type==='echo'?`<b>E</b> · REMEMBER ${nearby.value.title}`:nearby.type==='gate'?'<b>E</b> · ENTER THE CANOPY GATE':'<b>E</b> · REST AT THE TRAIL STONE';
}
function updateModeLabel(){$('cameraMode').textContent=player.thirdPerson?(lockTarget?'THIRD PERSON · LOCKED ON':'THIRD PERSON'):'FIRST PERSON';}

function update(rawDt){
  // Hit-stop: the fighters freeze for a few frames on impact; camera and effects keep running.
  const frozen=hitstop>0;hitstop=Math.max(0,hitstop-rawDt);
  const dt=frozen?0:rawDt;
  elapsed+=dt;
  if(lockTarget&&(!lockTarget.alive||Math.hypot(lockTarget.x-player.x,lockTarget.z-player.z)>22))lockTarget=null;
  updateModeLabel();

  // Movement intent relative to the camera, in world space.
  let f=Number(keyState.has('KeyW')||keyState.has('ArrowUp'))-Number(keyState.has('KeyS')||keyState.has('ArrowDown'));
  let side=Number(keyState.has('KeyD')||keyState.has('ArrowRight'))-Number(keyState.has('KeyA')||keyState.has('ArrowLeft'));
  if((f||side)&&player.emote!=='idle')endEmote();
  const len=Math.hypot(f,side)||1;f/=len;side/=len;
  const view=player.thirdPerson?player.cameraYaw:player.yaw;
  const input={x:-Math.sin(view)*f+Math.cos(view)*side,z:-Math.cos(view)*f-Math.sin(view)*side};
  const hasInput=!!(f||side);

  // Combat decides root motion and state; bones are last frame's pose.
  const floor0=groundY(player.x,player.z);
  const chest=new THREE.Vector3(player.x,floor0+player.height+1.35,player.z);
  const staminaBefore=player.stamina;
  const motion=frozen||player.defeated?{dx:0,dz:0}:combat.update(dt,{input,lockTarget:player.thirdPerson?lockTarget:null,pickTarget,bones:avatar.bones,grid:collisionGrid,
    targets:creatures.filter(c=>c.alive),stamina:player.stamina,x:player.x,z:player.z,chest});
  if(!frozen)handleCombatEvents();
  if(combat.events.some(e=>e.type==='swing'||e.type==='evade'))player.engaged=4;
  player.engaged=Math.max(0,player.engaged-dt);

  const speedStat=stats().speed,staminaStat=stats().stamina;
  if(player.stamina>=staminaBefore)player.stamina=THREE.MathUtils.clamp(player.stamina+(combat.state==='evade'?0:10+staminaStat*.65)*dt,0,100);
  const nearFight=creatures.some(c=>c.alive&&['approach','circle','windup','lunge','recover','stagger','alert'].includes(c.state)&&Math.hypot(c.x-player.x,c.z-player.z)<9);
  const guarded=!!lockTarget||player.engaged>0||nearFight;
  const runSpeed=5.1+(speedStat-10)*.08,guardSpeed=3.2+(speedStat-10)*.04;
  let desiredX=0,desiredZ=0;
  if(!combat.busy&&hasInput&&!player.defeated){const s=guarded?guardSpeed:runSpeed;desiredX=input.x*s;desiredZ=input.z*s;}
  player.vx=THREE.MathUtils.damp(player.vx,desiredX,hasInput?14:18,dt);
  player.vz=THREE.MathUtils.damp(player.vz,desiredZ,hasInput?14:18,dt);
  if(combat.busy){player.vx=0;player.vz=0;}

  // Facing: toward the lock in a fight, along the path when roaming, the camera in first person.
  if(!player.thirdPerson)combat.facing=player.yaw=player.cameraYaw;
  else if(!combat.busy){
    let want=null;
    if(lockTarget)want=yawOf(lockTarget.x-player.x,lockTarget.z-player.z);
    else if(hasInput)want=yawOf(input.x,input.z);
    if(want!==null)combat.facing+=angleTo(combat.facing,want)*(1-Math.exp(-(lockTarget?16:12)*dt));
  }
  player.yaw=combat.facing;

  const oldX=player.x,oldZ=player.z;
  const impact=moveWithCollision(player,player.vx*dt+motion.dx,player.vz*dt+motion.dz,collisionGrid,groundY);
  if(impact.hitX)player.vx=0;if(impact.hitZ)player.vz=0;
  // Creatures are solid: slide around them rather than through.
  for(const c of creatures){if(!c.alive)continue;const dx=player.x-c.x,dz=player.z-c.z,d=Math.hypot(dx,dz),min=c.radius+.36;
    if(d<min&&d>1e-4){const push=(min-d);const nx=player.x+dx/d*push,nz=player.z+dz/d*push;moveWithCollision(player,nx-player.x,nz-player.z,collisionGrid,groundY);}}
  const moved=Math.hypot(player.x-oldX,player.z-oldZ)/Math.max(dt,1e-4);

  const oldFeet=groundY(player.x,player.z)+player.height;
  player.velocityY-=22*dt;player.height+=player.velocityY*dt;
  const terrain=groundY(player.x,player.z);
  if(player.velocityY<=0){
    const support=collisionGrid.near(player.x,player.z).filter(o=>o.top-terrain<1.95&&o.top>terrain+.17&&Math.hypot(player.x-o.x,player.z-o.z)<o.r-.05&&oldFeet>=o.top-.07&&terrain+player.height<=o.top).sort((a,b)=>b.top-a.top)[0];
    if(support){player.height=support.top-terrain;player.velocityY=0;player.grounded=true;}
  }
  if(player.height<=0){player.height=0;player.velocityY=0;player.grounded=true;}
  else if(player.velocityY!==0)player.grounded=false;

  // Creatures act after the explorer so a strike this frame can interrupt them.
  const playerPos={x:player.x,z:player.z,y:groundY(player.x,player.z)+player.height};
  for(const c of creatures){
    const events=frozen?[]:c.update(dt,elapsed,{player:playerPos,playerInvulnerable:combat.invulnerable,grid:collisionGrid});
    for(const ev of events){
      if(ev.type==='windup'){sound.windup(c.type);debug.note(`${c.type} → TELEGRAPH (rearing, shell glowing)`,elapsed);}
      else if(ev.type==='lunge')sound.lunge();
      else if(ev.type==='alert')sound.alert();
      else if(ev.type==='bite'){debug.note(`${c.type} lunge → HIT you`,elapsed);hurtPlayer(c);}
      else if(ev.type==='evaded'){sound.evadedAttack();debug.note(`${c.type} lunge → EVADED (invulnerable step)`,elapsed);}
      else if(ev.type==='missed')debug.note(`${c.type} lunge → missed (${ev.gap.toFixed(2)} m wide)`,elapsed);
    }
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
  avatar.update(frozen?0:dt,player.grounded?groundY:null);
  avatar.flicker(elapsed,combat.clock<combat.invulnerableUntil?1:0);
  avatar.root.visible=avatar.root.visible&&player.thirdPerson;

  // --------------------------------------------------------------- camera
  const eyeBase=floor+player.height+(player.emote==='sit'?.98:1.65);
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
    if(hit)desired.copy(target).addScaledVector(obstruction,Math.max(.55,hit.distance-.35));
    camera.position.lerp(desired,1-Math.exp(-9*rawDt));camera.lookAt(target);
  }else{
    // First person rides the body: lunges, evades and flinches move the view a little.
    const head=avatar.bones.Head.getWorldPosition(new THREE.Vector3());
    const offset=head.clone().sub(new THREE.Vector3(player.x,floor+player.height+(avatar.headRest||1.735),player.z)).multiplyScalar(.45);
    const eye=new THREE.Vector3(player.x,eyeBase,player.z).add(offset);
    camera.position.x=eye.x;camera.position.z=eye.z;camera.position.y=THREE.MathUtils.damp(camera.position.y||eye.y,eye.y,14,rawDt);
    camera.rotation.y=player.cameraYaw;camera.rotation.x=player.pitch;
  }
  hands.group.visible=!player.thirdPerson&&(combat.busy||guarded);
  hands.update(rawDt,combat,guarded,frozen);

  lockMarker.visible=!!lockTarget&&player.thirdPerson;
  if(lockTarget){lockMarker.position.set(lockTarget.x,groundY(lockTarget.x,lockTarget.z)+1.75+Math.sin(elapsed*4)*.05,lockTarget.z);lockMarker.rotation.y+=rawDt*2;}

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
  });
  FX.position.set(player.x,groundY(player.x,player.z),player.z);
  motes.forEach((m,i)=>{m.position.y+=dt*(.1+i%4*.07);if(m.position.y>8)m.position.y=1;m.material.opacity=.28+Math.sin(elapsed*1.4+i)*.22;});
  if(toastTimer>0){toastTimer-=rawDt;if(toastTimer<=0)$('toast').classList.add('hidden');}
  updateHUD();
}
shell=createShell(entry,canvas,globe,{enterGame:resume,pauseGame:()=>{paused=true;},onAppearance:()=>{avatar.setAppearance(profile.appearance);hands.setAppearance(profile.appearance);}});
avatar.setAppearance(profile.appearance);hands.setAppearance(profile.appearance);shell.start();
if(!params.has('procedural'))loadExplorer(scene).then(explorer=>{
  const old=avatar;explorer.root.position.copy(old.root.position);explorer.root.rotation.y=old.root.rotation.y;
  scene.remove(old.root);avatar=explorer;avatar.setAppearance(profile.appearance);avatar.emote(player.emote);
  if(window.__verdant)window.__verdant.avatar=avatar;
}).catch(err=>console.warn('Explorer model failed to load; using the procedural body.',err));
const clock=new THREE.Clock(),capture=params.has('capture');
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.045);if(capture)return;if(!paused)update(dt);if(shell.view==='map'){globe.update(dt,clock.elapsedTime,innerWidth,innerHeight);renderer.render(globe.scene,globe.camera);}else renderer.render(scene,camera);}frame();
// ?capture advances the game by fixed steps on request, so footage recorded on a
// slow machine still plays back at true speed. The rules are the same code.
if(capture)window.__capture={step(frames=1,dt=1/60,draw=true){for(let i=0;i<frames;i++)if(!paused)update(dt);if(draw)renderer.render(scene,camera);}};
camera.position.set(player.x,groundY(player.x,player.z)+1.65,player.z);updateHUD();

// ?arena drops straight into the first encounter for testing (skips the menus).
if(params.has('arena')){
  if(!profile.complete){profile.complete=true;profile.introSeen=true;saveProfile();}
  player.z=37;player.cameraYaw=0;resume();
  window.__verdant={player,combat,creatures,camera,get avatar(){return avatar;},get lockTarget(){return lockTarget;},toggleLock,keyState,debug,attack:attackPressed,evade:evadePressed,get elapsed(){return elapsed;}};
}
