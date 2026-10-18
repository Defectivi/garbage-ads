import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {worldSpec} from '../src/game/GameConfig';
import {newState} from '../src/game/GameState';
import {WorldManager} from '../src/world/WorldManager';
import {exportFull,importJSON,validateWorld} from '../src/systems/SaveSystem';
import {createSurvivorAsset} from '../src/rendering/SurvivorAsset';
import {workerTool} from '../src/rendering/WorkerTools';
import {harvestPose,harvestPhase} from '../src/rendering/HarvestPose';
import {ActionPoseState,rangedPose} from '../src/rendering/ActionPose';
import {weaponMesh,disposeWeapon} from '../src/rendering/WeaponModels';

test('generation six geometry fingerprints remain identical to commit 331fb8d',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-generation6.json',import.meta.url),'utf8'));
 for(const {spec,digest}of fixtures){const w=new WorldManager(validateWorld(spec));const samples={surface:[[0,0],[64,45],[200,-160],[-132,256]].map(([x,z])=>[w.height(x,z),w.river(x,z)]),chunks:[w.chunk(0,0),w.chunk(2,1),w.chunk(-3,4)],villages:w.villages()};assert.equal(createHash('sha256').update(JSON.stringify(samples)).digest('hex'),digest);}
});

test('generation seven tributaries intersect stable main channels and share water/bridge rules',()=>{
 const w=new WorldManager(worldSpec(42));let intersection:{x:number;z:number}|undefined;
 for(let x=-1024;x<=1024;x+=2){const channels=w.rivers(x,0),main=channels.filter(r=>r.row<100000).sort((a,b)=>Math.abs(a.center)-Math.abs(b.center))[0];if(channels.some(r=>r.row>=100000&&Math.abs(r.center-main.center)<1)){intersection={x,z:main.center};break;}}
 assert(intersection,'seed has an actual crossing');assert(w.isWater(intersection.x,intersection.z));assert.equal(w.bridgeAt(intersection.x,intersection.z),undefined);
 const copy=new WorldManager(worldSpec(42));assert.deepEqual(w.rivers(intersection.x,intersection.z),copy.rivers(intersection.x,intersection.z));
 let bridges=0;for(let x=-256;x<=256;x+=64)for(const r of w.rivers(x,32)){const b=w.bridgeAt(x,r.center);if(!b)continue;bridges++;assert(!w.isWater(b.x,b.z));assert.equal(w.walkHeight(b.x,b.z),.65);assert(!w.canGrowTree(b.x,b.z));assert(!w.canGrowTree(b.x+b.halfWidth+1,b.z));}assert(bridges>0);
});

test('regional mountains have broad relief and no trees on steep slopes or bridge approaches',()=>{
 for(const seed of [0,42,12345]){const w=new WorldManager(worldSpec(seed));let high=-Infinity,steep=0;
  for(let x=-384;x<=384;x+=32)for(let z=-384;z<=384;z+=32){high=Math.max(high,w.height(x,z));if(w.slope(x,z)>.3){steep++;assert(!w.canGrowTree(x,z));}}
  assert(high>25,`mountain relief for ${seed}`);assert(steep>0);
  for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)for(const t of w.chunk(x,z).trees){assert(w.slope(t.x,t.z)<=.3);assert(!w.bridgeAt(t.x,t.z,1.6));assert(!w.isWater(t.x,t.z));}
  assert.equal(w.height(0,4),.8);for(const v of w.villages())assert(Math.abs(w.height(v.x,v.z)-.8)<1e-8);
 }
});

test('generation versions one through seven retain their version in full saves',()=>{
 for(let generationVersion=1;generationVersion<=7;generationVersion++){const spec={...worldSpec(42),generationVersion},w=new WorldManager(spec),restored=importJSON(exportFull(newState(spec))),copy=new WorldManager(restored.world);assert.equal(restored.world.generationVersion,generationVersion);for(const p of [{x:0,z:0},{x:64,z:45},{x:200,z:-160}]){assert.equal(w.height(p.x,p.z),copy.height(p.x,p.z));assert.deepEqual(w.river(p.x,p.z),copy.river(p.x,p.z));}assert.deepEqual(w.chunk(2,1),copy.chunk(2,1));}
 assert.throws(()=>validateWorld({...worldSpec(42),generationVersion:8}));
});

test('shared worker tools strike down in every facing and restore both arms after interruption',()=>{
 for(const kind of ['axe','pickaxe'] as const)for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const root=new T.Group(),asset=createSurvivorAsset().scene,tool=workerTool(kind),state=new ActionPoseState();root.add(asset);root.rotation.y=heading;asset.getObjectByName('HandR')!.add(tool);
  const before=asset.getObjectByName('ArmR')!.quaternion.clone();state.capture(asset);harvestPose(root,asset,tool,kind,.4);const raised=tool.localToWorld(new T.Vector3(0,.55,0));state.restore();state.capture(asset);harvestPose(root,asset,tool,kind,1);const hit=tool.localToWorld(new T.Vector3(0,.55,0));assert(raised.y>hit.y+.5);assert.equal(tool.parent,asset.getObjectByName('HandR'));state.restore();assert(asset.getObjectByName('ArmR')!.quaternion.equals(before));disposeWeapon(tool);
 }
 assert.equal(harvestPhase(1,.3),1);assert.equal(harvestPhase(1,.7),1);
});

test('shared shooting and throwing poses recoil/release then restore without changing weapon ownership',()=>{
 for(const type of ['bow','shotgun','molotov'] as const){const root=new T.Group(),asset=createSurvivorAsset().scene,weapon=weaponMesh(type,true),state=new ActionPoseState();root.add(asset);const hand=asset.getObjectByName(type==='bow'?'HandL':'HandR')!;hand.add(weapon);const before=asset.getObjectByName('ArmR')!.quaternion.clone();
  state.capture(asset);rangedPose(root,asset,weapon,type,.04);const initial=asset.getObjectByName('HandR')!.getWorldPosition(new T.Vector3());if(type==='shotgun')assert(weapon.getObjectByName('muzzle-flash')!.visible);state.restore();state.capture(asset);rangedPose(root,asset,weapon,type,.35);const released=asset.getObjectByName('HandR')!.getWorldPosition(new T.Vector3());assert(initial.distanceTo(released)>.01);if(type==='shotgun')assert(!weapon.getObjectByName('muzzle-flash')!.visible);assert.equal(weapon.parent,hand);state.restore();assert(asset.getObjectByName('ArmR')!.quaternion.equals(before));disposeWeapon(weapon);
 }
});
