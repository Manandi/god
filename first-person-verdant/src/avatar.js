import * as THREE from 'three';

// The explorer uses the muted green outfit and dark hair of the 2D player.
export function createAvatar(scene){
  const root=new THREE.Group();scene.add(root);
  const fabric=new THREE.MeshStandardMaterial({color:0x476f59,roughness:.92});
  const trim=new THREE.MeshStandardMaterial({color:0x91bc8b,roughness:.88});
  const dark=new THREE.MeshStandardMaterial({color:0x25372f,roughness:1});
  const skin=new THREE.MeshStandardMaterial({color:0xbca785,roughness:.95});
  const metal=new THREE.MeshStandardMaterial({color:0xb7c5a8,metalness:.58,roughness:.39});
  function add(parent,geometry,material,x,y,z){const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;parent.add(part);return part;}
  add(root,new THREE.CylinderGeometry(.26,.43,.91,8),fabric,0,1.03,0);
  const cloak=add(root,new THREE.ConeGeometry(.53,1.12,8),fabric,0,.85,.13);cloak.rotation.x=-.12;
  add(root,new THREE.CylinderGeometry(.39,.34,.1,8),trim,0,1.43,0);
  add(root,new THREE.SphereGeometry(.24,10,8),skin,0,1.68,-.03);
  add(root,new THREE.SphereGeometry(.255,10,8,0,Math.PI*2,0,Math.PI*.43),dark,0,1.77,-.03);
  add(root,new THREE.BoxGeometry(.34,.1,.27),dark,0,1.86,-.07);
  const legs=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.17,.67,0);root.add(leg);
    add(leg,new THREE.CylinderGeometry(.12,.13,.48,7),dark,0,-.24,0);
    add(leg,new THREE.BoxGeometry(.27,.16,.37),dark,0,-.51,-.075);legs.push(leg);
    const arm=add(root,new THREE.CylinderGeometry(.1,.13,.62,7),fabric,side*.38,1.1,-.035);arm.rotation.z=side*.17;
    add(root,new THREE.SphereGeometry(.12,8,6),skin,side*.43,.78,-.045);
  }
  add(root,new THREE.BoxGeometry(.12,.42,.06),trim,0,1.1,-.34);
  const weapon=add(root,new THREE.CylinderGeometry(.035,.04,.94,6),metal,.46,.87,-.24);weapon.rotation.z=-.32;
  return {root,animate(time,moving,speed,attacking,invuln){
    const cycle=Math.sin(time*(speed>7?14:10));
    legs[0].rotation.x=moving?cycle*.52:0;legs[1].rotation.x=moving?-cycle*.52:0;
    cloak.rotation.z=moving?Math.sin(time*8)*.035:0;
    weapon.rotation.x=attacking?Math.sin(time*18)*.8:0;
    root.visible=!(invuln>0&&Math.floor(time*15)%3===0);
  }};
}
