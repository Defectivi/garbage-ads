import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balances } from '../src/data/definitions';
import { DEFAULT_SETTINGS, worldSpec } from '../src/game/GameConfig';
import {simulationState as newState} from './fixtures/state';
import { Game } from '../src/game/Game';
import { transact, exchange } from '../src/systems/InventorySystem';
import { importJSON, exportFull, exportSandbox } from '../src/systems/SaveSystem';
const rules = { ...DEFAULT_SETTINGS };
test('transactions allow legitimate negative balances but enforce finite integer limits atomically', () => {
  const a = balances({ wood: -500, stone: 9999999 }); assert(transact([{ account: a, delta: { wood: 2 } }], rules).ok); assert.equal(a.wood, -498);
  const before = { ...a }; assert(!transact([{ account: a, delta: { wood: 10, stone: 1 } }], rules).ok); assert.deepEqual(a, before);
  for (const n of [NaN, Infinity, 1.1, 1e30]) assert(!transact([{ account: a, delta: { wood: n } }], rules).ok);
  assert(transact([{ account: a, delta: { wood: -50 } }], { ...rules, allowDebt: true }).ok); assert.equal(a.wood, -548);
  assert(!transact([{ account: a, delta: { wood: -1 } }], rules).ok);
});
test('barter updates both parties, rejects shortfalls and respects carried capacity', () => {
  const player = balances({ fish: 40 }), npc = balances({ metal: 10 });
  assert(exchange(player, npc, { fish: 40 }, { metal: 10 }, rules).ok); assert.equal(player.metal, 10); assert.equal(npc.fish, 40); assert.equal(npc.metal, 0);
  const before = [structuredClone(player), structuredClone(npc)]; assert(!exchange(player, npc, { gold: 1 }, { wood: 5 }, rules).ok); assert.deepEqual([player, npc], before);
  assert(!exchange(player, npc, { metal: 1 }, { fish: 40 }, rules, 12).ok); assert.deepEqual([player, npc], before);
});
test('full save round trip preserves negative extremes, modifications, NPC inventories and seed streams', () => {
  const s = newState(worldSpec(0, 65535)); s.inventory.wood = -9999999; s.stockpile.gold = 9999999; s.changes.nodes['starter:wood'] = 0; s.changes.containers.push('ruin:0:0'); s.changes.npcs['npc:ruin:0:0'] = { inventory: balances({ fish: -20 }), hp: 100 };
  assert.deepEqual(importJSON(exportFull(s)), s);
});
test('sandbox import is clean and never restores previous positions, buildings or discoveries', () => {
  const s = newState(worldSpec(12)); s.player.x = 200; s.inventory.fish = -42; s.buildings.push({ id: 'built:1', type: 'hut', x: 8, z: 5, rotation: 0 }); s.nextId = 2; s.discovered.push('ruin:3:2'); s.changes.nodes['starter:wood'] = 0;
  const fresh = importJSON(exportSandbox(s), 'sandbox-config'); assert.equal(fresh.inventory.fish, -42); assert.equal(fresh.player.x, 0); assert.deepEqual(fresh.buildings.map(b=>b.id), ['starter:hut']);assert.equal(fresh.workers.length,2); assert.deepEqual(fresh.changes.nodes, {}); assert.deepEqual(fresh.discovered, ['home']);
});
test('invalid JSON, versions, seeds, numeric balances, IDs and structures are rejected without live mutation', () => {
  const live = newState(worldSpec(42)), baseline = exportFull(live);
  for (const mutate of [(d: any) => d.world.seed = -1, (d: any) => d.formatVersion = 99, (d: any) => d.world.generationVersion = 99, (d: any) => d.state.inventory.wood = 1e12, (d: any) => d.state.inventory.wood = null, (d: any) => d.state.player.x = '3', (d: any) => d.state.furnaces = [], (d: any) => d.state.discovered = ['<script>']]) {
    const doc = JSON.parse(baseline); mutate(doc); assert.throws(() => importJSON(JSON.stringify(doc))); assert.equal(exportFull(live), baseline);
  }
  assert.throws(() => importJSON('{broken')); assert.throws(() => importJSON(exportSandbox(live), 'full-save'));
});
test('movement, gathering wood and stone, furnace fuel and cold exposure are connected', () => {
  const game = new Game(newState(worldSpec(42), { difficulty: 'survival' })); game.paused = false;
  const wood = game.nodes().find(n => n.id === 'starter:wood')!; game.state.player.x = 3.4; assert(game.gather(wood).ok); assert.equal(game.state.inventory.wood, 13);
  game.state.player.x = -3.8; game.state.player.z = 3; const stone = game.nodes().find(n => n.id === 'starter:stone')!; assert(game.gather(stone).ok); assert.equal(game.state.inventory.stone, 1);
  game.state.player.x = 0; game.state.player.z = 3; assert(game.feed().ok); const fuel = game.state.furnaces[0].fuel;
  game.state.player.warmth = 50; game.update(.1); assert(game.state.player.warmth > 50); assert(game.state.furnaces[0].fuel < fuel);
  game.state.player.x = 18; const warmth = game.state.player.warmth; game.update(.1, { x: 1, z: 0 }); assert(game.state.player.x > 18); assert(game.state.player.warmth < warmth);
});
test('build, save, unload and revisit retain placed structure and depleted nodes', () => {
  const game = new Game(newState(worldSpec(42)));game.state.inventory.wood=27; assert(game.build('hut', { x: 8, z: 4 }, 0).ok); assert.equal(game.state.inventory.wood, 7); assert.equal(game.state.workers.length, 0);
  const snapshot = exportFull(game.state), before = game.state.inventory.wood; assert(!game.build('hut', { x: 0, z: 0 }, 0).ok); assert.equal(game.state.inventory.wood, before);
  game.state.changes.nodes['starter:wood'] = 0; for (let x = -150; x <= 150; x++) game.world.chunk(x, 9); const node = game.world.chunk(0, 0).nodes.find(n => n.id === 'starter:wood')!; assert.equal(game.nodeRemaining(node), 0);
  const loaded = new Game(importJSON(snapshot)); assert.deepEqual(loaded.state.buildings, game.state.buildings); assert.equal(loaded.state.workers.length, 0);
});
test('river identifies wet crossings and dry bridges; valid fishing yields consumable inventory', () => {
  const game = new Game(newState(worldSpec(42))); game.paused = false; const r = game.world.river(12, 48); assert(game.world.isWater(12, r.center)); assert(!game.world.isWater(0, game.world.river(0, 48).center));
  const spot = game.world.around({ x: 12, z: r.center }, 1).flatMap(c => c.fishing)[0]; assert(spot); game.state.player.x = spot.x; game.state.player.z = spot.z;
  const old = game.state.inventory.fish; assert(game.startFishing(spot).ok); for (let i = 0; i < 42; i++) game.update(.1); assert(game.state.inventory.fish > old); assert(game.state.changes.fishing[spot.id] > 0);
  game.state.player.warmth = 40; assert(game.eat('fish').ok); assert.equal(game.state.player.warmth, 75);
});
test('generated ruins support persistent chest salvage and real NPC barter', () => {
  const game = new Game(newState(worldSpec(42))), r = game.world.ruin(0, 0)!; game.state.player = { ...game.state.player, ...r.container }; assert(game.search(r).ok); assert(!game.search(r).ok);
  game.state.player = { ...game.state.player, ...r.trader }; game.state.inventory.fish = 40; const npc = game.npc(r); assert(game.trade(r, 'barter-metal').ok); assert.equal(game.state.inventory.fish, 0); assert.equal(game.npc(r).inventory.metal, npc.inventory.metal - 10);
  const loaded = new Game(importJSON(exportFull(game.state))); assert.equal(loaded.npc(r).inventory.metal, game.npc(r).inventory.metal); assert(loaded.state.changes.containers.includes(r.id));
});
test('a hut worker harvests finite timber and delivers it physically into storage', () => {
  const game = new Game(newState(worldSpec(42))); game.paused = false;game.state.inventory.wood=20; assert(game.build('hut', { x: 8, z: 4 }, 0).ok);
  for (let i = 0; i < 1500 && game.state.stockpile.wood === 0; i++) game.update(.05);
  assert(game.state.stockpile.wood > 0, JSON.stringify(game.state.workers));
  assert(Object.keys(game.state.changes.nodes).length > 0);
  const loaded = new Game(importJSON(exportFull(game.state))); loaded.paused = false;
  for (let i = 0; i < 100; i++) loaded.update(.05); assert(loaded.state.workers.length === 2);
});
