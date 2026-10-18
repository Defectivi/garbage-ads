import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync(edge)?edge:undefined)});
mkdirSync('test-results',{recursive:true});const errors=[];
async function start(options={}){
  const page=await browser.newPage(options);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173');await page.locator('#seed').fill('42');await page.locator('#new-world').click();await page.locator('#resources').waitFor();
  await page.evaluate(()=>{const a=window.__frostbound,g=a.game;g.combat.ensureEncounters=()=>{};g.state.workers=[];g.state.combat.actors={};g.state.furnaces[0].fuel=0;g.state.player.hp=20;g.state.player.hunger=2;g.state.inventory.fish=5;g.state.inventory.meat=3;a.refresh();});
  return page;
}
try{
  for(const mobile of [false,true]){
    const page=await start(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
    await page.evaluate(()=>{window.__frostbound.game.state.settings.budgetMeal=true;});
    await page.locator('#inventory').click();await page.locator('#eat-fish').click();
    assert.match(await page.locator('#dialog-status').textContent(),/Ate fish: \+2 hunger, \+5 HP/);
    assert.match(await page.locator('#meal-vitals').textContent(),/HUNGER 4\/20 \/ HP 25\/50/);
    assert.equal(await page.locator('[data-food-count=fish]').textContent(),'x4');
    assert.equal(await page.evaluate(async()=>{
      let count=0;const observer=new MutationObserver(records=>count+=records.length);
      for(const id of ['meal-cooldown','meal-warning'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});
      for(let i=0;i<5;i++)window.__frostbound.refresh();await Promise.resolve();observer.disconnect();return count;
    }),0,'unchanged paused readouts do not repeat live announcements');
    assert.match(await page.locator('#meal-warning').textContent(),/DANGER/);
    assert.match(await page.locator('#hunger').textContent(),/4 \/ 20/);
    assert.match(await page.locator('#health').textContent(),/25 \/ 50 HP/);
    await page.screenshot({path:`test-results/rations-${mobile?'touch':'desktop'}-success.png`,fullPage:true});
    // Keyboard and rapid clicks use the same transaction. The modal intentionally pauses time.
    await page.locator('#eat-meat').focus();await page.keyboard.press('Enter');
    for(let i=0;i<4;i++)await page.locator('#eat-fish').click();
    assert.match(await page.locator('#dialog-status').textContent(),/3.0s remaining.*Close the rucksack/);
    assert.match(await page.locator('#meal-cooldown').textContent(),/3.0s.*paused/);
    assert.deepEqual(await page.evaluate(()=>{const s=window.__frostbound.game.state;return[s.inventory.fish,s.inventory.meat,s.player.hp,s.player.hunger];}),[4,3,25,4]);
    await page.locator('#meal-resume').click();
    await page.waitForFunction(()=>window.__frostbound.game.state.player.foodCooldown<1e-8);
    await page.locator('#inventory').click();await page.locator('#eat-meat').click();
    assert.match(await page.locator('#meal-vitals').textContent(),/HUNGER 7\/20 \/ HP 30\/100/);
    assert.equal(await page.locator('[data-food-count=meat]').textContent(),'x2');
    await page.screenshot({path:`test-results/rations-${mobile?'touch':'desktop'}-cooldown.png`,fullPage:true});
    await page.evaluate(()=>{const a=window.__frostbound;a.game.state.player.foodCooldown=0;a.game.state.inventory.meat=0;a.refresh();});
    await page.locator('#eat-meat').click();assert.match(await page.locator('#dialog-status').textContent(),/No meat in your pack/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.close();
  }
  const page=await start({viewport:{width:1440,height:1000}});
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.ready);
  const cancelled=await page.evaluate(()=>{
    const a=window.__frostbound,g=a.game,c=a.renderer.playerCharacter;
    g.state.player.hp=100;g.state.player.hunger=20;g.state.player.x=3.4;g.state.player.z=4;g.stopMovement();c.reset();
    const node=g.nodes().find(n=>n.id==='starter:wood'),before=g.state.inventory.wood;
    const r=g.startGather(node);if(!r.ok)throw Error(r.error);
    g.update(1/60,{x:1,z:0});c.update(g,1/60);
    const result={animation:c.object.userData.animation,tool:!!c.object.getObjectByName('player-tool'),awarded:g.state.inventory.wood-before};
    g.stopMovement();return result;
  });
  assert.notEqual(cancelled.animation,'gather');assert.equal(cancelled.tool,false);assert.equal(cancelled.awarded,0);
  // Exercise the actual RAF cap before the reproducible pose captures below.
  const woodBefore=await page.evaluate(()=>{
    const a=window.__frostbound,g=a.game;g.state.settings.budgetMeal=true;
    g.state.player.hp=100;g.state.player.hunger=20;g.state.player.x=3.4;g.state.player.z=4;g.stopMovement();
    const node=g.nodes().find(n=>n.id==='starter:wood'),before=g.state.inventory.wood;
    const r=g.startGather(node);if(!r.ok)throw Error(r.error);
    if(g.startGather(node).ok)throw Error('Repeated input started a second task');
    return before;
  });
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.getObjectByName('player-tool')?.userData.tool==='axe');
  await page.waitForFunction(()=>!window.__frostbound.game.gathering&&!window.__frostbound.renderer.playerCharacter.object.getObjectByName('player-tool'));
  assert.equal(await page.evaluate(()=>window.__frostbound.game.state.inventory.wood),woodBefore+1);
  // Freeze the harness's RAF, then advance the real simulation and renderer in reproducible steps.
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(200);
  await page.evaluate(()=>{const g=window.__frostbound.game;g.state.player.hp=100;g.state.player.hunger=20;g.paused=false;});
  for(const [resource,kind]of [['wood','tree'],['stone','boulder'],['metal',null],['gold',null]])for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const fixture=await page.evaluate(async({resource,kind,heading})=>{
      const a=window.__frostbound,g=a.game,{gatherSeconds}=await import('/src/game/Game.ts');
      g.gathering=undefined;g.stopMovement();a.renderer.playerCharacter.reset();
      // Real generated resources, including ore; use a fresh source for each heading.
      let node;
      for(let ring=0;ring<8&&!node;ring++)for(let cx=-ring;cx<=ring&&!node;cx++)for(let cz=-ring;cz<=ring&&!node;cz++){
        node=g.nodesInChunk(g.world.chunk(cx,cz)).find(n=>n.resource===resource&&(!kind||n.kind===kind)&&g.nodeRemaining(n)>0);
      }
      if(!node)throw Error('Missing generated '+resource);
      g.state.player.x=node.x-Math.sin(heading)*2.5;g.state.player.z=node.z-Math.cos(heading)*2.5;
      g.state.player.heading=heading;a.renderer.playerCharacter.object.rotation.y=heading;
      a.renderer.zoom=34;a.renderer.yaw=heading+Math.PI/2;g.state.settings.budgetMeal=heading===Math.PI/2;
      const before=g.state.inventory[resource];const r=g.startGather(node);if(!r.ok)throw Error(r.error);
      window.harvestFixture={node,duration:gatherSeconds(resource),before};
      for(let i=0;i<30;i++)a.renderer.update(1/60,g.state.elapsed*1000,false);
      return {duration:gatherSeconds(resource),natural:!!kind};
    },{resource,kind,heading});
    const tag=`${resource}-${Math.round(heading*100)}`;
    for(const phase of ['windup','impact','idle']){
      const state=await page.evaluate(({phase})=>{
        const a=window.__frostbound,g=a.game,f=window.harvestFixture;
        const goal=phase==='windup'?f.duration*.4*(Math.ceil(f.duration/.8)>1?.75:1)/Math.ceil(f.duration/.8):phase==='impact'?f.duration:f.duration+.22;
        const start=f.duration-(g.gathering?.remaining??0);
        const from=phase==='idle'?f.duration:start;
        for(let t=from;t<goal-1e-9;){const dt=Math.min(1/60,goal-t);g.update(dt);a.renderer.update(dt,g.state.elapsed*1000,false);t+=dt;}
        a.refresh();
        const c=a.renderer.playerCharacter,tool=c.object.getObjectByName('player-tool');
        return {tool:tool?.userData.tool,animation:c.object.userData.animation,progress:c.object.userData.harvestProgress,gathering:!!g.gathering,count:g.state.inventory[f.node.resource],before:f.before,terrain:g.state.changes.terrain?.[f.node.id]};
      },{phase});
      if(phase==='idle')assert.equal(state.tool,undefined);else assert.equal(state.tool,resource==='wood'?'axe':'pickaxe');
      if(phase==='impact'){assert.equal(state.gathering,false);assert.equal(state.count,state.before+(fixture.natural?0:1));}
      if(heading===0||heading===Math.PI/2){
        await page.screenshot({path:`test-results/harvest-${tag}-${phase}.png`});
        await page.evaluate(()=>{const a=window.__frostbound;a.renderer.zoom=18;a.renderer.update(0,a.game.state.elapsed*1000,false);});
        await page.screenshot({path:`test-results/harvest-${tag}-${phase}-close.png`});
        await page.evaluate(()=>{window.__frostbound.renderer.zoom=34;});
      }
    }
    // Real interruption: movement cancels; menus reset visual poses without advancing the task.
    await page.evaluate(()=>{const a=window.__frostbound,g=a.game;g.gathering=undefined;g.gathering={node:{...window.harvestFixture.node},remaining:window.harvestFixture.duration*.5};a.renderer.update(.02,g.state.elapsed*1000,false);g.update(1/60,{x:1,z:0});a.renderer.update(.02,g.state.elapsed*1000,false);});
    assert.equal(await page.evaluate(()=>window.__frostbound.renderer.playerCharacter.object.getObjectByName('player-tool')===undefined),true);
    await page.evaluate(()=>{const a=window.__frostbound,g=a.game;g.gathering={node:{...window.harvestFixture.node},remaining:window.harvestFixture.duration*.5};a.renderer.update(.02,g.state.elapsed*1000,false);a.panels.inventory();a.renderer.update(.02,g.state.elapsed*1000,false);});
    assert.equal(await page.evaluate(()=>window.__frostbound.renderer.playerCharacter.object.getObjectByName('player-tool')===undefined),true);
    await page.keyboard.press('e');
  }
  assert.deepEqual(errors,[]);
  console.log('Harvest/food browser checks passed: real generated trees, boulders, metal/gold ore in four facings; windup/impact/recovery, interruption/menu cleanup, exact yields; desktop/keyboard/touch-sized rations, immediate state/HUD, shared cooldown, pause explanation, expiry and unavailable-item feedback, Budget Meal Mode.');
}finally{await browser.close();}
