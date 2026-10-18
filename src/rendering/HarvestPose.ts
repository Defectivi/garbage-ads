import * as T from 'three';
import { solveArm } from './RigIK';

export type HarvestTool = 'axe' | 'pickaxe';
type Task = { node: { resource: string }; remaining: number };
export const HARVEST_RECOVERY = .18;
export const harvestCycles=(duration:number)=>Math.max(1,Math.ceil(duration/.8));
export function harvestPhase(fraction:number,duration:number){
  const progress=T.MathUtils.clamp(fraction,0,1)*harvestCycles(duration),phase=progress%1,last=Math.floor(progress)>=harvestCycles(duration)-1;
  return fraction>=1?1:last?phase:phase<.75?phase/.75:1+(phase-.75)/.25;
}
export function harvestTool(resource:string):HarvestTool|undefined {
  return resource==='wood'?'axe':['stone','metal','gold'].includes(resource)?'pickaxe':undefined;
}
/** Cosmetic clock follows the actual task, including its final hit; never awards resources. */
export class HarvestMotion {
  private task?:Task;
  private finished?:number;
  private kind?:HarvestTool;
  reset(){this.task=undefined;this.finished=undefined;this.kind=undefined;}
  update(task:Task|undefined,elapsed:number,duration:number,active:boolean) {
    if(!active){this.reset();return;}
    if(task){
      const kind=harvestTool(task.node.resource);
      if(!kind){this.reset();return;}
      this.task=task;this.kind=kind;this.finished=undefined;
      return {kind,progress:task.remaining<=1e-8?1:harvestPhase(1-task.remaining/duration,duration)};
    }
    if(!this.task||this.task.remaining>1e-8){this.reset();return;}
    this.finished??=elapsed;
    const recovery=(elapsed-this.finished)/HARVEST_RECOVERY;
    if(recovery>=1){this.reset();return;}
    return {kind:this.kind!,progress:1+recovery};
  }
}
const smooth=(n:number)=>{const t=T.MathUtils.clamp(n,0,1);return t*t*(3-2*t);};
/** +Z is the rig's forward direction. Heads travel in a vertical plane, never sideways. */
export function harvestPath(kind:HarvestTool,progress:number) {
  const rest=new T.Vector3(.38,1.1,.14),raised=new T.Vector3(.28,1.72,.08),impact=new T.Vector3(.3,1.03,.48);
  const low=new T.Vector3(0,-.65,.76).normalize(),high=new T.Vector3(0,.96,kind==='pickaxe'?-.34:-.28).normalize();
  const restDirection=new T.Vector3(0,.8,.6);
  const wind=progress<.4, recovery=progress>1;
  const t=smooth(recovery?(progress-1):wind?progress/.4:(progress-.4)/.6);
  return {
    hand:recovery?impact.lerp(rest,t):wind?rest.lerp(raised,t):raised.lerp(impact,t),
    direction:wind?restDirection.lerp(high,t).normalize():recovery?low.clone().lerp(restDirection,t).normalize():high.clone().lerp(low,t).normalize()
  };
}
export function harvestPose(root:T.Group,asset:T.Group,tool:T.Group,kind:HarvestTool,progress:number) {
  const {hand,direction}=harvestPath(kind,progress);
  solveArm(root,asset,'R',root.localToWorld(hand));
  // Align the handle's +Y axis with the strike; rotate the axe edge from +X toward +Z.
  const local=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction)
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.PI/2));
  const world=root.getWorldQuaternion(new T.Quaternion()).multiply(local);
  tool.quaternion.copy(tool.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
  root.updateMatrixWorld(true);
  solveArm(root,asset,'L',tool.localToWorld(new T.Vector3(0,.14,0)));
}
