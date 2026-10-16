import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
import {RESOURCE_IDS} from '../src/data/definitions';
import {createSurvivorAsset} from '../src/rendering/SurvivorAsset';
import {weaponMesh,disposeWeapon} from '../src/rendering/WeaponModels';
import {meleePose} from '../src/rendering/MeleePose';
import {SnowWeather} from '../src/rendering/SnowWeather';
const game=()=>{const g=new Game(newState({...worldSpec(42),generationVersion:3}));g.paused=false;g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;return g;};

test('movement owns facing; firing at a separate point never changes it',()=>{
 const g=game();g.paused=false;g.update(.05,{x:1,z:0});assert.equal(g.state.player.heading,Math.PI/2);g.combat.fireWeapon('player',g.state.player,{x:0,z:-10},'bow');assert.equal(g.state.player.heading,Math.PI/2);g.update(.05);assert.equal(g.state.player.heading,Math.PI/2);
});
test('melee wears once on enemy contact, never on misses or bleed ticks',()=>{
 for(const type of ['wooden_sword','spear','machete'] as const){const g=game(),p=g.state.player;g.state.combat.weapons=[{id:'hit-test',type,uses:100}];g.state.combat.equipped='hit-test';assert(g.combat.attack({x:p.x,z:p.z+2}));assert.equal(g.state.combat.weapons[0].uses,100);g.combat.update(.7);
 const enemies=Object.values(g.state.combat.actors).filter(a=>a.type==='bandit').slice(0,2);assert.equal(enemies.length,2);for(const a of enemies){a.hp=125;a.x=p.x;a.z=p.z+1.3;}g.state.combat.cooldown=0;assert(g.combat.attack({x:p.x,z:p.z+2}));for(let i=0;i<6;i++)g.combat.update(.1);assert.equal(g.state.combat.weapons[0].uses,99);assert(enemies.every(a=>a.hp<125));for(let i=0;i<50;i++)g.combat.update(.1);assert.equal(g.state.combat.weapons[0].uses,99);}
});
test('furnace binding persists, recovery halves both supplies once and finds clear ground',()=>{
 const g=game(),v=g.world.villages()[0],f=g.state.furnaces.find(f=>f.id===`${v.id}:furnace`)!;assert(!g.bindFurnace(f.id));g.state.player.x=f.x;g.state.player.z=f.z+2.5;g.state.inventory.wood=0;g.state.stockpile.wood=0;g.feed(f.id);assert.equal(g.state.respawnFurnaceId,f.id);assert.deepEqual(importJSON(exportFull(g.state)),g.state);
 for(const r of RESOURCE_IDS){g.state.inventory[r]=5;g.state.stockpile[r]=11;}g.state.inventory.gold=-3;g.state.combat.statuses.player={bleed:5,tick:0};g.state.player.hp=0;assert(g.recover());for(const r of RESOURCE_IDS){assert.equal(g.state.inventory[r],r==='gold'?-3:2);assert.equal(g.state.stockpile[r],5);}assert.equal(g.state.player.hp,100);assert.equal(g.state.player.warmth,100);assert(!g.state.combat.statuses.player);assert(Math.hypot(g.state.player.x-f.x,g.state.player.z-f.z)<12);assert(!g.world.isWater(g.state.player.x,g.state.player.z));assert(g.solids(g.state.player).every(s=>Math.hypot(s.x-g.state.player.x,s.z-g.state.player.z)>s.radius+.42));assert(!g.recover());assert.equal(g.state.inventory.wood,2);
 const bad=JSON.parse(exportFull(g.state));bad.state.respawnFurnaceId='missing';assert.throws(()=>importJSON(JSON.stringify(bad)),/Respawn furnace/);delete bad.state.respawnFurnaceId;assert.equal(importJSON(JSON.stringify(bad)).respawnFurnaceId,undefined);
});
test('sword and machete blade axes sweep horizontally across the body rather than pointing upward',()=>{
 for(const type of ['wooden_sword','machete','spear'] as const){const root=new T.Group(),asset=createSurvivorAsset(),weapon=weaponMesh(type,true);root.add(asset.scene);asset.scene.getObjectByName('HandR')!.add(weapon);const directions=[];
 for(const t of [0,.4,.8]){meleePose(root,asset.scene,weapon,type,t);const axis=new T.Vector3(0,1,0).applyQuaternion(weapon.getWorldQuaternion(new T.Quaternion()));assert(Math.abs(axis.y)<.2);directions.push(axis);}
 if(type!=='spear'){assert(directions[0].x>.7);assert(directions[2].x<-.7);}disposeWeapon(weapon);}
});
test('snow wraps individual flakes smoothly, stays bounded and respects pause/reduced motion',()=>{
 const weather=new SnowWeather(),geometry=weather.points.geometry,before=geometry.attributes.position.array.slice();weather.update(.05,true,{x:0,z:0},10);const after=geometry.attributes.position.array;assert.notEqual(after[1],before[1]);assert.equal(weather.points.position.y,10);
 for(let i=0;i<1000;i++)weather.update(.05,true,{x:500,z:-500},10);for(let i=0;i<after.length;i+=3){assert(after[i]>=-44&&after[i]<=44);assert(after[i+1]>=0&&after[i+1]<=44);assert(after[i+2]>=-44&&after[i+2]<=44);}assert(geometry.drawRange.count>850);
 const still=after.slice();weather.update(0,true,{x:500,z:-500},10);assert.deepEqual(after,still);weather.update(.1,true,{x:500,z:-500},10,true);assert.deepEqual(after,still);assert(geometry.drawRange.count<=220);
});
