import {isolateStartingCamp} from './browser-state.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', e => errors.push(e.stack)); mkdirSync('test-results', { recursive: true });
try {
  await page.goto('http://localhost:5173'); await page.locator('#seed').fill('42'); await page.screenshot({ path: 'test-results/v2-menu.png' });
  await page.locator('#new-world').click();await isolateStartingCamp(page); await page.waitForTimeout(700);
  // This suite exercises world/economy flows; combat and NPC sheltering have dedicated suites.
  await page.evaluate(()=>{const g=window.__frostbound.game;g.combat.ensureEncounters();for(const a of Object.values(g.state.combat.actors))a.hp=0;g.combat.ensureEncounters=()=>{};});
  const before = await page.evaluate(() => ({ ...window.__frostbound.game.state.player }));
  await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.__frostbound.game.state.player); assert(Math.hypot(after.x - before.x, after.z - before.z) > .5);
  // Travel through actual movement/collision updates, with A* over the generated world.
  await page.evaluate(async () => {
    const { route } = await import('/src/systems/Navigation.ts');
    window.walk = (target) => {
      const app = window.__frostbound, game = app.game;
      const solids = [...game.solids(game.state.player), ...game.solids(target)];
      const path = route(game.state.player, target, p => !game.world.isWater(p.x, p.z) && solids.every(s => Math.hypot(s.x - p.x, s.z - p.z) > s.radius + .8));
      if (!path.length && Math.hypot(game.state.player.x - target.x, game.state.player.z - target.z) > 2) throw new Error('No navigation route');
      for (const p of path) {
        let attempts = 90;
        while (Math.hypot(game.state.player.x - p.x, game.state.player.z - p.z) > .35 && attempts-- > 0) { const dx = p.x - game.state.player.x, dz = p.z - game.state.player.z, d = Math.hypot(dx, dz); game.update(.05, { x: dx / d, z: dz / d }); }
        if (attempts <= 0) throw new Error(`Navigation stuck at ${game.state.player.x},${game.state.player.z}`);
      }
      for (let i = 0; i < 10; i++) game.update(.05); app.refresh();
    };
    window.walk({ x: 3.8, z: 4 });
  });
  const wood = await page.evaluate(() => window.__frostbound.game.state.inventory.wood); await page.keyboard.press('f');
  await page.waitForFunction(before=>window.__frostbound.game.state.inventory.wood===before+1,wood);
  await page.evaluate(() => window.walk({ x: -4, z: 3 })); await page.keyboard.press('f'); await page.waitForFunction(()=>window.__frostbound.game.state.inventory.stone>0);
  await page.evaluate(() => window.walk({ x: 0, z: 3 })); const fuel = await page.evaluate(() => window.__frostbound.game.state.furnaces[0].fuel); await page.keyboard.press('f'); assert(await page.evaluate(() => window.__frostbound.game.state.furnaces[0].fuel) > fuel);
  await page.evaluate(()=>window.__frostbound.game.state.inventory.wood=20);await page.locator('#build').click(); await page.locator('[data-building="hut"]').click();
  await page.locator('#rotate-building').click(); await page.locator('#place-building').click();
  assert.equal(await page.evaluate(() => window.__frostbound.game.state.buildings.length), 1);
  await page.locator('#inventory').click(); await page.locator('#stash').click(); await page.locator('.close-modal').click();
  await page.locator('#saves').click(); await page.locator('#save-local').click();
  const download = page.waitForEvent('download'); await page.locator('#export-full').click(); const file = await download; await file.saveAs('test-results/exported-world.json');
  const inventoryBefore = await page.evaluate(() => JSON.stringify(window.__frostbound.game.state.inventory));
  await page.locator('#import-text').fill('{invalid'); await page.locator('#validate-import').click(); assert.match(await page.locator('#import-result').textContent(), /Invalid JSON/);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__frostbound.game.state.inventory)), inventoryBefore); assert(await page.locator('#replace-world').isHidden());
  await page.locator('#import-file').setInputFiles('test-results/exported-world.json'); await page.waitForFunction(() => document.querySelector('#import-text').value.startsWith('{')); await page.locator('#validate-import').click();
  assert(await page.locator('#replace-world').isVisible()); await page.locator('#replace-world').click(); assert.equal(await page.evaluate(() => window.__frostbound.game.state.buildings.length), 1);
  await page.locator('#map').click(); assert(await page.locator('#map-canvas').isVisible()); await page.locator('.close-modal').click();
  const fishBefore = await page.evaluate(() => window.__frostbound.game.state.inventory.fish);
  await page.evaluate(() => { const g = window.__frostbound.game, r = g.world.river(12, 48), f = g.world.around({ x: 12, z: r.center }).flatMap(c => c.fishing).sort((a, b) => Math.hypot(a.x - 12, a.z - r.center) - Math.hypot(b.x - 12, b.z - r.center))[0]; window.walk(f); });
  await page.keyboard.press('f'); assert(await page.evaluate(() => !!window.__frostbound.game.fishing));
  await page.evaluate(() => { for (let i = 0; i < 85; i++) window.__frostbound.game.update(.05); });
  assert(await page.evaluate(() => window.__frostbound.game.state.inventory.fish) > fishBefore);
  await page.evaluate(() => { const g = window.__frostbound.game, r = g.world.ruin(0, 0); window.walk({ x: r.container.x + 1.6, z: r.container.z + .6 }); }); await page.keyboard.press('f');
  assert(await page.evaluate(() => window.__frostbound.game.state.changes.containers.includes('ruin:0:0')));
  await page.evaluate(() => { const g = window.__frostbound.game, t = g.world.ruin(0, 0).trader; window.walk({ x: t.x - 1.6, z: t.z + .6 }); }); await page.keyboard.press('f');
  await page.locator('#offer').selectOption('sell-fish'); const gold = await page.evaluate(() => window.__frostbound.game.state.inventory.gold); await page.locator('#confirm-trade').click(); assert.equal(await page.evaluate(() => window.__frostbound.game.state.inventory.gold), gold + 3);
  await page.locator('#cancel-trade').click(); await page.waitForTimeout(1000); await page.screenshot({ path: 'test-results/v2-ruins.png' });
  const changed = await page.evaluate(() => JSON.stringify(window.__frostbound.game.state.changes));
  await page.evaluate(() => { const g = window.__frostbound.game; for (let x = 10; x < 160; x++) g.world.chunk(x, 30); g.world.chunk(0, 0); });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__frostbound.game.state.changes)), changed);
  await page.locator('#saves').click(); await page.locator('#edit-sandbox').click();
  const config = JSON.parse(await page.locator('#import-text').inputValue()); config.world.seed = 65535; config.startingState.resources.wood = -5000; config.startingState.resources.gold = 9999999;
  await page.locator('#import-text').fill(JSON.stringify(config)); await page.locator('#validate-import').click(); assert.equal(await page.evaluate(() => window.__frostbound.game.state.world.seed), 42);
  await page.locator('#replace-world').click();
  const fresh = await page.evaluate(() => { const s = window.__frostbound.game.state; return { wood: s.inventory.wood, gold: s.inventory.gold, x: s.player.x, buildings: s.buildings.length, discovered: s.discovered }; });
  assert.equal(fresh.wood, -5000); assert.equal(fresh.gold, 9999999); assert.equal(fresh.x, 0); assert.equal(fresh.buildings, 1); assert.deepEqual(fresh.discovered, ['home']);
  await page.locator('#settings').click(); await page.locator('#debt').check(); await page.locator('#difficulty').selectOption('survival'); await page.locator('#apply-settings').click(); assert.equal(await page.evaluate(() => window.__frostbound.game.state.settings.allowDebt), true);
  await page.locator('#menu').click(); const elapsed = await page.evaluate(() => window.__frostbound.game.state.elapsed); await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.__frostbound.game.state.elapsed), elapsed); await page.locator('#resume').click();
  // Actual touch events in a separate mobile browser context.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); mobile.on('pageerror', e => errors.push(e.stack));
  await mobile.goto('http://localhost:5173'); await mobile.locator('#seed').fill('42');await mobile.locator('#new-world').tap();await isolateStartingCamp(mobile);await mobile.waitForFunction(()=>window.__frostbound.renderer.chunks.size===25&&window.__frostbound.game.state.elapsed>.1);await mobile.evaluate(()=>{const g=window.__frostbound.game;for(const a of Object.values(g.state.combat.actors))a.hp=0;g.combat.ensureEncounters=()=>{};});const j = await mobile.locator('#joystick').boundingBox();
  const position = await mobile.evaluate(() => ({ ...window.__frostbound.game.state.player }));
  const cdp=await mobile.context().newCDPSession(mobile),center={x:j.x+j.width/2,y:j.y+j.height/2,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...center,x:center.x+28}]});await mobile.waitForTimeout(350);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const moved = await mobile.evaluate(() => window.__frostbound.game.state.player); assert(Math.hypot(moved.x - position.x, moved.z - position.z) > .3);
  await mobile.locator('#inventory').tap(); await mobile.locator('.close-modal').tap(); await mobile.locator('#build').tap(); await mobile.locator('[data-building="hut"]').tap(); await mobile.locator('#cancel-building').tap();
  await mobile.screenshot({ path: 'test-results/v2-mobile.png' }); await mobile.setViewportSize({ width: 844, height: 390 }); await mobile.waitForTimeout(250); await mobile.screenshot({ path: 'test-results/v2-landscape.png' });
  assert.deepEqual(errors, []); console.log('V2 browser checks passed: movement, real wood/stone collection, fuel, rotated hut placement, inventory/storage, JSON downloads/full restore, invalid-import preservation, map, fishing, ruin chest, NPC barter, chunk modifications, fresh sandbox with negative balances, settings, pause and touch controls.');
} finally { await browser.close(); }
