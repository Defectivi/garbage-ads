import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {simulationState as newState} from './fixtures/state';
import {worldSpec} from '../src/game/GameConfig';
import {WEAPONS, WEAPON_IDS, ACTOR_HP} from '../src/data/weapons';
import {updateSurvival,furnaceTier} from '../src/systems/SurvivalSystem';
import {shotgunDamage,equipmentDrops} from '../src/systems/CombatSystem';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
function isolated() { const g = new Game(newState({...worldSpec(42),generationVersion:3})); g.paused=false; g.combat.ensureEncounters(); for(const a of Object.values(g.state.combat.actors)) a.hp=0; return g; }
test('weapon cadence, 100 uses, infinite ammo and HP definitions',()=>{
 const g=isolated();
 for(const type of WEAPON_IDS){g.state.combat.weapons=[{id:'test',type,uses:100}];g.state.combat.equipped='test';g.state.combat.cooldown=0;assert(g.combat.attack({x:0,z:10}));assert.equal(g.state.combat.cooldown,WEAPONS[type].cooldown);assert.equal(g.state.combat.weapons[0].uses,WEAPONS[type].type==='melee'?100:99);assert(!g.combat.attack({x:0,z:10}));g.state.combat.cooldown=0;g.state.combat.weapons[0].uses=0;assert(g.combat.attack({x:0,z:10}));assert.equal(g.state.combat.projectiles.at(-1)!.weapon,'punch');}
 assert.deepEqual(ACTOR_HP,{polar_bear:50,wolf:50,bandit:125,arsonist:75,guard:125}); assert(shotgunDamage(.5)>shotgunDamage(2.9));
});
test('machete applies 25 damage and exactly ten bleed ticks and guard retaliation persists',()=>{
 const g=isolated();g.state.furnaces[0].fuel=0;const a=Object.values(g.state.combat.actors).find(a=>a.type==='guard')!; a.hp=125;a.x=0;a.z=5.5; a.weapon=null;
 g.combat.fireWeapon('player',g.state.player,a,'machete');for(let i=0;i<6;i++)g.combat.update(.1);assert.equal(a.hp,100);assert(g.state.combat.villageAlerts.includes(a.villageId!));
 // Keep the target in the active region without AI retaliation affecting the test.
 for(let i=0;i<100;i++)g.combat.update(.1);
 assert.equal(a.hp,80);assert(!g.state.combat.statuses[a.id]); assert.deepEqual(importJSON(exportFull(g.state)),g.state);
});
test('molotov burns for ten seconds, converts wood and trees into gatherable charcoal',()=>{
 const g=isolated(), n=g.nodes().find(n=>n.id==='starter:wood')!;
 g.combat.fireWeapon('player',g.state.player,n,'molotov');for(let i=0;i<120;i++)g.combat.update(.1);
 assert.equal(g.state.combat.fires.length,0);assert.equal(g.nodeResource(n),'charcoal');g.state.player.x=n.x;g.state.player.z=n.z;assert(g.gather(n).ok);assert.equal(g.state.inventory.charcoal,1);
 assert.deepEqual(importJSON(exportFull(g.state)),g.state);
});
test('snow triples fuel consumption; charcoal fuel burns before wood; sprint doubles exposure',()=>{
 const s=newState(worldSpec(42),{difficulty:'survival'});s.player.x=1000;s.player.warmth=80;const b=structuredClone(s);updateSurvival(s,1);updateSurvival(b,1,true);assert(Math.abs((80-b.player.warmth)-2*(80-s.player.warmth))<1e-9);
 const f=s.furnaces[0];f.fuel=100;s.combat.weather.mode='snow';updateSurvival(s,1);assert.equal(f.fuel,97);f.charcoal=120;updateSurvival(s,1);assert.equal(f.charcoal,117);assert.equal(f.fuel,97);assert.equal(furnaceTier(4),0);assert.equal(furnaceTier(5),1);assert.equal(furnaceTier(6),1);assert.equal(furnaceTier(11),2);
});
test('fixed villages spawn 3-5 guards, bandit groups 2-10, equipment drops approximate seven percent',()=>{
 const g=new Game(newState({...worldSpec(42),generationVersion:3}));g.combat.ensureEncounters();for(const v of g.world.villages().filter(v=>Math.hypot(v.x,v.z)<85)){const guards=Object.values(g.state.combat.actors).filter(a=>a.villageId===v.id);assert(guards.length>=3&&guards.length<=5);assert(g.state.furnaces.some(f=>f.id===v.id+':furnace'));}
 const bandits=Object.values(g.state.combat.actors).filter(a=>a.type==='bandit');for(const group of new Set(bandits.map(a=>a.groupId))){const n=bandits.filter(a=>a.groupId===group).length;assert(n>=2&&n<=10);}
 const drops=Array.from({length:10000},(_,i)=>equipmentDrops(42,String(i))).filter(Boolean).length;assert(drops>580&&drops<820);
 const v=g.world.villages()[0];g.state.player.x=v.trader.x;g.state.player.z=v.trader.z;g.state.inventory.wood=100;g.state.inventory.gold=100;assert(g.buyWeapon(v,'bow').ok);assert.equal(g.state.combat.weapons.at(-1)!.uses,100);assert.equal(g.state.inventory.wood,88);
});
test('legacy format 1 migrates safely and malformed combat imports are rejected',()=>{
 const s=newState({...worldSpec(42),generationVersion:3});const doc=JSON.parse(exportFull(s));doc.formatVersion=1;doc.world.generationVersion=1;delete doc.state.combat;delete doc.state.player.hp;delete doc.state.inventory.charcoal;delete doc.state.stockpile.charcoal;for(const f of doc.state.furnaces)delete f.charcoal;
 const restored=importJSON(JSON.stringify(doc));assert.equal(restored.world.generationVersion,1);assert.equal(restored.player.hp,100);assert.equal(restored.inventory.charcoal,0);assert.equal(restored.combat.weapons.length,0);
 for(const mutate of [(d:any)=>d.state.combat.weapons=[{id:'bad',type:'bow',uses:101}],(d:any)=>d.state.player.hp=101,(d:any)=>d.state.combat.weather.mode='rain',(d:any)=>d.state.combat.equipped='missing']){const next=JSON.parse(exportFull(s));mutate(next);assert.throws(()=>importJSON(JSON.stringify(next)));}
});
