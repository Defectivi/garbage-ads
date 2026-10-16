import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.locator('#seed').fill('42');await page.locator('#new-world').click();
 await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.ready);
 await page.evaluate(()=>{
  const a=window.__frostbound,g=a.game,v=g.world.villages()[0];g.state.player.x=v.x;g.state.player.z=v.z+4;g.stopMovement();g.combat.ensureEncounters();g.combat.ensureEncounters=()=>{};
  const guards=Object.values(g.state.combat.actors).filter(a=>a.villageId===v.id);for(const actor of Object.values(g.state.combat.actors))actor.hp=0;
  const house=g.settlement.structures().find(b=>b.id===`house:${v.id}:0`),guard=guards[0],healthy=guards[1];
  const door={x:house.x-.7*Math.cos(house.rotation)+2.4*Math.sin(house.rotation),z:house.z+.7*Math.sin(house.rotation)+2.4*Math.cos(house.rotation)};
  Object.assign(guard,{hp:125,x:door.x,z:door.z+1,cooldown:5});Object.assign(healthy,{hp:125,x:v.x+4,z:v.z+4,cooldown:5});
  window.guardId=guard.id;window.healthyId=healthy.id;window.houseId=house.id;g.combat.damage({...guard,kind:'guard'},5,'test');a.refresh();
 });
 await page.waitForFunction(()=>window.__frostbound.game.settlement.refuge(window.guardId)?.phase==='hidden');
 await page.waitForFunction(()=>{const r=window.__frostbound.renderer;return r.combatVisual.characters.get(window.guardId)?.ready&&r.combatVisual.characters.get(window.healthyId)?.ready;});
 assert.equal(await page.evaluate(()=>window.__frostbound.renderer.combatVisual.characters.get(window.guardId).object.visible),false);
 assert.equal(await page.evaluate(()=>window.__frostbound.renderer.combatVisual.characters.get(window.healthyId).object.visible),true);
 assert.equal(await page.evaluate(()=>window.__frostbound.game.combat.units().some(u=>u.id===window.guardId)),false);
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/guard-shelter.png'});
 await page.evaluate(()=>{const g=window.__frostbound.game,b=g.settlement.structures().find(b=>b.id===window.houseId);g.settlement.damage(b.id,1000,b);});
 await page.waitForFunction(()=>window.__frostbound.renderer.combatVisual.characters.get(window.guardId)?.object.visible===true);
 assert(await page.evaluate(()=>window.__frostbound.game.combat.units().some(u=>u.id===window.guardId)));
 await page.waitForFunction(()=>!window.__frostbound.game.settlement.refuge(window.guardId));assert.deepEqual(errors,[]);
 console.log('Guard shelter browser checks passed: injured model hides, healthy guard stays visible, ruined house exposes occupant, guard returns to duty.');
}finally{await browser.close();}
