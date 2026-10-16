import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/Game';
import {newState} from '../src/game/GameState';
import {worldSpec} from '../src/game/GameConfig';
import {ACTOR_HP,type ActorType} from '../src/data/weapons';
import type {Actor} from '../src/game/CombatState';
import {exportFull,importJSON} from '../src/systems/SaveSystem';
import {inPlayerHeat,furnaceTier} from '../src/systems/SurvivalSystem';
import {CHARACTER_STYLES,bearAppearance} from '../src/data/characters';
import {createSurvivorAsset} from '../src/rendering/SurvivorAsset';
import {createBearAsset} from '../src/rendering/BearAsset';
import * as T from 'three';
const fresh=()=>new Game(newState(worldSpec(42)));
function actor(g:Game,type:ActorType,x=13,z=0):Actor{const id=`test:${type}`;return g.state.combat.actors[id]={id,type,x,z,hp:ACTOR_HP[type],weapon:null,groupId:id,villageId:type==='guard'?'village:hearth':null,homeX:x,homeZ:z,heading:0,cooldown:4,roamTimer:10,targetX:x,targetZ:z,alerted:false,heatInside:false};}

test('active player furnaces halve all incoming damage; villages and extinguished furnaces do not',()=>{
 const g=fresh();const hit=(owner:string)=>g.combat.damage({...g.state.player,id:'player',kind:'player'},10,owner);
 assert(inPlayerHeat(g.state));for(const source of ['arrow','melee','fire','bleed'])hit(source);assert.equal(g.state.player.hp,80);
 g.state.furnaces[0].fuel=0;hit('arrow');assert.equal(g.state.player.hp,70);
 g.state.furnaces.push({id:'village:hearth:furnace',x:0,z:0,fuel:100,charcoal:0,level:1});hit('arrow');assert.equal(g.state.player.hp,60);
 g.state.furnaces.push({id:'built:1',x:0,z:0,fuel:0,charcoal:120,level:1});g.state.buildings.push({id:'built:1',type:'furnace',x:0,z:0,rotation:0});hit('arrow');assert.equal(g.state.player.hp,55);
 g.state.player.x=30;hit('arrow');assert.equal(g.state.player.hp,45);
});

test('hostile furnace entry costs exactly 10% max HP once per entry, not per frame',()=>{
 for(const type of ['polar_bear','bandit','arsonist'] as const){const g=fresh();g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;const a=actor(g,type);a.x=11;g.combat.update(0);assert.equal(a.hp,ACTOR_HP[type]*.9);
  for(let i=0;i<20;i++)g.combat.update(0);assert.equal(a.hp,ACTOR_HP[type]*.9);a.x=13;g.combat.update(0);assert.equal(a.heatInside,false);a.x=11;g.combat.update(0);assert(Math.abs(a.hp-ACTOR_HP[type]*.8)<1e-8);
 }
});

test('overlapping heat zones do not stack entry damage; neutral guards remain unharmed',()=>{
 const g=fresh();g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;
 g.state.buildings.push({id:'built:1',type:'furnace',x:8,z:0,rotation:0});g.state.furnaces.push({id:'built:1',x:8,z:0,fuel:100,charcoal:0,level:1});g.state.nextId=2;
 const bandit=actor(g,'bandit',11);g.combat.update(0);assert.equal(bandit.hp,112.5);
 const guard=actor(g,'guard',10);g.combat.update(0);assert.equal(guard.hp,125);
 const loaded=new Game(importJSON(exportFull(g.state)));loaded.combat.update(0);assert.equal(loaded.state.combat.actors[bandit.id].hp,112.5);
 const legacy=JSON.parse(exportFull(g.state));delete legacy.state.combat.actors[bandit.id].heatInside;const old=new Game(importJSON(JSON.stringify(legacy)));old.combat.update(0);assert.equal(old.state.combat.actors[bandit.id].hp,112.5);
});

test('enemy steering never ejects embedded actors farther than their movement budget',()=>{
 const g=fresh(),a=actor(g,'bandit',0,0);let previous={x:a.x,z:a.z};
 for(let i=0;i<80;i++){(g.combat as any).walk(a,{x:8,z:0},1/60,1.8);assert(Math.hypot(a.x-previous.x,a.z-previous.z)<=1.8/60+1e-8);previous={x:a.x,z:a.z};}
 assert(Number.isFinite(a.x)&&Number.isFinite(a.z));
 g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors).filter(a=>!a.id.startsWith('test:'))){assert(!g.world.isWater(a.x,a.z));const r=a.type==='polar_bear'?.75:.4;assert(g.solids(a).every(s=>Math.hypot(s.x-a.x,s.z-a.z)>=s.radius+r));}
});

test('fuel, upgrade and house feedback is emitted only for completed atomic transactions',()=>{
 const g=fresh(),s=g.state;s.player.x=0;s.player.z=3;const before=s.inventory.wood;
 assert(g.feed().ok);assert.equal(s.inventory.wood,before-1);assert.equal(g.actionEvents.at(-1)!.kind,'fuel');g.actionEvents.length=0;
 assert(!g.upgradeFurnace().ok);assert.equal(g.actionEvents.length,0);
 s.stockpile.wood=20;s.inventory.wood=10;assert(g.upgradeFurnace().ok);assert.equal(s.stockpile.wood,0);assert.equal(s.inventory.wood,0);assert.deepEqual(g.actionEvents.at(-1)!.costs,[{resource:'wood',amount:30,stock:20}]);
 s.inventory.wood=5;assert(g.build('hut',{x:8,z:4},0).ok);assert.equal(s.inventory.wood,0);assert.equal(g.actionEvents.at(-1)!.kind,'build');assert.equal(s.workers.length,1);
 const count=g.actionEvents.length;assert(!g.build('hut',{x:0,z:0},0).ok);assert.equal(g.actionEvents.length,count);assert(!exportFull(s).includes('actionEvents'));
 assert.equal(furnaceTier(4),0);assert.equal(furnaceTier(5),1);assert.equal(furnaceTier(10),2);assert.equal(furnaceTier(15),3);
});

test('prepared characters include tailored humanoid roles and continuous rigged quadrupeds',()=>{
 assert.equal(new Set(Array.from({length:32},(_,i)=>bearAppearance(`encounter-${i}-0`))).size,2);assert.equal(bearAppearance('stable'),bearAppearance('stable'));
 assert.equal(CHARACTER_STYLES.length,14);assert.equal(new Set(CHARACTER_STYLES.map(s=>s.id)).size,14);
 const vertexCounts=new Set<number>();for(const style of CHARACTER_STYLES){const asset=createSurvivorAsset(style),mesh=asset.scene.getObjectByName('Wayfarer_clothing') as T.SkinnedMesh;assert(mesh.isSkinnedMesh);assert.equal(mesh.skeleton.bones.length,17);vertexCounts.add(mesh.geometry.getAttribute('position').count);mesh.geometry.dispose();(mesh.material as T.Material).dispose();mesh.skeleton.dispose();}
 assert(vertexCounts.size>=3);
 for(const name of ['bear-ivory','bear-frost']){const asset=createBearAsset(name),mesh=asset.scene.getObjectByName('Bear_fur') as T.SkinnedMesh;assert(mesh.isSkinnedMesh);assert.equal(mesh.skeleton.bones.length,10);assert(asset.animations.some(a=>a.name==='walk'));mesh.geometry.computeBoundingBox();assert(mesh.geometry.boundingBox!.min.y>=0);mesh.geometry.dispose();(mesh.material as T.Material).dispose();mesh.skeleton.dispose();}
});
