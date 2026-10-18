import * as T from 'three';
import {solveArm} from './RigIK';

/** Restore procedural overrides before the mixer samples the next frame. */
export class ActionPoseState {
  private saved:{bone:T.Object3D;rotation:T.Quaternion}[]=[];
  private asset?:T.Group;private active=false;
  restore(){if(this.active)for(const s of this.saved)s.bone.quaternion.copy(s.rotation);this.active=false;}
  capture(asset:T.Group){
    if(this.active)return;
    if(this.asset!==asset){this.asset=asset;this.saved=[];for(const name of ['ArmR','ElbowR','HandR','ArmL','ElbowL','HandL']){const bone=asset.getObjectByName(name);if(bone)this.saved.push({bone,rotation:new T.Quaternion()});}}
    for(const s of this.saved)s.rotation.copy(s.bone.quaternion);this.active=true;
  }
}

/** Cosmetic grips and release/recoil only. Projectiles and hits remain authoritative. */
export function rangedPose(root:T.Group,asset:T.Group,weapon:T.Group,type:string,time?:number){
  const world=(x:number,y:number,z:number)=>root.localToWorld(new T.Vector3(x,y,z));
  weapon.rotation.set(0,0,0);
  if(type==='shotgun'){
    const t=time??1,kick=Math.sin(Math.min(1,t/.12)*Math.PI)*Math.max(0,1-t/.26);
    weapon.rotation.x=-kick*.16;
    solveArm(root,asset,'R',world(.06,1.4+kick*.04,.11-kick*.09));
    solveArm(root,asset,'L',weapon.localToWorld(new T.Vector3(0,-.04,.44)));
    const flash=weapon.getObjectByName('muzzle-flash');if(flash)flash.visible=time!==undefined&&time<.065;
  }else if(type==='bow'){
    const release=time===undefined?0:T.MathUtils.smoothstep(time,0,.24);
    solveArm(root,asset,'L',world(-.14,1.52,.48));solveArm(root,asset,'R',world(-.14+release*.12,1.55,.14+release*.25));
  }else if(type==='molotov'&&time!==undefined){
    const t=T.MathUtils.clamp(time/.65,0,1),throwing=T.MathUtils.smoothstep(t,.05,.48),recover=T.MathUtils.smoothstep(t,.55,1);
    solveArm(root,asset,'R',world(.32,1.78-throwing*.48-recover*.15,-.18+throwing*.82-recover*.4));
    solveArm(root,asset,'L',world(-.3,1.15,.2));weapon.rotation.x=throwing*.7*(1-recover);
  }
}
