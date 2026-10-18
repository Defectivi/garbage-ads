import { meleePath } from '../game/CombatGeometry';
import * as T from 'three';
import { solveArm } from './RigIK';

/** A shared blade-led downward cut or spear thrust, sampled by combat too. */
export function meleePose(root:T.Group,asset:T.Group,weapon:T.Group,type:string,progress:number) {
  if(!['stone_sword','wooden_sword','machete','spear'].includes(type))return;
  const pose=meleePath(type,progress),hand=new T.Vector3(pose.x,pose.y,pose.z),direction=new T.Vector3(pose.dx,pose.dy,pose.dz).normalize();
  solveArm(root,asset,'R',root.localToWorld(hand));
  solveArm(root,asset,'L',root.localToWorld(new T.Vector3(-.3,1.13,.18)));
  const worldDirection=direction.transformDirection(root.matrixWorld),rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),worldDirection);
  weapon.quaternion.copy(weapon.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  root.updateMatrixWorld(true);
}
