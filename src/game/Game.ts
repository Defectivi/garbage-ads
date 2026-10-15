import { BUILDINGS, RESOURCE_IDS, balances, type BuildingType, type Resource } from '../data/definitions';
import { WorldManager, distance, type Node, type Ruin, type FishingSpot } from '../world/WorldManager';
import type { GameState, Point } from './GameState';
import { transact, single, negate, exchange, type Result } from '../systems/InventorySystem';
import { updateSurvival } from '../systems/SurvivalSystem';
import { trader } from '../data/trades';
import { derive } from '../utils/SeededRNG';
import { route } from '../systems/Navigation';
import { CombatSystem } from '../systems/CombatSystem';
import { WEAPONS, weaponCost, type WeaponType } from '../data/weapons';
export interface Input { x: number; z: number; sprint?: boolean }
export class Game {
  readonly world: WorldManager;
  readonly combat: CombatSystem;
  paused = true;
  message = 'Welcome to the northern wilderness.';
  revision = 0;
  fishing?: { spot: FishingSpot; remaining: number };
  private paths = new Map<string, Point[]>();
  private velocity = { x: 0, z: 0 };
  constructor(public state: GameState) { this.world = new WorldManager(state.world); this.combat = new CombatSystem(this); }
  get inventoryLimit() { return this.state.settings.inventoryLimit ? this.state.settings.inventoryLimit + this.state.buildings.filter(b => b.type === 'storage').length * 50 : 0; }
  get dead() { return this.state.player.hp <= 0 || this.state.settings.difficulty === 'survival' && this.state.player.warmth <= 0; }
  notify(message: string) { this.message = message; }
  nodeRemaining(node: Node) { return this.state.changes.nodes[node.id] ?? node.amount; }
  nodeResource(node: Node): Resource { return this.state.combat.charredNodes.includes(node.id) ? 'charcoal' : node.resource; }
  nodes() {
    return this.world.around(this.state.player).flatMap(c => [...c.nodes, ...c.trees.flatMap((t, i) => { const id = `tree:${c.id.replace(',', ':')}:${i}`; return this.state.combat.charredTrees.includes(id) ? [{ ...t, id: `charcoal:${id}`, resource: 'charcoal' as const, amount: 3, radius: .4 }] : []; })]);
  }
  solids(point: Point) {
    const trees = this.world.around(point).flatMap(c => c.trees.flatMap((t, i) => this.state.combat.charredTrees.includes(`tree:${c.id.replace(',', ':')}:${i}`) ? [] : [{ ...t, radius: .38 * t.scale }]));
    const ruins = this.world.settlements(point).flatMap(r => [...Array.from({ length: r.houses }, (_, i) => ({ x: r.x + (i - 1) * 6, z: r.z - 3, radius: 2.1 })), { ...r.trader, radius: .5 }, { ...r.container, radius: .65 }]);
    return [...trees, ...ruins, ...this.state.buildings.map(b => ({ ...b, radius: BUILDINGS[b.type].radius })), ...this.state.furnaces.filter(f => !this.state.buildings.some(b => b.id === f.id)).map(f => ({ ...f, radius: 1.3 }))];
  }
  move(point: Point, dx: number, dz: number, radius = .42) {
    let x = point.x + dx, z = point.z + dz;
    if (this.world.isWater(x, point.z)) x = point.x;
    if (this.world.isWater(x, z)) z = point.z;
    for (const s of this.solids({ x, z })) {
      const d = Math.hypot(x - s.x, z - s.z), min = s.radius + radius;
      if (d < min) { x = s.x + (d ? (x - s.x) / d : 1) * min; z = s.z + (d ? (z - s.z) / d : 0) * min; }
    }
    if (!this.world.isWater(x, z)) { point.x = x; point.z = z; }
  }
  update(dt: number, input: Input = { x: 0, z: 0 }) {
    if (this.paused || this.dead) return;
    dt = Math.min(.1, Math.max(0, dt));
    const len = Math.hypot(input.x, input.z), factor = 1 - Math.exp(-dt * 18);
    const sprint = !!input.sprint && len > .1, speed = sprint ? 9 : 6;
    this.velocity.x += (input.x / Math.max(1, len) * speed - this.velocity.x) * factor;
    this.velocity.z += (input.z / Math.max(1, len) * speed - this.velocity.z) * factor;
    this.move(this.state.player, this.velocity.x * dt, this.velocity.z * dt);
    if (len > .1) this.state.player.heading = Math.atan2(input.x, input.z);
    this.combat.update(dt); updateSurvival(this.state, dt, sprint);
    for (const r of this.world.settlements(this.state.player)) if (distance(r, this.state.player) < 20 && !this.state.discovered.includes(r.id)) { this.state.discovered.push(r.id); this.notify(`Discovered ${r.name}. Search the chest and speak to the trader.`); }
    if (this.fishing) {
      if (distance(this.fishing.spot, this.state.player) > 3 || len > .1) { this.fishing = undefined; this.notify('Fishing cancelled.'); }
      else if ((this.fishing.remaining -= dt) <= 0) {
        const f = this.fishing.spot, previous = this.state.changes.fishing[f.id] ?? 0, catchSize = Math.min(f.availability - previous, 1 + derive(this.state.world.seeds.resources, f.id, previous, 0) % 3);
        const result = transact([{ account: this.state.inventory, delta: { fish: catchSize }, capacity: this.inventoryLimit }], this.state.settings);
        if (result.ok) { this.state.changes.fishing[f.id] = previous + catchSize; this.notify(`Caught ${catchSize} fish. Eat them for warmth or barter at a settlement.`); } else this.notify(result.error);
        this.fishing = undefined;
      }
    }
    this.updateWorkers(dt);
  }
  gather(node: Node): Result {
    if (distance(this.state.player, node) > 3) return { ok: false, error: 'Move closer to gather this resource.' };
    const left = this.nodeRemaining(node); if (left <= 0) return { ok: false, error: 'This resource is exhausted.' };
    const resource = this.nodeResource(node), result = transact([{ account: this.state.inventory, delta: single(resource, 1), capacity: this.inventoryLimit }], this.state.settings);
    if (result.ok) { this.state.changes.nodes[node.id] = left - 1; if (left === 1) this.revision++; this.notify(`+1 ${resource}`); }
    return result;
  }
  feed(id = 'home', resource: 'wood' | 'charcoal' = 'wood'): Result {
    const f = this.state.furnaces.find(f => f.id === id);
    if (!f || distance(f, this.state.player) > 4) return { ok: false, error: 'Approach a furnace to add fuel.' };
    const fuel = resource === 'charcoal' ? 120 : 60;
    if (f.fuel + f.charcoal > 3600 - fuel) return { ok: false, error: 'Furnace fuel capacity is 3600 units.' };
    const account = this.state.inventory[resource] > 0 ? this.state.inventory : this.state.stockpile;
    const r = transact([{ account, delta: single(resource, -1) }], this.state.settings);
    if (r.ok) { if (resource === 'charcoal') f.charcoal += fuel; else f.fuel += fuel; this.notify(resource === 'charcoal' ? 'Added 120 charcoal fuel. It burns at half the wood rate.' : 'Added 60 seconds of fuel.'); } return r;
  }
  eat(resource: 'fish' | 'meat'): Result {
    const r = transact([{ account: this.state.inventory, delta: single(resource, -1) }], this.state.settings);
    if (r.ok) { this.state.player.warmth = Math.min(100, this.state.player.warmth + 35); this.notify('A meal restores 35 warmth.'); } return r;
  }
  stash(): Result {
    if (!this.state.furnaces.some(f => distance(f, this.state.player) < 5) && !this.state.buildings.some(b => b.type === 'storage' && distance(b, this.state.player) < 5)) return { ok: false, error: 'Approach a furnace or storehouse.' };
    const give = balances(); for (const r of RESOURCE_IDS) give[r] = Math.max(0, this.state.inventory[r]);
    return transact([{ account: this.state.inventory, delta: negate(give) }, { account: this.state.stockpile, delta: give }], this.state.settings);
  }
  withdraw(resource: Resource, count = 1): Result {
    if (!this.state.furnaces.some(f => distance(f, this.state.player) < 5) && !this.state.buildings.some(b => b.type === 'storage' && distance(b, this.state.player) < 5)) return { ok: false, error: 'Approach storage to retrieve supplies.' };
    return transact([{ account: this.state.stockpile, delta: single(resource, -count) }, { account: this.state.inventory, delta: single(resource, count), capacity: this.inventoryLimit }], this.state.settings);
  }
  validPlacement(type: BuildingType, point: Point) {
    const radius = BUILDINGS[type].radius;
    if (distance(point, this.state.player) > 15) return 'Place within 15 units of your survivor.';
    if (distance(point, { x: 0, z: 3 }) < 4 + radius) return 'Keep the home furnace and delivery apron clear.';
    if (distance(point, this.state.player) < radius + .8) return 'Move your survivor out of the footprint.';
    const heights: number[] = [];
    for (const [dx, dz] of [[0, 0], [radius, radius], [-radius, radius], [radius, -radius], [-radius, -radius]]) {
      if (this.world.isWater(point.x + dx, point.z + dz)) return 'Cannot build in deep water.';
      heights.push(this.world.height(point.x + dx, point.z + dz));
    }
    if (Math.max(...heights) - Math.min(...heights) > 1.8) return 'This slope is too steep.';
    if (this.solids(point).some(s => distance(s, point) < s.radius + radius + .5)) return 'The footprint overlaps a tree, ruin or building.';
    for (const c of this.world.around(point)) {
      if (c.fishing.some(f => distance(f, point) < radius + 2)) return 'Keep the fishing marker accessible.';
      if (c.ruins.some(r => distance(r.trader, point) < radius + 2 || distance(r.container, point) < radius + 2)) return 'Keep traders and supply chests accessible.';
    }
    return '';
  }
  build(type: BuildingType, point: Point, rotation: number): Result {
    const invalid = this.validPlacement(type, point); if (invalid) return { ok: false, error: invalid };
    const cost = BUILDINGS[type].costs, stock: Partial<Record<Resource, number>> = {}, carried: Partial<Record<Resource, number>> = {};
    for (const k of RESOURCE_IDS) { const n = (cost as Partial<Record<Resource, number>>)[k] ?? 0; stock[k] = -Math.min(Math.max(0, this.state.stockpile[k]), n); carried[k] = -n - stock[k]!; }
    const r = transact([{ account: this.state.stockpile, delta: stock }, { account: this.state.inventory, delta: carried }], this.state.settings);
    if (!r.ok) return r;
    const id = `built:${this.state.nextId++}`; this.state.buildings.push({ id, type, ...point, rotation }); this.paths.clear();
    if (type === 'furnace') this.state.furnaces.push({ id, ...point, fuel: 0, charcoal: 0, level: 1 });
    if (type === 'hut') this.state.workers.push({ id: `worker:${id}`, hutId: id, hp: 100, x: point.x, z: point.z + 3, sourceId: null, load: 0, progress: 0, state: 'seeking' });
    this.revision++; this.notify(`${BUILDINGS[type].name} built.`); return r;
  }
  upgradeFurnace(id = 'home'): Result {
    const f = this.state.furnaces.find(f => f.id === id); if (!f || distance(f, this.state.player) > 5) return { ok: false, error: 'Approach the furnace to expand it.' };
    if (f.level >= 25) return { ok: false, error: 'Furnace is at the supported maximum level (25).' };
    const fromStock = Math.min(30, Math.max(0, this.state.stockpile.wood));
    const r = transact([{ account: this.state.stockpile, delta: { wood: -fromStock } }, { account: this.state.inventory, delta: { wood: -(30 - fromStock) } }], this.state.settings);
    if (r.ok) { f.level++; this.notify('Furnace expanded: +8 world units of heat range, more efficient fuel.'); } return r;
  }
  startFishing(spot: FishingSpot): Result {
    if (distance(spot, this.state.player) > 3) return { ok: false, error: 'Stand beside the blue fishing marker on the bank.' };
    if ((this.state.changes.fishing[spot.id] ?? 0) >= spot.availability) return { ok: false, error: 'This fishing location is depleted. Explore another riverbank.' };
    this.fishing = { spot, remaining: 4 }; this.notify('Fishing… stay on the bank for four seconds.'); return { ok: true };
  }
  search(ruin: Ruin): Result {
    if (distance(ruin.container, this.state.player) > 3) return { ok: false, error: 'Approach the supply chest.' };
    if (this.state.changes.containers.includes(ruin.id)) return { ok: false, error: 'This chest has already been searched.' };
    const r = transact([{ account: this.state.inventory, delta: { wood: 3 + ruin.houses, stone: 3, metal: 2 + ruin.variant, fish: 2, gold: 2 }, capacity: this.inventoryLimit }], this.state.settings);
    if (r.ok) { this.state.changes.containers.push(ruin.id); this.revision++; this.notify('Salvaged timber, stone, metal, food and a little gold.'); } return r;
  }
  npc(ruin: Ruin) { const def = trader(ruin), saved = this.state.changes.npcs[def.id]; return { ...def, inventory: saved?.inventory ?? def.inventory, hp: saved?.hp ?? 100 }; }
  buyWeapon(ruin: Ruin, type: WeaponType): Result {
    if (distance(ruin.trader, this.state.player) > 4 || this.npc(ruin).hp <= 0) return { ok: false, error: 'Approach a living trader to buy weapons.' };
    const npc = this.npc(ruin), next = { ...npc.inventory }, cost = weaponCost(type);
    const result = exchange(this.state.inventory, next, cost, {}, this.state.settings, this.inventoryLimit);
    if (result.ok) { this.state.changes.npcs[npc.id] = { inventory: next, hp: npc.hp }; const id = `weapon:${this.state.combat.sequence++}`; this.state.combat.weapons.push({ id, type, uses: 100 }); this.state.combat.equipped = id; this.notify(`${WEAPONS[type].name} purchased and equipped. 100 uses; infinite ammunition.`); }
    return result;
  }
  trade(ruin: Ruin, offerId: string): Result {
    if (this.npc(ruin).hp <= 0 || distance(ruin.trader, this.state.player) > 4) return { ok: false, error: 'Approach the trader before exchanging goods.' };
    const npc = this.npc(ruin), offer = npc.offers.find(o => o.id === offerId); if (!offer) return { ok: false, error: 'Unknown trade offer.' };
    const inventory = { ...npc.inventory };
    const result = exchange(this.state.inventory, inventory, offer.give, offer.receive, this.state.settings, this.inventoryLimit);
    if (result.ok) { this.state.changes.npcs[npc.id] = { inventory, hp: npc.hp }; this.notify(`Trade completed with ${npc.name}.`); } return result;
  }
  private updateWorkers(dt: number) {
    for (const w of this.state.workers) {
      if (w.hp <= 0) continue;
      const hut = this.state.buildings.find(b => b.id === w.hutId); if (!hut) continue;
      const sources = this.world.around(hut).flatMap(c => c.nodes).filter(n => this.nodeResource(n) === 'wood' && distance(n, hut) < 26 && this.nodeRemaining(n) > 0 && !this.world.isWater(n.x, n.z));
      let source = sources.find(n => n.id === w.sourceId);
      if (w.load >= 3 || !source && w.load > 0) w.state = 'returning';
      if (!source && !w.load) { source = sources.sort((a, b) => distance(a, w) - distance(b, w))[0]; w.sourceId = source?.id ?? null; w.state = source ? 'seeking' : 'blocked'; this.paths.delete(w.id); }
      if (w.state === 'blocked') { w.progress += dt; if (w.progress < 3) continue; w.progress = 0; w.state = w.load ? 'returning' : 'seeking'; this.paths.delete(w.id); }
      if (w.state === 'gathering') {
        w.progress += dt;
        if (source && w.progress >= 2) { this.state.changes.nodes[source.id] = this.nodeRemaining(source) - 1; if (this.nodeRemaining(source) === 0) this.revision++; w.load++; w.progress = 0; }
        if (!source || w.load >= 3) { w.state = 'returning'; this.paths.delete(w.id); }
        continue;
      }
      if (!source && !w.load) { w.state = 'blocked'; continue; }
      const destinations = [...this.state.furnaces.map(f => ({ x: f.x, z: f.z + 3 })), ...this.state.buildings.filter(b => b.type === 'storage').map(b => ({ x: b.x, z: b.z + 3.4 }))];
      const destination = destinations.sort((a, b) => distance(a, w) - distance(b, w))[0];
      const target = w.state === 'returning' ? destination : source!;
      if (distance(w, target) < (w.state === 'returning' ? 1.8 : 2)) {
        if (w.state === 'returning') {
          const r = transact([{ account: this.state.stockpile, delta: { wood: w.load } }], this.state.settings);
          if (r.ok) { w.load = 0; w.sourceId = null; w.state = 'seeking'; this.paths.delete(w.id); } else w.state = 'blocked';
        } else { w.state = 'gathering'; w.progress = 0; }
        continue;
      }
      let path = this.paths.get(w.id);
      if (!path) {
        const solids = this.solids(hut);
        const valid = (p: Point) => !this.world.isWater(p.x, p.z) && solids.every(s => distance(s, p) > s.radius + .6);
        let end = target; if (!valid(end)) { const options = Array.from({ length: 8 }, (_, i) => ({ x: target.x + Math.cos(i * Math.PI / 4) * 1.6, z: target.z + Math.sin(i * Math.PI / 4) * 1.6 })).filter(valid); if (options.length) end = options.sort((a, b) => distance(a, w) - distance(b, w))[0]; }
        path = route(w, end, valid); this.paths.set(w.id, path);
        if (!path.length) { w.state = 'blocked'; continue; }
      }
      const next = path[0]; if (!next) { this.paths.delete(w.id); continue; }
      const d = distance(w, next), step = Math.min(d, dt * 3.8); this.move(w, (next.x - w.x) / (d || 1) * step, (next.z - w.z) / (d || 1) * step, .3);
      if (d < .4) path.shift();
    }
  }
}
