import * as T from 'three';
import { molotovMesh } from './ProjectileModels';
import type { WeaponType } from '../data/weapons';

/** Original small weapon assets. Each model's origin is its grip/socket. */
export function weaponMesh(type: WeaponType, inHand = false) {
  const group = new T.Group(); group.name = 'held-weapon'; group.userData.weapon = type;
  const materials = {
    stone: new T.MeshStandardMaterial({color:0x899b9d,roughness:1}),
    steel: new T.MeshStandardMaterial({ color: 0x3d515e, metalness: .65, roughness: .4 }),
    edge: new T.MeshStandardMaterial({ color: 0xbacbd0, metalness: .7, roughness: .3 }),
    wood: new T.MeshStandardMaterial({ color: 0x93613b, roughness: .85 }),
    grip: new T.MeshStandardMaterial({ color: 0x3a423c, roughness: 1 }),
    brass: new T.MeshStandardMaterial({ color: 0xb49c63, metalness: .55, roughness: .5 })
  };
  const add=(geometry:T.BufferGeometry, material:T.Material,x=0,y=0,z=0) => {const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
  const profile=(points:number[][],depth:number,material:T.Material) => {
    const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:1,steps:1});geometry.translate(0,0,-depth/2);return add(geometry,material);
  };
  const cylinder=(radius:number,length:number,material:T.Material,x=0,y=0,z=0)=>add(new T.CylinderGeometry(radius,radius,length,8),material,x,y,z);
  if(type==='stone_sword'||type==='wooden_sword'||type==='machete') {
    cylinder(.038,.22,materials.grip,0,-.06);
    cylinder(.045,.025,materials.brass,0,-.18);
    const guard=profile([[-.14,.04],[.14,.04],[.12,.085],[-.12,.085]],.065,type==='wooden_sword'?materials.wood:materials.steel);guard.position.y=.01;
    profile(type!=='machete'?[[-.065,.12],[.065,.12],[.055,.68],[0,.82],[-.055,.68]]:[[-.045,.12],[.055,.12],[.075,.53],[.11,.68],[.035,.8],[-.075,.68],[-.065,.3]],.045,type==='wooden_sword'?materials.wood:type==='stone_sword'?materials.stone:materials.edge);
    if(type==='wooden_sword') profile([[-.012,.16],[.012,.16],[.008,.7],[-.008,.7]],.05,materials.brass);
    for(let i=0;i<4;i++)add(new T.TorusGeometry(.039,.006,3,8),materials.wood,0,-.13+i*.045).rotation.x=Math.PI/2;
  } else if(type==='spear') {
    cylinder(.025,1.65,materials.wood,0,.24);cylinder(.036,.24,materials.grip,0,0);
    profile([[-.026,1.04],[.026,1.04],[.075,1.17],[0,1.48],[-.075,1.17]],.025,materials.edge);
    cylinder(.033,.12,materials.brass,0,1.01);
  } else if(type==='shotgun') {
    // Side profiles define a buttstock, trigger/receiver and tapered pump. Forward is +Z.
    const stock=profile([[-.48,-.16],[-.48,.06],[-.31,.08],[-.1,.04],[.04,-.04],[-.08,-.1],[-.28,-.045],[-.35,-.18]],.11,materials.wood);stock.rotation.y=-Math.PI/2;
    const receiver=profile([[-.08,-.055],[.31,-.055],[.34,.07],[-.07,.08]],.12,materials.steel);receiver.rotation.y=-Math.PI/2;
    const barrel=cylinder(.033,.79,materials.steel,0,.065,.64);barrel.rotation.x=Math.PI/2;
    const magazine=cylinder(.035,.51,materials.steel,0,-.02,.51);magazine.rotation.x=Math.PI/2;
    const pump=cylinder(.056,.24,materials.wood,0,-.018,.56);pump.rotation.x=Math.PI/2;
    const muzzle=add(new T.RingGeometry(.023,.035,10),materials.edge,0,.065,1.04);muzzle.material.side=T.DoubleSide;
    const flash=add(new T.ConeGeometry(.11,.3,5).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:0xffdc83,transparent:true,opacity:.85,depthWrite:false}),0,.065,1.15);flash.name='muzzle-flash';flash.visible=false;flash.castShadow=false;
    add(new T.TorusGeometry(.065,.011,4,10,Math.PI*1.6),materials.steel,0,-.08,.13).rotation.y=Math.PI/2;
    profile([[-.014,.1],[.014,.1],[.01,.14],[-.01,.14]],.02,materials.brass).position.z=.92;
  } else if(type==='bow') {
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.62,-.05),new T.Vector3(0,-.44,.13),new T.Vector3(0,-.2,.19),new T.Vector3(0,0,.07),new T.Vector3(0,.2,.19),new T.Vector3(0,.44,.13),new T.Vector3(0,.62,-.05)]);
    add(new T.TubeGeometry(curve,24,.025,5,false),materials.wood);cylinder(.035,.17,materials.grip,0,0,.07);
    const string=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,-.62,-.05),new T.Vector3(0,.62,-.05)]),new T.LineBasicMaterial({color:0xd9d5b6}));group.add(string);
    const arrow=cylinder(.008,.68,materials.wood,0,0,.29);arrow.rotation.x=Math.PI/2;
    const tip=add(new T.ConeGeometry(.021,.08,4),materials.edge,0,0,.67);tip.rotation.x=Math.PI/2;
  } else {
    group.add(molotovMesh());
  }
  // Materials are owned per weapon and can be released without touching another model.
  const used=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])used.add(m);});
  for(const material of Object.values(materials))if(!used.has(material))material.dispose();
  if(!inHand){group.position.set(.48,1.1,.28);group.rotation.x=type==='spear'?Math.PI/3:.3;}
  return group;
}
export function disposeWeapon(group:T.Object3D) {
  const materials=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const m of materials)m.dispose();group.removeFromParent();
}
