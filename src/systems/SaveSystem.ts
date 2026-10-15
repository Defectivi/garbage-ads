import { balances, BUILDINGS, RESOURCE_IDS, type Balances, type BuildingType } from '../data/definitions';
import { GENERATION_VERSION, type Settings, type WorldSpec } from '../game/GameConfig';
import { newState, type GameState, type Point } from '../game/GameState';
const KEY = 'frostbound.world.v2';
const record = (v: unknown, path: string): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) throw new Error(`${path} must be an object.`); return v as Record<string, unknown>; };
const num = (v: unknown, path: string, min: number, max: number, integer = false) => { if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isSafeInteger(v)) || v < min || v > max) throw new Error(`${path} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`); return v; };
const id = (v: unknown, path: string) => { if (typeof v !== 'string' || !/^[A-Za-z0-9:,_-]{1,120}$/.test(v) || ['__proto__', 'constructor', 'prototype'].includes(v)) throw new Error(`${path} has an invalid entity ID.`); return v; };
const bool = (v: unknown, path: string) => { if (typeof v !== 'boolean') throw new Error(`${path} must be true or false.`); return v; };
const array = (v: unknown, path: string, max = 10000): unknown[] => { if (!Array.isArray(v) || v.length > max) throw new Error(`${path} must be an array with at most ${max} entries.`); return v; };
function point(v: unknown, path: string): Point { const p = record(v, path); return { x: num(p.x, `${path}.x`, -1000000, 1000000), z: num(p.z, `${path}.z`, -1000000, 1000000) }; }
export function validateSettings(v: unknown): Settings {
  const s = record(v, 'settings'); if (s.difficulty !== 'relaxed' && s.difficulty !== 'survival') throw new Error('Unknown survival difficulty.');
  return { difficulty: s.difficulty, renderDistance: num(s.renderDistance, 'renderDistance', 1, 3, true), sound: bool(s.sound, 'sound'), allowDebt: bool(s.allowDebt, 'allowDebt'), inventoryLimit: num(s.inventoryLimit, 'inventoryLimit', 0, 9999999, true), resourceMin: num(s.resourceMin, 'resourceMin', -9999999, -1, true), resourceMax: num(s.resourceMax, 'resourceMax', 1, 9999999, true) };
}
export function validateBalances(v: unknown, settings: Settings, path = 'resources'): Balances {
  const r = record(v, path), out = balances();
  for (const k of RESOURCE_IDS) out[k] = num(r[k], `${path}.${k}`, settings.resourceMin, settings.resourceMax, true);
  return out;
}
export function validateWorld(v: unknown): WorldSpec {
  const w = record(v, 'world');
  if (w.generationVersion !== GENERATION_VERSION) throw new Error(`Unsupported generation version ${String(w.generationVersion)}. This build supports version ${GENERATION_VERSION}; no terrain migration is attempted.`);
  const seeds = record(w.seeds, 'world.seeds'), c = record(w.config, 'world.config');
  const read = (k: string) => num(seeds[k], `seeds.${k}`, 0, 65535, true);
  return { seed: num(w.seed, 'world.seed', 0, 65535, true), generationVersion: GENERATION_VERSION, seeds: { terrain: read('terrain'), rivers: read('rivers'), biomes: read('biomes'), resources: read('resources'), ruins: read('ruins'), wildlife: read('wildlife') }, config: { chunkSize: num(c.chunkSize, 'chunkSize', 16, 64, true), initialRegionSize: num(c.initialRegionSize, 'initialRegionSize', 64, 4096, true), worldScale: num(c.worldScale, 'worldScale', .5, 4), riverDensity: num(c.riverDensity, 'riverDensity', 0, 3), ruinDensity: num(c.ruinDensity, 'ruinDensity', 0, 3), resourceDensity: num(c.resourceDensity, 'resourceDensity', 0, 3) } };
}
function numericMap(v: unknown, path: string) {
  const raw = record(v, path); if (Object.keys(raw).length > 50000) throw new Error(`${path} is too large.`);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) out[id(key, path)] = num(value, `${path}.${key}`, 0, 9999999, true);
  return out;
}
export function exportFull(state: GameState) { const { world, ...rest } = state; return JSON.stringify({ format: 'frostbound', formatVersion: 1, mode: 'full-save', world, state: rest }, null, 2); }
export function exportSandbox(state: GameState) {
  return JSON.stringify({ format: 'frostbound', formatVersion: 1, mode: 'sandbox-config', world: state.world, startingState: { resources: state.inventory, stockpile: state.stockpile, furnace: { level: state.furnaces[0].level, fuel: state.furnaces[0].fuel }, settings: state.settings } }, null, 2);
}
/** Parse into a new detached state. The live state is never referenced or mutated. */
export function importJSON(text: string, expectedMode?: 'full-save' | 'sandbox-config'): GameState {
  if (text.length > 12000000) throw new Error('JSON file is larger than 12 MB.');
  let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new Error('Invalid JSON syntax. Check commas, quotes and numeric values.'); }
  const doc = record(parsed, 'document'); if (doc.format !== 'frostbound' || doc.formatVersion !== 1) throw new Error('Unsupported save format or formatVersion. Expected frostbound formatVersion 1.');
  if (doc.mode !== 'full-save' && doc.mode !== 'sandbox-config') throw new Error('mode must be full-save or sandbox-config.');
  if (expectedMode && doc.mode !== expectedMode) throw new Error(`This is a ${String(doc.mode)} file; use the matching import mode.`);
  const world = validateWorld(doc.world);
  if (doc.mode === 'sandbox-config') {
    const start = record(doc.startingState, 'startingState'), settings = validateSettings(start.settings), fresh = newState(world, settings), f = record(start.furnace, 'startingState.furnace');
    fresh.inventory = validateBalances(start.resources, settings); fresh.stockpile = validateBalances(start.stockpile, settings, 'stockpile');
    fresh.furnaces[0].level = num(f.level, 'furnace.level', 1, 25, true); fresh.furnaces[0].fuel = num(f.fuel, 'furnace.fuel', 0, 3600);
    return fresh;
  }
  const raw = record(doc.state, 'state'), settings = validateSettings(raw.settings), player = record(raw.player, 'player'), changes = record(raw.changes, 'changes');
  const state = newState(world, settings);
  state.player = { ...point(player, 'player'), warmth: num(player.warmth, 'warmth', 0, 100), heading: num(player.heading, 'heading', -1000000, 1000000) };
  state.inventory = validateBalances(raw.inventory, settings); state.stockpile = validateBalances(raw.stockpile, settings, 'stockpile');
  state.elapsed = num(raw.elapsed, 'elapsed', 0, 1e12); state.nextId = num(raw.nextId, 'nextId', 1, 1e9, true);
  const seen = new Set<string>();
  const unique = (key: string) => { if (seen.has(key)) throw new Error(`Duplicate entity ID ${key}.`); seen.add(key); return key; };
  state.buildings = array(raw.buildings, 'buildings', 2000).map((v, i) => { const b = record(v, `building ${i}`); if (typeof b.type !== 'string' || !Object.hasOwn(BUILDINGS, b.type)) throw new Error(`Unknown building type ${String(b.type)}.`); return { id: unique(id(b.id, 'building.id')), ...point(b, 'building'), type: b.type as BuildingType, rotation: num(b.rotation, 'rotation', -1000, 1000) }; });
  state.furnaces = array(raw.furnaces, 'furnaces', 2001).map(v => { const f = record(v, 'furnace'); return { id: id(f.id, 'furnace.id'), ...point(f, 'furnace'), fuel: num(f.fuel, 'fuel', 0, 3600), level: num(f.level, 'level', 1, 25, true) }; });
  if (state.furnaces.filter(f => f.id === 'home').length !== 1 || state.furnaces[0].id !== 'home' || state.furnaces[0].x !== 0 || state.furnaces[0].z !== 0) throw new Error('Exactly one home furnace at 0,0 must be first.');
  if (new Set(state.furnaces.map(f => f.id)).size !== state.furnaces.length) throw new Error('Duplicate furnace IDs.');
  for (const b of state.buildings) if (b.type === 'furnace' && !state.furnaces.some(f => f.id === b.id && f.x === b.x && f.z === b.z)) throw new Error('A built furnace is missing its matching fuel state.');
  for (const f of state.furnaces) if (f.id !== 'home' && !state.buildings.some(b => b.id === f.id && b.type === 'furnace')) throw new Error('Outpost furnace has no building.');
  state.workers = array(raw.workers, 'workers', 2000).map(v => {
    const w = record(v, 'worker'); if (!['seeking', 'gathering', 'returning', 'blocked'].includes(String(w.state))) throw new Error('Invalid worker state.');
    const hutId = id(w.hutId, 'worker.hutId'); if (!state.buildings.some(b => b.id === hutId && b.type === 'hut')) throw new Error('Worker is missing its hut.');
    return { id: unique(id(w.id, 'worker.id')), hutId, ...point(w, 'worker'), sourceId: w.sourceId === null ? null : id(w.sourceId, 'sourceId'), state: w.state as GameState['workers'][number]['state'], load: num(w.load, 'worker.load', 0, 3, true), progress: num(w.progress, 'worker.progress', 0, 100) };
  });
  if (new Set(state.workers.map(w => w.hutId)).size !== state.workers.length) throw new Error('Only one worker per hut is supported.');
  const maxBuilt = Math.max(0, ...state.buildings.map(b => Number(b.id.split(':')[1]) || 0)); if (state.nextId <= maxBuilt) throw new Error('nextId must exceed existing building numbers.');
  state.changes.nodes = numericMap(changes.nodes, 'changes.nodes'); state.changes.fishing = numericMap(changes.fishing, 'changes.fishing');
  state.changes.containers = array(changes.containers, 'containers').map(v => id(v, 'container')); state.discovered = array(raw.discovered, 'discovered').map(v => id(v, 'discovered'));
  if (state.discovered.some(k => k !== 'home' && !/^ruin:-?\d{1,4}:-?\d{1,4}$/.test(k))) throw new Error('Discovered locations must be home or stable ruin:regionX:regionZ IDs.');
  const npcs = record(changes.npcs, 'npcs'); if (Object.keys(npcs).length > 10000) throw new Error('Too many NPC records.');
  for (const [key, value] of Object.entries(npcs)) state.changes.npcs[id(key, 'npc.id')] = { inventory: validateBalances(record(value, 'NPC').inventory, settings, 'NPC inventory') };
  return state;
}
export function saveLocal(state: GameState): ResultMessage {
  try { localStorage.setItem(KEY, exportFull(state)); return { ok: true, message: 'World saved locally.' }; } catch { return { ok: false, message: 'Local save failed: storage is unavailable or full. Export JSON to keep this world.' }; }
}
export function loadLocal() { const text = localStorage.getItem(KEY); if (!text) throw new Error('No v2 world save found.'); return importJSON(text, 'full-save'); }
interface ResultMessage { ok: boolean; message: string }
