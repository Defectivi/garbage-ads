import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync(edge)?edge:undefined)});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.locator('#seed').fill('42');await page.locator('#new-world').click();await page.locator('#resources').waitFor({timeout:60000});
 await page.keyboard.down('Escape');assert.equal(await page.locator('.pause-modal').count(),1);
 await page.keyboard.down('Escape');await page.keyboard.down('Escape');assert.equal(await page.locator('.pause-modal').count(),1);assert(await page.evaluate(()=>window.__frostbound.game.paused));
 const elapsed=await page.evaluate(()=>window.__frostbound.game.state.elapsed);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__frostbound.game.state.elapsed),elapsed);
 await page.keyboard.up('Escape');await page.keyboard.down('Escape');assert.equal(await page.locator('.pause-modal').count(),0);
 await page.keyboard.down('Escape');assert.equal(await page.locator('.pause-modal').count(),0);await page.keyboard.up('Escape');
 await page.keyboard.press('e');await page.locator('.inventory-modal').waitFor();await page.keyboard.down('Escape');await page.keyboard.down('Escape');assert.equal(await page.locator('.modal-backdrop').count(),0);await page.keyboard.up('Escape');
 await page.keyboard.press('m');await page.locator('#map-canvas').waitFor();await page.keyboard.down('Escape');await page.keyboard.down('Escape');assert.equal(await page.locator('.modal-backdrop').count(),0);await page.keyboard.up('Escape');
 await page.evaluate(()=>window.__frostbound.beginBuilding('hut'));await page.locator('.placement-bar').waitFor();await page.keyboard.down('Escape');await page.keyboard.down('Escape');assert.equal(await page.locator('.placement-bar').count(),0);assert.equal(await page.locator('.pause-modal').count(),0);await page.keyboard.up('Escape');
 await page.keyboard.press('Escape');await page.locator('.pause-modal').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.pause-modal').count(),0);
 await page.evaluate(()=>{const a=window.__frostbound;a.game.state.player.hp=0;a.refresh();});await page.locator('.death-modal').waitFor();await page.keyboard.down('Escape');await page.keyboard.down('Escape');await page.keyboard.up('Escape');assert.equal(await page.locator('.death-modal').count(),1);
 assert.deepEqual(errors,[]);console.log('Escape browser regression passed: held-key repeats cannot toggle pause twice, reopen closed inventory/map, or pause after cancelling placement; release enables the next press, pause freezes simulation, death stays protected.');
}finally{await browser.close();}
