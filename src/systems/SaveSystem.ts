import {noteLabel} from './MapJournal';
import {HARDSHIPS} from './Difficulty';
import { structureMaxHP } from '../data/settlement';
import { balances, BUILDINGS, CONSTRUCTION_SECONDS, RESOURCE_IDS, type Balances, type BuildingType } from '../data/definitions';
import { GENERATION_VERSION, INT32_MIN,INT32_MAX,UINT32_MAX,parseSeed, type Settings, type WorldSpec } from '../game/GameConfig';
import { newState, maxPlayerHP, type GameState, type Point } from '../game/GameState';
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
  const s = record(v, 'settings'),legacyBounds=s.resourceMin===-9999999&&s.resourceMax===9999999; if (s.difficulty !== 'relaxed' && s.difficulty !== 'survival') throw new Error('Unknown survival difficulty.');
  return { ...(s.budgetMeal===undefined?{}:{budgetMeal:bool(s.budgetMeal,'budgetMeal')}),...(s.showFPS===undefined?{}:{showFPS:bool(s.showFPS,'showFPS')}),difficulty: s.difficulty, renderDistance: num(s.renderDistance, 'renderDistance', 1, 3, true), sound: bool(s.sound, 'sound'), allowDebt: bool(s.allowDebt, 'allowDebt'), inventoryLimit: num(s.inventoryLimit, 'inventoryLimit', 0, INT32_MAX, true), resourceMin: legacyBounds?INT32_MIN:num(s.resourceMin, 'resourceMin', INT32_MIN, -1, true), resourceMax: legacyBounds?INT32_MAX:num(s.resourceMax, 'resourceMax', 1, INT32_MAX, true) };
}
export function validateBalances(v: unknown, settings: Settings, path = 'resources'): Balances {
  const r = record(v, path), out = balances();
  for (const k of RESOURCE_IDS) out[k] = num(r[k], `${path}.${k}`, settings.resourceMin, settings.resourceMax, true);
  return out;
}
export function validateWorld(v: unknown): WorldSpec {
  const w = record(v, 'world');
  if (![1, 2, 3, 4, 5, 6, GENERATION_VERSION].includes(w.generationVersion as number)) throw new Error(`Unsupported generation version ${String(w.generationVersion)}. Supported terrain generations: 1, 2, 3, 4, 5, 6 and ${GENERATION_VERSION}.`);
  if(w.namingVersion!==undefined&&w.namingVersion!==1)throw new Error('Unsupported village naming version.');
  if(w.mode!==undefined&&!['easy','normal','hard'].includes(String(w.mode)))throw new Error('Unknown expedition difficulty.');
  if(w.hardship!==undefined&&(w.mode!=='hard'||typeof w.hardship!=='string'||!Object.hasOwn(HARDSHIPS,w.hardship)))throw new Error('Unknown Siberia hardship.');
  const seeds = record(w.seeds, 'world.seeds'), c = record(w.config, 'world.config');
  const read = (k: string) => num(seeds[k], `seeds.${k}`, 0, UINT32_MAX, true);
  let seedText:string|undefined;if(w.seedText!==undefined){if(typeof w.seedText!=='string')throw new Error('seedText must be text.');const parsed=parseSeed(w.seedText);if(!parsed.seedText||parsed.seed!==w.seed)throw new Error('seedText does not match the numeric seed.');seedText=parsed.seedText;}
  // Legacy worlds used wildlife for village guards and equipment drops. Preserve those outcomes.
  const independent = (k: 'villages' | 'loot') => seeds[k] === undefined && Number(w.generationVersion) < 3 ? read('wildlife') : read(k);
  return { ...(w.namingVersion===undefined?{}:{namingVersion:1 as const}),...(w.mode===undefined?{}:{mode:w.mode as WorldSpec['mode']}),...(w.hardship===undefined?{}:{hardship:w.hardship as WorldSpec['hardship']}),seed: num(w.seed, 'world.seed', 0, UINT32_MAX, true),...(seedText===undefined?{}:{seedText}), generationVersion: Number(w.generationVersion), seeds: { terrain: read('terrain'), rivers: read('rivers'), biomes: read('biomes'), resources: read('resources'), ruins: read('ruins'), wildlife: read('wildlife'), villages: independent('villages'), loot: independent('loot') }, config: { chunkSize: num(c.chunkSize, 'chunkSize', 16, 64, true), initialRegionSize: num(c.initialRegionSize, 'initialRegionSize', 64, 4096, true), worldScale: num(c.worldScale, 'worldScale', .5, 4), riverDensity: num(c.riverDensity, 'riverDensity', 0, 3), ruinDensity: num(c.ruinDensity, 'ruinDensity', 0, 3), resourceDensity: num(c.resourceDensity, 'resourceDensity', 0, 3) } };
}
function numericMap(v: unknown, path: string) {
  const raw = record(v, path); if (Object.keys(raw).length > 50000) throw new Error(`${path} is too large.`);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) out[id(key, path)] = num(value, `${path}.${key}`, 0, INT32_MAX, true);
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
    fresh.actors[id(key, 'actor.id')] = { ...(a.patrolIndex===undefined?{}:{patrolIndex:num(a.patrolIndex,'patrol index',0,15,true)}),id: key, type, ...point(a, 'actor'), hp: num(a.hp, 'actor.hp', 0, ACTOR_HP[type]), weapon: a.weapon === null ? null : weaponType(a.weapon), groupId: id(a.groupId, 'groupId'), villageId: a.villageId === null ? null : id(a.villageId, 'villageId'), homeX: num(a.homeX, 'homeX', -1e6, 1e6), homeZ: num(a.homeZ, 'homeZ', -1e6, 1e6), heading: num(a.heading, 'heading', -1000, 1000), cooldown: num(a.cooldown, 'actor.cooldown', 0, 5), roamTimer: num(a.roamTimer, 'roamTimer', -1, 10), targetX: num(a.targetX, 'targetX', -1e6, 1e6), targetZ: num(a.targetZ, 'targetZ', -1e6, 1e6), alerted: bool(a.alerted, 'alerted'), ...(a.heatInside === undefined ? {} : {heatInside: bool(a.heatInside,'heatInside')}),...(a.heatBurn===undefined?{}:{heatBurn:num(a.heatBurn,'heatBurn',0,1)}),...(a.pursuitId===undefined?{}:{pursuitId:id(a.pursuitId,'pursuitId')}),...(a.stunned===undefined?{}:{stunned:num(a.stunned,'actor.stunned',0,1)}),...(a.retreating===undefined?{}:{retreating:bool(a.retreating,'retreating')}) };
  }
  for (const key of ['encounters', 'villageAlerts', 'charredNodes', 'charredTrees'] as const) fresh[key] = array(raw[key], key, 50000).map(v => id(v, key));
  fresh.projectiles = array(raw.projectiles, 'projectiles', 1000).map(v => {
    const p = record(v, 'projectile'); if (!['arrow', 'pellet', 'bottle', 'swing'].includes(String(p.kind))) throw new Error('Unknown projectile kind.');
    return { id: id(p.id, 'projectile.id'), ownerId: id(p.ownerId, 'ownerId'), kind: p.kind as CombatState['projectiles'][number]['kind'], ...point(p, 'projectile'), targetX: num(p.targetX, 'targetX', -1e6, 1e6), targetZ: num(p.targetZ, 'targetZ', -1e6, 1e6), fromX: num(p.fromX, 'fromX', -1e6, 1e6), fromZ: num(p.fromZ, 'fromZ', -1e6, 1e6), age: num(p.age, 'age', 0, 10), duration: num(p.duration, 'duration', .01, 10), damage: num(p.damage, 'damage', 0, 105),...(p.aim===undefined?{}:{aim:num(p.aim,'projectile.aim',-1000,1000)}), ...(p.weapon===undefined?{}:{weapon:p.weapon==='punch'?'punch' as const:weaponType(p.weapon)}), ...(p.weaponId===undefined?{}:{weaponId:id(p.weaponId,'projectile.weaponId')}), ...(p.hitIds===undefined?{}:{hitIds:array(p.hitIds,'hitIds',2000).map(v=>id(v,'hitId'))}), ...(p.volleyId===undefined?{}:{volleyId:id(p.volleyId,'volleyId')}), ...(p.wearCharged===undefined?{}:{wearCharged:bool(p.wearCharged,'wearCharged')}) };
  });
  fresh.fires = array(raw.fires, 'fires', 500).map(v => { const f = record(v, 'fire'); return { ...point(f, 'fire'), id: id(f.id, 'fire.id'), ownerId: id(f.ownerId, 'ownerId'), remaining: num(f.remaining, 'fire.remaining', 0, 10), tick: num(f.tick, 'fire.tick', 0, 1), charred: bool(f.charred, 'charred') }; });
  fresh.drops = array(raw.drops, 'drops', 1000).map(v => { const d = record(v, 'drop'); return { ...point(d, 'drop'), id: id(d.id, 'drop.id'), weapon: weaponType(d.weapon), uses: num(d.uses, 'drop.uses', 0, 100, true) }; });
  const statuses = record(raw.statuses, 'statuses'); if (Object.keys(statuses).length > 10000) throw new Error('Too many status effects.');
  for (const [key, value] of Object.entries(statuses)) { const status = record(value, 'status'); fresh.statuses[id(key, 'status.id')] = { bleed: num(status.bleed, 'bleed', 0, 10), tick: num(status.tick, 'bleed tick', 0, 1),...(status.bleedDamage===undefined?{}:{bleedDamage:num(status.bleedDamage,'bleedDamage',0,7)}),...(status.wolfBleed===undefined?{}:{wolfBleed:num(status.wolfBleed,'wolfBleed',0,12)}),...(status.wolfTick===undefined?{}:{wolfTick:num(status.wolfTick,'wolfTick',0,1)}) }; }
  const w = record(raw.weather, 'weather'); if (w.mode !== 'clear' && w.mode !== 'snow') throw new Error('Weather must be clear or snow.'); fresh.weather = { mode: w.mode, remaining: num(w.remaining, 'weather.remaining', 0, 300), cycle: num(w.cycle, 'weather.cycle', 0, 1e9, true) };
  return fresh;
}
export function exportFull(state: GameState) { const { world, ...rest } = state; return JSON.stringify({ format: 'frostbound', formatVersion: 3, mode: 'full-save', world, state: rest }, null, 2); }
export function exportSandbox(state: GameState) {
  return JSON.stringify({ format: 'frostbound', formatVersion: 3, mode: 'sandbox-config', world: state.world, startingState: { resources: state.inventory, stockpile: state.stockpile, furnace: { level: state.furnaces[0].level, fuel: state.furnaces[0].fuel, charcoal: state.furnaces[0].charcoal }, equipment: { weapons: state.combat.weapons, equipped: state.combat.equipped }, settings: state.settings } }, null, 2);
}
/** Parse into a new detached state. The live state is never referenced or mutated. */
export function importJSON(text: string, expectedMode?: 'full-save' | 'sandbox-config'): GameState {
  if (text.length > 12000000) throw new Error('JSON file is larger than 12 MB.');
  let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new Error('Invalid JSON syntax. Check commas, quotes and numeric values.'); }
  const doc = record(parsed, 'document'); if (doc.format !== 'frostbound' || ![1, 2, 3].includes(doc.formatVersion as number)) throw new Error('Unsupported save format or formatVersion. Expected frostbound formatVersion 1, 2 or 3.');
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
  if(raw.hardships!==undefined){state.hardships=array(raw.hardships,'hardships',5).map(v=>{if(typeof v!=='string'||!Object.hasOwn(HARDSHIPS,v))throw new Error('Unknown permanent hardship.');return v as NonNullable<GameState['hardships']>[number];});if(new Set(state.hardships).size!==state.hardships.length||world.mode!=='hard')throw new Error('Invalid permanent hardships.');}
  if(raw.villageTrials!==undefined){state.villageTrials=array(raw.villageTrials,'villageTrials',50000).map(v=>id(v,'villageTrial'));const villages=new WorldManager(world).villages();if(new Set(state.villageTrials).size!==state.villageTrials.length||state.villageTrials.some(id=>!villages.some(v=>v.id===id)))throw new Error('Unknown or duplicate visited village.');}
  delete state.spawnProtection;if(raw.spawnProtection!==undefined){const zone=record(raw.spawnProtection,'spawnProtection');state.spawnProtection={...point(zone,'spawnProtection'),remaining:num(zone.remaining,'spawnProtection.remaining',0,12)};}
  state.player = { ...point(player, 'player'), warmth: num(player.warmth, 'warmth', 0, 100), hp: num(player.hp, 'hp', 0, 100), heading: num(player.heading, 'heading', -1000000, 1000000), ...(player.hunger===undefined?{}:{hunger:num(player.hunger,'hunger',0,20)}),...(player.sprintHungerTime===undefined?{}:{sprintHungerTime:num(player.sprintHungerTime,'sprintHungerTime',0,15)}),...(player.hungerTime===undefined?{}:{hungerTime:num(player.hungerTime,'hungerTime',0,30)}),...(player.foodCooldown===undefined?{}:{foodCooldown:num(player.foodCooldown,'foodCooldown',0,3)}),...(player.starvationTime===undefined?{}:{starvationTime:num(player.starvationTime,'starvationTime',0,1)}),...(player.invulnerable===undefined?{}:{invulnerable:num(player.invulnerable,'invulnerable',0,5)}), ...(player.heatTime===undefined?{}:{heatTime:num(player.heatTime,'heatTime',0,3)}),...(player.stunned===undefined?{}:{stunned:num(player.stunned,'stunned',0,3)}),...(player.recentDamage===undefined?{}:{recentDamage:num(player.recentDamage,'recentDamage',0,3)}) };
  if(player.hypothermia!==undefined){const h=record(player.hypothermia,'hypothermia');state.player.hypothermia={level:num(h.level,'hypothermia.level',1,2,true) as 1|2,waterTime:num(h.waterTime,'waterTime',0,5),tick:num(h.tick,'hypothermia.tick',0,3)};state.player.hp=Math.min(90,state.player.hp);}
  state.player.hp=Math.min(state.player.hp,maxPlayerHP(state));
  state.combat = validateCombat(raw.combat);
  state.inventory = validateBalances(raw.inventory, settings); state.stockpile = validateBalances(raw.stockpile, settings, 'stockpile');
  state.elapsed = num(raw.elapsed, 'elapsed', 0, 1e12); state.nextId = num(raw.nextId, 'nextId', 1, 1e9, true);
  const seen = new Set<string>();
  const unique = (key: string) => { if (seen.has(key)) throw new Error(`Duplicate entity ID ${key}.`); seen.add(key); return key; };
  state.buildings = array(raw.buildings, 'buildings', 2000).map((v, i) => { const b = record(v, `building ${i}`); if (typeof b.type !== 'string' || !Object.hasOwn(BUILDINGS, b.type)) throw new Error(`Unknown building type ${String(b.type)}.`); return { id: unique(id(b.id, 'building.id')), ...point(b, 'building'), type: b.type as BuildingType, rotation: num(b.rotation, 'rotation', -1000, 1000),...(b.burnTime===undefined?{}:{burnTime:num(b.burnTime,'burnTime',0,15)}),...(b.pulseTime===undefined?{}:{pulseTime:num(b.pulseTime,'pulseTime',0,1)}),...(b.construction===undefined?{}:{construction:num(b.construction,'construction',0,CONSTRUCTION_SECONDS[b.type as BuildingType])}) }; });
  state.furnaces = array(raw.furnaces, 'furnaces', 2001).map(v => { const f = record(v, 'furnace'); return { id: id(f.id, 'furnace.id'), ...point(f, 'furnace'), fuel: num(f.fuel, 'fuel', 0, 3600), charcoal: num(f.charcoal, 'charcoal', 0, 3600), level: num(f.level, 'level', 1, 50, true) }; });
  if (state.furnaces.filter(f => f.id === 'home').length !== 1 || state.furnaces[0].id !== 'home' || state.furnaces[0].x !== 0 || state.furnaces[0].z !== 0) throw new Error('Exactly one home furnace at 0,0 must be first.');
  if (new Set(state.furnaces.map(f => f.id)).size !== state.furnaces.length) throw new Error('Duplicate furnace IDs.');
  if(raw.respawnFurnaceId !== undefined){state.respawnFurnaceId=id(raw.respawnFurnaceId,'respawnFurnaceId');if(!state.furnaces.some(f=>f.id===state.respawnFurnaceId))throw new Error('Respawn furnace does not exist.');}
  for (const b of state.buildings) if (b.type === 'furnace' && !state.furnaces.some(f => f.id === b.id && f.x === b.x && f.z === b.z)) throw new Error('A built furnace is missing its matching fuel state.');
  for (const f of state.furnaces) if (f.id !== 'home' && !state.buildings.some(b => b.id === f.id && b.type === 'furnace') && !new WorldManager(world).villages().some(v => `${v.id}:furnace` === f.id && v.x === f.x && v.z + 1 === f.z)) throw new Error('Outpost furnace has no building or fixed village.');
  if(raw.communities!==undefined){
    const all=record(raw.communities,'communities'),sites=new WorldManager(world).villages();if(Object.keys(all).length>sites.length)throw new Error('Too many village communities.');state.communities={};
    for(const[key,value]of Object.entries(all)){const c=record(value,'community'),site=sites.find(v=>v.id===key);if(!site||c.id!==key||c.version!==1)throw new Error('Unknown village community or version.');
      if(typeof c.name!=='string'||! /^[A-Za-z][A-Za-z '-]{0,63}$/.test(c.name))throw new Error('Invalid village name.');
      const leaderId=id(c.leaderId,'leader'),furnaceId=id(c.furnaceId,'community furnace'),storageId=id(c.storageId,'community storage');if(leaderId!==`npc:${key}`||furnaceId!==`${key}:furnace`||storageId!==`store:${key}`||!state.furnaces.some(f=>f.id===furnaceId))throw new Error('Village identity mismatch.');
      const workerIds=array(c.workerIds,'residents',3).map(v=>id(v,'resident')),guardIds=array(c.guardIds,'guards',5).map(v=>id(v,'guard'));if(workerIds.length!==3||workerIds.some((v,i)=>v!==`resident:${key}:${i}`)||guardIds.length!==site.guardCount||guardIds.some((v,i)=>v!==`guard:${key}:${i}`))throw new Error('Village roster mismatch.');
      const security=record(c.security,'security'),patrol=array(c.patrol,'patrol',16).map(v=>point(v,'patrol'));if(patrol.length<2||patrol.some(p=>Math.hypot(p.x-site.x,p.z-site.z)>36))throw new Error('Invalid village patrol.');
      const threatIds=array(security.threatIds,'threats',32).map(v=>id(v,'threat'));if(new Set(threatIds).size!==threatIds.length||threatIds.some(id=>id!=='player'&&!state.combat.actors[id]))throw new Error('Unknown or duplicate village threat.');
      state.communities[key]={version:1,id:key,name:c.name,seed:num(c.seed,'settlement seed',0,UINT32_MAX,true),leaderId,furnaceId,storageId,stockpile:validateBalances(c.stockpile,settings,'village stockpile'),capacity:num(c.capacity,'village capacity',1,INT32_MAX,true),workerIds,guardIds,patrol,security:{threatIds,calmTime:num(security.calmTime,'calmTime',0,8)}};
    }
  }
  state.workers = array(raw.workers, 'workers', 4000).map(v => {
    const w = record(v, 'worker'); if (!['seeking', 'gathering', 'returning', 'blocked'].includes(String(w.state))) throw new Error('Invalid worker state.');
    const hutId = id(w.hutId, 'worker.hutId'); const communityId=w.communityId===undefined?undefined:id(w.communityId,'worker.communityId'),community=communityId?state.communities?.[communityId]:undefined;if(communityId&&(!community||!community.workerIds.includes(String(w.id))||!Array.from({length:3},(_,i)=>`house:${communityId}:${i}`).includes(hutId)))throw new Error('Invalid village worker assignment.');
    if (!community&&!state.buildings.some(b => b.id === hutId && b.type === 'hut')) throw new Error('Worker is missing its hut.');
    return { ...(communityId?{communityId}:{}),...(w.assignment===undefined?{}:{assignment:(()=>{if(!['wood','stone','fish'].includes(String(w.assignment)))throw new Error('Invalid work assignment.');return w.assignment as 'wood'|'stone'|'fish';})()}),...(w.villageId===undefined?{}:{villageId:(()=>{const key=id(w.villageId,'worker.villageId');if(!new WorldManager(world).villages().some(v=>v.id===key))throw new Error('Unknown worker village.');return key;})()}),...(w.relocated===undefined?{}:{relocated:bool(w.relocated,'worker.relocated')}),id: unique(id(w.id, 'worker.id')), hutId, hp: num(w.hp, 'worker.hp', 0, 100), ...point(w, 'worker'), sourceId: w.sourceId === null ? null : id(w.sourceId, 'sourceId'), state: w.state as GameState['workers'][number]['state'], load: num(w.load, 'worker.load', 0, 3, true), progress: num(w.progress, 'worker.progress', 0, 100),...(w.resource===undefined?{}:{resource:(()=>{if(!['wood','stone','fish'].includes(String(w.resource)))throw new Error('Invalid worker resource.');return w.resource as 'wood'|'stone'|'fish';})()}) };
  });
  for(const community of Object.values(state.communities??{}))if(community.workerIds.some(id=>!state.workers.some(w=>w.id===id&&w.communityId===community.id)))throw new Error('Missing village resident.');
  for(const hut of state.buildings.filter(b=>b.type==='hut')){const workers=state.workers.filter(w=>w.hutId===hut.id);if(workers.length>2)throw new Error('Only two workers per hut are supported.');if(hut.construction!==undefined&&workers.length)throw new Error('Unfinished huts cannot have workers.');}
  const maxBuilt = Math.max(0, ...state.buildings.map(b => Number(b.id.split(':')[1]) || 0)); if (state.nextId <= maxBuilt) throw new Error('nextId must exceed existing building numbers.');
  if(changes.terrain!==undefined){const terrain=record(changes.terrain,'terrain');if(Object.keys(terrain).length>50000)throw new Error('Too many terrain changes.');for(const [key,value] of Object.entries(terrain)){if(value!=='felled'&&value!=='broken')throw new Error('Unknown terrain change.');state.changes.terrain![id(key,'terrain.id')]=value;}}
  state.changes.nodes = numericMap(changes.nodes, 'changes.nodes'); state.changes.fishing = numericMap(changes.fishing, 'changes.fishing');
  state.changes.containers = array(changes.containers, 'containers').map(v => id(v, 'container')); state.discovered = array(raw.discovered, 'discovered').map(v => id(v, 'discovered'));
  if (state.discovered.some(k => k !== 'home' && !/^ruin:-?\d{1,4}:-?\d{1,4}$/.test(k) && !new WorldManager(world).villages().some(v => v.id === k))) throw new Error('Unknown discovered location ID.');
  const npcs = record(changes.npcs, 'npcs'); if (Object.keys(npcs).length > 10000) throw new Error('Too many NPC records.');
  for (const [key, value] of Object.entries(npcs)) state.changes.npcs[id(key, 'npc.id')] = { inventory: validateBalances(record(value, 'NPC').inventory, settings, 'NPC inventory'), hp: num(record(value, 'NPC').hp, 'NPC.hp', 0, 100) };
  const worldManager=new WorldManager(world);
  if(changes.treeRegrowth!==undefined){const timers=record(changes.treeRegrowth,'treeRegrowth');if(Object.keys(timers).length>50000)throw new Error('Too many tree timers.');for(const [key,value]of Object.entries(timers)){const match=/^tree:(-?\d+):(-?\d+):(\d+)$/.exec(key);if(!match||Math.abs(Number(match[1]))*world.config.chunkSize>1e6+64||Math.abs(Number(match[2]))*world.config.chunkSize>1e6+64||(state.changes.terrain?.[key]!=='felled'&&!state.combat.charredTrees.includes(key))||!worldManager.chunk(Number(match[1]),Number(match[2])).trees[Number(match[3])])throw new Error('Unknown regrowing tree.');state.changes.treeRegrowth![id(key,'treeRegrowth.id')]=num(value,'treeRegrowth.readyAt',0,1e12+1200);}}
  const resolveStructure=(key:string)=>{
    const placed=state.buildings.find(b=>b.id===key);if(placed)return placed;
    const furnace=state.furnaces.find(f=>f.id===key);if(furnace)return{...furnace,type:'furnace' as const};
    const store=Object.values(state.communities??{}).find(c=>c.storageId===key);if(store){const v=worldManager.villages().find(v=>v.id===store.id)!;return{id:key,type:'storage' as const,x:v.x+12,z:v.z-4};}
    const match=/^house:(village:[a-z]+|ruin:-?\d+:-?\d+):(\d+)$/.exec(key);if(!match)return undefined;
    const settlement=match[1].startsWith('village:')?worldManager.villages().find(v=>v.id===match[1]):worldManager.ruin(Number(match[1].split(':')[1]),Number(match[1].split(':')[2]));
    return settlement&&Number(match[2])<settlement.houses?{id:key,type:'hut' as const,x:settlement.x+(Number(match[2])-1)*6,z:settlement.z-3}:undefined;
  };
  if(changes.structures!==undefined){const structures=record(changes.structures,'structures');if(Object.keys(structures).length>10000)throw new Error('Too many structure changes.');for(const [key,value]of Object.entries(structures)){
    id(key,'structure.id');const structure=resolveStructure(key);if(!structure)throw new Error('Unknown structure.');const raw=record(value,'integrity');if(!['intact','ruin','gone'].includes(String(raw.stage)))throw new Error('Invalid structure stage.');const stage=raw.stage as 'intact'|'ruin'|'gone',hp=num(raw.hp,'structure.hp',0,structureMaxHP(structure));if(stage==='gone'&&hp!==0||stage!=='gone'&&hp===0||stage==='ruin'&&hp>structureMaxHP(structure)*.25)throw new Error('Invalid structure HP for its stage.');state.changes.structures![key]={stage,hp};
  }}
  if(changes.refuges!==undefined){const refuges=record(changes.refuges,'refuges');if(Object.keys(refuges).length>12000)throw new Error('Too many sheltering NPCs.');for(const[key,value]of Object.entries(refuges)){
    id(key,'refuge.npc');const npcKey=key.startsWith('npc:')?key.slice(4):'',ruin=/^ruin:(-?\d+):(-?\d+)$/.exec(npcKey),knownNpc=worldManager.villages().some(v=>v.id===npcKey)||!!ruin&&!!worldManager.ruin(Number(ruin[1]),Number(ruin[2]));if(!state.workers.some(w=>w.id===key)&&!knownNpc&&state.combat.actors[key]?.type!=='guard')throw new Error('Unknown sheltered NPC.');const raw=record(value,'refuge'),houseId=id(raw.houseId,'houseId');if(!resolveStructure(houseId))throw new Error('Shelter does not exist.');if(!['fleeing','hidden','returning'].includes(String(raw.phase)))throw new Error('Invalid refuge phase.');state.changes.refuges![key]={...point(raw,'refuge'),houseId,homeX:num(raw.homeX,'homeX',-1e6,1e6),homeZ:num(raw.homeZ,'homeZ',-1e6,1e6),remaining:num(raw.remaining,'refuge.remaining',0,12),phase:raw.phase as 'fleeing'|'hidden'|'returning',...(raw.reason==='night'?{reason:'night' as const}:{})};if(raw.reason!==undefined&&raw.reason!=='night')throw new Error('Invalid refuge reason.');
  }}
  if(player.shelter!==undefined){const raw=record(player.shelter,'player.shelter'),houseId=id(raw.houseId,'shelter.houseId'),house=resolveStructure(houseId);if(!house||house.type!=='hut'||Math.hypot(house.x-state.player.x,house.z-state.player.z)>5||state.buildings.some(b=>b.id===houseId&&b.construction)||state.changes.structures?.[houseId]?.stage&&state.changes.structures[houseId].stage!=='intact'||Object.values(state.changes.refuges??{}).some(r=>r.houseId===houseId&&r.phase!=='returning'))throw new Error('Player shelter is unavailable.');state.player.shelter={houseId,tick:num(raw.tick,'shelter.tick',0,1)};}
  if(changes.lootTaken!==undefined){state.changes.lootTaken=array(changes.lootTaken,'lootTaken',50000).map(v=>id(v,'lootTaken'));if(state.changes.lootTaken.some(key=>!worldManager.villages().some(v=>Array.from({length:world.mode==='hard'?12:6},(_,i)=>`supplies:${v.id}:${i}`).includes(key))))throw new Error('Unknown village loot pile.');if(new Set(state.changes.lootTaken).size!==state.changes.lootTaken.length)throw new Error('Duplicate looted pile.');}
  if(changes.groundLoot!==undefined){const loot=record(changes.groundLoot,'groundLoot');if(Object.keys(loot).length>5000)throw new Error('Too many loot piles.');for(const[key,value]of Object.entries(loot)){
    id(key,'loot.id');const raw=record(value,'loot');if(raw.id!==key)throw new Error('Loot ID does not match key.');const resources=record(raw.resources,'loot.resources'),items:Partial<Balances>={};if(Object.keys(resources).some(key=>!RESOURCE_IDS.includes(key as keyof Balances)))throw new Error('Unknown loot material.');for(const resource of RESOURCE_IDS)if(resources[resource]!==undefined)items[resource]=num(resources[resource],'loot.quantity',0,INT32_MAX,true);state.changes.groundLoot![key]={id:key,...point(raw,'loot'),resources:items,...(raw.weapon===undefined?{}:{weapon:weaponType(raw.weapon)})};
  }}
  if(raw.journal!==undefined){
    const j=record(raw.journal,'map journal');if(j.version!==1)throw new Error('Unsupported map journal version.');const ids=new Set<string>();const key=(v:unknown)=>{const k=id(v,'map note');if(!/^note:[1-9]\d*$/.test(k)||ids.has(k))throw new Error('Invalid or duplicate map note.');ids.add(k);return k;};
    const explored=array(j.explored,'explored cells',50000).map(v=>{if(typeof v!=='string'||! /^-?\d{1,5},-?\d{1,5}$/.test(v)||v.split(',').some(n=>Math.abs(Number(n))>62500))throw new Error('Invalid explored cell.');return v;});if(new Set(explored).size!==explored.length)throw new Error('Duplicate explored cell.');const known=new Set(explored),charted=(p:Point)=>known.has(`${Math.floor(p.x/16)},${Math.floor(p.z/16)}`);
    const markers=array(j.markers,'markers',200).map(v=>{const m=record(v,'marker'),p=point(m,'marker');if(!charted(p))throw new Error('Marker is outside explored terrain.');return{id:key(m.id),label:noteLabel(m.label),...p};});
    const paths=array(j.paths,'routes',50).map(v=>{const r=record(v,'route'),points=array(r.points,'waypoints',128).map(p=>point(p,'waypoint'));if(points.length<2||points.some(p=>!charted(p)))throw new Error('Route waypoints must be explored.');return{id:key(r.id),label:noteLabel(r.label),points};});const nextId=num(j.nextId,'map nextId',1,1e9,true);if([...ids].some(id=>Number(id.slice(5))>=nextId))throw new Error('Map nextId must exceed note IDs.');state.journal={version:1,nextId,markers,paths,explored};
  }
  return state;
}
export function saveLocal(state: GameState): ResultMessage {
  try { localStorage.setItem(KEY, exportFull(state)); return { ok: true, message: 'World saved locally.' }; } catch { return { ok: false, message: 'Local save failed: storage is unavailable or full. Export JSON to keep this world.' }; }
}
export function loadLocal() { const text = localStorage.getItem(KEY); if (!text) throw new Error('No v2 world save found.'); return importJSON(text, 'full-save'); }
interface ResultMessage { ok: boolean; message: string }
