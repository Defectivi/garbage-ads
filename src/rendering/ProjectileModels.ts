import * as T from 'three';
import type { Projectile } from '../game/CombatState';

// Original pixel surface: green glass, worn paper band, red hazard stripe and soot.
// Shared immutable texture; individual weapon disposal must not dispose this atlas.
let bottleSurface:T.DataTexture|undefined;
function molotovSurface() {
  if(bottleSurface)return bottleSurface;
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=((x*17+y*31+x*y*3)%13)-6, label=y>18&&y<36;
    let rgb=label?[192,171,119]:[69+Math.round(24*Math.sin(x/size*Math.PI*2)),100,55];
    if(label&&(y<22||y>32))rgb=[144,53,31];
    if(label&&y>24&&y<29&&x%16>3&&x%16<12)rgb=[46,44,33];
    if(y>52)rgb=rgb.map(v=>v*.6);
    const i=(y*size+x)*4;data[i]=rgb[0]+noise;data[i+1]=rgb[1]+noise;data[i+2]=rgb[2]+noise;data[i+3]=255;
  }
  bottleSurface=new T.DataTexture(data,size,size);bottleSurface.name='Molotov_glass_paper_soot';bottleSurface.colorSpace=T.SRGBColorSpace;bottleSurface.magFilter=T.NearestFilter;bottleSurface.needsUpdate=true;return bottleSurface;
}

/** Grip centered bottle, used both in the hand and in flight. */
export function molotovMesh() {
  const g=new T.Group();g.name='Molotov_bottle';
  const contour=[[0,-.23],[.085,-.23],[.105,-.18],[.105,.07],[.065,.14],[.035,.18],[.035,.29],[0,.29]].map(([x,y])=>new T.Vector2(x,y));
  const glass=new T.Mesh(new T.LatheGeometry(contour,12),new T.MeshStandardMaterial({map:molotovSurface(),roughness:.32,metalness:.12}));glass.name='textured-glass';g.add(glass);
  const wick=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,.29,0),new T.Vector3(.025,.35,0),new T.Vector3(.065,.39,0)]),6,.017,5,false),new T.MeshStandardMaterial({color:0xd5c39c,roughness:1}));wick.name='cloth-wick';g.add(wick);
  const flame=new T.Mesh(new T.ConeGeometry(.047,.16,6),new T.MeshBasicMaterial({color:0xff8c32}));flame.position.set(.065,.44,0);flame.name='lit-wick';g.add(flame);
  const core=new T.Mesh(new T.ConeGeometry(.022,.1,5),new T.MeshBasicMaterial({color:0xffed9f}));core.position.set(.065,.425,.02);g.add(core);
  return g;
}

/** Templates own GPU assets; flight clones share them, avoiding per-shot allocation. */
export class ProjectileModels {
  private templates=new Map<Projectile['kind'],T.Group>();
  create(kind:Projectile['kind']) {
    let template=this.templates.get(kind);
    if(!template){template=this.build(kind);this.templates.set(kind,template);}
    return template.clone(true);
  }
  private build(kind:Projectile['kind']) {
    const g=kind==='bottle'?molotovMesh():new T.Group();g.name=`projectile-${kind}`;g.userData.projectileKind=kind;
    const add=(geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0)=>{const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);g.add(mesh);return mesh;};
    if(kind==='arrow'){
      const shaft=add(new T.CylinderGeometry(.018,.018,.95,6),new T.MeshStandardMaterial({color:0x98623b}),0,0,-.04);shaft.rotation.x=Math.PI/2;shaft.name='wooden-shaft';
      const tip=add(new T.ConeGeometry(.065,.2,4),new T.MeshStandardMaterial({color:0xc6d6db,metalness:.7,roughness:.3}),0,0,.53);tip.rotation.x=Math.PI/2;tip.name='steel-arrowhead';
      const feather=new T.MeshStandardMaterial({color:0xf5e5be,side:T.DoubleSide});
      for(let i=0;i<3;i++){const fin=new T.Shape();fin.moveTo(0,-.52);fin.lineTo(.12,-.47);fin.lineTo(.12,-.28);fin.lineTo(0,-.34);fin.closePath();const mesh=add(new T.ShapeGeometry(fin),feather);mesh.rotation.x=Math.PI/2;mesh.rotateY(i*Math.PI*2/3);mesh.name='fletching';}
    }else if(kind==='pellet'){
      const bullet=add(new T.SphereGeometry(.04,6,4),new T.MeshBasicMaterial({color:0xffefb0}));bullet.name='shot-pellet';
      const streak=add(new T.CylinderGeometry(.012,.024,.48,5),new T.MeshBasicMaterial({color:0xffd581,transparent:true,opacity:.7,depthWrite:false}),0,0,-.24);streak.rotation.x=Math.PI/2;streak.name='shot-tracer';
    }else if(kind==='swing'){
      const arc=add(new T.RingGeometry(.9,1.03,20,1,-.8,1.6),new T.MeshBasicMaterial({color:0xf7e7bc,transparent:true,opacity:.35,side:T.DoubleSide,depthWrite:false}));arc.rotation.x=-Math.PI/2;arc.rotation.z=Math.PI/2;
    }
    return g;
  }
}
