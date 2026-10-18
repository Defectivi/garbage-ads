import test from 'node:test';
import assert from 'node:assert/strict';
import {worldSpec,type Hardship} from '../src/game/GameConfig';
import {newState,maxPlayerHP} from '../src/game/GameState';
import {Game} from '../src/game/Game';
import {WorldManager} from '../src/world/WorldManager';
import {RESOURCE_IDS} from '../src/data/definitions';
import {actorMaxHP,hungerRate,visitVillage,HARDSHIPS} from '../src/systems/Difficulty';
import {movementMultiplier} from '../src/systems/StatusSystem';
import {updateSurvival} from '../src/systems/SurvivalSystem';
import {spawnProtected} from '../src/systems/SpawnProtection';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
function fresh(mode:'easy'|'normal'|'hard',hardship:Hardship='hunger',seed=42){const spec=worldSpec(seed);spec.mode=mode;if(mode==='hard')spec.hardship=hardship;return newState(spec);}
test('Normal preserves the legacy starting balance and geometry',()=>{
 const old=newState(worldSpec(42)),normal=fresh('normal');const {world,...a}=old,{world:other,...b}=normal;assert.deepEqual(a,b);assert.deepEqual(new WorldManager(world).chunk(2,1),new WorldManager(other).chunk(2,1));assert.equal(normal.player.hp,100);assert.equal(normal.furnaces[0].fuel,60);
});
test('Easy grants its bonus once and halves walking and sprint hunger',()=>{
 const s=fresh('easy'),normal=fresh('normal');for(const k of RESOURCE_IDS)assert.equal(s.inventory[k],normal.inventory[k]+20);
 assert.equal(s.combat.weapons[0].type,'machete');assert.equal(s.furnaces[0].fuel,120);assert.equal(actorMaxHP(s,'bandit'),87.5);assert.equal(s.combat.weather.remaining,240);
 updateSurvival(s,30,false,true);assert.equal(s.player.hunger,20);updateSurvival(s,30,false,true);assert.equal(s.player.hunger,19);
 updateSurvival(s,15,true,true);assert.equal(s.player.hunger,19);updateSurvival(s,15,true,true);assert.equal(s.player.hunger,17);
 assert.deepEqual(importJSON(exportFull(s)),s);
});
test('All five Siberia starting hardships have their stated effects and survive reload',()=>{
 for(const key of Object.keys(HARDSHIPS) as Hardship[]){const s=fresh('hard',key);assert.deepEqual(s.hardships,[key]);assert.equal(s.player.hp,key==='health'?40:80);assert.equal(maxPlayerHP(s),key==='health'?50:100);assert.equal(s.furnaces[0].fuel,key==='fuel'?0:60);assert.equal(spawnProtected(s),key!=='unprotected');assert.equal(movementMultiplier(s),key==='slow'?.8:1);assert.equal(hungerRate(s),key==='hunger'?1.5:1);assert.equal(s.combat.weapons[0].type,'molotov');assert.equal(s.combat.weapons[0].uses,1);assert.deepEqual(importJSON(exportFull(s)),s);}
 const s=fresh('hard');updateSurvival(s,20,false,true);assert.equal(s.player.hunger,19);
});
test('Siberia natural resources are absent inside 200m, while village loot doubles and persists',()=>{
 const s=fresh('hard'),g=new Game(s);let outside=0;
 for(let x=-7;x<=7;x++)for(let z=-7;z<=7;z++){const c=g.world.chunk(x,z);for(const p of [...c.nodes,...c.trees,...c.fishing]){assert(Math.hypot(p.x,p.z)>200);outside++;}}
 assert(outside>0);const v=g.world.villages()[0];assert.equal(g.settlement.loot(v).filter(p=>p.id.includes(v.id)).length,12);s.changes.lootTaken=[`supplies:${v.id}:11`];assert.deepEqual(importJSON(exportFull(s)),s);
});
test('Easy has more inhabited villages and far fewer ruins in the exploration region',()=>{
 const easy=new WorldManager(fresh('easy').world),normal=new WorldManager(fresh('normal').world);let e=0,n=0;for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){if(easy.ruin(x,z))e++;if(normal.ruin(x,z))n++;}assert(e<n);assert(easy.villages().length>normal.villages().length);assert(e<easy.villages().length);
});
test('Village hardships roll once per village, including misses; duplicate effects never stack',()=>{
 let hits=0,misses=0;
 for(let seed=0;seed<100;seed++){const s=fresh('hard','slow',seed),id='village:hearth',result=visitVillage(s,id);if(result){hits++;assert.notEqual(result,'slow');assert.equal(s.hardships!.length,2);}else misses++;
 const saved=importJSON(exportFull(s)),before=exportFull(saved);assert.equal(visitVillage(saved,id),undefined);assert.equal(exportFull(saved),before);assert.deepEqual(saved.villageTrials,[id]);}
 assert(hits>15&&hits<45);assert(misses>0);
});
test('Neutral Easy bears only retaliate; hard wolves spare bandits; furnace damage uses scaled max HP',()=>{
 const g=new Game(fresh('easy'));delete g.state.spawnProtection;g.combat.ensureEncounters();const bear=Object.values(g.state.combat.actors).find(a=>a.type==='polar_bear')!;assert(bear);assert.equal(bear.hp,35);
 const unit={...g.state.player,id:'player',kind:'player' as const};assert(!(g.combat as any).canHit(bear.id,unit));Object.assign(bear,{x:2,z:2});(g.combat as any).heatEntry(bear);assert.equal(bear.hp,35);g.combat.damage({...bear,kind:'enemy'},1,'player');assert((g.combat as any).canHit(bear.id,unit));bear.heatInside=false;(g.combat as any).heatEntry(bear);assert.equal(bear.hp,30.5);
 const hard=new Game(fresh('hard'));delete hard.state.spawnProtection;hard.combat.ensureEncounters();const actors=Object.values(hard.state.combat.actors),wolf=actors.find(a=>a.type==='wolf')!,bandit=actors.find(a=>a.type==='bandit')!;assert(wolf&&bandit);assert(!(hard.combat as any).canHit(wolf.id,{...bandit,kind:'enemy'}));assert((hard.combat as any).canHit(wolf.id,unit));
});
test('Hard villages have additional bandit patrols and Unclaimed persists through recovery',()=>{
 const g=new Game(fresh('hard','unprotected'));const v=g.world.villages()[0];Object.assign(g.state.player,{x:v.x,z:v.z+20});g.combat.ensureEncounters();assert(Object.values(g.state.combat.actors).some(a=>a.id.startsWith('raider:')));g.state.player.hp=0;assert(g.recover());assert.equal(g.state.player.invulnerable,0);assert(!g.state.spawnProtection);assert(!spawnProtected(g.state));
});
test('Invalid mode and hardship data are rejected without mutating the source',()=>{
 const s=fresh('normal'),doc=JSON.parse(exportFull(s));doc.world.mode='impossible';assert.throws(()=>importJSON(JSON.stringify(doc)),/difficulty/);doc.world.mode='hard';doc.world.hardship='bogus';assert.throws(()=>importJSON(JSON.stringify(doc)),/hardship/);assert.equal(s.world.mode,'normal');
});

test('Actual village discovery applies and saves the trial; returning never rerolls it',()=>{
 let state=fresh('hard','slow');for(let seed=0;seed<100;seed++){const candidate=fresh('hard','slow',seed);if(visitVillage(structuredClone(candidate),'village:hearth')){state=candidate;break;}}
 const g=new Game(state);g.combat.update=()=>{};g.state.workers=[];g.paused=false;const v=g.world.villages()[0];Object.assign(g.state.player,{x:v.x,z:v.z+8});g.update(.1);assert(g.state.discovered.includes(v.id));assert.deepEqual(g.state.villageTrials,[v.id]);assert.equal(g.state.hardships!.length,2);assert.match(g.message,/Siberia/);
 const loaded=new Game(importJSON(exportFull(g.state)));loaded.combat.update=()=>{};loaded.paused=false;loaded.update(.1);assert.equal(loaded.state.hardships!.length,2);assert.deepEqual(loaded.state.villageTrials,[v.id]);
});
test('Easy storms retain duration but have substantially longer clear intervals',()=>{
 for(const mode of ['easy','normal'] as const){const g=new Game(fresh(mode));g.combat.ensureEncounters=()=>{};g.state.combat.weather.remaining=.05;g.combat.update(.1);assert.equal(g.state.combat.weather.mode,'snow');assert.equal(g.state.combat.weather.remaining,55);g.state.combat.weather.remaining=.05;g.combat.update(.1);assert.equal(g.state.combat.weather.mode,'clear');const n=g.state.combat.weather.remaining;assert(n>=(mode==='easy'?240:90)&&n<=(mode==='easy'?300:150));}
});
