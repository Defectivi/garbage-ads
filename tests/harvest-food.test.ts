import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { HarvestMotion, harvestPath, harvestPose, harvestCycles } from '../src/rendering/HarvestPose';
import { createSurvivorAsset } from '../src/rendering/SurvivorAsset';
import { workerTool } from '../src/rendering/WorkerTools';
import { Game, gatherSeconds } from '../src/game/Game';
import { worldSpec } from '../src/game/GameConfig';
import { simulationState } from './fixtures/state';
import { SimulationClock, RenderTiming } from '../src/game/FrameTiming';
const advance=(g:Game,seconds:number)=>{for(let i=0;i<Math.round(seconds*60);i++)g.update(1/60);};
const game=()=>{const g=new Game(simulationState(worldSpec(42)));g.paused=false;g.combat.ensureEncounters=()=>{};g.state.furnaces[0].fuel=0;return g;};

test('a harvest cancelled before its first render cannot publish a completed pickup animation',()=>{
  const g=game(),s=g.state,node={id:'test:cancel',kind:'resource' as const,resource:'wood' as const,x:s.player.x,z:s.player.z,amount:3};
  const before=s.inventory.wood,stamp=g.lastGather;
  assert(g.startGather(node).ok);g.update(1/60,{x:1,z:0});
  assert(!g.gathering);assert.equal(s.inventory.wood,before);assert.equal(g.lastGather,stamp);
});

test('axe and pickaxe track windup, downward impact and bounded recovery; interruptions discard poses',()=>{
  for(const resource of ['wood','stone','metal','gold'] as const){
    const motion=new HarvestMotion(),duration=gatherSeconds(resource),task={node:{resource},remaining:duration};
    assert.equal(motion.update(task,0,duration,true)!.progress,0);
    task.remaining=duration*(1-.4*(harvestCycles(duration)>1?.75:1)/harvestCycles(duration));const raised=motion.update(task,duration*.4,duration,true)!;
    task.remaining=0;const hit=motion.update(task,duration,duration,true)!;
    assert(harvestPath(hit.kind,raised.progress).hand.y>harvestPath(hit.kind,hit.progress).hand.y+.5);
    assert(harvestPath(hit.kind,hit.progress).direction.y<0);
    assert.equal(motion.update(undefined,duration,duration,true)!.progress,1);
    assert(motion.update(undefined,duration+.1,duration,true)!.progress>1);
    assert.equal(motion.update(undefined,duration+.2,duration,true),undefined);
    task.remaining=duration*.5;motion.update(task,1,duration,true);
    assert.equal(motion.update(undefined,1,duration,true),undefined,'cancelled tasks do not replay impact');
    motion.update(task,1,duration,true);assert.equal(motion.update(task,1,duration,false),undefined,'menu/death resets');
    assert.equal(motion.update(undefined,2,duration,true),undefined);
  }
});

test('tool stays on hand and sweeps down in the facing plane for all four headings',()=>{
  for(const kind of ['axe','pickaxe'] as const)for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const root=new T.Group(),asset=createSurvivorAsset().scene,tool=workerTool(kind);root.add(asset);root.rotation.y=heading;
    const hand=asset.getObjectByName('HandR')!;hand.add(tool);const heights:number[]=[];
    for(const progress of [0,.4,.7,1,1.5,2]){
      harvestPose(root,asset,tool,kind,progress);
      assert(tool.getWorldPosition(new T.Vector3()).distanceTo(hand.getWorldPosition(new T.Vector3()))<1e-8);
      const direction=new T.Vector3(0,1,0).transformDirection(tool.matrixWorld);
      const local=direction.clone().applyAxisAngle(new T.Vector3(0,1,0),-heading);
      assert(Math.abs(local.x)<.15);assert(direction.toArray().every(Number.isFinite));
      if(progress===.4||progress===1)heights.push(tool.localToWorld(new T.Vector3(0,.55,0)).y);
    }
    assert(heights[0]>heights[1]+.7);
  }
});

test('food applies once, shares cooldown, expires on simulation time and rejects unavailable/dead actions',()=>{
  const g=game(),s=g.state;s.player.hp=20;s.player.hunger=4;s.inventory.fish=4;s.inventory.meat=4;
  assert(g.eat('fish').ok);assert.deepEqual([s.player.hp,s.player.hunger,s.inventory.fish,s.player.foodCooldown],[25,6,3,3]);
  assert.match(g.message,/Ate fish: \+2 hunger, \+5 HP/);
  for(let i=0;i<20;i++){const r=g.eat(i%2?'fish':'meat');assert(!r.ok);if(!r.ok)assert.match(r.error,/remaining/);}
  assert.deepEqual([s.player.hp,s.player.hunger,s.inventory.fish,s.inventory.meat],[25,6,3,4]);
  advance(g,2.9);assert(!g.eat('meat').ok);advance(g,.1);assert(g.eat('meat').ok);
  assert.deepEqual([s.player.hp,s.player.hunger,s.inventory.meat],[30,9,3]);
  advance(g,3);s.inventory.fish=0;s.settings.resourceMin=-100;
  const missing=g.eat('fish');assert(!missing.ok);if(!missing.ok)assert.match(missing.error,/No fish/);
  assert.equal(s.inventory.fish,0);assert((s.player.foodCooldown??0)<1e-8);
  s.player.hp=0;const dead=g.eat('meat');assert(!dead.ok);if(!dead.ok)assert.match(dead.error,/Recover/);assert.equal(s.inventory.meat,3);
});

test('existing capped-benefit meals still consume at full HP/hunger; menus freeze cooldown',()=>{
  const g=game(),s=g.state;s.player.hp=100;s.player.hunger=20;s.inventory.fish=3;
  assert(g.eat('fish').ok);assert.deepEqual([s.player.hp,s.player.hunger,s.inventory.fish],[100,20,2]);assert.match(g.message,/Already full/);
  g.paused=true;g.update(10);assert.equal(s.player.foodCooldown,3);
  const r=g.eat('fish');assert(!r.ok);if(!r.ok)assert.match(r.error,/Close the rucksack/);
  g.paused=false;advance(g,3);assert(g.eat('fish').ok);
});

test('full hunger or health caps only that benefit; nonfood input cannot spend an item',()=>{
  const g=game(),s=g.state;s.player.hunger=20;s.player.hp=40;s.inventory.meat=4;
  assert(g.eat('meat').ok);assert.deepEqual([s.player.hp,s.player.hunger,s.inventory.meat],[45,20,3]);
  advance(g,3);s.player.hp=100;s.player.hunger=10;
  assert(g.eat('meat').ok);assert.deepEqual([s.player.hp,s.player.hunger,s.inventory.meat],[100,13,2]);
  const before=s.inventory.wood;
  const invalid=g.eat('wood' as any);assert(!invalid.ok);if(!invalid.ok)assert.match(invalid.error,/not edible/);
  assert.equal(s.inventory.wood,before);assert.equal(s.player.foodCooldown,3);
});

test('render throttling cannot alter gathering durations, yields or food cooldown expiration',()=>{
  for(const budget of [false,true])for(const resource of ['wood','stone','metal','gold'] as const){
    const g=game(),clock=new SimulationClock(),render=new RenderTiming(),s=g.state;
    const node={id:'test:harvest',kind:'resource' as const,resource,x:s.player.x,z:s.player.z,amount:3};
    const before=s.inventory[resource];s.player.hp=20;s.player.hunger=10;s.inventory.fish=3;assert(g.eat('fish').ok);
    assert(g.startGather(node).ok);
    const task=g.gathering;assert(!g.startGather(node).ok);assert.equal(g.gathering,task,'repeated input retains one task');
    const steps=Math.round(gatherSeconds(resource)*60);let renders=0;
    for(let i=1;i<=180;i++){
      clock.advance(1/60,dt=>g.update(dt));if(render.due(i*1000/60,budget))renders++;
      if(i===steps-1){assert(g.gathering);assert.equal(s.inventory[resource],before);}
      if(i===steps){assert(!g.gathering);assert.equal(s.inventory[resource],before+1);}
    }
    assert.equal(s.inventory[resource],before+1);assert(g.eat('fish').ok);assert.equal(s.inventory.fish,1);
    if(budget)assert(renders<100);else assert.equal(renders,180);
  }
});
