import { bladeSegment, meleeDuration, segmentDistance, segmentSegmentDistance, projectileHeight } from '../game/CombatGeometry';
import { heatRadius, inPlayerHeat, playerHeatSources } from './SurvivalSystem';
import type { Game } from '../game/Game';
import type { Point } from '../game/GameState';
import { ACTOR_HP, WEAPONS, type ActorType, type WeaponType } from '../data/weapons';
import type { Actor, Projectile } from '../game/CombatState';
import { SeededRNG, derive } from '../utils/SeededRNG';
import { distance } from '../world/WorldManager';
import { transact } from './InventorySystem';

export interface CombatUnit extends Point { id: string; hp: number; kind: 'player' | 'guard' | 'enemy' | 'npc'; villageId?: string | null }
export function shotgunDamage(range: number) { return Math.round(12 + 83 * (1 - Math.min(3, Math.max(0, range)) / 3)); }
export function equipmentDrops(seed: number, id: string) { return derive(seed, `equipment:${id}`) / 4294967296 < .07; }


export class CombatSystem {
  lastAttack = -100;
  readonly damageEvents: {x:number;z:number;amount:number;targetId:string;bleed:boolean}[]=[];
  readonly actorAttacks = new Map<string, number>();
  private velocities = new Map<string, Point>();
  constructor(private game: Game) { for (const actor of Object.values(game.state.combat.actors)) actor.heatInside ??= inPlayerHeat(game.state, actor); }
  private get s() { return this.game.state; }
  private get c() { return this.s.combat; }
  private nextId(prefix: string) { return `${prefix}:${this.c.sequence++}`; }
  private spawn(id: string, type: ActorType, point: Point, groupId: string, weapon: WeaponType | null, villageId: string | null = null) {
    if (this.c.actors[id]) return;
    const radius = type === 'polar_bear' ? .75 : .4;
    const solids = this.game.solids(point);
    let valid: Point | undefined;
    for (let i = 0; i < 64; i++) {
      const angle = i * 2.399963, r = i === 0 ? 0 : 1 + Math.floor(i / 8) * 1.5;
      const p = { x: point.x + Math.cos(angle) * r, z: point.z + Math.sin(angle) * r };
      if (!this.game.world.isWater(p.x,p.z) && distance(p,this.s.player) > radius + .8 && solids.every(s => distance(s,p) > s.radius + radius + .12) && Object.values(this.c.actors).every(a => a.hp <= 0 || distance(a,p) > radius + (a.type === 'polar_bear' ? .75 : .4) + .2)) { valid = p; break; }
    }
    if (!valid) return;
    point = valid;
    this.c.actors[id] = { id, type, ...point, hp: ACTOR_HP[type], weapon, groupId, villageId, homeX: point.x, homeZ: point.z, heading: 0, cooldown: 1, roamTimer: 0, targetX: point.x, targetZ: point.z, alerted: false, heatInside: false };
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
    const before=target.id==='player'?this.s.player.hp:this.c.actors[target.id]?.hp??this.s.workers.find(w=>w.id===target.id)?.hp??target.hp;
    if (before <= 0) return;
    if (target.id === 'player' && inPlayerHeat(this.s)) amount *= .5;
    if (target.id === 'player') this.s.player.hp = Math.max(0, this.s.player.hp - amount);
    else if (this.c.actors[target.id]) {
      const actor = this.c.actors[target.id], wasAlive = actor.hp > 0; actor.hp = Math.max(0, actor.hp - amount);
      if (ownerId === 'player') { actor.alerted = true; for (const member of Object.values(this.c.actors)) if (member.groupId === actor.groupId) member.alerted = true; }
      if (actor.villageId && ownerId === 'player' && !this.c.villageAlerts.includes(actor.villageId)) this.c.villageAlerts.push(actor.villageId);
      if (wasAlive && actor.hp <= 0) {
        this.c.kills++; delete this.c.statuses[actor.id];
        if (actor.weapon && equipmentDrops(this.s.world.seeds.loot, actor.id)) this.c.drops.push({ id: this.nextId('drop'), x: actor.x, z: actor.z, weapon: actor.weapon, uses: 100 });
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
    if(this.damageEvents.length>=64)this.damageEvents.shift();
    this.damageEvents.push({x:target.x,z:target.z,amount:Math.min(before,amount),targetId:target.id,bleed:ownerId==='bleed'});
    if (bleed&&before>amount) this.c.statuses[target.id] = { bleed: 10, tick: 0 };
  }
  attack(target: Point): boolean {
    if (this.game.paused || this.game.dead || this.c.cooldown > 0) return false;
    const weapon = this.c.weapons.find(w => w.id === this.c.equipped && w.uses > 0);
    if (!weapon) { this.game.notify('Equip a weapon. Traders sell replacements.'); return false; }
    const def = WEAPONS[weapon.type]; this.c.cooldown = def.cooldown; this.lastAttack = this.s.elapsed;
    this.fireWeapon('player', this.s.player, target, weapon.type,weapon.id);
    if(def.type !== 'melee') weapon.uses--;
    if (weapon.uses === 0) this.game.notify(`${def.name} is worn out after 100 uses. Equip a replacement.`);
    return true;
  }
  attackAssisted():boolean {
    if(this.game.paused||this.game.dead||this.c.cooldown>0)return false;
    const p=this.s.player,weapon=this.c.weapons.find(w=>w.id===this.c.equipped&&w.uses>0);
    if(!weapon)return this.attack(p);
    const range=Math.min(12,WEAPONS[weapon.type].range);
    const target=this.units().filter(u=>(u.kind==='enemy'||u.kind==='guard'&&!!u.villageId&&this.c.villageAlerts.includes(u.villageId))&&distance(u,p)<=range+this.hurtRadius(u)&&this.assistReach(p,u,weapon.type)&&!this.blocked(p,u)).sort((a,b)=>distance(a,p)-distance(b,p)||a.id.localeCompare(b.id))[0];
    if(target)p.heading=Math.atan2(target.x-p.x,target.z-p.z);
    return this.attack(target??{x:p.x+Math.sin(p.heading)*12,z:p.z+Math.cos(p.heading)*12});
  }
  private assistReach(origin:Point,unit:CombatUnit,weapon:WeaponType){
    if(WEAPONS[weapon].type!=='melee')return true;
    const heading=Math.atan2(unit.x-origin.x,unit.z-origin.z);
    for(let t=.1;t<=.8;t+=.025){const blade=bladeSegment(origin,heading,weapon,t);if(this.touches(unit,blade.a,blade.b))return true;}return false;
  }
  private hurtRadius(unit:CombatUnit){return this.c.actors[unit.id]?.type==='polar_bear'?1.95:.65;}
  private touches(unit:CombatUnit,a:Point,b:Point,padding=.1){
    const actor=this.c.actors[unit.id];
    if(actor?.type!=='polar_bear')return segmentDistance(unit,a,b)<=.65+padding;
    const dx=Math.sin(actor.heading),dz=Math.cos(actor.heading);
    return segmentSegmentDistance(a,b,{x:actor.x-dx*.8,z:actor.z-dz*.8},{x:actor.x+dx*1.3,z:actor.z+dz*1.3})<=.7+padding;
  }
  private blocked(a:Point,b:Point){return this.game.solids(b).some(s=>distance(s,a)>s.radius+.2&&distance(s,b)>s.radius+.2&&segmentDistance(s,a,b)<s.radius);}
  private canHit(ownerId: string, target: CombatUnit) {
    if (ownerId === target.id || target.hp <= 0) return false;
    if (ownerId === 'player') return true;
    const owner = this.c.actors[ownerId];
    return owner?.type === 'guard' ? target.kind === 'enemy' || target.kind === 'player' && !!owner.villageId && this.c.villageAlerts.includes(owner.villageId) : target.kind !== 'enemy';
  }
  fireWeapon(ownerId: string, from: Point, target: Point, weapon: WeaponType, weaponId?:string) {
    if (ownerId !== 'player') this.actorAttacks.set(ownerId, this.s.elapsed);
    // `from` can be an Actor or Player: never spread it into a shot, since its id would replace the projectile id.
    const def = WEAPONS[weapon], d = distance(from, target), dx = (target.x - from.x) / (d || 1), dz = (target.z - from.z) / (d || 1);
    if (def.type === 'melee') {
      const damage = weapon === 'spear' ? 3 + derive(this.s.world.seeds.wildlife, ownerId, this.c.sequence++, 0) % 8 : def.damage;
      this.c.projectiles.push({id:this.nextId('swing'),ownerId,kind:'swing',x:from.x,z:from.z,fromX:from.x,fromZ:from.z,targetX:from.x+dx*def.range,targetZ:from.z+dz*def.range,age:0,duration:meleeDuration(weapon),damage,weapon,...(weaponId?{weaponId}:{}),hitIds:[],wearCharged:false});
    } else if (def.type === 'pellet') {
      const volleyId=this.nextId('volley'),hitIds:string[]=[];
      for(let i=-2;i<=2;i++){const a=Math.atan2(dx,dz)+i*Math.PI/9;this.c.projectiles.push({id:this.nextId('pellet'),ownerId,kind:'pellet',x:from.x,z:from.z,fromX:from.x,fromZ:from.z,targetX:from.x+Math.sin(a)*3,targetZ:from.z+Math.cos(a)*3,age:0,duration:.15,damage:def.damage,volleyId,hitIds});}
    } else {
      const range = def.type === 'arrow' ? def.range : Math.min(def.range, Math.max(1, d));
      this.c.projectiles.push({ id: this.nextId('projectile'), ownerId, kind: def.type, x: from.x, z: from.z, fromX: from.x, fromZ: from.z, targetX: from.x + dx * range, targetZ: from.z + dz * range, age: 0, duration: range / (def.type === 'arrow' ? 24 : 10), damage: def.damage });
    }
  }
  private stepProjectile(p: Projectile, dt: number) {
    const old={x:p.x,z:p.z},previous=p.age/p.duration;p.age+=dt;const t=Math.min(1,p.age/p.duration);
    if(p.kind==='swing'){
      const owner=p.ownerId==='player'?this.s.player:this.c.actors[p.ownerId];
      if(!owner||owner.hp<=0)return false;
      if(!p.weapon||p.damage<=0)return t<1; // Legacy swings were cosmetic.
      p.x=owner.x;p.z=owner.z;const hits=p.hitIds??(p.hitIds=[]),units=this.units().filter(u=>this.canHit(p.ownerId,u)&&!hits.includes(u.id));
      const steps=Math.max(1,Math.ceil((t-previous)*48));
      for(let i=0;i<=steps;i++){
        const phase=previous+(t-previous)*i/steps;if(phase<.1||phase>.8)continue;
        const blade=bladeSegment(owner,owner.heading,p.weapon,phase);
        for(const unit of units)if(!hits.includes(unit.id)&&this.touches(unit,blade.a,blade.b)&&!this.blocked(owner,unit)){
          hits.push(unit.id);this.damage(unit,p.damage,p.ownerId,p.weapon==='machete');
          if(p.ownerId==='player'&&!p.wearCharged&&(unit.kind==='enemy'||unit.kind==='guard')){
            const weapon=this.c.weapons.find(w=>w.id===p.weaponId);if(weapon&&weapon.uses>0){weapon.uses--;if(weapon.uses===0)this.game.notify(`${WEAPONS[weapon.type].name} is worn out. Equip a replacement.`);}p.wearCharged=true;
          }
        }
      }
      return t<1;
    }
    p.x=p.fromX+(p.targetX-p.fromX)*t;p.z=p.fromZ+(p.targetZ-p.fromZ)*t;
    if(p.kind==='arrow'||p.kind==='pellet'&&p.damage>0){
      const n=Math.hypot(p.targetX-p.fromX,p.targetZ-p.fromZ)||1,dx=(p.targetX-p.fromX)/n,dz=(p.targetZ-p.fromZ)/n;
      const a={x:old.x-dx*(p.kind==='arrow'?.52:.04),z:old.z-dz*(p.kind==='arrow'?.52:.04)},b={x:p.x+dx*(p.kind==='arrow'?.63:.04),z:p.z+dz*(p.kind==='arrow'?.63:.04)};
      const hit=this.units().filter(u=>this.canHit(p.ownerId,u)&&!(p.hitIds??[]).includes(u.id)&&this.touches(u,a,b,.06)&&!this.blocked(old,u)).sort((a,b)=>distance(a,old)-distance(b,old))[0];
      if(hit){
        this.damage(hit,p.kind==='pellet'?shotgunDamage(distance({x:p.fromX,z:p.fromZ},hit)):p.damage,p.ownerId);
        if(p.volleyId)for(const shot of this.c.projectiles)if(shot.volleyId===p.volleyId){shot.hitIds??=[];if(!shot.hitIds.includes(hit.id))shot.hitIds.push(hit.id);}
        return false;
      }
      if(this.blocked(old,p))return false;
    }
    if(p.kind==='bottle'){
      const fromHeight=this.game.world.walkHeight(p.fromX,p.fromZ),toHeight=this.game.world.walkHeight(p.targetX,p.targetZ);
      for(let i=0;i<=8;i++){
        const phase=previous+(t-previous)*i/8,point={x:p.fromX+(p.targetX-p.fromX)*phase,z:p.fromZ+(p.targetZ-p.fromZ)*phase};
        const y=projectileHeight('bottle',phase,fromHeight,toHeight);
        const hit=this.units().find(u=>this.canHit(p.ownerId,u)&&this.touches(u,point,point,.12)&&y>=this.game.world.walkHeight(u.x,u.z)&&y<=this.game.world.walkHeight(u.x,u.z)+2.15);
        if(hit){this.damage(hit,p.damage,p.ownerId);this.c.fires.push({id:this.nextId('fire'),ownerId:p.ownerId,...point,remaining:10,tick:0,charred:false});return false;}
      }
    }
    if(t>=1){if(p.kind==='bottle')this.c.fires.push({id:this.nextId('fire'),ownerId:p.ownerId,x:p.targetX,z:p.targetZ,remaining:10,tick:0,charred:false});return false;}
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
    for (const [id, status] of Object.entries(this.c.statuses)) { status.tick += Math.min(dt,status.bleed); status.bleed = Math.max(0,status.bleed-dt); while (status.tick >= 1 - 1e-8) { status.tick = Math.max(0, status.tick - 1); const u = this.units().find(u => u.id === id); if (u) this.damage(u, 2, 'bleed'); } if (status.bleed <= 1e-8) delete this.c.statuses[id]; }
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
      this.heatEntry(actor); if (actor.hp <= 0) continue;
      actor.cooldown = Math.max(0, actor.cooldown - dt); actor.roamTimer = Math.max(0, actor.roamTimer - dt);
      const guard = actor.type === 'guard', hostilePlayer = !guard || !!actor.villageId && this.c.villageAlerts.includes(actor.villageId);
      const targets = units.filter(u => u.hp > 0 && u.id !== actor.id && (guard ? u.kind === 'enemy' || u.kind === 'player' && hostilePlayer : u.kind !== 'enemy'));
      const target = targets.filter(u => distance(u, actor) < (actor.alerted ? 30 : snow ? 27 : guard ? 16 : 12)).sort((a, b) => distance(a, actor) - distance(b, actor))[0];
      const weapon = actor.weapon, range = weapon ? WEAPONS[weapon].range : 1.65;
      if (target) {
        const d = distance(actor, target); this.face(actor, Math.atan2(target.x - actor.x, target.z - actor.z), dt);
        if (d < range && actor.cooldown === 0) {
          actor.cooldown = weapon ? WEAPONS[weapon].cooldown : 1.5;
          if (weapon) this.fireWeapon(actor.id, actor, target, weapon); else { this.actorAttacks.set(actor.id,this.s.elapsed); this.damage(target, 5, actor.id); }
        }
        if (d > (weapon === 'bow' ? 8 : weapon === 'molotov' ? 6 : weapon === 'shotgun' ? 2.2 : 1.35)) this.walk(actor, target, dt, actor.type === 'polar_bear' ? 2.1 : 1.8);
      } else {
        if (actor.roamTimer <= 0) { actor.roamTimer = 3 + derive(this.s.world.seeds.wildlife, actor.id, Math.floor(this.s.elapsed / 4)) % 5; const a = derive(this.s.world.seeds.wildlife, actor.id, Math.floor(this.s.elapsed / 5)) / 4294967296 * Math.PI * 2; actor.targetX = actor.homeX + Math.cos(a) * (guard ? 5 : 11); actor.targetZ = actor.homeZ + Math.sin(a) * (guard ? 5 : 11); }
        this.walk(actor, { x: actor.targetX, z: actor.targetZ }, dt, 1.1);
      }
      this.heatEntry(actor);
    }
  }
  private face(actor: Actor, angle: number, dt: number) {
    actor.heading += Math.atan2(Math.sin(angle - actor.heading), Math.cos(angle - actor.heading)) * (1 - Math.exp(-dt * 8));
  }
  private heatEntry(actor: Actor) {
    const hostile = actor.type !== 'guard' || !!actor.villageId && this.c.villageAlerts.includes(actor.villageId);
    const sources = playerHeatSources(this.s);
    const inside = sources.some(f => distance(f,actor) < heatRadius(f) + (actor.heatInside ? .35 : 0));
    if (inside && !actor.heatInside && hostile && actor.hp > 0) this.damage({ ...actor, kind: actor.type === 'guard' ? 'guard' : 'enemy' }, ACTOR_HP[actor.type] * .1, 'furnace');
    actor.heatInside = inside;
  }
  private walk(actor: Actor, target: Point, dt: number, speed: number) {
    const d = distance(actor,target), oldVelocity = this.velocities.get(actor.id) ?? {x:0,z:0};
    const dx = d > .5 ? (target.x-actor.x)/d*speed : 0, dz = d > .5 ? (target.z-actor.z)/d*speed : 0;
    const blend = 1-Math.exp(-dt*5), vx = oldVelocity.x+(dx-oldVelocity.x)*blend, vz = oldVelocity.z+(dz-oldVelocity.z)*blend;
    const step = Math.min(speed*dt,Math.hypot(vx,vz)*dt,d), radius = actor.type === 'polar_bear' ? .75 : .4;
    if (step < 1e-6) { this.velocities.set(actor.id,{x:0,z:0}); return; }
    const solids = this.game.solids(actor);
    const penetration = (p:Point) => solids.reduce((n,s)=>n+Math.max(0,s.radius+radius-distance(s,p)),0);
    const current = penetration(actor), base = Math.atan2(vx,vz);
    for (const turn of [0,.5,-.5,1,-1,1.5,-1.5,Math.PI]) {
      const angle = base+turn, p = {x:actor.x+Math.sin(angle)*step,z:actor.z+Math.cos(angle)*step};
      const crowd = Object.values(this.c.actors).some(a=>a!==actor&&a.hp>0&&distance(a,p)<radius+(a.type==='polar_bear'?.75:.4)+.08&&distance(a,p)<distance(a,actor));
      if (!crowd && !this.game.world.isWater(p.x,p.z) && penetration(p) <= Math.max(.001,current-.00001)) {
        actor.x=p.x;actor.z=p.z;this.velocities.set(actor.id,{x:Math.sin(angle)*step/dt,z:Math.cos(angle)*step/dt});this.face(actor,angle,dt);return;
      }
    }
    this.velocities.set(actor.id,{x:0,z:0});
  }
  pickup(dropId: string) {
    const drop = this.c.drops.find(d => d.id === dropId); if (!drop || distance(drop, this.s.player) > 3) return false;
    this.c.weapons.push({ id: this.nextId('weapon'), type: drop.weapon, uses: drop.uses }); this.c.drops = this.c.drops.filter(d => d.id !== dropId); this.game.notify(`Picked up ${WEAPONS[drop.weapon].name}.`); return true;
  }
}
