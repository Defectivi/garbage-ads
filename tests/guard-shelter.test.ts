import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
function fixture(){
 const g=new Game(newState(worldSpec(42)));g.combat.ensureEncounters();g.combat.ensureEncounters=()=>{};
 const guards=Object.values(g.state.combat.actors).filter(a=>a.type==='guard'),guard=guards[0],healthy=guards[1];
 for(const a of Object.values(g.state.combat.actors))a.hp=0;
 const house={id:'built:1',type:'hut' as const,x:8,z:0,rotation:0};g.state.buildings.push(house);g.state.nextId=2;
 Object.assign(guard,{hp:125,x:7.3,z:3.5,weapon:'shotgun',cooldown:0});
 Object.assign(healthy,{hp:125,x:12,z:4,weapon:'shotgun',cooldown:0});
 const enemy=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(enemy,{hp:125,x:12,z:5,weapon:'bow',cooldown:5});
 g.state.furnaces[0].fuel=0;g.solids=()=>[];g.world.isWater=()=>false;
 return{g,guard,healthy,enemy,house};
}
test('injured guards retreat without attacking, hide, survive save/load and resume defense after returning',()=>{
 const {g,guard,healthy,house}=fixture();g.combat.damage({...guard,kind:'guard'},5,'player');
 assert(g.state.combat.villageAlerts.includes(guard.villageId!));assert.equal(guard.hp,120);
 assert.equal(g.settlement.refuge(guard.id)!.phase,'fleeing');
 g.combat.update(.1);assert(!g.combat.actorAttacks.has(guard.id));assert(g.combat.actorAttacks.has(healthy.id));
 for(let i=0;i<100&&g.settlement.refuge(guard.id)?.phase!=='hidden';i++)g.settlement.update(.1);
 assert.equal(g.settlement.refuge(guard.id)!.phase,'hidden');assert(!g.combat.units().some(u=>u.id===guard.id));
 assert.equal(guard.x,g.settlement.refuge(guard.id)!.x);assert.equal(guard.z,g.settlement.refuge(guard.id)!.z);
 const loaded=new Game(importJSON(exportFull(g.state)));assert.equal(loaded.settlement.refuge(guard.id)!.phase,'hidden');assert(!loaded.combat.units().some(u=>u.id===guard.id));
 // Place an exposed hostile within firing range: the hidden and returning guard must still abstain.
 const enemy=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(enemy,{hp:125,x:guard.x+1,z:guard.z,cooldown:5});
 g.combat.update(.1);assert(!g.combat.actorAttacks.has(guard.id));
 g.settlement.update(12);assert.equal(g.settlement.refuge(guard.id)!.phase,'returning');g.combat.update(.1);assert(!g.combat.actorAttacks.has(guard.id));
 for(let i=0;i<100&&g.settlement.refuge(guard.id);i++)g.settlement.update(.1);
 assert(!g.settlement.refuge(guard.id));g.combat.update(.1);assert(g.combat.actorAttacks.has(guard.id));assert.equal(g.settlement.integrity(house).stage,'intact');
});
test('ruined houses expose sheltered guards, lethal hits clear refuge, and enemy shelter imports are rejected',()=>{
 const {g,guard,enemy,house}=fixture();g.combat.damage({...guard,kind:'guard'},5,'test');
 for(let i=0;i<100&&g.settlement.refuge(guard.id)?.phase!=='hidden';i++)g.settlement.update(.1);
 assert.equal(g.settlement.refuge(guard.id)!.phase,'hidden');
 const doc=JSON.parse(exportFull(g.state));doc.state.changes.refuges[enemy.id]=doc.state.changes.refuges[guard.id];assert.throws(()=>importJSON(JSON.stringify(doc)),/Unknown sheltered NPC/);
 g.settlement.damage(house.id,1000,house);assert.equal(g.settlement.refuge(guard.id)!.phase,'returning');assert(g.combat.units().some(u=>u.id===guard.id));
 g.combat.damage({...guard,kind:'guard'},200,'test');assert.equal(guard.hp,0);assert(!g.settlement.refuge(guard.id));
});

