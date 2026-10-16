import {workerTool} from './WorkerTools';
import {createWolfAsset} from './WolfAsset';
import { meleePose } from './MeleePose';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTER_STYLES } from '../data/characters';
import type { WeaponType } from '../data/weapons';
import { createSurvivorAsset } from './SurvivorAsset';
import { createBearAsset } from './BearAsset';
import { weaponMesh, disposeWeapon } from './WeaponModels';
import { solveArm } from './RigIK';

const templates=new Map<string,Promise<{scene:T.Group;animations:T.AnimationClip[]}>>();
function template(id:string) {
  if(!templates.has(id))templates.set(id,new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${id}.glb`).catch(()=>id.startsWith('wolf-')?createWolfAsset(id):id.startsWith('bear-')?createBearAsset(id):createSurvivorAsset(CHARACTER_STYLES.find(s=>s.id===id))));
  return templates.get(id)!;
}
export class NPCCharacter {
  readonly object=new T.Group(); ready=false;
  private asset?:T.Group;private mixer?:T.AnimationMixer;private actions=new Map<string,T.AnimationAction>();
  private tool?:T.Group;
  private base?:T.AnimationAction;private upper?:T.AnimationAction;private action=false;private lastAttack=-100;
  private old?:{x:number;z:number};private speed=0;private weapon?:T.Group;private weaponType?:WeaponType;private disposed=false;
  constructor(readonly appearance:string) {
    this.object.visible=false;this.object.name='NPCSurvivor';this.object.userData.appearance=appearance;
    void template(appearance).then(asset=>{if(this.disposed)return;this.asset=clone(asset.scene) as T.Group;this.object.add(this.asset);this.mixer=new T.AnimationMixer(this.asset);const stone=asset.animations.find(c=>c.name==='wooden_sword')?.clone();if(stone){stone.name='stone_sword';if(!asset.animations.some(c=>c.name==='stone_sword'))asset.animations.push(stone);}
    for(const clip of asset.animations)this.actions.set(clip.name,this.mixer.clipAction(clip));this.asset.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;if(o instanceof T.SkinnedMesh)o.frustumCulled=false;}});this.ready=true;this.object.visible=true;});
  }
  private play(name:string,upper=false,once=false) {
    const next=this.actions.get(name);if(!next)return;const old=upper?this.upper:this.base;if(old===next&&!once)return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();if(old&&old!==next)old.crossFadeTo(next,.18,false);
    if(upper){this.upper=next;this.action=once;}else this.base=next;
  }
  update(point:{x:number;z:number},height:number,heading:number,dt:number,clock:number,weapon:WeaponType|null=null,attack=-100,working=false,tool?:'axe'|'pickaxe') {
    const distance=this.old?Math.hypot(point.x-this.old.x,point.z-this.old.z):0;this.old={...point};
    this.speed=T.MathUtils.lerp(this.speed,dt>0?Math.min(3,distance/dt):0,1-Math.exp(-dt*12));
    this.object.position.set(point.x,height,point.z);this.object.rotation.y+=Math.atan2(Math.sin(heading-this.object.rotation.y),Math.cos(heading-this.object.rotation.y))*(1-Math.exp(-dt*10));
    if(!this.ready)return;
    const wanted=working?tool:undefined;if(this.tool?.userData.tool!==wanted){if(this.tool)disposeWeapon(this.tool);this.tool=undefined;if(wanted){this.tool=workerTool(wanted);this.asset!.getObjectByName('HandR')?.add(this.tool);}}
    const bear=this.appearance.startsWith('bear-')||this.appearance.startsWith('wolf-'),moving=this.speed>.08;
    this.play(moving?'walk':'idle');if(this.base&&moving)this.base.setEffectiveTimeScale(T.MathUtils.clamp(this.speed/(bear?1.5:1.8),.4,1.5));
    if(this.weaponType!==(weapon??undefined)) { if(this.weapon)disposeWeapon(this.weapon);this.weapon=undefined;this.weaponType=weapon??undefined;if(weapon&&!bear){this.weapon=weaponMesh(weapon,true);if(weapon==='shotgun')this.weapon.scale.setScalar(.8);if(['stone_sword','wooden_sword','spear','machete'].includes(weapon))this.weapon.rotation.x=weapon==='spear'?0:Math.PI;this.asset!.getObjectByName(weapon==='bow'?'HandL':'HandR')?.add(this.weapon);}}
    if(this.action&&this.upper&&this.upper.time>=this.upper.getClip().duration-.02)this.action=false;
    if(attack>this.lastAttack){this.lastAttack=attack;if(clock-attack<.8)this.play(bear?'attack':weapon??'punch',true,true);}
    if(!this.action&&bear&&this.upper){this.upper.fadeOut(.15);this.upper=undefined;}
    if(!this.action&&!bear)this.play(working?'gather':moving?'arms_walk':'arms_idle',true);
    this.mixer!.update(dt);
    if(this.action&&this.weapon&&this.asset&&(weapon==='shotgun'||weapon==='bow')){
      if(weapon==='shotgun') {solveArm(this.object,this.asset,'R',this.object.localToWorld(new T.Vector3(.06,1.4,.11)));solveArm(this.object,this.asset,'L',this.weapon.localToWorld(new T.Vector3(0,-.04,.44)));}
      else {solveArm(this.object,this.asset,'L',this.object.localToWorld(new T.Vector3(-.14,1.52,.48)));solveArm(this.object,this.asset,'R',this.object.localToWorld(new T.Vector3(-.14,1.55,.14)));}
    }
    if(this.weapon&&weapon&&['stone_sword','wooden_sword','machete','spear'].includes(weapon)){if(this.action&&this.upper?.getClip().name===weapon)meleePose(this.object,this.asset!,this.weapon,weapon,this.upper.time/this.upper.getClip().duration);else this.weapon.rotation.set(weapon==='spear'?0:Math.PI,0,-.15);}
    this.object.userData.animation=this.action?this.upper?.getClip().name:working?'gather':moving?'walk':'idle';
  }
  dispose(){this.disposed=true;if(this.tool)disposeWeapon(this.tool);if(this.weapon)disposeWeapon(this.weapon);this.mixer?.stopAllAction();if(this.asset){this.mixer?.uncacheRoot(this.asset);this.asset.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose();});}this.object.removeFromParent();}
}
