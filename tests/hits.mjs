import {isolateStartingCamp} from './browser-state.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});const errors=[];mkdirSync('test-results',{recursive:true});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:{width:mobile?390:1440,height:mobile?844:1000},hasTouch:mobile,isMobile:mobile});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');await page.locator('#seed').fill('42');await page.locator('#new-world').click();await isolateStartingCamp(page);
  await page.evaluate(()=>{const a=window.__frostbound,g=a.game;g.state.furnaces[0].fuel=0;g.state.combat.weapons=[{id:'hit-test',type:'wooden_sword',uses:100}];g.state.combat.equipped='hit-test';g.combat.ensureEncounters();for(const actor of Object.values(g.state.combat.actors))actor.hp=0;const enemy=Object.values(g.state.combat.actors).find(a=>a.type==='bandit');Object.assign(enemy,{x:-1.3,z:4,hp:125,weapon:null,cooldown:5,roamTimer:5,heatInside:true});window.hitEnemy=enemy.id;g.state.player.heading=0;a.renderer.zoom=16;a.refresh();window.hitReadings=[];new MutationObserver(records=>{for(const record of records)for(const el of record.addedNodes)if(el instanceof HTMLElement&&el.matches('.damage-number'))window.hitReadings.push({target:el.dataset.target,text:el.textContent});}).observe(document.body,{childList:true,subtree:true});});
  await page.waitForFunction(()=>window.__frostbound.renderer.combatVisual.characters.get(window.hitEnemy)?.ready);
  if(mobile)await page.locator('#attack-button').tap();else await page.mouse.click(650,350);
  await page.waitForFunction(()=>window.hitReadings.some(e=>e.target===window.hitEnemy&&e.text==='-10'));
  assert.equal(await page.evaluate(()=>window.__frostbound.game.state.combat.actors[window.hitEnemy].hp),115);assert.equal(await page.evaluate(()=>window.__frostbound.game.state.combat.weapons[0].uses),99);assert(Math.abs(await page.evaluate(()=>window.__frostbound.game.state.player.heading)+Math.PI/2)<.1);
  await page.screenshot({path:`test-results/damage-assist-${mobile?'mobile':'desktop'}.png`});
  await page.waitForTimeout(1200);assert.equal(await page.locator('.damage-number').count(),0);
  await page.evaluate(()=>{const g=window.__frostbound.game;g.state.combat.weapons=[{id:'machete',type:'machete',uses:100}];g.state.combat.equipped='machete';g.state.combat.cooldown=0;g.state.combat.actors[window.hitEnemy].cooldown=5;});
  if(mobile)await page.locator('#attack-button').tap();else await page.mouse.click(650,350);
  await page.waitForFunction(()=>window.hitReadings.some(e=>e.target===window.hitEnemy&&e.text==='-25'));await page.waitForFunction(()=>window.hitReadings.some(e=>e.target===window.hitEnemy&&e.text==='-2'));assert.equal(await page.evaluate(()=>window.__frostbound.game.state.combat.weapons[0].uses),99);
  await page.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto('http://localhost:5173');await reduced.locator('#seed').fill('42');await reduced.locator('#new-world').click();await isolateStartingCamp(reduced);await reduced.waitForFunction(()=>window.__frostbound.renderer.chunks.size===25);await reduced.evaluate(()=>{const g=window.__frostbound.game;g.combat.damage({...g.state.player,id:'player',kind:'player'},10,'test');});await reduced.waitForSelector('.damage-number.incoming');assert.equal(await reduced.locator('.damage-number.incoming').textContent(),'-5');await reduced.waitForTimeout(800);assert.equal(await reduced.locator('.damage-number').count(),0);
 assert.deepEqual(errors,[]);console.log('Hit browser checks passed: native left-click/touch target assist, 10/25 damage indicators, bleed feedback, single hit durability, cleanup and reduced-motion incoming damage.');
}finally{await browser.close();}
