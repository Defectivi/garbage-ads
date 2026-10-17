import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {WorldManager,distance} from '../src/world/WorldManager';
import {TREE_REGROW_SECONDS} from '../src/systems/TreeGrowth';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
import {banditGold,equipmentDrops} from '../src/systems/CombatSystem';
const fresh=()=>{const g=new Game(newState(worldSpec(42)));g.state.workers=[];g.paused=false;g.combat.ensureEncounters=()=>{};return g;};
function treeFixture(){const g=fresh(),chunk=g.world.chunk(0,0),node=g.nodesInChunk(chunk).find(n=>n.kind==='tree')!;assert(node);Object.assign(g.state.player,{x:node.x,z:node.z});assert(g.gather(node).ok);return{g,node};}
test('generation six cliffs reproduce independently of resource seeds; legacy landscapes keep their layout',()=>{
 const spec=worldSpec(42),a=new WorldManager(spec),b=new WorldManager(spec),cliffs=a.cliffs({x:0,z:0},3);assert(cliffs.length>0);assert.deepEqual(cliffs,b.cliffs({x:0,z:0},3));a.cliffs({x:0,z:0},3).reverse();assert.deepEqual(a.cliffs({x:0,z:0},3),cliffs);const lakes=a.lakes({x:0,z:0},3);a.lakes({x:0,z:0},3).reverse();assert.deepEqual(a.lakes({x:0,z:0},3),lakes);assert.deepEqual(cliffs,new WorldManager(worldSpec(42,12)).cliffs({x:0,z:0},3));assert(cliffs.every(c=>c.height>=28&&c.height<=46&&distance(c,{x:0,z:0})>60));assert(cliffs.flatMap(c=>a.cliffOres(c)).every(n=>!a.isWater(n.x,n.z)&&!a.bridgeAt(n.x,n.z)));
 for(let version=1;version<=5;version++){const old=new WorldManager({...spec,generationVersion:version});assert.deepEqual(old.cliffs({x:0,z:0},3),[]);assert.equal(importJSON(exportFull(newState({...spec,generationVersion:version}))).world.generationVersion,version);}
 const old=new WorldManager({...spec,generationVersion:5});for(const p of [{x:0,z:0},{x:70,z:85},{x:-140,z:90}])assert.equal(a.height(p.x,p.z),old.height(p.x,p.z));
});
test('cliffs block player/actor movement and sight but ore deposits are reachable, finite and mineable',()=>{
 const g=fresh(),c=g.world.cliffs({x:0,z:0},3)[0],ores=g.world.cliffOres(c);assert.deepEqual(new Set(ores.map(n=>n.resource)),new Set(['gold','stone','metal']));assert(ores.every(n=>distance(n,c)>c.radius));
 const p={x:c.x-c.radius-1,z:c.z};for(let i=0;i<8;i++)g.move(p,.5,0);assert(p.x<c.x-c.radius);assert(!g.world.visible({x:c.x-c.radius-4,z:c.z},{x:c.x+c.radius+4,z:c.z}));
 for(const ore of ores){const chunk=g.world.chunk(Math.floor(ore.x/32),Math.floor(ore.z/32)),actual=g.nodesInChunk(chunk).find(n=>n.id===ore.id)!;assert(actual);Object.assign(g.state.player,{x:ore.x,z:ore.z});const before=g.state.inventory[ore.resource];assert(g.startGather(actual).ok);assert.equal(g.gathering!.remaining,ore.resource==='gold'?2.2:ore.resource==='metal'?1.1:.7);g.gathering=undefined;for(let i=0;i<ore.amount;i++)assert(g.gather(actual).ok);assert(!g.gather(actual).ok);assert.equal(g.state.inventory[ore.resource],before+ore.amount);}
 assert.deepEqual(importJSON(exportFull(g.state)),g.state);
});
test('felled trees leave timed stumps, regrow at twenty simulation minutes, then support another finite harvest',()=>{
 const {g,node}=treeFixture(),s=g.state,at=s.changes.treeRegrowth![node.id];assert.equal(at,s.elapsed+TREE_REGROW_SECONDS);assert(g.treeGrowth.stumps(node).some(t=>t.id===node.id));const log=g.nodes().find(n=>n.kind==='log'&&n.id===`log:${node.id}`)!;assert(log);for(let i=0;i<log.amount;i++)assert(g.gather(log).ok);assert(!g.gather(log).ok);
 s.elapsed=at-.1;g.treeGrowth.update();assert.equal(s.changes.terrain![node.id],'felled');g.paused=true;g.update(.1);assert.equal(s.elapsed,at-.1);assert.deepEqual(importJSON(exportFull(s)),s);
 const loaded=new Game(importJSON(exportFull(s)));loaded.state.elapsed=at;loaded.treeGrowth.update();assert.equal(loaded.state.changes.terrain![node.id],undefined);assert.equal(loaded.state.changes.treeRegrowth![node.id],undefined);assert(loaded.nodes().some(n=>n.id===node.id&&n.kind==='tree'));assert.equal(loaded.nodeRemaining(log),0);assert(!loaded.gather(log).ok);assert(loaded.gather(node).ok);assert.equal(loaded.state.changes.treeRegrowth![node.id],at+1200);assert.equal(loaded.nodeRemaining(loaded.nodes().find(n=>n.id===log.id)!),log.amount);
});
test('burned trees also leave regrowing stumps; legacy felling receives a timer and invalid timers are rejected',()=>{
 const {g,node}=treeFixture(),s=g.state;delete s.changes.terrain![node.id];s.combat.charredTrees.push(node.id);s.elapsed=1200;g.treeGrowth.update();assert(!s.combat.charredTrees.includes(node.id));assert(g.nodes().some(n=>n.id===node.id));
 s.changes.terrain![node.id]='felled';delete s.changes.treeRegrowth;const old=new Game(s);assert.equal(s.changes.treeRegrowth![node.id],s.elapsed+1200);assert.deepEqual(importJSON(exportFull(old.state)),old.state);
 const bad=JSON.parse(exportFull(s));bad.state.changes.treeRegrowth[node.id]=-1;assert.throws(()=>importJSON(JSON.stringify(bad)),/treeRegrowth/);bad.state.changes.treeRegrowth={'tree:99999999999999999999999:0:0':1200};assert.throws(()=>importJSON(JSON.stringify(bad)),/regrowing tree/);
});
test('bandit gold has an independent 25 percent roll of zero-to-four gold, stable on defeat and reload',()=>{
 let successful=0;const amounts=new Set<number>();for(let i=0;i<10000;i++){const id=`bandit:${i}`;if(equipmentDrops(42,`gold:${id}`,.25))successful++;const gold=banditGold(42,id);assert(gold>=0&&gold<=4);assert.equal(gold,banditGold(42,id));amounts.add(gold);}assert(successful>2300&&successful<2700);assert.equal(amounts.size,5);
 const g=fresh();for(let i=0;i<30;i++){const id=`bandit:test:${i}`,a={id,type:'bandit' as const,x:0,z:4,hp:125,weapon:null,groupId:id,villageId:null,homeX:0,homeZ:4,heading:0,cooldown:0,roamTimer:0,targetX:0,targetZ:4,alerted:false};g.state.combat.actors[id]=a;g.combat.damage({...a,kind:'enemy'},1000,'player');const expected=banditGold(g.state.world.seeds.loot,id);assert.equal(g.state.changes.groundLoot![`bandit-gold:${id}`]?.resources.gold??0,expected);const before=JSON.stringify(g.state.changes.groundLoot);g.combat.damage({...a,kind:'enemy'},1000,'player');assert.equal(JSON.stringify(g.state.changes.groundLoot),before);}assert.deepEqual(importJSON(exportFull(g.state)),g.state);
});
