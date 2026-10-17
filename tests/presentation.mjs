import {isolateStartingCamp} from './browser-state.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync(edge)?edge:undefined)});
const errors=[];mkdirSync('test-results',{recursive:true});
const attach=page=>page.on('pageerror',e=>errors.push(e.message));
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});attach(page);
  await page.goto('http://localhost:5173');await page.locator('#seed').fill('42');await page.locator('#new-world').click();await page.locator('#resources').waitFor();await isolateStartingCamp(page);
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.ready&&window.__frostbound.renderer.chunks.size===25);
  assert.equal(await page.evaluate(()=>window.__frostbound.renderer.playerCharacter.source),'glb');
  const terrain=await page.evaluate(()=>{
    const a=window.__frostbound,r=a.renderer;const before=r.chunks.size;
    r.refreshChunks();const immediately=r.chunks.size;const counts=[];
    for(let i=0;i<14;i++){r.update(1/60,performance.now()/1000,false);counts.push(r.chunks.size);}
    return {before,immediately,counts,dirty:r.dirtyChunks.size};
  });
  assert.equal(terrain.immediately,terrain.before);assert(terrain.counts.every(n=>n===25));assert.equal(terrain.dirty,0);
  await page.evaluate(()=>{const a=window.__frostbound;a.game.state.player.x=3.4;a.game.state.player.z=4;a.game.stopMovement();a.refresh();window.woodCounter=document.querySelector('[data-resource="wood"] b');window.numberPops=0;const animate=window.woodCounter.animate.bind(window.woodCounter);window.woodCounter.animate=(...args)=>{window.numberPops++;return animate(...args);};});
  const wood=await page.evaluate(()=>window.__frostbound.game.state.inventory.wood);
  await page.keyboard.press('f');try{await page.waitForSelector('.collection-flight[data-resource="wood"]');}catch(error){console.log('Collection failure state:',await page.evaluate(()=>{const a=window.__frostbound;return {mode:a.mode,paused:a.game.paused,dead:a.game.dead,wood:a.game.state.inventory.wood,context:a.context(),focus:document.activeElement?.outerHTML,message:a.game.message,flights:a.collectionEffects.flights.length};}));throw error;}
  assert.equal(await page.evaluate(()=>window.__frostbound.game.state.inventory.wood),wood+1);
  assert.equal(await page.evaluate(()=>document.querySelector('[data-resource="wood"] b')===window.woodCounter),true);
  await page.waitForTimeout(280);await page.screenshot({path:'test-results/collection-flight-desktop.png'});
  await page.waitForFunction(()=>window.numberPops>0);
  await page.waitForTimeout(300);assert.equal(await page.locator('.collection-flight').count(),0);
  assert.equal(await page.evaluate(()=>window.__frostbound.game.state.inventory.wood),wood+1);
  // Check actual visible action transitions, not only clip names in the asset.
  await page.keyboard.down('d');await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.animation==='walk');
  await page.keyboard.down('Shift');await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.animation==='sprint');
  await page.keyboard.up('Shift');await page.keyboard.up('d');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.animation==='idle');
  for(const type of ['wooden_sword','spear','machete','bow','shotgun','molotov']){
    await page.evaluate(type=>{const g=window.__frostbound.game;g.state.combat.weapons=[{id:'visual-fixture',type,uses:100}];g.state.combat.equipped=null;},type);
    await page.waitForTimeout(30);
    await page.evaluate(()=>{const g=window.__frostbound.game;g.state.combat.equipped='visual-fixture';g.state.combat.cooldown=0;g.combat.attack({x:g.state.player.x,z:g.state.player.z+8});});
    await page.waitForFunction(type=>window.__frostbound.renderer.playerCharacter.object.userData.upperAnimation===type,type);
    const socket=await page.evaluate(()=>window.__frostbound.renderer.playerCharacter.object.getObjectByName('held-weapon').parent.name);
    assert.equal(socket,type==='bow'?'HandL':'HandR');
    await page.waitForTimeout(900);
  }
  // Switching during a live swing must not animate the new bow as the old sword.
  await page.evaluate(()=>{const g=window.__frostbound.game;g.state.combat.weapons=[{id:'switch-sword',type:'wooden_sword',uses:100}];g.state.combat.equipped='switch-sword';g.state.combat.cooldown=0;g.combat.attack({x:g.state.player.x,z:g.state.player.z+2});});
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.upperAnimation==='wooden_sword');
  await page.evaluate(()=>{const g=window.__frostbound.game;g.state.combat.weapons=[{id:'switch-bow',type:'bow',uses:100}];g.state.combat.equipped='switch-bow';});
  await page.waitForFunction(()=>{const d=window.__frostbound.renderer.playerCharacter.object.userData;return d.weapon==='bow'&&d.upperAnimation!=='wooden_sword';});
  // Ranged aim keeps a real second hand at the support grip.
  await page.evaluate(()=>{const g=window.__frostbound.game;g.state.combat.weapons=[{id:'shotgun-fixture',type:'shotgun',uses:100}];g.state.combat.equipped='shotgun-fixture';g.state.combat.cooldown=0;});
  await page.mouse.move(1050,500);await page.mouse.down({button:'right'});
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.upperAnimation==='aim_shotgun');
  const gripDistance=await page.evaluate(()=>{const c=window.__frostbound.renderer.playerCharacter.object,hand=c.getObjectByName('HandL'),weapon=c.getObjectByName('held-weapon');return hand.getWorldPosition(hand.position.clone()).distanceTo(weapon.localToWorld(hand.position.clone().set(0,-.04,.44)));});
  assert(gripDistance<.04,`support grip drifted ${gripDistance}`);
  await page.screenshot({path:'test-results/survivor-shotgun-aim.png'});
  await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});
  assert.equal(await page.evaluate(()=>window.__frostbound.game.state.combat.weapons[0].uses),99);
  await page.waitForTimeout(4200);assert.equal(await page.evaluate(()=>window.__frostbound.game.state.combat.weapons[0].uses),99);
  await page.mouse.up({button:'right'});
  await page.evaluate(()=>{const a=window.__frostbound;a.renderer.zoom=10;a.renderer.yaw=.15;a.game.state.player.heading=0;});await page.waitForTimeout(350);
  await page.screenshot({path:'test-results/survivor-front.png'});
  await page.evaluate(()=>window.__frostbound.renderer.yaw=Math.PI+.2);await page.waitForTimeout(150);await page.screenshot({path:'test-results/survivor-back.png'});
  await page.evaluate(()=>{const g=window.__frostbound.game;g.combat.damage({...g.state.player,id:'player',kind:'player'},5,'test');});
  await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.animation==='hurt');
  await page.evaluate(()=>{window.__frostbound.game.state.player.hp=0;});await page.waitForSelector('#recover');
  await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.__frostbound.renderer.playerCharacter.object.userData.animation),'death');
  await page.locator('#recover').click();await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.object.userData.animation==='idle');
  // Native touch collection and a viewport change during flight.
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});attach(mobile);
  await mobile.goto('http://localhost:5173');await mobile.locator('#enter-world').tap();await mobile.locator('#resources').waitFor();await isolateStartingCamp(mobile);await mobile.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.ready);
  await mobile.evaluate(()=>{const a=window.__frostbound;a.game.state.player.x=3.4;a.game.state.player.z=4;a.refresh();});
  await mobile.locator('#touch-interact').tap();await mobile.waitForSelector('.collection-flight[data-resource="wood"]');
  await mobile.screenshot({path:'test-results/collection-flight-mobile.png'});await mobile.setViewportSize({width:844,height:390});
  await mobile.waitForTimeout(1200);assert.equal(await mobile.locator('.collection-flight').count(),0);assert.equal(await mobile.evaluate(()=>window.__frostbound.game.state.inventory.wood),13);
  // A burst may drop excess cosmetic flights, never authoritative awards.
  await mobile.evaluate(()=>{const g=window.__frostbound.game,n=g.nodes().find(n=>n.id==='starter:wood');g.state.changes.nodes[n.id]=100;for(let i=0;i<60;i++)g.gather(n);});
  await mobile.waitForSelector('.collection-flight');assert((await mobile.locator('.collection-flight').count())<=12);
  await mobile.waitForTimeout(1300);assert.equal(await mobile.locator('.collection-flight').count(),0);assert.equal(await mobile.evaluate(()=>window.__frostbound.game.state.inventory.wood),73);
  const reduced=await browser.newPage({reducedMotion:'reduce'});attach(reduced);await reduced.goto('http://localhost:5173');await reduced.locator('#enter-world').click();await reduced.locator('#resources').waitFor();await isolateStartingCamp(reduced);
  await reduced.evaluate(()=>{const a=window.__frostbound;a.game.state.player.x=3.4;a.game.state.player.z=4;a.refresh();});await reduced.keyboard.press('f');await reduced.waitForFunction(()=>window.__frostbound.game.state.inventory.wood===13);
  assert.equal(await reduced.locator('.collection-flight').count(),0);assert.equal(await reduced.evaluate(()=>window.__frostbound.game.state.inventory.wood),13);
  assert.equal(await reduced.locator('[data-resource="wood"] b').evaluate(el=>el.getAnimations().length),0);
  const fallback=await browser.newPage();attach(fallback);await fallback.route('**/models/wayfarer.glb',route=>route.abort());await fallback.goto('http://localhost:5173');
  await fallback.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.ready);assert.equal(await fallback.evaluate(()=>window.__frostbound.renderer.playerCharacter.source),'local-fallback');
  assert.deepEqual(errors,[]);console.log('Presentation browser checks passed: atomic terrain swaps, GLB/rig/fallback, locomotion/actions/damage/death, weapon hand sockets/support grip, desktop and touch collection, resize, bounded effects, single awards and reduced motion.');
}finally{await browser.close();}
