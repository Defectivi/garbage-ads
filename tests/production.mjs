import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined) });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4173'); await page.locator('#seed').fill('0'); await page.locator('#new-world').click();
  await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d');
  assert.match(await page.locator('#seed-hud').textContent(), /SEED 0/);
  assert.equal(await page.evaluate(() => typeof window.__frostbound), 'undefined');
  await page.locator('#inventory').click(); await page.locator('.close-modal').click();
  await page.locator('#menu').click(); await page.locator('#resume').click(); assert.deepEqual(errors, []);
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
  });
  await unsupported.goto('http://localhost:4173'); await unsupported.waitForSelector('.error-screen');
  assert.match(await unsupported.locator('.error-screen').textContent(), /WebGL/);
  console.log('Production smoke passed: seed zero, game/UI, keyboard input, pause, development hooks excluded, graceful WebGL failure.');
} finally { await browser.close(); }
