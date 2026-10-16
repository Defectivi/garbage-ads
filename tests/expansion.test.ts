import {villageLoot,STRUCTURE_HP} from '../src/data/settlement';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {updateSurvival} from '../src/systems/SurvivalSystem';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
const fresh=()=>new Game(newState(worldSpec(42)));
test('fresh worlds reset furnace upgrades and start unarmed with a two-damage punch',()=>{
 const old=fresh();old.state.furnaces[0].level=25;old.state.inventory.wood=300;const g=fresh();assert.equal(g.state.furnaces[0].level,1);assert.equal(g.state.combat.weapons.length,0);assert.equal(g.state.combat.equipped,null);g.paused=false;g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;g.state.furnaces[0].fuel=0;g.solids=()=>[];const a=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(a,{hp:125,x:0,z:4.9});assert(g.combat.attackAssisted());const p=g.state.combat.projectiles[0];(g.combat as any).stepProjectile(p,.45);assert.equal(a.hp,123);assert.equal(g.state.combat.weapons.length,0);assert.equal(g.state.combat.cooldown,1);
});
test('active furnace healing repeats by 25 HP every three seconds and resets on leaving',()=>{
 const s=newState(worldSpec(42));s.player.hp=10;for(let i=0;i<29;i++)updateSurvival(s,.1);assert.equal(s.player.hp,10);updateSurvival(s,.1);assert.equal(s.player.hp,35);for(let i=0;i<30;i++)updateSurvival(s,.1);assert.equal(s.player.hp,60);s.player.x=100;updateSurvival(s,1);assert.equal(s.player.heatTime,0);s.player.x=0;updateSurvival(s,2.9);assert.equal(s.player.hp,60);s.furnaces[0].fuel=0;updateSurvival(s,1);assert.equal(s.player.hp,60);assert.equal(s.player.heatTime,0);
});
test('heat retains ten percent entry loss, doubles subsequent hostile damage and halves speed',()=>{
 const g=fresh();g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;const a=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(a,{hp:125,x:4,z:4,heatInside:false,cooldown:5});(g.combat as any).heatEntry(a);assert.equal(a.hp,112.5);g.combat.damage({...a,kind:'enemy'},10,'player');assert.equal(a.hp,92.5);
 g.solids=()=>[];g.world.isWater=()=>false;const start={x:a.x,z:a.z};(g.combat as any).walk(a,{x:10,z:4},.1,1.8);const slow=Math.hypot(a.x-start.x,a.z-start.z);a.x=start.x;a.z=start.z;(g.combat as any).velocities.clear();g.state.furnaces[0].fuel=0;(g.combat as any).walk(a,{x:10,z:4},.1,1.8);assert(Math.abs(Math.hypot(a.x-start.x,a.z-start.z)-slow*2)<1e-8);
});
test('recovery grants five seconds of immunity including bleed, preserved by save/load',()=>{
 const g=fresh();g.state.player.hp=0;assert(g.recover());assert.equal(g.state.player.invulnerable,5);const hit=()=>g.combat.damage({...g.state.player,id:'player',kind:'player'},10,'bleed');hit();assert.equal(g.state.player.hp,100);assert.equal(importJSON(exportFull(g.state)).player.invulnerable,5);updateSurvival(g.state,4.9);hit();assert.equal(g.state.player.hp,100);updateSurvival(g.state,.1);hit();assert.equal(g.state.player.hp,95);
});

test('gathering takes one second, cannot stack presses, and cancels without awarding on movement',()=>{
 const g=fresh();g.paused=false;g.combat.ensureEncounters=()=>{};g.solids=()=>[];const n=g.nodes().find(n=>n.id==='starter:wood')!;g.state.player.x=n.x;g.state.player.z=n.z;const before=g.state.inventory.wood;assert(g.startGather(n).ok);assert(!g.startGather(n).ok);for(let i=0;i<9;i++)g.update(.1);assert.equal(g.state.inventory.wood,before);g.update(.1);assert.equal(g.state.inventory.wood,before+1);assert(!g.gathering);g.startGather(n);g.update(.1,{x:1,z:0});assert(!g.gathering);assert.equal(g.state.inventory.wood,before+1);assert(!exportFull(g.state).includes('gathering'));
});
test('trees become persistent logs and boulders split into finite smaller stones',()=>{
 const g=fresh();g.paused=false;g.combat.ensureEncounters=()=>{};g.solids=()=>[];const tree=g.nodes().find(n=>n.kind==='tree')!;g.state.player.x=tree.x;g.state.player.z=tree.z;const before=g.state.inventory.wood;g.startGather(tree);for(let i=0;i<30;i++)g.update(.1);assert.equal(g.state.inventory.wood,before);assert.equal(g.state.changes.terrain![tree.id],'felled');assert.equal(g.terrainEvents.length,1);const log=g.nodes().find(n=>n.id===`log:${tree.id}`)!;assert(log);g.startGather(log);for(let i=0;i<30;i++)g.update(.1);assert.equal(g.state.inventory.wood,before+1);assert.deepEqual(importJSON(exportFull(g.state)),g.state);
 const rock=g.world.around({x:0,z:0},2).flatMap(c=>g.nodesInChunk(c)).find(n=>n.kind==='boulder')!;g.state.player.x=rock.x;g.state.player.z=rock.z;g.startGather(rock);for(let i=0;i<30;i++)g.update(.1);const shards=g.nodes().filter(n=>n.id.startsWith(`fragment:${rock.id}:`));assert.equal(shards.length,3);assert.equal(shards.reduce((n,s)=>n+s.amount,0),rock.amount);assert(shards.every(n=>n.radius<rock.radius));assert.equal(g.state.inventory.stone,0);
});

test('huts and stores have 1000/2000 HP, bleed immunity, quarter-health ruins and single salvage drops',()=>{
 for(const type of ['hut','storage'] as const){const g=fresh(),b={id:'built:1',type,x:8,z:0,rotation:0};g.state.buildings.push(b);g.state.nextId=2;const hp=STRUCTURE_HP[type];const unit={...b,hp,kind:'building' as const,radius:2};g.combat.damage(unit,100,'bleed');assert.equal(g.settlement.integrity(b).hp,hp);g.combat.damage(unit,100,'player',true);assert.equal(g.settlement.integrity(b).hp,hp-100);assert(!g.state.combat.statuses[b.id]);g.combat.damage(unit,hp,'player');assert.deepEqual(g.settlement.integrity(b),{hp:hp*.25,stage:'ruin'});g.combat.damage({...unit,hp:hp*.25},hp,'player');assert.equal(g.settlement.integrity(b).stage,'gone');assert.equal(g.settlement.loot().filter(p=>p.id===`salvage:${b.id}`).length,1);assert.deepEqual(importJSON(exportFull(g.state)),g.state);g.state.player.x=b.x;g.state.player.z=b.z;assert(g.settlement.pickup(`salvage:${b.id}`).ok);assert.equal(g.state.inventory.stone,type==='hut'?1:2);assert(!g.settlement.pickup(`salvage:${b.id}`).ok);g.combat.damage(unit,hp,'player');assert(!g.state.changes.groundLoot![`salvage:${b.id}`]);}
});
test('damaged workers enter their own intact hut, become sheltered and emerge when it is ruined',()=>{
 const g=fresh();g.combat.ensureEncounters=()=>{};const b={id:'built:1',type:'hut' as const,x:8,z:0,rotation:0};g.state.buildings.push(b);g.state.nextId=2;const w={id:'worker:built:1',hutId:b.id,hp:100,x:8,z:3,sourceId:null,load:0,progress:0,state:'seeking' as const};g.state.workers.push(w);g.combat.damage({...w,kind:'npc'},5,'enemy');assert.equal(g.settlement.refuge(w.id)!.houseId,b.id);for(let i=0;i<100&&g.settlement.refuge(w.id)?.phase!=='hidden';i++)g.settlement.update(.1);assert.equal(g.settlement.refuge(w.id)!.phase,'hidden');assert(!g.combat.units().some(u=>u.id===w.id));assert.deepEqual(importJSON(exportFull(g.state)),g.state);g.settlement.damage(b.id,1000,b);assert.equal(g.settlement.refuge(w.id)!.phase,'returning');assert(g.combat.units().some(u=>u.id===w.id));
});
test('village supplies follow 50/40/10 category probabilities and remain collected across saves',()=>{
 const counts={food:0,materials:0,weapon:0},weapons=new Set();for(let i=0;i<10000;i++){const loot=villageLoot(i%65536,`sample:${i}`);counts[loot.category]++;if(loot.weapon)weapons.add(loot.weapon);}assert(counts.food>4800&&counts.food<5200);assert(counts.materials>3800&&counts.materials<4200);assert(counts.weapon>800&&counts.weapon<1200);assert.equal(weapons.size,6);
 const g=fresh(),v=g.world.villages()[0],piles=g.settlement.loot(v).filter(p=>p.id.includes(v.id));assert.equal(piles.length,6);const pile=piles[0];g.state.player.x=pile.x;g.state.player.z=pile.z;assert(g.settlement.pickup(pile.id).ok);assert(!g.settlement.pickup(pile.id).ok);const loaded=new Game(importJSON(exportFull(g.state)));assert(!loaded.settlement.loot(v).some(p=>p.id===pile.id));assert(Object.keys(g.state.changes.npcs).length===0);
});
test('new save fields reject invalid integrity, shelters, terrain and loot before live mutation',()=>{
 const g=fresh(),base=exportFull(g.state);for(const mutate of [(d:any)=>d.state.changes.structures.home={hp:5000,stage:'ruin'},(d:any)=>d.state.changes.refuges.bad={houseId:'none',x:0,z:0,homeX:0,homeZ:0,remaining:12,phase:'hidden'},(d:any)=>d.state.changes.terrain.fake='ice',(d:any)=>d.state.changes.groundLoot.bad={id:'bad',x:0,z:0,resources:{wood:-1}}]){const doc=JSON.parse(base);mutate(doc);assert.throws(()=>importJSON(JSON.stringify(doc)));assert.equal(exportFull(g.state),base);}
});

test('projectiles stop at a solid wall even when the next sample lies inside its footprint',()=>{
 const g=fresh();g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;const a=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(a,{hp:125,x:0,z:7});g.solids=()=>[{id:'wall',x:0,z:5.5,radius:.5}];g.combat.fireWeapon('player',g.state.player,a,'bow');assert.equal((g.combat as any).stepProjectile(g.state.combat.projectiles[0],.05),false);assert.equal(a.hp,125);
});
