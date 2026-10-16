import { meleePose } from './MeleePose';
import { solveArm } from './RigIK';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Game } from '../game/Game';
import type { WeaponType } from '../data/weapons';
import { createSurvivorAsset } from './SurvivorAsset';
import { weaponMesh, disposeWeapon } from './WeaponModels';

/** Visual state only. Collision, hits, durability and awards remain in Game/CombatSystem. */
export class PlayerCharacter {
  readonly object = new T.Group();
  ready = false; source: 'loading' | 'glb' | 'local-fallback' = 'loading';
  private mixer?: T.AnimationMixer; private asset?: T.Group;
  private actions = new Map<string,T.AnimationAction>();
  private base?: T.AnimationAction; private upper?: T.AnimationAction; private oneShot = false;
  private held?: T.Group; private equipped = ''; private type?: WeaponType;
  private previous?: { x:number; z:number }; private speed = 0;
  private attackStamp = -100; private gatherStamp = -100; private hp = 100;
  private disposed = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  constructor() {
    this.object.name = 'PlayerSurvivor';
    void new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/wayfarer.glb`).then(asset => this.install(asset,'glb')).catch(() => this.install(createSurvivorAsset(),'local-fallback'));
  }
  private install(asset:{scene:T.Group;animations:T.AnimationClip[]},source:'glb'|'local-fallback') {
    if(this.disposed){this.disposeAsset(asset.scene);return;}
    this.asset=asset.scene;this.object.add(asset.scene);this.mixer=new T.AnimationMixer(asset.scene);
    asset.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;if(o instanceof T.SkinnedMesh)o.frustumCulled=false;}});
    const clips=[...asset.animations];const stone=clips.find(c=>c.name==='wooden_sword')?.clone();if(stone){stone.name='stone_sword';clips.push(stone);}
    for(const name of ['bow','shotgun']) {
      const shot=clips.find(c=>c.name===name);if(!shot)continue;
      const tracks=shot.tracks.map(track=>new T.QuaternionKeyframeTrack(track.name,[0,1],[...track.values.slice(0,4),...track.values.slice(0,4)]));
      clips.push(new T.AnimationClip(`aim_${name}`,1,tracks));
    }
    for(const clip of clips)this.actions.set(clip.name,this.mixer.clipAction(clip));
    this.source=source;this.ready=true;this.object.userData.assetSource=source;
  }
  private transition(name:string,upper=false,once=false) {
    const next=this.actions.get(name);if(!next)return;
    const previous=upper?this.upper:this.base;
    if(previous===next&&!once)return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();
    if(previous&&previous!==next)previous.crossFadeTo(next,.14,false);
    if(upper){this.upper=next;this.oneShot=once;}else this.base=next;
  }
  reset() {
    this.previous=undefined;this.speed=0;this.attackStamp=-100;this.gatherStamp=-100;this.hp=100;
    this.mixer?.stopAllAction();this.base=undefined;this.upper=undefined;this.oneShot=false;
    if(this.held)disposeWeapon(this.held);this.held=undefined;this.equipped='';this.type=undefined;
  }
  update(game:Game,dt:number,aiming=false) {
    const p=game.state.player,elapsed=game.state.elapsed;
    const travel=this.previous?Math.hypot(p.x-this.previous.x,p.z-this.previous.z):0;
    const speed=dt>0?Math.min(12,travel/dt):0;this.speed=T.MathUtils.lerp(this.speed,speed,1-Math.exp(-dt*12));
    this.previous={x:p.x,z:p.z};
    this.object.position.set(p.x,game.world.walkHeight(p.x,p.z),p.z);
    const angle=Math.atan2(Math.sin(p.heading-this.object.rotation.y),Math.cos(p.heading-this.object.rotation.y));
    this.object.rotation.y+=angle*(1-Math.exp(-dt*16));
    if(!this.ready)return;
    const equipped=game.state.combat.weapons.find(w=>w.id===game.state.combat.equipped&&w.uses>0);
    if(this.equipped!==(equipped?.id??'')) {
      this.oneShot=false;this.upper?.fadeOut(.12);this.upper=undefined;
      if(this.held)disposeWeapon(this.held);this.held=undefined;this.equipped=equipped?.id??'';this.type=equipped?.type;
      if(equipped){const socket=this.asset!.getObjectByName(equipped.type==='bow'?'HandL':'HandR');this.held=weaponMesh(equipped.type,true);if(equipped.type==='shotgun')this.held.scale.setScalar(.8);if(['stone_sword','wooden_sword','machete','spear'].includes(equipped.type))this.held.rotation.x=equipped.type==='spear'?0:Math.PI;socket?.add(this.held);}
    }
    const dead=game.dead;
    if(dead){if(this.base?.getClip().name!=='death'){this.oneShot=false;this.upper?.fadeOut(.1);this.transition('death',false,true);}this.mixer!.update(dt);this.object.userData.animation='death';this.hp=p.hp;return;}
    const locomotion=this.speed>.2?(this.speed>7?'sprint':'walk'):'idle';
    this.transition(locomotion);
    if(this.base&&locomotion!=='idle')this.base.setEffectiveTimeScale(T.MathUtils.clamp(this.speed/(locomotion==='sprint'?9:6),.5,1.4));
    if(this.oneShot&&this.upper&&this.upper.time>=this.upper.getClip().duration-.02)this.oneShot=false;
    if(!game.paused&&game.combat.lastAttack>this.attackStamp) {
      this.attackStamp=game.combat.lastAttack;this.object.rotation.y=p.heading;
      if(elapsed-this.attackStamp<.5)this.transition(this.type??'punch',true,true);
    } else if(!game.paused&&game.lastGather>this.gatherStamp) {
      this.gatherStamp=game.lastGather;if(elapsed-this.gatherStamp<.5)this.transition('gather',true,true);
    }
    if(p.hp<this.hp&&!dead)this.transition('hurt',true,true);this.hp=p.hp;
    if(!this.oneShot)this.transition(aiming&&(this.type==='bow'||this.type==='shotgun')?`aim_${this.type}`:`arms_${locomotion}`,true);
    // Reduced motion removes ambient sway, while deliberate locomotion/actions still communicate state.
    const motion=this.reduced.matches;
    if(this.upper&&this.upper.getClip().name==='arms_idle')this.upper.setEffectiveTimeScale(motion?0:1);
    this.mixer!.update(game.paused?0:dt);
    if((aiming||this.oneShot)&&this.held&&(this.type==='bow'||this.type==='shotgun')&&this.upper?.getClip().name!=='hurt')this.rangedGrip(this.type);
    if(this.held&&this.type&&['stone_sword','wooden_sword','machete','spear'].includes(this.type)){if(this.oneShot&&this.upper?.getClip().name===this.type)meleePose(this.object,this.asset!,this.held,this.type,this.upper.time/this.upper.getClip().duration);else this.held.rotation.set(this.type==='spear'?0:Math.PI,0,-.15);}
    this.object.userData.animation=this.oneShot?this.upper?.getClip().name:locomotion;
    this.object.userData.upperAnimation=this.upper?.getClip().name;this.object.userData.weapon=this.type;
  }
  private solveArm(side:'L'|'R',target:T.Vector3) { solveArm(this.object,this.asset!,side,target); }
  private rangedGrip(type:'bow'|'shotgun') {
    const world=(point:T.Vector3)=>this.object.localToWorld(point);
    if(type==='shotgun'){
      const t=this.upper?.getClip().name==='shotgun'?this.upper.time:1;
      const kick=Math.sin(Math.min(1,t/.16)*Math.PI)*Math.max(0,1-t/.3);
      this.held!.rotation.x=-kick*.12;
      this.solveArm('R',world(new T.Vector3(.06,1.4+kick*.03,.11-kick*.05)));
      this.solveArm('L',this.held!.localToWorld(new T.Vector3(0,-.04,.44)));
    }else{
      this.solveArm('L',world(new T.Vector3(-.14,1.52,.48)));
      const release=this.upper?.getClip().name==='bow'?Math.min(1,this.upper.time/.35):0;
      this.solveArm('R',world(new T.Vector3(-.14,1.55,.14+release*.16)));
    }
  }
  private disposeAsset(asset:T.Group) {
    const materials=new Set<T.Material>();asset.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.SkinnedMesh)o.skeleton.dispose();}});for(const m of materials)m.dispose();
  }
  dispose(){this.disposed=true;this.mixer?.stopAllAction();if(this.held)disposeWeapon(this.held);if(this.asset){this.mixer?.uncacheRoot(this.asset);this.disposeAsset(this.asset);}this.object.removeFromParent();}
}
