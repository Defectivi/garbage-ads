import {isolateStartingCamp} from './browser-state.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined) });
const errors = [];
mkdirSync('test-results', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173');
  assert.equal(await page.title(), 'FYWS: Frostbound');
  await page.locator('#seed').fill('0'); await page.locator('#new-world').click();await isolateStartingCamp(page);
  await page.waitForFunction(() => window.__frostbound.game.state.elapsed > .2);
  assert.match(await page.locator('#seed-hud').textContent(), /SEED 0 \/ GEN 5/);
  await page.waitForFunction(() => window.__frostbound.renderer.chunks.has('2,0'));
  const outerResources = await page.evaluate(() => {
    const { game, renderer } = window.__frostbound, group = renderer.chunks.get('2,0');
    const expected = game.nodesInChunk(game.world.chunk(2,0)).filter(n => n.kind!=='tree'&&!game.world.isWater(n.x,n.z) && game.nodeRemaining(n) > 0).length;
    const rendered = group.children.filter(o => o.isInstancedMesh && (o.geometry.type === 'DodecahedronGeometry' || o.geometry.parameters.radiusTop === .4)).reduce((sum,o) => sum + o.count, 0);
    const trees=game.nodesInChunk(game.world.chunk(2,0)).filter(n=>n.kind==='tree').length,treeParts=group.children.filter(o=>o.isInstancedMesh&&o.userData.treeIds).map(o=>o.count);
    return { expected, rendered,trees,treeParts };
  });
  assert(outerResources.expected > 0); assert.equal(outerResources.rendered, outerResources.expected);assert(outerResources.treeParts.every(n=>n===outerResources.trees));if(outerResources.trees)assert.equal(outerResources.treeParts.length,7);
  const position = () => page.evaluate(() => ({ x: window.__frostbound.game.state.player.x, z: window.__frostbound.game.state.player.z }));
  await page.evaluate(() => { window.__frostbound.renderer.yaw = 0; });
  const start = await position();
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  assert((await position()).z < start.z - .3);
  // Native right mouse gesture must rotate without firing on release.
  const yaw = await page.evaluate(() => window.__frostbound.renderer.yaw);
  const attackStamp = await page.evaluate(() => window.__frostbound.game.combat.lastAttack);
  await page.mouse.move(1100, 550); await page.mouse.down({ button: 'right' });
  await page.mouse.move(1190, 550, { steps: 5 }); await page.mouse.up({ button: 'right' });
  assert(Math.abs(await page.evaluate(() => window.__frostbound.renderer.yaw) - yaw) > .5);
  assert.equal(await page.evaluate(() => window.__frostbound.game.combat.lastAttack), attackStamp);
  await page.mouse.wheel(0, 100000); assert.equal(await page.evaluate(() => window.__frostbound.renderer.zoom), 65);
  await page.mouse.wheel(0, -100000); assert.equal(await page.evaluate(() => window.__frostbound.renderer.zoom), 16);
  // Losing focus clears velocity as well as keys; it must not resume a held action.
  await page.keyboard.down('d'); await page.waitForTimeout(120);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const stopped = await position(); await page.waitForTimeout(180); assert.deepEqual(await position(), stopped);
  await page.keyboard.up('d');
  await page.locator('#saves').click();
  const typingPosition = await position();
  await page.locator('#import-text').focus(); await page.keyboard.type('wasd e 123456 space');
  assert.deepEqual(await position(), typingPosition);
  assert.equal(await page.evaluate(() => window.__frostbound.game.combat.lastAttack), attackStamp);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/phase1-desktop.png' });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto('http://localhost:5173'); await mobile.locator('#enter-world').tap();await isolateStartingCamp(mobile);
  await mobile.waitForFunction(() => window.__frostbound.game.state.elapsed > .1);
  const cdp = await mobile.context().newCDPSession(mobile);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ ...p, radiusX: 3, radiusY: 3, force: 1 })) });
  const j = await mobile.locator('#joystick').boundingBox(), center = { id: 1, x: j.x + j.width / 2, y: j.y + j.height / 2 };
  const mobilePosition = () => mobile.evaluate(() => ({ x: window.__frostbound.game.state.player.x, z: window.__frostbound.game.state.player.z }));
  const resting = await mobilePosition();
  await touch('touchStart', [{ ...center, x: center.x + 2 }]); await mobile.waitForTimeout(180);
  assert.deepEqual(await mobilePosition(), resting); await touch('touchEnd', []);
  await touch('touchStart', [center]); await touch('touchMove', [{ ...center, x: center.x + 30 }]);
  await mobile.waitForTimeout(220); await touch('touchEnd', []);
  const moved = await mobilePosition(); assert(Math.hypot(moved.x - resting.x, moved.z - resting.z) > .3);
  await mobile.evaluate(() => window.dispatchEvent(new Event('blur')));
  const mobileYaw = await mobile.evaluate(() => window.__frostbound.renderer.yaw);
  // The same native drag on left terrain does nothing, right terrain orbits.
  for (const [x, shouldOrbit] of [[30, false], [290, true]]) {
    const before = await mobile.evaluate(() => window.__frostbound.renderer.yaw);
    await touch('touchStart', [{ id: 2, x, y: 410 }]);
    await touch('touchMove', [{ id: 2, x: x + 65, y: 410 }]); await touch('touchEnd', []);
    const after = await mobile.evaluate(() => window.__frostbound.renderer.yaw);
    if (shouldOrbit) assert(Math.abs(after - before) > .4); else assert.equal(after, before);
  }
  assert.notEqual(await mobile.evaluate(() => window.__frostbound.renderer.yaw), mobileYaw);
  const sprint = await mobile.locator('#sprint-button').boundingBox();
  await touch('touchStart', [{ id: 3, x: sprint.x + sprint.width / 2, y: sprint.y + sprint.height / 2 }]);
  assert(await mobile.locator('#sprint-button').evaluate(el => el.classList.contains('selected')));
  await touch('touchEnd', []);
  assert(!(await mobile.locator('#sprint-button').evaluate(el => el.classList.contains('selected'))));
  await mobile.locator('#zoom-in').tap();
  await mobile.screenshot({ path: 'test-results/phase1-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Phase 1 browser checks passed: seed zero, keyboard movement, RMB orbit without firing, zoom limits, blur reset, typing isolation, native touch joystick/dead zone, right-side orbit, hold sprint and zoom fallback.');
} finally { await browser.close(); }
