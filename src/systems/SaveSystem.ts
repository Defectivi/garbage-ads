import { STRUCTURE_HP } from '../data/settlement';
import { balances, BUILDINGS, RESOURCE_IDS, type Balances, type BuildingType } from '../data/definitions';
import { GENERATION_VERSION, type Settings, type WorldSpec } from '../game/GameConfig';
import { newState, type GameState, type Point } from '../game/GameState';
import { WorldManager } from '../world/WorldManager';
import { freshCombat, type CombatState } from '../game/CombatState';
import { ACTOR_HP, WEAPONS, type WeaponType, type ActorType } from '../data/weapons';
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
  if (![1, 2, GENERATION_VERSION].includes(w.generationVersion as number)) throw new Error(`Unsupported generation version ${String(w.generationVersion)}. Supported terrain generations: 1, 2 and ${GENERATION_VERSION}.`);
  const seeds = record(w.seeds, 'world.seeds'), c = record(w.config, 'world.config');
  const read = (k: string) => num(seeds[k], `seeds.${k}`, 0, 65535, true);
  // Legacy worlds used wildlife for village guards and equipment drops. Preserve those outcomes.
  const independent = (k: 'villages' | 'loot') => seeds[k] === undefined && Number(w.generationVersion) < 3 ? read('wildlife') : read(k);
  return { seed: num(w.seed, 'world.seed', 0, 65535, true), generationVersion: Number(w.generationVersion), seeds: { terrain: read('terrain'), rivers: read('rivers'), biomes: read('biomes'), resources: read('resources'), ruins: read('ruins'), wildlife: read('wildlife'), villages: independent('villages'), loot: independent('loot') }, config: { chunkSize: num(c.chunkSize, 'chunkSize', 16, 64, true), initialRegionSize: num(c.initialRegionSize, 'initialRegionSize', 64, 4096, true), worldScale: num(c.worldScale, 'worldScale', .5, 4), riverDensity: num(c.riverDensity, 'riverDensity', 0, 3), ruinDensity: num(c.ruinDensity, 'ruinDensity', 0, 3), resourceDensity: num(c.resourceDensity, 'resourceDensity', 0, 3) } };
}
function numericMap(v: unknown, path: string) {
  const raw = record(v, path); if (Object.keys(raw).length > 50000) throw new Error(`${path} is too large.`);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) out[id(key, path)] = num(value, `${path}.${key}`, 0, 9999999, true);
  return out;
}
function weaponType(v: unknown): WeaponType { if (typeof v !== 'string' || !Object.hasOwn(WEAPONS, v)) throw new Error('Unknown weapon type.'); return v as WeaponType; }
function validateEquipment(v: unknown) {
  const e = record(v, 'equipment'), seen = new Set<string>();
  const weapons = array(e.weapons, 'weapons', 500).map(v => { const w = record(v, 'weapon'), key = id(w.id, 'weapon.id'); if (seen.has(key)) throw new Error('Duplicate weapon ID.'); seen.add(key); return { id: key, type: weaponType(w.type), uses: num(w.uses, 'weapon.uses', 0, 100, true) }; });
  const equipped = e.equipped === null ? null : id(e.equipped, 'equipped'); if (equipped && !weapons.some(w => w.id === equipped)) throw new Error('Equipped weapon does not exist.'); return { weapons, equipped };
}
function validateCombat(v: unknown): CombatState {
  const raw = record(v, 'combat'), fresh = freshCombat(), equipment = validateEquipment(raw); fresh.weapons = equipment.weapons; fresh.equipped = equipment.equipped;
  fresh.cooldown = num(raw.cooldown, 'cooldown', 0, 4); fresh.sequence = num(raw.sequence, 'combat.sequence', 1, 1e9, true); fresh.kills = num(raw.kills, 'kills', 0, 1e9, true);
  const actors = record(raw.actors, 'actors'); if (Object.keys(actors).length > 15000) throw new Error('Too many combat actors.');
  for (const [key, value] of Object.entries(actors)) {
    const a = record(value, 'actor'); if (typeof a.type !== 'string' || !Object.hasOwn(ACTOR_HP, a.type)) throw new Error('Unknown actor type.'); const type = a.type as ActorType;
    if (a.id !== key) throw new Error('Actor ID does not match its record key.');
    fresh.actors[id(key, 'actor.id')] = { id: key, type, ...point(a, 'actor'), hp: num(a.hp, 'actor.hp', 0, ACTOR_HP[type]), weapon: a.weapon === null ? null : weaponType(a.weapon), groupId: id(a.groupId, 'groupId'), villageId: a.villageId === null ? null : id(a.villageId, 'villageId'), homeX: num(a.homeX, 'homeX', -1e6, 1e6), homeZ: num(a.homeZ, 'homeZ', -1e6, 1e6), heading: num(a.heading, 'heading', -1000, 1000), cooldown: num(a.cooldown, 'actor.cooldown', 0, 5), roamTimer: num(a.roamTimer, 'roamTimer', -1, 10), targetX: num(a.targetX, 'targetX', -1e6, 1e6), targetZ: num(a.targetZ, 'targetZ', -1e6, 1e6), alerted: bool(a.alerted, 'alerted'), ...(a.heatInside === undefined ? {} : {heatInside: bool(a.heatInside,'heatInside')}) };
  }
  for (const key of ['encounters', 'villageAlerts', 'charredNodes', 'charredTrees'] as const) fresh[key] = array(raw[key], key, 50000).map(v => id(v, key));
  fresh.projectiles = array(raw.projectiles, 'projectiles', 1000).map(v => {
    const p = record(v, 'projectile'); if (!['arrow', 'pellet', 'bottle', 'swing'].includes(String(p.kind))) throw new Error('Unknown projectile kind.');
    return { id: id(p.id, 'projectile.id'), ownerId: id(p.ownerId, 'ownerId'), kind: p.kind as CombatState['projectiles'][number]['kind'], ...point(p, 'projectile'), targetX: num(p.targetX, 'targetX', -1e6, 1e6), targetZ: num(p.targetZ, 'targetZ', -1e6, 1e6), fromX: num(p.fromX, 'fromX', -1e6, 1e6), fromZ: num(p.fromZ, 'fromZ', -1e6, 1e6), age: num(p.age, 'age', 0, 10), duration: num(p.duration, 'duration', .01, 10), damage: num(p.damage, 'damage', 0, 100), ...(p.weapon===undefined?{}:{weapon:p.weapon==='punch'?'punch' as const:weaponType(p.weapon)}), ...(p.weaponId===undefined?{}:{weaponId:id(p.weaponId,'projectile.weaponId')}), ...(p.hitIds===undefined?{}:{hitIds:array(p.hitIds,'hitIds',2000).map(v=>id(v,'hitId'))}), ...(p.volleyId===undefined?{}:{volleyId:id(p.volleyId,'volleyId')}), ...(p.wearCharged===undefined?{}:{wearCharged:bool(p.wearCharged,'wearCharged')}) };
  });
  fresh.fires = array(raw.fires, 'fires', 500).map(v => { const f = record(v, 'fire'); return { ...point(f, 'fire'), id: id(f.id, 'fire.id'), ownerId: id(f.ownerId, 'ownerId'), remaining: num(f.remaining, 'fire.remaining', 0, 10), tick: num(f.tick, 'fire.tick', 0, 1), charred: bool(f.charred, 'charred') }; });
  fresh.drops = array(raw.drops, 'drops', 1000).map(v => { const d = record(v, 'drop'); return { ...point(d, 'drop'), id: id(d.id, 'drop.id'), weapon: weaponType(d.weapon), uses: num(d.uses, 'drop.uses', 0, 100, true) }; });
  const statuses = record(raw.statuses, 'statuses'); if (Object.keys(statuses).length > 10000) throw new Error('Too many status effects.');
  for (const [key, value] of Object.entries(statuses)) { const status = record(value, 'status'); fresh.statuses[id(key, 'status.id')] = { bleed: num(status.bleed, 'bleed', 0, 10), tick: num(status.tick, 'bleed tick', 0, 1) }; }
  const w = record(raw.weather, 'weather'); if (w.mode !== 'clear' && w.mode !== 'snow') throw new Error('Weather must be clear or snow.'); fresh.weather = { mode: w.mode, remaining: num(w.remaining, 'weather.remaining', 0, 300), cycle: num(w.cycle, 'weather.cycle', 0, 1e9, true) };
  return fresh;
}
export function exportFull(state: GameState) { const { world, ...rest } = state; return JSON.stringify({ format: 'frostbound', formatVersion: 2, mode: 'full-save', world, state: rest }, null, 2); }
export function exportSandbox(state: GameState) {
  return JSON.stringify({ format: 'frostbound', formatVersion: 2, mode: 'sandbox-config', world: state.world, startingState: { resources: state.inventory, stockpile: state.stockpile, furnace: { level: state.furnaces[0].level, fuel: state.furnaces[0].fuel, charcoal: state.furnaces[0].charcoal }, equipment: { weapons: state.combat.weapons, equipped: state.combat.equipped }, settings: state.settings } }, null, 2);
}
/** Parse into a new detached state. The live state is never referenced or mutated. */
export function importJSON(text: string, expectedMode?: 'full-save' | 'sandbox-config'): GameState {
  if (text.length > 12000000) throw new Error('JSON file is larger than 12 MB.');
  let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new Error('Invalid JSON syntax. Check commas, quotes and numeric values.'); }
  const doc = record(parsed, 'document'); if (doc.format !== 'frostbound' || ![1, 2].includes(doc.formatVersion as number)) throw new Error('Unsupported save format or formatVersion. Expected frostbound formatVersion 1 or 2.');
  if (doc.formatVersion === 1) {
    const body = record(doc.mode === 'sandbox-config' ? doc.startingState : doc.state, 'legacy state');
    for (const k of [doc.mode === 'sandbox-config' ? 'resources' : 'inventory', 'stockpile']) { const r = record(body[k], k); r.charcoal ??= 0; }
    if (doc.mode === 'full-save') {
      record(body.player, 'player').hp ??= 100; body.combat = freshCombat();
      for (const f of array(body.furnaces, 'furnaces')) record(f, 'furnace').charcoal ??= 0;
      for (const w of array(body.workers, 'workers')) record(w, 'worker').hp ??= 100;
      for (const value of Object.values(record(record(body.changes, 'changes').npcs, 'npcs'))) { const npc = record(value, 'npc'); npc.hp ??= 100; record(npc.inventory, 'NPC inventory').charcoal ??= 0; }
    }
  }
  if (doc.mode !== 'full-save' && doc.mode !== 'sandbox-config') throw new Error('mode must be full-save or sandbox-config.');
  if (expectedMode && doc.mode !== expectedMode) throw new Error(`This is a ${String(doc.mode)} file; use the matching import mode.`);
  const world = validateWorld(doc.world);
  if (doc.mode === 'sandbox-config') {
    const start = record(doc.startingState, 'startingState'), settings = validateSettings(start.settings), fresh = newState(world, settings), f = record(start.furnace, 'startingState.furnace');
    fresh.inventory = validateBalances(start.resources, settings); fresh.stockpile = validateBalances(start.stockpile, settings, 'stockpile');
    fresh.furnaces[0].level = num(f.level, 'furnace.level', 1, 25, true); fresh.furnaces[0].fuel = num(f.fuel, 'furnace.fuel', 0, 3600);
    fresh.furnaces[0].charcoal = num(f.charcoal ?? 0, 'furnace.charcoal', 0, 3600);
    if (start.equipment !== undefined) { const equipment = validateEquipment(start.equipment); fresh.combat.weapons = equipment.weapons; fresh.combat.equipped = equipment.equipped; fresh.combat.sequence = Math.max(1, ...equipment.weapons.map(w => Number(w.id.split(':').at(-1)) + 1 || 1)); }
    return fresh;
  }
  const raw = record(doc.state, 'state'), settings = validateSettings(raw.settings), player = record(raw.player, 'player'), changes = record(raw.changes, 'changes');
  const state = newState(world, settings);
  state.player = { ...point(player, 'player'), warmth: num(player.warmth, 'warmth', 0, 100), hp: num(player.hp, 'hp', 0, 100), heading: num(player.heading, 'heading', -1000000, 1000000), ...(player.invulnerable===undefined?{}:{invulnerable:num(player.invulnerable,'invulnerable',0,5)}), ...(player.heatTime===undefined?{}:{heatTime:num(player.heatTime,'heatTime',0,3)}) };
  state.combat = validateCombat(raw.combat);
  state.inventory = validateBalances(raw.inventory, settings); state.stockpile = validateBalances(raw.stockpile, settings, 'stockpile');
  state.elapsed = num(raw.elapsed, 'elapsed', 0, 1e12); state.nextId = num(raw.nextId, 'nextId', 1, 1e9, true);
  const seen = new Set<string>();
  const unique = (key: string) => { if (seen.has(key)) throw new Error(`Duplicate entity ID ${key}.`); seen.add(key); return key; };
  state.buildings = array(raw.buildings, 'buildings', 2000).map((v, i) => { const b = record(v, `building ${i}`); if (typeof b.type !== 'string' || !Object.hasOwn(BUILDINGS, b.type)) throw new Error(`Unknown building type ${String(b.type)}.`); return { id: unique(id(b.id, 'building.id')), ...point(b, 'building'), type: b.type as BuildingType, rotation: num(b.rotation, 'rotation', -1000, 1000) }; });
  state.furnaces = array(raw.furnaces, 'furnaces', 2001).map(v => { const f = record(v, 'furnace'); return { id: id(f.id, 'furnace.id'), ...point(f, 'furnace'), fuel: num(f.fuel, 'fuel', 0, 3600), charcoal: num(f.charcoal, 'charcoal', 0, 3600), level: num(f.level, 'level', 1, 25, true) }; });
  if (state.furnaces.filter(f => f.id === 'home').length !== 1 || state.furnaces[0].id !== 'home' || state.furnaces[0].x !== 0 || state.furnaces[0].z !== 0) throw new Error('Exactly one home furnace at 0,0 must be first.');
  if (new Set(state.furnaces.map(f => f.id)).size !== state.furnaces.length) throw new Error('Duplicate furnace IDs.');
  if(raw.respawnFurnaceId !== undefined){state.respawnFurnaceId=id(raw.respawnFurnaceId,'respawnFurnaceId');if(!state.furnaces.some(f=>f.id===state.respawnFurnaceId))throw new Error('Respawn furnace does not exist.');}
  for (const b of state.buildings) if (b.type === 'furnace' && !state.furnaces.some(f => f.id === b.id && f.x === b.x && f.z === b.z)) throw new Error('A built furnace is missing its matching fuel state.');
  for (const f of state.furnaces) if (f.id !== 'home' && !state.buildings.some(b => b.id === f.id && b.type === 'furnace') && !new WorldManager(world).villages().some(v => `${v.id}:furnace` === f.id && v.x === f.x && v.z + 1 === f.z)) throw new Error('Outpost furnace has no building or fixed village.');
  state.workers = array(raw.workers, 'workers', 2000).map(v => {
    const w = record(v, 'worker'); if (!['seeking', 'gathering', 'returning', 'blocked'].includes(String(w.state))) throw new Error('Invalid worker state.');
    const hutId = id(w.hutId, 'worker.hutId'); if (!state.buildings.some(b => b.id === hutId && b.type === 'hut')) throw new Error('Worker is missing its hut.');
    return { id: unique(id(w.id, 'worker.id')), hutId, hp: num(w.hp, 'worker.hp', 0, 100), ...point(w, 'worker'), sourceId: w.sourceId === null ? null : id(w.sourceId, 'sourceId'), state: w.state as GameState['workers'][number]['state'], load: num(w.load, 'worker.load', 0, 3, true), progress: num(w.progress, 'worker.progress', 0, 100) };
  });
  if (new Set(state.workers.map(w => w.hutId)).size !== state.workers.length) throw new Error('Only one worker per hut is supported.');
  const maxBuilt = Math.max(0, ...state.buildings.map(b => Number(b.id.split(':')[1]) || 0)); if (state.nextId <= maxBuilt) throw new Error('nextId must exceed existing building numbers.');
  if(changes.terrain!==undefined){const terrain=record(changes.terrain,'terrain');if(Object.keys(terrain).length>50000)throw new Error('Too many terrain changes.');for(const [key,value] of Object.entries(terrain)){if(value!=='felled'&&value!=='broken')throw new Error('Unknown terrain change.');state.changes.terrain![id(key,'terrain.id')]=value;}}
  state.changes.nodes = numericMap(changes.nodes, 'changes.nodes'); state.changes.fishing = numericMap(changes.fishing, 'changes.fishing');
  state.changes.containers = array(changes.containers, 'containers').map(v => id(v, 'container')); state.discovered = array(raw.discovered, 'discovered').map(v => id(v, 'discovered'));
  if (state.discovered.some(k => k !== 'home' && !/^ruin:-?\d{1,4}:-?\d{1,4}$/.test(k) && !new WorldManager(world).villages().some(v => v.id === k))) throw new Error('Unknown discovered location ID.');
  const npcs = record(changes.npcs, 'npcs'); if (Object.keys(npcs).length > 10000) throw new Error('Too many NPC records.');
  for (const [key, value] of Object.entries(npcs)) state.changes.npcs[id(key, 'npc.id')] = { inventory: validateBalances(record(value, 'NPC').inventory, settings, 'NPC inventory'), hp: num(record(value, 'NPC').hp, 'NPC.hp', 0, 100) };
  const worldManager=new WorldManager(world);
  const resolveStructure=(key:string)=>{
    const placed=state.buildings.find(b=>b.id===key);if(placed)return placed;
    const furnace=state.furnaces.find(f=>f.id===key);if(furnace)return{...furnace,type:'furnace' as const};
    const match=/^house:(village:[a-z]+|ruin:-?\d+:-?\d+):(\d+)$/.exec(key);if(!match)return undefined;
    const settlement=match[1].startsWith('village:')?worldManager.villages().find(v=>v.id===match[1]):worldManager.ruin(Number(match[1].split(':')[1]),Number(match[1].split(':')[2]));
    return settlement&&Number(match[2])<settlement.houses?{type:'hut' as const}:undefined;
  };
  if(changes.structures!==undefined){const structures=record(changes.structures,'structures');if(Object.keys(structures).length>10000)throw new Error('Too many structure changes.');for(const [key,value]of Object.entries(structures)){
    id(key,'structure.id');const structure=resolveStructure(key);if(!structure)throw new Error('Unknown structure.');const raw=record(value,'integrity');if(!['intact','ruin','gone'].includes(String(raw.stage)))throw new Error('Invalid structure stage.');const stage=raw.stage as 'intact'|'ruin'|'gone',hp=num(raw.hp,'structure.hp',0,STRUCTURE_HP[structure.type]);if(stage==='gone'&&hp!==0||stage!=='gone'&&hp===0||stage==='ruin'&&hp>STRUCTURE_HP[structure.type]*.25)throw new Error('Invalid structure HP for its stage.');state.changes.structures![key]={stage,hp};
  }}
  if(changes.refuges!==undefined){const refuges=record(changes.refuges,'refuges');if(Object.keys(refuges).length>12000)throw new Error('Too many sheltering NPCs.');for(const[key,value]of Object.entries(refuges)){
    id(key,'refuge.npc');const npcKey=key.startsWith('npc:')?key.slice(4):'',ruin=/^ruin:(-?\d+):(-?\d+)$/.exec(npcKey),knownNpc=worldManager.villages().some(v=>v.id===npcKey)||!!ruin&&!!worldManager.ruin(Number(ruin[1]),Number(ruin[2]));if(!state.workers.some(w=>w.id===key)&&!knownNpc&&state.combat.actors[key]?.type!=='guard')throw new Error('Unknown sheltered NPC.');const raw=record(value,'refuge'),houseId=id(raw.houseId,'houseId');if(!resolveStructure(houseId))throw new Error('Shelter does not exist.');if(!['fleeing','hidden','returning'].includes(String(raw.phase)))throw new Error('Invalid refuge phase.');state.changes.refuges![key]={...point(raw,'refuge'),houseId,homeX:num(raw.homeX,'homeX',-1e6,1e6),homeZ:num(raw.homeZ,'homeZ',-1e6,1e6),remaining:num(raw.remaining,'refuge.remaining',0,12),phase:raw.phase as 'fleeing'|'hidden'|'returning'};
  }}
  if(changes.lootTaken!==undefined){state.changes.lootTaken=array(changes.lootTaken,'lootTaken',50000).map(v=>id(v,'lootTaken'));if(state.changes.lootTaken.some(key=>!worldManager.villages().some(v=>Array.from({length:6},(_,i)=>`supplies:${v.id}:${i}`).includes(key))))throw new Error('Unknown village loot pile.');if(new Set(state.changes.lootTaken).size!==state.changes.lootTaken.length)throw new Error('Duplicate looted pile.');}
  if(changes.groundLoot!==undefined){const loot=record(changes.groundLoot,'groundLoot');if(Object.keys(loot).length>5000)throw new Error('Too many loot piles.');for(const[key,value]of Object.entries(loot)){
    id(key,'loot.id');const raw=record(value,'loot');if(raw.id!==key)throw new Error('Loot ID does not match key.');const resources=record(raw.resources,'loot.resources'),items:Partial<Balances>={};if(Object.keys(resources).some(key=>!RESOURCE_IDS.includes(key as keyof Balances)))throw new Error('Unknown loot material.');for(const resource of RESOURCE_IDS)if(resources[resource]!==undefined)items[resource]=num(resources[resource],'loot.quantity',0,9999,true);state.changes.groundLoot![key]={id:key,...point(raw,'loot'),resources:items,...(raw.weapon===undefined?{}:{weapon:weaponType(raw.weapon)})};
  }}
  return state;
}
export function saveLocal(state: GameState): ResultMessage {
  try { localStorage.setItem(KEY, exportFull(state)); return { ok: true, message: 'World saved locally.' }; } catch { return { ok: false, message: 'Local save failed: storage is unavailable or full. Export JSON to keep this world.' }; }
}
export function loadLocal() { const text = localStorage.getItem(KEY); if (!text) throw new Error('No v2 world save found.'); return importJSON(text, 'full-save'); }
interface ResultMessage { ok: boolean; message: string }
