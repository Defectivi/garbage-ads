import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {WorldManager,distance} from '../src/world/WorldManager';
import {updateExposure,maxPlayerHP,movementMultiplier,playerEffects} from '../src/systems/StatusSystem';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
function fixture(){const g=new Game(newState(worldSpec(42)));g.combat.ensureEncounters();g.combat.ensureEncounters=()=>{};g.solids=()=>[];g.world.isWater=()=>false;g.state.furnaces[0].fuel=0;for(const a of Object.values(g.state.combat.actors))a.hp=0;return g;}
test('new generation villages are distant; generation 3 locations remain stable',()=>{
 for(const seed of [0,42,65535]){const w=new WorldManager(worldSpec(seed));for(const v of w.villages()){assert(distance(v,{x:0,z:4})>=120);assert(!w.isWater(v.x,v.z));}}
 const old=new WorldManager({...worldSpec(42),generationVersion:3});assert.equal(old.villages()[0].x,40);assert.equal(old.villages()[0].z,8);
});
test('wolf packs contain 3-12 persistent members with 50 HP and no weapons',()=>{
 const g=new Game(newState(worldSpec(42)));g.combat.ensureEncounters();const wolves=Object.values(g.state.combat.actors).filter(a=>a.type==='wolf');assert(wolves.length>=3);
 for(const id of new Set(wolves.map(a=>a.groupId))){const pack=wolves.filter(a=>a.groupId===id);assert(pack.length>=3&&pack.length<=12);assert(pack.every(a=>a.hp===50&&a.weapon===null));}const before=wolves.length;g.combat.ensureEncounters();assert.equal(Object.values(g.state.combat.actors).filter(a=>a.type==='wolf').length,before);assert.deepEqual(importJSON(exportFull(g.state)),g.state);
});
test('wolf locks the nearest visible living entity, ignores packmates and keeps pursuit',()=>{
 const g=fixture(),actors=Object.values(g.state.combat.actors),wolf=actors.find(a=>a.type==='wolf')!,packmate=actors.find(a=>a.type==='wolf'&&a.groupId===wolf.groupId&&a.id!==wolf.id)!,bandit=actors.find(a=>a.type==='bandit')!;
 Object.assign(wolf,{hp:50,x:0,z:10,cooldown:5});Object.assign(packmate,{hp:50,x:0,z:10.1,cooldown:5});Object.assign(bandit,{hp:125,x:0,z:12,cooldown:5});g.combat.update(.1);assert.equal(wolf.pursuitId,bandit.id);
 bandit.z=55;g.state.player.z=9;g.combat.update(.1);assert.equal(wolf.pursuitId,bandit.id);bandit.hp=0;g.combat.update(.1);assert.equal(wolf.pursuitId,'player');
 g.state.player.z=200;g.combat.update(.1);assert.equal(wolf.pursuitId,'player');assert(wolf.z>10);
});
test('ordinary enemies give up on distant players and return home',()=>{
 const g=fixture(),a=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;Object.assign(a,{hp:125,x:0,z:10,homeX:20,homeZ:10,cooldown:5});g.combat.update(.1);assert.equal(a.pursuitId,'player');g.state.player.z=60;const before=a.x;g.combat.update(.1);assert.equal(a.pursuitId,undefined);assert(a.retreating);assert(a.x>before);assert(!a.alerted);
});
test('wolf bite deals 7 then 4 each second for 12 seconds; repeat bites refresh duration only',()=>{
 const g=fixture(),wolf=Object.values(g.state.combat.actors).find(a=>a.type==='wolf')!;Object.assign(wolf,{hp:50,x:0,z:5});const target=()=>({...g.state.player,id:'player',kind:'player' as const});
 (g.combat as any).bite(wolf,target());assert.equal(g.state.player.hp,93);wolf.hp=0;for(let i=0;i<120;i++)g.combat.update(.1);assert.equal(g.state.player.hp,45);assert(!g.state.combat.statuses.player);
 g.state.player.hp=100;wolf.hp=50;(g.combat as any).bite(wolf,target());g.state.combat.statuses.player.wolfBleed=2;g.state.combat.statuses.player.wolfTick=.7;(g.combat as any).bite(wolf,target());assert.equal(g.state.combat.statuses.player.wolfBleed,12);assert.equal(g.state.combat.statuses.player.wolfTick,.7);assert.deepEqual(importJSON(exportFull(g.state)),g.state);
 g.state.player.invulnerable=5;delete g.state.combat.statuses.player;const hp=g.state.player.hp;(g.combat as any).bite(wolf,target());assert.equal(g.state.player.hp,hp);assert(!g.state.combat.statuses.player);
});
test('bear attacks deal 15 or 30 with approximately 50 percent criticals and ten percent chance of a three-second stun',()=>{
 const g=fixture(),bear=Object.values(g.state.combat.actors).find(a=>a.type==='polar_bear')!;bear.hp=50;let criticals=0,stuns=0;
 for(let i=0;i<1000;i++){g.state.player.hp=100;g.state.player.stunned=0;(g.combat as any).bite(bear,{...g.state.player,id:'player',kind:'player'});const damage=100-g.state.player.hp;assert(damage===15||damage===30);if(damage===30)criticals++;if(g.state.player.stunned===3)stuns++;}
 assert(criticals>450&&criticals<550);assert(stuns>70&&stuns<130);g.state.player.stunned=3;g.paused=false;assert(!g.combat.attackAssisted());const p={...g.state.player};g.update(.1,{x:1,z:0});assert.equal(g.state.player.x,p.x);updateExposure(g.state,3,false);assert.equal(g.state.player.stunned,0);
});
test('river exposure caps max HP, slows walking, escalates after five seconds and drains 25 warmth per three seconds',()=>{
 const g=fixture(),s=g.state;updateExposure(s,.1,true);assert.equal(maxPlayerHP(s),90);assert.equal(s.player.hp,90);assert.equal(movementMultiplier(s),.1);assert.equal(movementMultiplier(s,true),.5);
 updateExposure(s,4.8,true);assert.equal(s.player.hypothermia!.level,1);updateExposure(s,.1,true);assert.equal(s.player.hypothermia!.level,2);assert.equal(s.player.warmth,100);updateExposure(s,2.9,true);assert.equal(s.player.warmth,100);updateExposure(s,.1,true);assert.equal(s.player.warmth,75);updateExposure(s,3,true);assert.equal(s.player.warmth,50);
 assert(playerEffects(s).some(e=>e.label==='HYPOTHERMIA II'));assert.deepEqual(importJSON(exportFull(s)),s);
 updateExposure(s,.1,false);assert.equal(s.player.hypothermia!.level,1);assert.equal(maxPlayerHP(s),90);updateExposure(s,20,false);assert(s.player.hypothermia);s.furnaces[0].fuel=100;updateExposure(s,.1,false);assert(!s.player.hypothermia);assert.equal(maxPlayerHP(s),100);
 updateExposure(s,.1,true);s.furnaces[0].fuel=0;s.combat.fires.push({id:'fire:1',ownerId:'test',x:0,z:4,remaining:10,tick:0,charred:false});updateExposure(s,.1,false);assert(!s.player.hypothermia);
});
test('water can be entered and crossed while bridge crossings stay dry',()=>{
 const g=new Game(newState(worldSpec(42)));g.solids=()=>[];const r=g.world.river(12,48);const p={x:12,z:r.center-r.width-1};g.move(p,0,r.width+1);assert(g.world.isWater(p.x,p.z));g.move(p,0,r.width+1);assert(!g.world.isWater(p.x,p.z));assert(!g.world.isWater(0,g.world.river(0,48).center));
});
test('new effect saves validate timers and retain older optional-field compatibility',()=>{
 const g=fixture();for(const mutate of [(d:any)=>d.state.player.stunned=4,(d:any)=>d.state.player.hypothermia={level:3,waterTime:0,tick:0},(d:any)=>d.state.combat.statuses.player={bleed:0,tick:0,wolfBleed:13}]){const doc=JSON.parse(exportFull(g.state));mutate(doc);assert.throws(()=>importJSON(JSON.stringify(doc)));}assert.deepEqual(importJSON(exportFull(g.state)),g.state);
});

test('wolf acquisition respects sight blockers and its visible muzzle is a valid hit target',()=>{
 const g=fixture(),wolf=Object.values(g.state.combat.actors).find(a=>a.type==='wolf')!,enemy=Object.values(g.state.combat.actors).find(a=>a.type==='bandit')!;
 Object.assign(wolf,{hp:50,x:0,z:10,heading:0,cooldown:5});Object.assign(enemy,{hp:125,x:2,z:10,cooldown:5});g.state.player.x=-5;g.state.player.z=10;
 g.solids=()=>[{id:'wall',x:1,z:10,radius:.4}];g.combat.update(.1);assert.equal(wolf.pursuitId,'player');
 const unit={...wolf,kind:'enemy'},muzzle={x:wolf.x+Math.sin(wolf.heading)*1.45,z:wolf.z+Math.cos(wolf.heading)*1.45};assert((g.combat as any).touches(unit,muzzle,muzzle,.05));
});
test('hypothermia movement penalties persist ashore, sprint improves speed and consumes more warmth',()=>{
 const run=(cold:boolean,sprint:boolean)=>{const g=fixture();g.paused=false;if(cold)g.state.player.hypothermia={level:1,waterTime:0,tick:0};g.state.player.x=20;g.state.player.warmth=90;const x=g.state.player.x;for(let i=0;i<20;i++)g.update(.1,{x:1,z:0,sprint});return{d:g.state.player.x-x,warmth:g.state.player.warmth};};
 const normal=run(false,false),cold=run(true,false),sprint=run(true,true);assert(Math.abs(cold.d/normal.d-.1)<1e-8);assert(Math.abs(sprint.d/normal.d-.75)<1e-8);assert(sprint.warmth<cold.warmth);
});
