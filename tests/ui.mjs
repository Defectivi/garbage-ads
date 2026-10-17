import {isolateStartingCamp} from './browser-state.mjs';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined) });
mkdirSync('test-results', { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173'); await page.screenshot({ path: 'test-results/field-kit-menu.png' });
  await page.locator('#enter-world').click();await page.locator('#resources').waitFor();await isolateStartingCamp(page); await page.waitForTimeout(500); await page.screenshot({ path: 'test-results/field-kit-hud.png' });
  await page.locator('#inventory').click();
  assert.equal(await page.locator('.pack-slots .item-slot').count(), 27);
  assert.equal(await page.locator('.storage-slots .item-slot').count(), 9);
  await page.screenshot({ path: 'test-results/field-kit-inventory.png' });
  await page.locator('[data-item="fish"][data-account="inventory"]').click(); assert.match(await page.locator('.item-inspector h3').textContent(), /Fish/);
  await page.locator('#eat-fish').click(); assert.equal(await page.evaluate(() => window.__frostbound.game.state.inventory.fish), 2);
  await page.locator('#stash').click(); assert.equal(await page.evaluate(() => window.__frostbound.game.state.stockpile.wood), 12);
  await page.locator('[data-item="wood"][data-account="stockpile"]').click(); await page.locator('#take-selected').click();
  assert.equal(await page.evaluate(() => window.__frostbound.game.state.inventory.wood), 1); assert.equal(await page.evaluate(() => window.__frostbound.game.state.stockpile.wood), 11);
  await page.locator('[data-item="stone"][data-account="stockpile"]').click(); await page.locator('#take-selected').click(); assert.match(await page.locator('#dialog-status').textContent(), /Insufficient/);
  // All sandbox counts remain legible and unchanged, including negatives and large totals.
  await page.evaluate(() => { window.__frostbound.game.state.inventory.wood = -9999999; window.__frostbound.game.state.inventory.gold = 9999999; });
  await page.locator('[data-item="wood"][data-account="inventory"]').click(); assert.equal(await page.locator('[data-item="wood"][data-account="inventory"] .stack-count').textContent(), '-9999999');
  await page.keyboard.press('Escape'); await page.locator('#build').click(); await page.screenshot({ path: 'test-results/field-kit-build.png' }); await page.locator('.close-modal').click();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto('http://localhost:5173'); await mobile.screenshot({ path: 'test-results/field-kit-mobile-menu.png' }); await mobile.locator('#enter-world').tap();await mobile.locator('#resources').waitFor();await isolateStartingCamp(mobile); await mobile.waitForTimeout(300); await mobile.screenshot({ path: 'test-results/field-kit-mobile-hud.png' });
  await mobile.locator('#inventory').tap(); await mobile.screenshot({ path: 'test-results/field-kit-mobile-inventory.png' });
  const bounds = await mobile.locator('.inventory-modal').boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= 391);
  await mobile.locator('[data-item="fish"][data-account="inventory"]').tap(); await mobile.locator('#eat-fish').tap(); assert.equal(await mobile.evaluate(() => window.__frostbound.game.state.inventory.fish), 2);
  await mobile.locator('.close-modal').tap();
  await mobile.setViewportSize({ width: 844, height: 390 }); await mobile.locator('#inventory').tap(); await mobile.locator('.close-modal').tap();
  assert.deepEqual(errors, []);
  console.log('Field-kit UI checks passed: slot selection, quantities, food, storage transfers, failed-action feedback, negative/extreme balances, keyboard close, touch actions and responsive panels.');
} finally { await browser.close(); }
