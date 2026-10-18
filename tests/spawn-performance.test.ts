import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState,type Point} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {distance,WORLD_CHUNK_CACHE_LIMIT} from '../src/world/WorldManager';
import {BUILDINGS} from '../src/data/definitions';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
const fresh=()=>new Game(newState(worldSpec(42)));

/** Original unrestricted collision query, retained as a behavioral reference. */
function originalSolids(g:Game,point:Point){
 const trees=g.world.around(point).flatMap(c=>c.trees.flatMap((t,i)=>(g.world.bridgeAt(t.x,t.z)||g.state.combat.charredTrees.includes(`tree:${c.cx}:${c.cz}:${i}`)||g.state.changes.terrain?.[`tree:${c.cx}:${c.cz}:${i}`]==='felled')?[]:[{...t,radius:.38*t.scale}]));
 const ruins=g.world.settlements(point).flatMap(r=>[...(g.npc(r).hp>0&&g.settlement.refuge(`npc:${r.id}`)?.phase!=='hidden'?[{id:`npc:${r.id}`,...g.settlement.position(`npc:${r.id}`,r.trader),radius:.5}]:[]),{...r.container,radius:.65}]);
 const rocks=g.world.around(point).flatMap(c=>g.nodesInChunk(c)).filter(n=>n.kind==='boulder'&&g.nodeRemaining(n)>0).map(n=>({...n,radius:1.45}));
 return [...g.world.cliffs(point).map(c=>({...c,radius:c.radius})),...trees,...rocks,...ruins,...g.settlement.structures(point).filter(b=>g.settlement.integrity(b).stage!=='gone').map(b=>({...b,radius:BUILDINGS[b.type].radius}))];
}

test('cached and bounded collision queries preserve the unrestricted collider sequence and reach',()=>{
 const g=fresh();
 for(const p of [{x:0,z:4},{x:-33,z:31},{x:63,z:-1},{x:128,z:8}]){
  const all=originalSolids(g,p);assert.deepEqual(g.solids(p),all);
  for(const reach of [.4,1.7,12.75,18,40])assert.deepEqual(g.solids(p,reach),all.filter(s=>(s.x-p.x)**2+(s.z-p.z)**2<=(s.radius+reach)**2));
 }
});

test('repeated natural-resource queries reuse immutable bridge/cliff eligibility',()=>{
 const g=fresh(),chunk=g.world.chunk(0,0),bridge=g.world.bridgeAt.bind(g.world),cliff=g.world.cliffAt.bind(g.world);let scans=0;
 g.world.bridgeAt=(...args)=>{scans++;return bridge(...args);};g.world.cliffAt=(...args)=>{scans++;return cliff(...args);};
 const first=g.nodesInChunk(chunk);assert(scans>0);scans=0;
 for(let i=0;i<100;i++)assert.deepEqual(g.nodesInChunk(chunk),first);
 assert.equal(scans,0,'eligibility is not regenerated per enemy or per simulation step');
});

test('cached trees and boulders immediately respect falling, burning, depletion and regrowth',()=>{
 const g=fresh(),tree=g.nodes().find(n=>n.kind==='tree')!,rock=g.nodes().find(n=>n.kind==='boulder')!;
 const hasTree=()=>g.solids(tree).some(s=>s.x===tree.x&&s.z===tree.z&&s.radius===tree.radius);
 assert(hasTree());g.breakNatural(tree);assert(!hasTree());assert(g.nodes().some(n=>n.id===`log:${tree.id}`));
 g.state.elapsed=1200;g.treeGrowth.update();assert(hasTree());g.state.combat.charredTrees.push(tree.id);assert(!hasTree());g.state.combat.charredTrees=[];assert(hasTree());
 assert(g.solids(rock).some(s=>'id'in s&&s.id===rock.id));g.breakNatural(rock);assert(!g.solids(rock).some(s=>'id'in s&&s.id===rock.id));assert(g.nodes().some(n=>n.id.startsWith(`fragment:${rock.id}:`)));
 delete g.state.changes.terrain![rock.id];assert(g.solids(rock).some(s=>'id'in s&&s.id===rock.id));g.state.changes.nodes[rock.id]=0;assert(!g.solids(rock).some(s=>'id'in s&&s.id===rock.id));
 const restored=new Game(importJSON(exportFull(g.state)));assert.deepEqual(restored.solids(rock),g.solids(rock));
});

test('moving NPCs, shelter occupancy and destroyed buildings are never frozen in the terrain cache',()=>{
 const g=fresh(),v=g.world.villages()[0],id=`npc:${v.id}`;g.solids(v.trader);
 const refuge={houseId:`house:${v.id}:0`,x:v.x+2,z:v.z+2,homeX:v.trader.x,homeZ:v.trader.z,phase:'fleeing' as const,remaining:12};
 (g.state.changes.refuges??={})[id]=refuge;
 assert(g.solids(v).some(s=>'id'in s&&s.id===id&&s.x===refuge.x));refuge.x+=3;assert(g.solids(v).some(s=>'id'in s&&s.id===id&&s.x===refuge.x));
 g.state.changes.refuges![id].phase='hidden';assert(!g.solids(v).some(s=>'id'in s&&s.id===id));
 g.state.buildings.push({id:'built:perf',type:'hut',x:8,z:8,rotation:0});assert(g.solids({x:8,z:8}).some(s=>'id'in s&&s.id==='built:perf'));
 g.state.changes.structures!['built:perf']={hp:0,stage:'gone'};assert(!g.solids({x:8,z:8}).some(s=>'id'in s&&s.id==='built:perf'));
});

test('preparation changes no gameplay state or protection duration and retains identical encounters',()=>{
 const prepared=fresh(),cold=fresh(),before=exportFull(prepared.state),points=prepared.combat.encounterPreparationPoints();
 assert(points.length>0);for(const p of points)for(const c of prepared.world.around(p))prepared.prepareCollisionChunk(c);
 assert.equal(exportFull(prepared.state),before);prepared.combat.ensureEncounters();assert.equal(Object.keys(prepared.state.combat.actors).length,0);assert.equal(prepared.state.spawnProtection!.remaining,12);
 prepared.state.spawnProtection!.remaining=0;cold.state.spawnProtection!.remaining=0;prepared.combat.ensureEncounters();cold.combat.ensureEncounters();
 assert.deepEqual(prepared.state.combat,cold.state.combat);assert(Object.keys(prepared.state.combat.actors).length>0);
});

test('bounded AI movement and sight preserve full-query combat, workers and survival timing',()=>{
 const fast=fresh(),full=fresh();fast.paused=full.paused=false;fast.state.spawnProtection!.remaining=0;full.state.spawnProtection!.remaining=0;
 full.solids=p=>originalSolids(full,p);
 const units=full.combat.units.bind(full.combat);full.combat.units=()=>{(full.combat as any).unitSnapshot=undefined;return units();};
 for(let i=0;i<180;i++){fast.update(1/60);full.update(1/60);}
 assert.deepEqual(fast.state,full.state);assert.equal(fast.state.combat.projectiles.length,full.state.combat.projectiles.length);
 assert.deepEqual(importJSON(exportFull(fast.state)),fast.state);
});

test('preparing many regions retains the existing bounded world cache and terrain changes',()=>{
 const spec=worldSpec(42);spec.config.resourceDensity=0;spec.config.ruinDensity=0;spec.config.riverDensity=0;
 const g=new Game(newState(spec)),chunk=g.world.chunk(0,0);g.prepareCollisionChunk(chunk);
 for(let i=1;i<=WORLD_CHUNK_CACHE_LIMIT+5;i++){g.prepareCollisionChunk(g.world.chunk(i,20));assert((g.world as any).cache.size<=WORLD_CHUNK_CACHE_LIMIT);}
 assert.notEqual(g.world.chunk(0,0),chunk);assert.equal(distance(g.state.player,{x:0,z:4}),0);
 const hot=g.world.chunk(0,0);
 for(let i=1;i<=WORLD_CHUNK_CACHE_LIMIT+5;i++){g.world.chunk(i,-20);g.world.chunk(0,0);}
 assert.equal(g.world.chunk(0,0),hot,'frequently queried collision chunks survive distant cache pressure');
});
