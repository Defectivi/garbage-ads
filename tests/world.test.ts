import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldSpec } from '../src/game/GameConfig';
import { WorldManager } from '../src/world/WorldManager';
import { derive, SeededRNG } from '../src/utils/SeededRNG';
test('16-bit world seeds include both limits and reject invalid values', () => { worldSpec(0); worldSpec(65535); for (const n of [-1, 65536, 1.5, NaN, Infinity]) { assert.throws(() => worldSpec(n)); assert.throws(() => worldSpec(0, n)); } });
test('coordinate-addressable streams reproduce terrain, biomes, rivers, ruins and nodes', () => {
  const a = new WorldManager(worldSpec(48192)), b = new WorldManager(worldSpec(48192));
  for (const [x, z] of [[0, 0], [-71, -45], [256, 32], [-32, 32]]) { assert.equal(a.height(x, z), b.height(x, z)); assert.deepEqual(a.river(x, z), b.river(x, z)); assert.equal(a.biome(x, z), b.biome(x, z)); }
  assert.deepEqual(a.chunk(-2, 1), b.chunk(-2, 1)); assert.deepEqual(a.ruin(0, 0), b.ruin(0, 0));
});
test('changing resource seed changes resources without affecting terrain or rivers', () => {
  const a = new WorldManager(worldSpec(42, 1)), b = new WorldManager(worldSpec(42, 2));
  assert.equal(a.height(31, 45), b.height(31, 45)); assert.deepEqual(a.river(31, 45), b.river(31, 45)); assert.deepEqual(a.chunk(1, 1).trees, b.chunk(1, 1).trees);
  assert.notDeepEqual(a.chunk(1, 1).nodes, b.chunk(1, 1).nodes);
  const spec = worldSpec(42, 1); spec.seeds.terrain = 65535; assert.deepEqual(a.chunk(1, 1).nodes, new WorldManager(spec).chunk(1, 1).nodes);
});
test('chunk load order, negative coordinates and shared boundary heights remain stable', () => {
  const a = new WorldManager(worldSpec(65535)), b = new WorldManager(worldSpec(65535)); a.chunk(1, 0); const n = a.chunk(-1, -1); b.chunk(-2, 3); b.chunk(5, 0); assert.deepEqual(n, b.chunk(-1, -1));
  for (let z = -32; z <= 32; z += 2) assert.equal(a.height(32, z), b.height(32, z));
  assert.equal(derive(0, 'terrain', -1, 0), derive(0, 'terrain', -1, 0)); assert.equal(new SeededRNG(42).next(), new SeededRNG(42).next());
});
