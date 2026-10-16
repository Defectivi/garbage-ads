import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {shotgunDamage} from '../src/systems/CombatSystem';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
import {bladeSegment} from '../src/game/CombatGeometry';
import {createSurvivorAsset} from '../src/rendering/SurvivorAsset';
import {weaponMesh,disposeWeapon} from '../src/rendering/WeaponModels';
import {meleePose} from '../src/rendering/MeleePose';
function fixture(type:'wooden_sword'|'machete'|'shotgun'|'bow'|'molotov'='wooden_sword'){
 const g=new Game(newState({...worldSpec(42),generationVersion:3}));g.paused=false;g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;g.state.furnaces[0].fuel=0;g.solids=()=>[];
 const a=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(a,{hp:125,x:0,z:5.3,heading:0});g.state.combat.weapons=[{id:'fixture',type,uses:100}];g.state.combat.equipped='fixture';
 return {g,a,step:(dt:number)=>{g.state.combat.projectiles=g.state.combat.projectiles.filter(p=>(g.combat as any).stepProjectile(p,dt));}};
}
test('assisted click turns toward a nearby enemy, excludes peaceful guards and respects range/blockers',()=>{
 const {g,a,step}=fixture();a.x=-1.3;a.z=4;const guard=Object.values(g.state.combat.actors).find(a=>a.type==='guard')!;Object.assign(guard,{hp:125,x:.5,z:4});assert(g.combat.attackAssisted());assert.equal(g.state.player.heading,-Math.PI/2);step(.6);assert.equal(a.hp,115);assert.equal(guard.hp,125);assert.equal(g.state.combat.weapons[0].uses,99);
 g.state.combat.cooldown=0;a.x=-20;g.state.player.heading=.3;assert(g.combat.attackAssisted());assert.equal(g.state.player.heading,.3);g.state.combat.cooldown=0;a.x=-1.3;g.solids=()=>[{x:-.65,z:4,radius:.25}];g.state.player.heading=0;g.combat.attackAssisted();assert.equal(g.state.player.heading,0);
});
test('a swept blade hits outside the old narrow cone and spends one use for multiple contacts',()=>{
 const {g,a,step}=fixture(),blade=bladeSegment(g.state.player,0,'wooden_sword',.2);a.x=blade.b.x;a.z=blade.b.z;const other=Object.values(g.state.combat.actors).find(u=>u.type==='bandit'&&u.id!==a.id)!;Object.assign(other,{hp:125,x:a.x+.15,z:a.z});g.combat.attack({x:0,z:10});assert.equal(a.hp,125);step(.55);assert.equal(a.hp,115);assert.equal(other.hp,115);assert.equal(g.state.combat.weapons[0].uses,99);
});
test('real rendered blade contact is covered by the authoritative sweep across several poses',()=>{
 for(const type of ['wooden_sword','machete'] as const)for(const phase of [.15,.35,.6]){
  const {g,a,step}=fixture(type),root=new T.Group(),asset=createSurvivorAsset(),weapon=weaponMesh(type,true);root.position.set(0,0,4);root.add(asset.scene);asset.scene.getObjectByName('HandR')!.add(weapon);meleePose(root,asset.scene,weapon,type,phase);const tip=weapon.localToWorld(new T.Vector3(0,.75,0));a.x=tip.x;a.z=tip.z;g.combat.attack({x:0,z:10});step(.6);assert(a.hp<125,`${type} missed visible blade at ${phase}`);disposeWeapon(weapon);
 }
});
test('pellets hit during travel once per target per volley and follow 12-95 falloff',()=>{
 assert.equal(shotgunDamage(0),95);assert.equal(shotgunDamage(3),12);assert.equal(shotgunDamage(9),12);
 const {g,a,step}=fixture('shotgun');a.z=5;g.combat.attack({x:0,z:10});assert.equal(a.hp,125);step(.15);assert.equal(a.hp,125-shotgunDamage(1));assert.equal(g.combat.damageEvents.filter(e=>e.targetId===a.id).length,1);assert.equal(g.state.combat.weapons[0].uses,99);
 const far=fixture('shotgun');far.a.z=7.1;far.g.combat.attack({x:0,z:10});far.step(.15);assert.equal(far.a.hp,113);
});
test('arrow tips and bottle contact deal damage, and damage events record actual HP loss',()=>{
 const arrow=fixture('bow');arrow.a.z=5.25;arrow.g.combat.attack({x:0,z:10});arrow.step(.01);assert.equal(arrow.a.hp,110); // Arrowhead reaches before the center does.
 const bottle=fixture('molotov');bottle.a.z=4.5;bottle.g.combat.attack({x:0,z:10});bottle.step(.05);assert.equal(bottle.a.hp,122);assert.equal(bottle.g.state.combat.fires.length,1);
 const {g,a}=fixture();a.hp=3;g.combat.damage({...a,kind:'enemy'},10,'player');assert.equal(g.combat.damageEvents.at(-1)!.amount,3);g.state.furnaces[0].fuel=20;g.combat.damage({...g.state.player,id:'player',kind:'player'},10,'enemy');assert.equal(g.combat.damageEvents.at(-1)!.amount,5);for(let i=0;i<100;i++)g.combat.damage({...g.state.player,id:'player',kind:'player'},.01,'enemy');assert.equal(g.combat.damageEvents.length,64);assert(!exportFull(g.state).includes('damageEvents'));
});
test('saving during a connected swing preserves hit deduplication and durability charge',()=>{
 const {g,a,step}=fixture('machete');g.combat.attack({x:0,z:10});step(.3);assert.equal(a.hp,100);assert.equal(g.state.combat.weapons[0].uses,99);const loaded=new Game(importJSON(exportFull(g.state)));loaded.solids=()=>[];const shot=loaded.state.combat.projectiles[0];(loaded.combat as any).stepProjectile(shot,.2);assert.equal(loaded.state.combat.actors[a.id].hp,100);assert.equal(loaded.state.combat.weapons[0].uses,99);assert.equal(loaded.state.combat.statuses[a.id].bleed,10);
});

test('bear contact includes its long muzzle and torso rather than only a center circle',()=>{
 const {g,a,step}=fixture();Object.assign(a,{type:'polar_bear',hp:50,x:2.8,z:4,heading:-Math.PI/2});assert(g.combat.attackAssisted());step(.55);assert.equal(a.hp,40);assert.equal(g.state.combat.weapons[0].uses,99);
});
