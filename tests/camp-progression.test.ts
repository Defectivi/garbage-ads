import {ACTOR_HP} from '../src/data/weapons';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {heatRadius,updateSurvival,healingAmount} from '../src/systems/SurvivalSystem';
import {furnaceCost,fuelInterval} from '../src/data/furnaces';
import {RESOURCE_IDS} from '../src/data/definitions';
import {WorldManager,distance} from '../src/world/WorldManager';
import {updateExposure} from '../src/systems/StatusSystem';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
const fresh=()=>{const g=new Game(newState(worldSpec(42)));g.paused=false;g.combat.ensureEncounters=()=>{};return g;};
test('upgrade schedule reaches 50, uses every material and spends carried/stored supplies atomically',()=>{
 assert.deepEqual(furnaceCost(2),{wood:30});assert.deepEqual(furnaceCost(3),{wood:60});assert.deepEqual(furnaceCost(4),{wood:90});assert.deepEqual(furnaceCost(5),{wood:90});assert.deepEqual(furnaceCost(6),{wood:100,metal:10});assert.deepEqual(furnaceCost(10),{wood:140,metal:20});
 const g=fresh();for(const r of RESOURCE_IDS)g.state.inventory[r]=100000;
 const used=new Set();for(let level=2;level<=50;level++){const cost=furnaceCost(level),before={...g.state.inventory};assert(g.upgradeFurnace().ok);assert.equal(g.state.furnaces[0].level,level);for(const r of RESOURCE_IDS){assert.equal(g.state.inventory[r],before[r]-(cost[r]??0));if(cost[r])used.add(r);}}
 assert.equal(used.size,RESOURCE_IDS.length);assert(!g.upgradeFurnace().ok);assert.deepEqual(importJSON(exportFull(g.state)),g.state);
 const h=fresh();h.state.inventory.wood=10;h.state.stockpile.wood=20;assert(h.upgradeFurnace().ok);assert.equal(h.state.inventory.wood+h.state.stockpile.wood,0);const snapshot=exportFull(h.state);assert(!h.upgradeFurnace().ok);assert.equal(exportFull(h.state),snapshot);
});
test('radius stops growing at 20 while fuel interval keeps improving to 50',()=>{
 const f=fresh().state.furnaces[0];f.level=20;const radius=heatRadius(f);f.level=50;assert.equal(heatRadius(f),radius);assert.equal(radius,164);assert.equal(fuelInterval(1),1);assert.equal(fuelInterval(2),1.2);assert.equal(fuelInterval(50),10.8);
 const s=fresh().state;s.furnaces[0].level=50;updateSurvival(s,1);assert(Math.abs(s.furnaces[0].fuel-(100-1/10.8))<1e-8);
});
test('charcoal is preferred and adds 30 base seconds; wood adds 10, with no hidden double duration',()=>{
 const g=fresh(),f=g.state.furnaces[0];f.fuel=0;g.state.inventory.charcoal=1;assert(g.feed().ok);assert.equal(f.charcoal,30);assert.equal(g.state.inventory.wood,12);assert(g.feed('home','wood').ok);assert.equal(f.fuel,10);updateSurvival(g.state,1);assert.equal(f.charcoal,29);assert.equal(f.fuel,10);
 g.state.combat.weather.mode='snow';updateSurvival(g.state,1);assert.equal(f.charcoal,26);f.charcoal=0;updateSurvival(g.state,1);assert.equal(f.fuel,7);
});
test('attacks inside furnace reduce the next healing tick to ten, restored after three damage-free seconds',()=>{
 const g=fresh(),p=g.state.player;p.hp=20;p.heatTime=2.5;g.combat.damage({...p,id:'player',kind:'player'},10,'enemy');assert.equal(p.hp,15);assert.equal(healingAmount(g.state),10);assert.equal(importJSON(exportFull(g.state)).player.recentDamage,3);updateSurvival(g.state,.5);assert.equal(p.hp,25);updateSurvival(g.state,2.5);assert.equal(healingAmount(g.state),25);updateSurvival(g.state,.5);assert.equal(p.hp,50);
});
test('all hostile types burn for twelve per second without doubling or overlapping heat stacking, including outside AI radius',()=>{
 const g=fresh();Object.getPrototypeOf(g.combat).ensureEncounters.call(g.combat);for(const a of Object.values(g.state.combat.actors))a.hp=0;
 const a=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(a,{hp:125,x:90,z:0,heatInside:false});g.state.furnaces[0].level=20;
 for(let i=0;i<10;i++)g.combat.update(.1);assert.equal(a.hp,100.5);assert.equal(a.heatBurn,0);
 a.x=300;g.combat.update(.1);assert.equal(a.heatBurn,0);a.x=90;g.combat.update(.1);assert.equal(a.hp,88); // another 10% entry penalty, no full burn tick yet
 const b={id:'built:1',type:'furnace' as const,x:1,z:0,rotation:0};g.state.buildings.push(b);g.state.nextId=2;g.state.furnaces.push({...b,level:20,fuel:100,charcoal:0});for(let i=0;i<9;i++)g.combat.update(.1);assert.equal(a.hp,76);
});
test('hut construction takes ten simulation seconds, survives saving, and summons exactly two workers once',()=>{
 const g=fresh();g.solids=()=>[];g.state.inventory.wood=20;assert(g.build('hut',{x:8,z:4}).ok);assert.equal(g.state.inventory.wood,0);assert.equal(g.state.workers.length,0);for(let i=0;i<50;i++)g.update(.1);assert(Math.abs(g.state.buildings[0].construction!-5)<1e-8);
 const loaded=new Game(importJSON(exportFull(g.state)));loaded.paused=false;loaded.combat.ensureEncounters=()=>{};loaded.solids=()=>[];for(let i=0;i<49;i++)loaded.update(.1);assert.equal(loaded.state.workers.length,0);loaded.update(.1);assert.equal(loaded.state.workers.length,2);assert(loaded.state.workers.every(w=>w.hp===100));for(let i=0;i<20;i++)loaded.update(.1);assert.equal(loaded.state.workers.length,2);assert.deepEqual(importJSON(exportFull(loaded.state)),loaded.state);
});
test('workers keep gathering at half HP, shelter below half and recover in their intact hut',()=>{
 const g=fresh(),hut={id:'built:1',type:'hut' as const,x:8,z:0,rotation:0};g.state.buildings.push(hut);g.state.nextId=2;const w={id:'worker:built:1:0',hutId:hut.id,hp:100,x:7.3,z:3,sourceId:null,load:0,progress:0,state:'seeking' as const};g.state.workers.push(w);
 g.combat.damage({...w,kind:'npc'},50,'enemy');assert.equal(w.hp,50);assert(!g.settlement.refuge(w.id));g.combat.damage({...w,kind:'npc'},1,'bleed');assert.equal(w.hp,49);assert(g.settlement.refuge(w.id));for(let i=0;i<100&&g.settlement.refuge(w.id)?.phase!=='hidden';i++)g.settlement.update(.1);assert.equal(g.settlement.refuge(w.id)!.phase,'hidden');g.settlement.update(5);assert.equal(w.hp,74);
});
test('two workers gather and deliver stone and fish, preserving finite shared fishing availability',()=>{
 const g=fresh();g.solids=()=>[];g.world.isWater=()=>false;
 const nodes=[{id:'test:wood',resource:'wood' as const,amount:20,radius:.4,x:12,z:4},{id:'test:stone',resource:'stone' as const,amount:20,radius:.4,x:12,z:8}],spot={id:'fish:0:0',availability:8,x:15,z:4};
 g.world.around=()=>[{id:'0,0',cx:0,cz:0,trees:[],ruins:[],nodes,fishing:[spot]}];g.state.inventory.wood=20;g.state.stockpile.wood=100;assert(g.build('hut',{x:8,z:4}).ok);for(let i=0;i<900;i++)g.update(.1);assert(g.state.stockpile.stone>0);assert(g.state.stockpile.fish>0);assert((g.state.changes.fishing[spot.id]??0)<=8);assert.equal(g.nodeRemaining({...spot,amount:8,resource:'fish',radius:.4}),8-(g.state.changes.fishing[spot.id]??0));
});
test('generation five creates deterministic lakes and taller hills without moving old terrain',()=>{
 const spec=worldSpec(42),w=new WorldManager(spec),old=new WorldManager({...spec,generationVersion:4}),lakes=w.lakes({x:0,z:0},3);assert(lakes.length>0);assert.deepEqual(lakes,new WorldManager(spec).lakes({x:0,z:0},3));for(const l of lakes){assert(w.isWater(l.x,l.z));assert(distance(l,{x:0,z:0})>65);assert(w.villages().every(v=>distance(v,l)>48));}
 let rise=0;for(let x=-128;x<=256;x+=8)for(let z=-128;z<=256;z+=8)rise=Math.max(rise,w.height(x,z)-old.height(x,z));assert(rise>10);assert.equal(w.height(0,0),.8);
 const s=newState(spec),lake=lakes[0];s.player.x=lake.x;s.player.z=lake.z;updateExposure(s,1,w.isWater(lake.x,lake.z));assert.equal(s.player.hypothermia?.level,1);assert.equal(s.player.hp,90);
});
test('terrain elevations block sight between otherwise clear entities',()=>{
 const w=new WorldManager(worldSpec(42));w.walkHeight=()=>0;w.height=(x,z)=>Math.abs(x-5)<1?5:0;assert(!w.visible({x:0,z:0},{x:10,z:0}));assert(w.visible({x:0,z:0},{x:0,z:10}));
});

test('furnace burning affects bears, wolves, bandits, arsonists and hostile guards but spares peaceful guards',()=>{
 const g=fresh(),v=g.world.villages()[0];g.state.player.x=v.x;g.state.player.z=v.z;Object.getPrototypeOf(g.combat).ensureEncounters.call(g.combat);g.state.player.x=0;g.state.player.z=4;
 const actors=Object.values(g.state.combat.actors);for(const a of actors)a.hp=0;
 for(const type of Object.keys(ACTOR_HP) as (keyof typeof ACTOR_HP)[]){const a=actors.find(a=>a.type===type)!;assert(a);Object.assign(a,{hp:ACTOR_HP[type],x:4,z:0,heatInside:true,heatBurn:0});if(type==='guard')g.state.combat.villageAlerts.push(a.villageId!);for(let i=0;i<10;i++)(g.combat as any).heatBurn(a,.1);assert.equal(a.hp,ACTOR_HP[type]-12);a.hp=0;}
 const guard=actors.find(a=>a.type==='guard')!;guard.hp=125;g.state.combat.villageAlerts=[];(g.combat as any).heatBurn(guard,1);assert.equal(guard.hp,125);
});

test('fuel priority uses available charcoal in either account even when the other account has resource debt',()=>{
 const g=fresh();g.state.inventory.charcoal=-2;g.state.stockpile.charcoal=1;const wood=g.state.inventory.wood;assert(g.feed().ok);assert.equal(g.state.stockpile.charcoal,0);assert.equal(g.state.inventory.charcoal,-2);assert.equal(g.state.inventory.wood,wood);assert.equal(g.state.furnaces[0].charcoal,30);
});
