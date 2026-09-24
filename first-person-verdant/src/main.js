import * as THREE from 'three';
import { buildWorld, groundY, SITES, GATE } from './world.js';
import { createCreatures } from './creatures.js';
import { createAvatar } from './avatar.js';
import './style.css';

const $=id=>document.getElementById(id);
const canvas=$('game'),entry=$('entry'),journal=$('journal'),ending=$('ending');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.43;
const scene=new THREE.Scene();const world=buildWorld(scene),creatures=createCreatures(scene);
const camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,.08,540);camera.rotation.order='YXZ';
const avatar=createAvatar(scene),raycaster=new THREE.Raycaster();
const player={x:0,z:39,yaw:0,pitch:0,health:4,stamina:100,invuln:0,attack:0,step:0,height:0,velocityY:0,grounded:true,dash:0,dashCooldown:0,dashX:0,dashZ:0,thirdPerson:false,zoom:5.8};
const keyState=new Set();let started=false,paused=true,done=false,journalOpen=false,toastTimer=0,elapsed=0,audio;
let save;try{save=JSON.parse(localStorage.getItem('verdant-reach-3d-v1')||'{}');}catch{save={};}
const memories=new Set(Array.isArray(save.memories)?save.memories.filter(v=>SITES.some(s=>s.id===v)):[]);
world.echoes.forEach(e=>{if(memories.has(e.id)){e.crystal.visible=false;e.ring.visible=false;e.light.visible=false;}});
const blade=new THREE.Group();camera.add(blade);scene.add(camera);
const armMaterial=new THREE.MeshStandardMaterial({color:0x426b55,roughness:1}),woodMaterial=new THREE.MeshStandardMaterial({color:0x715d43,roughness:.95}),steelMaterial=new THREE.MeshStandardMaterial({color:0xb8d9b5,metalness:.55,roughness:.3});
function weaponPart(geometry,material,x,y,z,rotation=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.z=rotation;blade.add(m);return m;}
weaponPart(new THREE.CylinderGeometry(.13,.16,.59,7),armMaterial,.48,-.43,-.67,.5);
weaponPart(new THREE.CylinderGeometry(.05,.07,.68,8),woodMaterial,.57,-.18,-.89,-.27);
weaponPart(new THREE.BoxGeometry(.52,.065,.12),steelMaterial,.62,.01,-.89,-.25);
weaponPart(new THREE.ConeGeometry(.14,.52,5),steelMaterial,.72,.35,-.95,-.24);
const FX=new THREE.Group();scene.add(FX);
const motes=[];for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,6,5),new THREE.MeshBasicMaterial({color:0xc4efb0,transparent:true,opacity:.6}));
  mesh.position.set((Math.random()-.5)*20,1+Math.random()*7,(Math.random()-.5)*20);FX.add(mesh);motes.push(mesh);
}
function playTone(freq=140,duration=.1,volume=.04,type='sine'){
  if(!audio)return;
  const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.5),audio.currentTime+duration);
  g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
  o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration+.01);
}
function initAudio(){
  if(audio){audio.resume();return;}
  try{audio=new AudioContext();const hum=audio.createOscillator(),gain=audio.createGain();hum.type='sine';hum.frequency.value=73;gain.gain.value=.014;hum.connect(gain).connect(audio.destination);hum.start();
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
function resume(){started=true;paused=false;entry.classList.add('hidden');journal.classList.add('hidden');journalOpen=false;initAudio();canvas.requestPointerLock?.().catch(()=>{});}
$('begin').onclick=resume;$('closeJournal').onclick=()=>toggleJournal(false);
$('continueExploring').onclick=()=>{ending.classList.add('hidden');done=false;resume();};
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&started&&!journalOpen&&!done){paused=true;entry.classList.remove('hidden');$('begin').firstChild.textContent='CONTINUE EXPLORING ';}
  else if(document.pointerLockElement){paused=false;entry.classList.add('hidden');}
});
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keyState.add(e.code);
  if(e.code==='KeyJ'&&started){toggleJournal(!journalOpen);return;}
  if(e.repeat)return;
  if(e.code==='KeyV'&&started){player.thirdPerson=!player.thirdPerson;blade.visible=!player.thirdPerson;$('cameraMode').textContent=player.thirdPerson?'THIRD PERSON':'FIRST PERSON';playTone(410,.12,.025);}
  if(e.code==='Space'&&!paused&&player.grounded){player.velocityY=8.3;player.grounded=false;playTone(260,.13,.04);}
  if(e.code==='KeyQ'&&!paused&&player.dashCooldown<=0&&player.stamina>=23){
    let forward=Number(keyState.has('KeyW'))-Number(keyState.has('KeyS'));
    let sideways=Number(keyState.has('KeyD'))-Number(keyState.has('KeyA'));
    const length=Math.hypot(forward,sideways)||1;forward=forward/length;sideways/=length;
    if(!forward&&!sideways)forward=1;
    player.dashX=-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*sideways;
    player.dashZ=-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*sideways;
    player.dash=.23;player.dashCooldown=1.25;player.stamina-=23;player.invuln=Math.max(player.invuln,.28);playTone(340,.23,.07,'triangle');
  }
  if(e.code==='KeyE'&&!paused&&!journalOpen)interact();
});
canvas.addEventListener('wheel',e=>{if(!player.thirdPerson)return;e.preventDefault();player.zoom=THREE.MathUtils.clamp(player.zoom+Math.sign(e.deltaY)*.65,3.3,9.5);},{passive:false});
window.addEventListener('keyup',e=>keyState.delete(e.code));
window.addEventListener('blur',()=>keyState.clear());
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===canvas&&!paused){player.yaw-=e.movementX*.0021;player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.00185,-1.35,1.35);}
});
canvas.addEventListener('mousedown',e=>{if(e.button!==0||paused)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.().catch(()=>{});return;}strike();});
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));});

function validPosition(x,z){
  if(x*x+(z+55)*(z+55)>205*205||z< -202)return false;
  if(groundY(x,z)-groundY(player.x,player.z)>1.45+player.height)return false;
  return !world.colliders.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+.52);
}
function nearestInteractable(){
  const d=(p)=>Math.hypot(p.x-player.x,p.z-player.z);
  const echo=world.echoes.find(e=>!memories.has(e.id)&&d(e)<4.9);
  if(echo)return{type:'echo',value:echo};
  if(d(GATE)<6)return{type:'gate'};
  if(Math.hypot(player.x,player.z-39)<5.8&&player.health<4)return{type:'rest'};
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
  }else if(nearby.type==='rest'){player.health=4;playTone(490,.4,.07);toast('THE ROOTS RESTORE YOUR VITALITY');}
}
function strike(){
  if(player.attack>0)return;player.attack=.56;playTone(190,.18,.065,'sawtooth');
  let closest=null,range=3.7;
  const forward={x:-Math.sin(player.yaw),z:-Math.cos(player.yaw)};
  for(const c of creatures){if(!c.alive)continue;const dx=c.x-player.x,dz=c.z-player.z,d=Math.hypot(dx,dz);if(d<range&&(dx*forward.x+dz*forward.z)/d>.53){range=d;closest=c;}}
  if(closest){closest.hit();playTone(92,.17,.09,'triangle');if(!closest.alive)toast('SHELLBACK DRIVEN BACK','Explore to grow. Creatures do not give XP.');}
}
function hurt(){if(player.invuln>0)return;player.health--;player.invuln=1.25;playTone(78,.45,.11,'sawtooth');
  document.getElementById('vignette').style.background='radial-gradient(ellipse,transparent 24%,rgba(143,42,42,.65) 100%)';
  setTimeout(()=>{document.getElementById('vignette').style.background='';},240);
  if(player.health<=0){player.health=4;player.x=0;player.z=39;player.height=0;player.velocityY=0;player.yaw=0;player.invuln=2;toast('THE ROOTS RETURN YOU TO THE TRAIL','The memories you found remain with you.');}
}
function updateHUD(){
  $('hearts').innerHTML=Array.from({length:4},(_,i)=>`<span class="${i<player.health?'':'lost'}">◆</span>`).join('');
  $('echoCount').textContent=`MEMORIES ${memories.size} / 3`;
  $('staminaFill').style.width=`${player.stamina}%`;
  const next=SITES.filter(s=>!memories.has(s.id)).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]||GATE;
  const distance=Math.round(Math.hypot(next.x-player.x,next.z-player.z));
  const bearing=-Math.atan2(next.x-player.x,-(next.z-player.z));
  const diff=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw));
  $('compass').textContent=Math.abs(diff)<.32?'↑':diff>.32&&diff<2.7?'↖':diff<-.32&&diff>-2.7?'↗':'↓';
  $('distance').textContent=`${next.title||'CANOPY GATE'} · ${distance} m`;
  $('objective').textContent=memories.size===3?'Reach the Canopy Gate':`Recover the lost memories · ${memories.size}/3`;
  let region='VERDANT REACH';for(const s of SITES)if(Math.hypot(s.x-player.x,s.z-player.z)<18)region=s.title;
  if(Math.hypot(GATE.x-player.x,GATE.z-player.z)<17)region='THE CANOPY GATE';$('region').textContent=region;
  const nearby=nearestInteractable();$('interaction').classList.toggle('hidden',!nearby);
  if(nearby)$('interaction').innerHTML=nearby.type==='echo'?`<b>E</b> · REMEMBER ${nearby.value.title}`:nearby.type==='gate'?'<b>E</b> · ENTER THE CANOPY GATE':'<b>E</b> · REST AT THE TRAIL STONE';
}
function update(dt){
  elapsed+=dt;player.invuln=Math.max(0,player.invuln-dt);player.attack=Math.max(0,player.attack-dt);
  player.dashCooldown=Math.max(0,player.dashCooldown-dt);
  let f=Number(keyState.has('KeyW')||keyState.has('ArrowUp'))-Number(keyState.has('KeyS')||keyState.has('ArrowDown'));
  let side=Number(keyState.has('KeyD')||keyState.has('ArrowRight'))-Number(keyState.has('KeyA')||keyState.has('ArrowLeft'));
  const moving=!!(f||side),running=moving&&(keyState.has('ShiftLeft')||keyState.has('ShiftRight'))&&player.stamina>3;
  player.stamina=THREE.MathUtils.clamp(player.stamina+(running?-22:15)*dt,0,100);
  const speed=running?8.9:5.1,length=Math.hypot(f,side)||1;
  const dashActive=player.dash>0;player.dash=Math.max(0,player.dash-dt);
  const vx=dashActive?player.dashX*19*dt:(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*side)/length*speed*dt;
  const vz=dashActive?player.dashZ*19*dt:(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*side)/length*speed*dt;
  if(validPosition(player.x+vx,player.z))player.x+=vx;
  if(validPosition(player.x,player.z+vz))player.z+=vz;
  player.velocityY-=22*dt;player.height+=player.velocityY*dt;
  if(player.height<=0){player.height=0;player.velocityY=0;player.grounded=true;}
  const floor=groundY(player.x,player.z),eye=floor+player.height+1.65;
  avatar.root.position.set(player.x,floor+player.height,player.z);
  avatar.root.rotation.y=player.yaw;
  avatar.animate(elapsed,moving||dashActive,speed,player.attack>0,player.invuln);
  avatar.root.visible=player.thirdPerson&&avatar.root.visible;
  const bob=moving&&player.grounded?Math.sin(elapsed*(running?15:10))*.018:0;
  if(player.thirdPerson){
    const heading=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
    const target=new THREE.Vector3(player.x,floor+player.height+1.35,player.z);
    const retreat=player.zoom*Math.cos(player.pitch*.55);
    const desired=target.clone().addScaledVector(heading,-retreat);
    desired.y+=1.1+player.zoom*.21+Math.sin(player.pitch)*player.zoom*.7;
    const obstruction=desired.clone().sub(target),distance=obstruction.length();
    raycaster.set(target,obstruction.normalize());raycaster.far=distance;
    const hit=raycaster.intersectObjects(world.cameraObstacles,false)[0];
    if(hit)desired.copy(target).addScaledVector(obstruction,Math.max(.55,hit.distance-.35));
    camera.position.lerp(desired,1-Math.exp(-14*dt));camera.lookAt(target);
  }else{
    camera.position.set(player.x,THREE.MathUtils.damp(camera.position.y||eye,eye,14,dt)+bob,player.z);
    camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
  }
  blade.position.y=Math.sin(elapsed*(running?15:9))*(moving?.018:.006);
  blade.rotation.x=player.attack>0?Math.sin((1-player.attack/.56)*Math.PI)*-.65:0;
  blade.rotation.z=player.attack>0?Math.sin((1-player.attack/.56)*Math.PI)*-.95:0;
  player.step-=dt;if(moving&&player.grounded&&player.step<=0){player.step=running?.29:.46;playTone(74+Math.random()*20,.06,.013,'triangle');}
  for(const creature of creatures)if(creature.update(dt,elapsed,player))hurt();
  world.animated.forEach(({mesh,type,baseY,index})=>{
    if(type==='echo'){mesh.position.y=baseY+Math.sin(elapsed*1.8+index)*.3;mesh.rotation.y+=dt*.6;}
    if(type==='ring'){mesh.position.y=baseY+Math.sin(elapsed*1.8+index)*.3;mesh.rotation.z+=dt*.7;}
    if(type==='pool')mesh.material.opacity=.78+Math.sin(elapsed*1.6)*.08;
    if(type==='gate')mesh.material.opacity=.13+Math.sin(elapsed*1.8)*.07;
  });
  FX.position.set(player.x,groundY(player.x,player.z),player.z);
  motes.forEach((m,i)=>{m.position.y+=dt*(.1+i%4*.07);if(m.position.y>8)m.position.y=1;m.material.opacity=.28+Math.sin(elapsed*1.4+i)*.22;});
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.add('hidden');}
  updateHUD();
}
const clock=new THREE.Clock();function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.045);if(!paused)update(dt);renderer.render(scene,camera);}frame();
camera.position.set(player.x,groundY(player.x,player.z)+1.65,player.z);updateHUD();
