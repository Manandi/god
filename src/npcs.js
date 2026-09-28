import * as THREE from 'three';
import { groundY } from './world.js';

const NPC_DATA = [
  { id:'mycel', name:'MYCEL', role:'Rootkeeper', x:-3.2, z:48.2, color:0x6f8f63,
    lines:['The city remembers your footsteps, even when the forest does not.','Guard late, not early. A perfect turn of the wrist breaks a charging beast.'],
    responses:[['city','What is Mossgate?','A promise made from rootwood and stubbornness. We shelter travelers, not conquerors.'],['training','Teach me to survive.','Watch the creature’s feet. When they leave the earth, your parry must already be moving.'],['doubt','I do not trust this place.','Good. Trust should grow roots before it bears weight. Look around, then ask me again.']] },
  { id:'orin', name:'ORIN', role:'Warden-Captain', x:6.4, z:53.6, color:0x526b79,
    lines:['Rootbreaker is slow, but it will crack a shellback out of its lunge.','Mossgate is safe. No shellback crosses the ward posts.'],
    responses:[['training','Show me Rootbreaker.','Hold R, then release it to commit your weight. Do not throw it without enough breath to escape afterward.'],['duty','How can I help Mossgate?','Recover the forest memories. Every awakened root strengthens our wards.'],['boast','I can handle the turtles.','Confidence is useful. Noise is not. Come back after a perfect parry.']] },
  { id:'sela', name:'SELA', role:'Wayfinder', x:-8.5, z:57.4, color:0x9a7451,
    lines:['I marked the old trail with amber lanterns. Follow them when the fog thickens.','Three memories wake the Canopy Gate. The nearest waits at the Rootwell.'],
    responses:[['route','Where should I go first?','Take the south-west lantern road. The Rootwell lies where the ground turns blue-green.'],['ruins','What happened to Mosswatch?','Its wardens listened to the crown and forgot the roots. The stones remember the price.'],['company','Will you come with me?','Not yet. Someone must keep the path home visible. Bring me a memory and I may reconsider.']] },
  { id:'tavi', name:'TAVI', role:'Herbalist', x:9.1, z:43.9, color:0x7d596f,
    lines:['Rest beside the green brazier and I will bind your wounds.','A measured fighter keeps enough breath for one last leaf-step.'],
    responses:[['healing','Can you heal me?','The hearth restores vitality and breath. Stand beside it and press E.'],['herbs','What grows in the Reach?','Sunmoss for wounds, bellcap for fever, and ghostfern for mistakes best left unnamed.'],['style','Do I look like I belong?','Square cuffs, honest leather, steady eyes. You look more like the Reach every day.']] }
];

function material(color, emissive=0){return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:emissive?1.1:0,roughness:.9,flatShading:true});}
function cube(parent,size,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}

function makeNpc(scene,data,index){
  const root=new THREE.Group();root.position.set(data.x,groundY(data.x,data.z),data.z);scene.add(root);
  const skin=material([0xc48f68,0x8f624a,0xe0ad7f,0xb97959][index]),cloth=material(data.color),dark=material(0x26332f),leather=material(0x554438),glow=material(0xd6d58e,0x4f6d3d);
  const white=material(0xf5f0df),iris=material([0x385342,0x523d2a,0x355468,0x4d382d][index]),lip=material(0x8b5149),hair=material([0x29302b,0x76513b,0xb29b73,0x3b2925][index]);
  const body=new THREE.Group();root.add(body);
  cube(body,[.62,.78,.35],cloth,0,1.24,0);
  cube(body,[.48,.42,.4],skin,0,1.87,-.01);
  cube(body,[.52,.13,.43],hair,0,2.09,0);
  const brows=[];
  for(const side of [-1,1]){
    cube(body,[.105,.075,.025],white,side*.115,1.94,.202);
    cube(body,[.04,.05,.012],iris,side*.115,1.94,.219);
    const brow=cube(body,[.12,.025,.02],hair,side*.115,2.015,.212);brow.rotation.z=side*(index%2?.12:-.04);brows.push(brow);
  }
  cube(body,[.055,.07,.035],skin,0,1.87,.22);
  const mouth=cube(body,[.15,.028,.018],lip,0,1.79,.215);mouth.rotation.z=index===2?.06:0;
  if(index===0){for(let i=0;i<5;i++)cube(body,[.09,.18,.08],hair,(i-2)*.085,1.68,.04);}
  if(index===2){const braid=cube(body,[.1,.43,.1],hair,-.2,1.74,-.06);braid.rotation.z=-.08;}
  // Block arms are intentional: the NPCs and explorer share one visual language.
  for(const side of [-1,1]){
    const arm=cube(body,[.2,.68,.22],cloth,side*.43,1.26,0);arm.rotation.z=side*(index%2?.13:-.08);
    cube(body,[.22,.18,.24],leather,side*.45,.9,0);
    cube(body,[.18,.19,.2],skin,side*.45,.72,-.01);
    cube(body,[.24,.74,.27],dark,side*.18,.5,.02);
  }
  const rune=cube(body,[.12,.12,.04],glow,0,1.35,-.2);rune.rotation.z=Math.PI/4;
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0xe8d993,transparent:true,opacity:.85}));marker.position.set(0,2.55,0);root.add(marker);
  root.rotation.y=index%2?Math.PI*.92:Math.PI*.12;
  return {...data,root,body,marker,mouth,brows,line:0,stance:'',expression:'neutral',baseY:root.position.y};
}

export function createNpcs(scene){return NPC_DATA.map((data,index)=>makeNpc(scene,data,index));}

export function updateNpcs(npcs,time,player,camera){
  for(const npc of npcs){
    const d=Math.hypot(player.x-npc.x,player.z-npc.z);
    if(d<7){
      const want=Math.atan2(player.x-npc.x,player.z-npc.z);
      const delta=Math.atan2(Math.sin(want-npc.root.rotation.y),Math.cos(want-npc.root.rotation.y));
      npc.root.rotation.y+=delta*(1-Math.exp(-3/60));
    }
    npc.body.position.y=Math.sin(time*1.7+npc.x)*.012;
    const speaking=npc.expression!=='neutral',stern=npc.expression==='stern',warm=npc.expression==='warm'||npc.expression==='resolved';
    npc.mouth.scale.x=THREE.MathUtils.damp(npc.mouth.scale.x,warm ? 1.18 : stern ? .82 : speaking ? 1.05 : 1,9,1/60);
    npc.mouth.rotation.z=THREE.MathUtils.damp(npc.mouth.rotation.z,warm ? .08 : stern ? -.03 : 0,9,1/60);
    npc.mouth.position.y=THREE.MathUtils.damp(npc.mouth.position.y,warm?1.805:stern?1.785:1.79,9,1/60);
    npc.brows.forEach((b,i)=>{const side=i?-1:1;b.rotation.z=THREE.MathUtils.damp(b.rotation.z,stern?side*.22:warm?-side*.1:side*.04,9,1/60);b.position.y=THREE.MathUtils.damp(b.position.y,stern?2.0:warm?2.025:2.015,9,1/60);});
    npc.marker.position.y=2.5+Math.sin(time*2.2+npc.z)*.07;
    npc.marker.visible=d<12;
  }
}

export function nearestNpc(npcs,x,z,radius=3.1){
  return npcs.map(npc=>({npc,d:Math.hypot(npc.x-x,npc.z-z)})).filter(v=>v.d<radius).sort((a,b)=>a.d-b.d)[0]?.npc||null;
}

export function conversationFor(npc,quest=null){
  const remembered=npc.stance?` You chose to speak of ${npc.stance}; I remember.`:'';
  const line=(quest?.opening||npc.lines[npc.line%npc.lines.length])+remembered;npc.line++;
  const responses=quest?[[quest.action,quest.label,quest.reply],...npc.responses.slice(1)]:npc.responses;
  return {title:`${npc.name} · ${npc.role}`,line,choices:responses.map(([,label])=>label),responses};
}

export function answerNpc(npc,index,data){
  const responses=data?.responses||npc.responses;
  const [key,label,reply]=responses[index]||responses[0];if(!key.startsWith('quest-'))npc.stance=key;
  return {key,label,reply};
}
