import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createSurvivorAsset } from '../src/rendering/SurvivorAsset';
import { weaponMesh, disposeWeapon } from '../src/rendering/WeaponModels';
import { WEAPON_IDS } from '../src/data/weapons';
import { Game } from '../src/game/Game';
import { newState } from '../src/game/GameState';
import { worldSpec } from '../src/game/GameConfig';
import { exportFull } from '../src/systems/SaveSystem';

test('original survivor has one weighted garment mesh, a human rig, grounded feet and reusable clips',()=>{
  const asset=createSurvivorAsset(),mesh=asset.scene.getObjectByName('Wayfarer_clothing') as T.SkinnedMesh;
  assert(mesh.isSkinnedMesh);assert.equal(mesh.geometry.type,'BufferGeometry');assert.equal(mesh.skeleton.bones.length,17);
  assert.equal(asset.scene.getObjectByName('HandR')!.parent!.name,'ElbowR');
  const weights=mesh.geometry.getAttribute('skinWeight');for(let i=0;i<weights.count;i++)assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
  mesh.geometry.computeBoundingBox();assert(mesh.geometry.boundingBox!.min.y>=0);assert(mesh.geometry.boundingBox!.max.y<2.2);
  for(const name of ['idle','walk','sprint','gather','wooden_sword','spear','machete','bow','shotgun','molotov','hurt','death'])assert(asset.animations.some(a=>a.name===name));
  const mixer=new T.AnimationMixer(asset.scene),knee=asset.scene.getObjectByName('KneeL')!,before=knee.quaternion.clone();
  mixer.clipAction(asset.animations.find(a=>a.name==='walk')!).play();mixer.update(.25);assert(!knee.quaternion.equals(before));
  mixer.stopAllAction();mixer.uncacheRoot(asset.scene);mesh.geometry.dispose();(mesh.material as T.Material).dispose();mesh.skeleton.dispose();
});

test('all six original weapon silhouettes have finite geometry and local grip origins',()=>{
  for(const type of WEAPON_IDS){const weapon=weaponMesh(type,true);assert.equal(weapon.userData.weapon,type);assert.equal(weapon.position.length(),0);let meshes=0;weapon.traverse(o=>{if(o instanceof T.Mesh)meshes++;});assert(meshes>=3);
    const box=new T.Box3().setFromObject(weapon);assert(!box.isEmpty());for(const n of [...box.min.toArray(),...box.max.toArray()])assert(Number.isFinite(n));
    disposeWeapon(weapon);
  }
});

test('collection feedback is emitted only after an atomic award and never serialized',()=>{
  const g=new Game(newState(worldSpec(42))),wood=g.nodes().find(n=>n.id==='starter:wood')!;g.state.player.x=3.4;
  const before=g.state.inventory.wood;assert(g.gather(wood).ok);assert.equal(g.state.inventory.wood,before+1);assert.deepEqual(g.collectionEvents,[{resource:'wood',amount:1,x:wood.x,z:wood.z}]);
  const drained=g.collectionEvents.splice(0);assert.equal(drained.length,1);assert.equal(g.collectionEvents.splice(0).length,0);assert.equal(g.state.inventory.wood,before+1);
  g.state.player.x=100;assert(!g.gather(wood).ok);assert.equal(g.collectionEvents.length,0);
  g.state.player.x=3.4;g.state.settings.resourceMax=g.state.inventory.wood;assert(!g.gather(wood).ok);assert.equal(g.collectionEvents.length,0);
  assert(!exportFull(g.state).includes('collectionEvents'));assert(!exportFull(g.state).includes('lastGather'));
});

test('presentation event queue stays bounded without losing authoritative resource awards',()=>{
  const g=new Game(newState(worldSpec(42))),wood=g.nodes().find(n=>n.id==='starter:wood')!;g.state.player.x=3.4;g.state.changes.nodes[wood.id]=100;
  const before=g.state.inventory.wood;for(let i=0;i<60;i++)assert(g.gather(wood).ok);
  assert.equal(g.collectionEvents.length,32);assert.equal(g.state.inventory.wood,before+60);assert.equal(g.nodeRemaining(wood),40);
});
