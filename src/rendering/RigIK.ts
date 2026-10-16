import * as T from 'three';
export function solveArm(object:T.Group,asset:T.Group,side:'L'|'R',target:T.Vector3) {
    const arm=asset.getObjectByName(`Arm${side}`)!,elbow=asset.getObjectByName(`Elbow${side}`)!,hand=asset.getObjectByName(`Hand${side}`)!;
    object.updateMatrixWorld(true);
    const start=arm.getWorldPosition(new T.Vector3()),mid=elbow.getWorldPosition(new T.Vector3()),end=hand.getWorldPosition(new T.Vector3());
    const l1=start.distanceTo(mid),l2=mid.distanceTo(end),direction=target.clone().sub(start).normalize();
    const distance=T.MathUtils.clamp(start.distanceTo(target),Math.abs(l1-l2)+.001,l1+l2-.001);
    const along=(l1*l1+distance*distance-l2*l2)/(2*distance);
    const pole=new T.Vector3(side==='L'?-1:1,-.65,-.35).applyQuaternion(object.quaternion);
    const bend=pole.addScaledVector(direction,-pole.dot(direction)).normalize();
    const desired=start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    const rotate=(joint:T.Object3D,current:T.Vector3,wanted:T.Vector3)=>{
      const q=new T.Quaternion().setFromUnitVectors(current.normalize(),wanted.normalize()).multiply(joint.getWorldQuaternion(new T.Quaternion()));
      joint.quaternion.copy(joint.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));object.updateMatrixWorld(true);
    };
    rotate(arm,mid.clone().sub(start),desired.clone().sub(start));
    const moved=elbow.getWorldPosition(new T.Vector3());
    rotate(elbow,hand.getWorldPosition(new T.Vector3()).sub(moved),target.clone().sub(moved));
    hand.quaternion.copy(hand.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(object.getWorldQuaternion(new T.Quaternion())));
    object.updateMatrixWorld(true);
}
