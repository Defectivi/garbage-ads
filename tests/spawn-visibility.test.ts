import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {Game} from '../src/game/Game';
import {beginSpawnProtection,spawnProtected,SPAWN_RADIUS} from '../src/systems/SpawnProtection';
import {updateSurvival} from '../src/systems/SurvivalSystem';
import {updateExposure,playerEffects} from '../src/systems/StatusSystem';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
import {weatherVisibility} from '../src/rendering/WeatherVisibility';
import {furnaceAura} from '../src/rendering/FurnaceAura';
test('new worlds start with sixty fuel seconds, a completed 500 HP hut and two healthy workers',()=>{
 const g=new Game(newState(worldSpec(42))),hut=g.state.buildings.find(b=>b.id==='starter:hut')!;assert.equal(g.state.furnaces[0].fuel,60);assert.equal(hut.construction,undefined);assert.equal(g.settlement.integrity(hut).hp,500);assert.equal(g.state.workers.length,2);assert(g.state.workers.every(w=>w.hutId===hut.id&&w.hp===100));
 g.settlement.damage(hut.id,500,hut);assert.deepEqual(g.settlement.integrity(hut),{hp:125,stage:'ruin'});assert.deepEqual(importJSON(exportFull(g.state)),g.state);const built={id:'built:1',type:'hut' as const,x:8,z:4,rotation:0};assert.equal(g.settlement.integrity(built).hp,1000);
});
test('spawn area prevents hostile generation for exactly twelve simulation seconds, then retries deferred encounters',()=>{
 const g=new Game(newState(worldSpec(42)));g.combat.ensureEncounters();assert.equal(Object.values(g.state.combat.actors).length,0);assert.equal(g.state.combat.encounters.length,0);updateSurvival(g.state,11.9);g.combat.ensureEncounters();assert.equal(Object.values(g.state.combat.actors).length,0);updateSurvival(g.state,.1);g.combat.ensureEncounters();assert(Object.values(g.state.combat.actors).length>0);assert(g.state.combat.encounters.length>0);assert(!spawnProtected(g.state));
});
test('safe area is anchored at spawn, blocks incoming damage and persists without refreshing on import',()=>{
 const g=new Game(newState(worldSpec(42))),p=g.state.player;g.combat.damage({...p,id:'player',kind:'player'},20,'test');assert.equal(p.hp,100);assert(spawnProtected(g.state,{x:99,z:4}));assert(!spawnProtected(g.state,{x:101,z:4}));updateSurvival(g.state,6);assert.equal(importJSON(exportFull(g.state)).spawnProtection!.remaining,6);assert(playerEffects(g.state).some(e=>e.id==='spawn'));
 p.x=110;g.combat.damage({...p,id:'player',kind:'player'},20,'test');assert.equal(p.hp,80);g.paused=true;g.update(.1);assert.equal(g.state.spawnProtection!.remaining,6);
 const doc=JSON.parse(exportFull(g.state));delete doc.state.spawnProtection;doc.state.buildings=[];doc.state.workers=[];doc.state.furnaces[0].fuel=11;const legacy=importJSON(JSON.stringify(doc));assert.equal(legacy.spawnProtection,undefined);assert.equal(legacy.buildings.length,0);assert.equal(legacy.furnaces[0].fuel,11);
 doc.state.spawnProtection={x:0,z:4,remaining:13};assert.throws(()=>importJSON(JSON.stringify(doc)));
});
test('respawn clears nearby hostiles outside one hundred metres and renews the twelve-second area',()=>{
 const g=new Game(newState(worldSpec(42)));delete g.state.spawnProtection;g.combat.ensureEncounters();const enemy=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;for(const a of Object.values(g.state.combat.actors))a.hp=0;Object.assign(enemy,{hp:125,x:5,z:5});g.state.player.hp=0;assert(g.recover());assert.equal(g.state.spawnProtection!.remaining,12);assert(Math.hypot(enemy.x-g.state.spawnProtection!.x,enemy.z-g.state.spawnProtection!.z)>=SPAWN_RADIUS);assert(!g.world.isWater(enemy.x,enemy.z));
 g.solids=()=>[];g.world.isWater=()=>false;const zone=g.state.spawnProtection!;Object.assign(enemy,{x:zone.x+100.1,z:zone.z});for(let i=0;i<20;i++)(g.combat as any).walk(enemy,zone,.1,3);assert(!spawnProtected(g.state,enemy));
});
test('bridge deck stays dry and level at its visible edges; rails keep repeated sideways movement out of water',()=>{
 const g=new Game(newState(worldSpec(42)));g.solids=()=>[];
 for(const x of [-64,0,64]){const r=g.world.river(x,48),bridge=g.world.bridgeAt(x,r.center)!;assert(bridge);for(const offset of [-2.2,0,2.2]){assert(!g.world.isWater(x+offset,r.center));assert.equal(g.world.walkHeight(x+offset,r.center),.65);}
  g.state.player.x=x;g.state.player.z=r.center;delete g.state.player.hypothermia;for(let i=0;i<100;i++){g.move(g.state.player,.2,0);updateExposure(g.state,.1,g.world.isWater(g.state.player.x,g.state.player.z));}assert.equal(g.state.player.hypothermia,undefined);assert(g.state.player.x<=x+1.881);assert(g.world.isWater(x+3,r.center));
  const p={x,z:r.center-bridge.halfLength-1};for(let i=0;i<Math.ceil((bridge.halfLength*2+2)/.1);i++){g.move(p,0,.1);assert(!g.world.isWater(p.x,p.z));}
 }
});
test('warmth aura covers the disk with a fog-aware terrain-following mesh and bounded geometry',()=>{
 const g=new Game(newState(worldSpec(42))),aura=furnaceAura(g,g.state.furnaces[0],12),positions=aura.geometry.attributes.position;assert.equal(aura.userData.radius,12);assert.equal(aura.name,'heat-aura');assert.equal(aura.material.depthWrite,false);assert.equal(aura.material.fog,true);assert(positions.count<500);assert.equal(aura.userData.clock.value,0);aura.geometry.dispose();aura.material.dispose();
});
test('whiteout fog shortens sight distance and changes smoothly with storm intensity',()=>{
 for(const zoom of [10,34,50]){const clear=weatherVisibility(zoom,2,0),storm=weatherVisibility(zoom,2,1),mid=weatherVisibility(zoom,2,.5);assert.equal(clear.far,110);assert(storm.far<clear.far);assert(storm.near<storm.far);assert(mid.far<clear.far&&mid.far>storm.far);}
});
