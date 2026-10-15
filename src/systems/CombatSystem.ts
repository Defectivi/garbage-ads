import type { Game } from '../game/Game';
import type { Point } from '../game/GameState';
import { ACTOR_HP, WEAPONS, type ActorType, type WeaponType } from '../data/weapons';
import type { Actor, Projectile } from '../game/CombatState';
import { SeededRNG, derive } from '../utils/SeededRNG';
import { distance } from '../world/WorldManager';
import { transact } from './InventorySystem';

export interface CombatUnit extends Point { id: string; hp: number; kind: 'player' | 'guard' | 'enemy' | 'npc'; villageId?: string | null }
export function shotgunDamage(range: number) { return Math.round(8 + 27 * (1 - Math.min(3, Math.max(0, range)) / 3)); }
export function equipmentDrops(seed: number, id: string) { return derive(seed, `equipment:${id}`) / 4294967296 < .07; }
const segmentDistance = (p: Point, a: Point, b: Point) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };

export class CombatSystem {
  lastAttack = -100;
  constructor(private game: Game) {}
  private get s() { return this.game.state; }
  private get c() { return this.s.combat; }
  private nextId(prefix: string) { return `${prefix}:${this.c.sequence++}`; }
  private spawn(id: string, type: ActorType, point: Point, groupId: string, weapon: WeaponType | null, villageId: string | null = null) {
    if (this.c.actors[id]) return;
    this.c.actors[id] = { id, type, ...point, hp: ACTOR_HP[type], weapon, groupId, villageId, homeX: point.x, homeZ: point.z, heading: 0, cooldown: 1, roamTimer: 0, targetX: point.x, targetZ: point.z, alerted: false };
  }
  ensureEncounters() {
    const p = this.s.player, world = this.game.world;
    for (const v of world.villages()) if (distance(v, p) < 85) {
      if (!this.s.furnaces.some(f => f.id === `${v.id}:furnace`)) this.s.furnaces.push({ id: `${v.id}:furnace`, x: v.x, z: v.z + 1, fuel: 240, charcoal: 0, level: 1 });
      for (let i = 0; i < v.guardCount; i++) { const angle = i * Math.PI * 2 / v.guardCount; this.spawn(`guard:${v.id}:${i}`, 'guard', { x: v.x + Math.cos(angle) * 10, z: v.z + Math.sin(angle) * 10 }, v.id, i % 2 ? 'machete' : 'shotgun', v.id); }
    }
    const cx = Math.floor(p.x / 64), cz = Math.floor(p.z / 64);
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
      const key = `encounter:${x}:${z}`; if (this.c.encounters.includes(key)) continue;
      this.c.encounters.push(key); const rng = new SeededRNG(derive(this.s.world.seeds.wildlife, 'encounter', x, z));
      const groups: { type: ActorType; count: number; x: number; z: number }[] = [
        { type: 'polar_bear', count: 1, x: x * 64 + rng.range(14, 50), z: z * 64 + rng.range(14, 50) }
      ];
      if (derive(this.s.world.seeds.wildlife, 'bandit-group', x, z) % 3 === 0 || x === 0 && z === 0) groups.push({ type: 'bandit', count: 2 + Math.floor(rng.next() * 9), x: x * 64 + 30, z: z * 64 - 22 });
      if (derive(this.s.world.seeds.wildlife, 'arsonist', x, z) % 3 === 0 || x === 0 && z === 0) groups.push({ type: 'arsonist', count: 1, x: x * 64 + 19, z: z * 64 + 29 });
      for (const group of groups) for (let i = 0; i < group.count; i++) {
        let point = { x: group.x + (i % 4) * 1.7, z: group.z + Math.floor(i / 4) * 1.7 };
        if (Math.hypot(point.x, point.z) < 22) point.z += 26;
        if (world.villages().some(v => distance(v, point) < 22)) point.z -= 36;
        if (world.isWater(point.x, point.z)) { const r = world.river(point.x, point.z); point.z = r.center - r.width - 3; }
        const weapon = group.type === 'bandit' ? (['bow', 'shotgun', 'machete'] as const)[Math.floor(rng.next() * 3)] : group.type === 'arsonist' ? 'molotov' : null;
        this.spawn(`${key}:${group.type}:${i}`, group.type, point, `${key}:${group.type}`, weapon);
      }
    }
  }
  units(): CombatUnit[] {
    const units: CombatUnit[] = [{ ...this.s.player, id: 'player', kind: 'player' }];
    for (const a of Object.values(this.c.actors)) if (a.hp > 0 && distance(a, this.s.player) < 85) units.push({ ...a, kind: a.type === 'guard' ? 'guard' : 'enemy' });
    for (const w of this.s.workers) if (w.hp > 0 && distance(w, this.s.player) < 85) units.push({ ...w, kind: 'npc' });
    for (const r of this.game.world.settlements(this.s.player, 2)) { const npc = this.game.npc(r); if (npc.hp > 0) units.push({ ...r.trader, id: npc.id, hp: npc.hp, kind: 'npc', villageId: r.id.startsWith('village:') ? r.id : null }); }
    return units;
  }
  damage(target: CombatUnit, amount: number, ownerId: string, bleed = false) {
    if (target.hp <= 0) return;
    if (target.id === 'player') this.s.player.hp = Math.max(0, this.s.player.hp - amount);
    else if (this.c.actors[target.id]) {
      const actor = this.c.actors[target.id], wasAlive = actor.hp > 0; actor.hp = Math.max(0, actor.hp - amount);
      if (ownerId === 'player') { actor.alerted = true; for (const member of Object.values(this.c.actors)) if (member.groupId === actor.groupId) member.alerted = true; }
      if (actor.villageId && ownerId === 'player' && !this.c.villageAlerts.includes(actor.villageId)) this.c.villageAlerts.push(actor.villageId);
      if (wasAlive && actor.hp <= 0) {
        this.c.kills++; delete this.c.statuses[actor.id];
        if (actor.weapon && equipmentDrops(this.s.world.seeds.wildlife, actor.id)) this.c.drops.push({ id: this.nextId('drop'), x: actor.x, z: actor.z, weapon: actor.weapon, uses: 100 });
        this.game.notify(`${actor.type === 'polar_bear' ? 'Polar bear' : actor.type === 'guard' ? 'Guard' : 'Raider'} defeated.`);
      }
    } else {
      const worker = this.s.workers.find(w => w.id === target.id);
      if (worker) worker.hp = Math.max(0, worker.hp - amount);
      else {
        const settlement = this.game.world.settlements(target, 2).find(r => this.game.npc(r).id === target.id);
        if (settlement) { const npc = this.game.npc(settlement); this.s.changes.npcs[target.id] = { inventory: { ...npc.inventory }, hp: Math.max(0, npc.hp - amount) }; this.game.revision++; }
      }
      if (target.villageId && ownerId === 'player' && !this.c.villageAlerts.includes(target.villageId)) this.c.villageAlerts.push(target.villageId);
    }
    if (bleed) this.c.statuses[target.id] = { bleed: 5, tick: 0 };
  }
  attack(target: Point): boolean {
    if (this.game.paused || this.game.dead || this.c.cooldown > 0) return false;
    const weapon = this.c.weapons.find(w => w.id === this.c.equipped && w.uses > 0);
    if (!weapon) { this.game.notify('Equip a weapon. Traders sell replacements.'); return false; }
    const def = WEAPONS[weapon.type]; this.c.cooldown = def.cooldown; weapon.uses--; this.lastAttack = this.s.elapsed;
    this.fireWeapon('player', this.s.player, target, weapon.type);
    if (weapon.uses === 0) this.game.notify(`${def.name} is worn out after 100 uses. Equip a replacement.`);
    return true;
  }
  private canHit(ownerId: string, target: CombatUnit) {
    if (ownerId === target.id || target.hp <= 0) return false;
    if (ownerId === 'player') return true;
    const owner = this.c.actors[ownerId];
    return owner?.type === 'guard' ? target.kind === 'enemy' || target.kind === 'player' && !!owner.villageId && this.c.villageAlerts.includes(owner.villageId) : target.kind !== 'enemy';
  }
  fireWeapon(ownerId: string, from: Point, target: Point, weapon: WeaponType) {
    const def = WEAPONS[weapon], d = distance(from, target), dx = (target.x - from.x) / (d || 1), dz = (target.z - from.z) / (d || 1);
    if (ownerId === 'player') this.s.player.heading = Math.atan2(dx, dz);
    const targets = this.units().filter(u => this.canHit(ownerId, u));
    const cone = (u: Point, range: number, angle: number) => { const n = distance(u, from); return n < range + .35 && ((u.x - from.x) * dx + (u.z - from.z) * dz) / (n || 1) > Math.cos(angle); };
    if (def.type === 'melee') {
      const damage = weapon === 'spear' ? 3 + derive(this.s.world.seeds.wildlife, ownerId, this.c.sequence++, 0) % 8 : def.damage;
      for (const u of targets) if (cone(u, def.range, 1)) this.damage(u, damage, ownerId, weapon === 'machete');
      this.c.projectiles.push({ id: this.nextId('swing'), ownerId, kind: 'swing', ...from, fromX: from.x, fromZ: from.z, targetX: from.x + dx * def.range, targetZ: from.z + dz * def.range, age: 0, duration: .2, damage: 0 });
    } else if (def.type === 'pellet') {
      for (const u of targets) if (cone(u, 3, Math.PI * 40 / 180)) this.damage(u, shotgunDamage(distance(from, u)), ownerId);
      for (let i = -2; i <= 2; i++) { const a = Math.atan2(dx, dz) + i * .18; this.c.projectiles.push({ id: this.nextId('pellet'), ownerId, kind: 'pellet', ...from, fromX: from.x, fromZ: from.z, targetX: from.x + Math.sin(a) * 3, targetZ: from.z + Math.cos(a) * 3, age: 0, duration: .15, damage: 0 }); }
    } else {
      const range = def.type === 'arrow' ? def.range : Math.min(def.range, Math.max(1, d));
      this.c.projectiles.push({ id: this.nextId('projectile'), ownerId, kind: def.type, ...from, fromX: from.x, fromZ: from.z, targetX: from.x + dx * range, targetZ: from.z + dz * range, age: 0, duration: range / (def.type === 'arrow' ? 24 : 10), damage: def.damage });
    }
  }
  private stepProjectile(p: Projectile, dt: number) {
    const old = { x: p.x, z: p.z }; p.age += dt; const t = Math.min(1, p.age / p.duration); p.x = p.fromX + (p.targetX - p.fromX) * t; p.z = p.fromZ + (p.targetZ - p.fromZ) * t;
    if (p.kind === 'arrow') {
      const hit = this.units().filter(u => this.canHit(p.ownerId, u) && segmentDistance(u, old, p) < (this.c.actors[u.id]?.type === 'polar_bear' ? .95 : .55)).sort((a, b) => distance(a, old) - distance(b, old))[0];
      if (hit) { this.damage(hit, p.damage, p.ownerId); return false; }
      if (this.game.solids(p).some(s => distance(s, p) < s.radius && !this.units().some(u => distance(u, s) < .7))) return false;
    }
    if (t >= 1) { if (p.kind === 'bottle') this.c.fires.push({ id: this.nextId('fire'), ownerId: p.ownerId, x: p.targetX, z: p.targetZ, remaining: 10, tick: 0, charred: false }); return false; }
    return true;
  }
  private charTimber(point: Point) {
    for (const chunk of this.game.world.around(point)) {
      for (const n of chunk.nodes) if (n.resource === 'wood' && distance(n, point) <= 4 && this.game.nodeRemaining(n) > 0 && !this.c.charredNodes.includes(n.id)) this.c.charredNodes.push(n.id);
      chunk.trees.forEach((tree, i) => { const id = `tree:${chunk.id.replace(',', ':')}:${i}`; if (distance(tree, point) <= 4 && !this.c.charredTrees.includes(id)) this.c.charredTrees.push(id); });
    }
    this.game.revision++;
  }
  update(dt: number) {
    this.ensureEncounters(); this.c.cooldown = Math.max(0, this.c.cooldown - dt);
    const weather = this.c.weather; weather.remaining -= dt;
    if (weather.remaining <= 0) { weather.mode = weather.mode === 'clear' ? 'snow' : 'clear'; weather.cycle++; weather.remaining = weather.mode === 'snow' ? 55 : 90 + derive(this.s.world.seeds.wildlife, 'weather', weather.cycle) % 61; this.game.notify(weather.mode === 'snow' ? 'Blizzard incoming. Fuel burns 3× faster; enemies track you from farther away.' : 'The storm has passed.'); }
    for (const [id, status] of Object.entries(this.c.statuses)) { status.tick += dt; status.bleed -= dt; while (status.tick >= 1 - 1e-8) { status.tick = Math.max(0, status.tick - 1); const u = this.units().find(u => u.id === id); if (u) this.damage(u, 2, 'bleed'); } if (status.bleed <= 1e-8) delete this.c.statuses[id]; }
    for (const fire of this.c.fires) {
      fire.remaining -= dt; fire.tick += dt;
      while (fire.tick >= 1 - 1e-8) { fire.tick = Math.max(0, fire.tick - 1); for (const u of this.units()) if (distance(u, fire) <= 4) this.damage(u, 3, fire.ownerId); }
      if (fire.remaining <= 1e-8 && !fire.charred) { fire.charred = true; this.charTimber(fire); }
    }
    this.c.fires = this.c.fires.filter(f => f.remaining > 1e-8);
    this.c.projectiles = this.c.projectiles.filter(p => this.stepProjectile(p, dt));
    const units = this.units(), snow = weather.mode === 'snow';
    for (const actor of Object.values(this.c.actors)) {
      if (actor.hp <= 0 || distance(actor, this.s.player) > 70) continue;
      actor.cooldown = Math.max(0, actor.cooldown - dt); actor.roamTimer = Math.max(0, actor.roamTimer - dt);
      const guard = actor.type === 'guard', hostilePlayer = !guard || !!actor.villageId && this.c.villageAlerts.includes(actor.villageId);
      const targets = units.filter(u => u.hp > 0 && u.id !== actor.id && (guard ? u.kind === 'enemy' || u.kind === 'player' && hostilePlayer : u.kind !== 'enemy'));
      const target = targets.filter(u => distance(u, actor) < (actor.alerted ? 30 : snow ? 27 : guard ? 16 : 12)).sort((a, b) => distance(a, actor) - distance(b, actor))[0];
      const weapon = actor.weapon, range = weapon ? WEAPONS[weapon].range : 1.65;
      if (target) {
        const d = distance(actor, target); actor.heading = Math.atan2(target.x - actor.x, target.z - actor.z);
        if (d < range && actor.cooldown === 0) {
          actor.cooldown = weapon ? WEAPONS[weapon].cooldown : 1.5;
          if (weapon) this.fireWeapon(actor.id, actor, target, weapon); else this.damage(target, 5, actor.id);
        }
        if (d > (weapon === 'bow' ? 8 : weapon === 'molotov' ? 6 : weapon === 'shotgun' ? 2.2 : 1.35)) this.walk(actor, target, dt, actor.type === 'polar_bear' ? 3.8 : 3.2);
      } else {
        if (actor.roamTimer <= 0) { actor.roamTimer = 3 + derive(this.s.world.seeds.wildlife, actor.id, Math.floor(this.s.elapsed / 4)) % 5; const a = derive(this.s.world.seeds.wildlife, actor.id, Math.floor(this.s.elapsed / 5)) / 4294967296 * Math.PI * 2; actor.targetX = actor.homeX + Math.cos(a) * (guard ? 5 : 11); actor.targetZ = actor.homeZ + Math.sin(a) * (guard ? 5 : 11); }
        this.walk(actor, { x: actor.targetX, z: actor.targetZ }, dt, 1.1);
      }
    }
  }
  private walk(actor: Actor, target: Point, dt: number, speed: number) {
    const d = distance(actor, target); if (d < .5) return; const dx = (target.x - actor.x) / d, dz = (target.z - actor.z) / d, old = { x: actor.x, z: actor.z };
    this.game.move(actor, dx * dt * speed, dz * dt * speed, actor.type === 'polar_bear' ? .75 : .4);
    if (distance(old, actor) < dt * speed * .2) this.game.move(actor, -dz * dt * speed, dx * dt * speed, .4);
    actor.heading = Math.atan2(dx, dz);
  }
  pickup(dropId: string) {
    const drop = this.c.drops.find(d => d.id === dropId); if (!drop || distance(drop, this.s.player) > 3) return false;
    this.c.weapons.push({ id: this.nextId('weapon'), type: drop.weapon, uses: drop.uses }); this.c.drops = this.c.drops.filter(d => d.id !== dropId); this.game.notify(`Picked up ${WEAPONS[drop.weapon].name}.`); return true;
  }
}
