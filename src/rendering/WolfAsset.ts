import * as T from 'three';
import {createBearAsset} from './BearAsset';
/** Original rigged canine variant: lean torso, pointed ears, narrow muzzle and a bushy tail. */
export function createWolfAsset(variant='wolf-slate'){
 const asset=createBearAsset(),scene=asset.scene;scene.name=variant;
 const fur=new T.MeshStandardMaterial({color:variant==='wolf-ash'?0x827e74:0x697e89,roughness:1});
 scene.traverse(o=>{if(o instanceof T.SkinnedMesh){const geometry=o.geometry.clone(),p=geometry.getAttribute('position'),c=geometry.getAttribute('color');for(let i=0;i<p.count;i++){p.setXYZ(i,p.getX(i)*.63,p.getY(i)*.72,p.getZ(i)*.85);const dark=c.getX(i)<.15;c.setXYZ(i,dark?.025:.34,dark?.04:.42,dark?.05:.47);}geometry.computeVertexNormals();o.geometry=geometry;}});
 // Scale the bind-space bones consistently with the slimmer body.
 scene.traverse(o=>{if(o instanceof T.Bone)o.position.multiply(new T.Vector3(.63,.72,.85));});scene.updateMatrixWorld(true);scene.traverse(o=>{if(o instanceof T.SkinnedMesh)o.bind(o.skeleton);});
 const head=scene.getObjectByName('BearHead')!;
 for(const side of [-1,1]){const ear=new T.Mesh(new T.ConeGeometry(.14,.42,4),fur);ear.position.set(side*.15,.25,.08);ear.rotation.z=side*-.15;ear.castShadow=true;head.add(ear);}
 const tail=new T.Mesh(new T.ConeGeometry(.20,.95,7),fur);tail.position.set(0,-.05,-1.25);tail.rotation.x=-.9;tail.castShadow=true;scene.getObjectByName('Body')!.add(tail);
 return asset;
}
