import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {equipmentDrops,droppedWeaponUses} from '../src/systems/CombatSystem';
import {weaponUses,WEAPON_IDS} from '../src/data/weapons';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
const fresh=()=>{const g=new Game(newState(worldSpec(42)));g.solids=()=>[];g.world.isWater=()=>false;g.combat.ensureEncounters=()=>{};g.state.elapsed=600;return g;};
function advance(g:Game,seconds:number){for(let i=0;i<seconds*10;i++){g.settlement.update(.1);(g as any).updateWorkers(.1);}}
test('workers walk to their own hut, keep loads and rest all night even offscreen, resume at dawn',()=>{
 const g=fresh(),s=g.state,w=s.workers[0];s.player.x=1000;s.player.z=1000;w.x=-7;w.z=5;w.load=2;w.resource='wood';s.stockpile.wood=5;s.furnaces[0].fuel=0;
 advance(g,20);assert.equal(g.settlement.refuge(w.id)?.houseId,w.hutId);assert.equal(g.settlement.refuge(w.id)?.phase,'hidden');const at={x:w.x,z:w.z};advance(g,550);assert.deepEqual({x:w.x,z:w.z},at);assert.equal(w.load,2);assert.equal(s.stockpile.wood,5);assert.equal(s.furnaces[0].fuel,0);assert.equal(g.settlement.refuge(w.id)?.phase,'hidden');assert.deepEqual(importJSON(exportFull(s)),s);
 const loaded=new Game(importJSON(exportFull(s)));loaded.state.elapsed=1200;loaded.solids=()=>[];loaded.world.isWater=()=>false;advance(loaded,10);assert.equal(loaded.settlement.refuge(w.id),undefined);
});
test('ruined hut ejects hidden workers with half current HP once, preserves loads and leaves outsiders unchanged',()=>{
 const g=fresh(),s=g.state,[inside,outside]=s.workers,hut=s.buildings[0];inside.hp=80;inside.load=3;inside.x=-7;inside.z=-4.5;s.changes.refuges![inside.id]={houseId:hut.id,x:-7,z:-4.5,homeX:-7,homeZ:5,phase:'hidden',remaining:12,reason:'night'};
 g.settlement.damage(hut.id,500,hut);assert.equal(g.settlement.integrity(hut).stage,'ruin');assert.equal(inside.hp,40);assert.equal(outside.hp,100);assert.equal(inside.load,3);assert.equal(g.settlement.refuge(inside.id)?.phase,'returning');const z=inside.z;advance(g,.1);assert(inside.z>z);g.settlement.damage(hut.id,1,hut);assert.equal(inside.hp,40);advance(g,15);assert.equal(g.settlement.refuge(inside.id),undefined);assert.equal(outside.hp,100);assert.deepEqual(importJSON(exportFull(s)),s);
});
test('burning huts cannot shelter workers at night, hidden dead workers are removed without resurrection',()=>{
 const g=fresh(),s=g.state,hut=s.buildings[0],w=s.workers[0];s.combat.fires.push({id:'fire:test',x:hut.x,z:hut.z,ownerId:'player',remaining:10,tick:0,charred:false});advance(g,1);assert.equal(g.settlement.refuge(w.id),undefined);
 s.combat.fires=[];advance(g,10);assert.equal(g.settlement.refuge(w.id)?.phase,'hidden');w.hp=0;advance(g,1);assert.equal(g.settlement.refuge(w.id),undefined);assert.equal(w.hp,0);
});
test('bandit drops average 25 percent with deterministic 40-80 percent wear and molotovs have 1-5 uses',()=>{
 const count=Array.from({length:10000},(_,i)=>equipmentDrops(42,String(i),.25)).filter(Boolean).length;assert(count>2300&&count<2700);
 for(const weapon of WEAPON_IDS){const found=new Set<number>();for(let i=0;i<500;i++){const n=droppedWeaponUses(42,String(i),weapon);assert.equal(n,droppedWeaponUses(42,String(i),weapon));assert(Number.isInteger(n));found.add(n);if(weapon==='molotov')assert(n>=1&&n<=5);else{assert(n/weaponUses(weapon)>=.2);assert(n/weaponUses(weapon)<=.6);}}if(weapon==='molotov')assert.deepEqual([...found].sort(),[1,2,3,4,5]);}
});
test('bandit deaths roll once, keep worn durability through save and pickup; molotov counts survive pickup',()=>{
 const g=fresh(),s=g.state;s.elapsed=0;let drops=0;
 for(let i=0;i<100;i++){const id=`bandit:test:${i}`,weapon=WEAPON_IDS[i%WEAPON_IDS.length],a={id,type:'bandit' as const,x:0,z:4,hp:125,weapon,groupId:id,villageId:null,homeX:0,homeZ:4,heading:0,cooldown:0,roamTimer:0,targetX:0,targetZ:4,alerted:false};s.combat.actors[id]=a;const before=s.combat.drops.length;g.combat.damage({...a,kind:'enemy'},1000,'player');const expected=equipmentDrops(s.world.seeds.loot,id,.25);assert.equal(s.combat.drops.length-before,Number(expected));g.combat.damage({...a,kind:'enemy'},1000,'player');assert.equal(s.combat.drops.length-before,Number(expected));if(expected){drops++;const drop=s.combat.drops.at(-1)!;assert.equal(drop.uses,droppedWeaponUses(s.world.seeds.loot,id,weapon));assert.deepEqual(importJSON(exportFull(s)),s);assert(g.combat.pickup(drop.id));assert.equal(s.combat.weapons.at(-1)!.uses,drop.uses);assert(!g.combat.pickup(drop.id));}}
 assert(drops>10);for(let uses=1;uses<=5;uses++){s.combat.drops.push({id:`drop:manual:${uses}`,x:0,z:4,weapon:'molotov',uses});assert(g.combat.pickup(`drop:manual:${uses}`));assert.equal(s.combat.weapons.at(-1)!.uses,uses);}
});
