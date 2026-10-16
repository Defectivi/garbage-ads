import {isNight} from './DayNight';
import {spawnProtected,SPAWN_RADIUS} from './SpawnProtection';
import { BUILDINGS } from '../data/definitions';
import { bladeSegment, meleeDuration, segmentDistance, segmentSegmentDistance, projectileHeight } from '../game/CombatGeometry';
import { heatRadius, inPlayerHeat, playerHeatSources, structureIntact } from './SurvivalSystem';
import type { Game } from '../game/Game';
import type { Point } from '../game/GameState';
import { ACTOR_HP, WEAPONS, weaponUses, type ActorType, type WeaponType } from '../data/weapons';
import type { Actor, Projectile } from '../game/CombatState';
import { SeededRNG, derive } from '../utils/SeededRNG';
import { distance } from '../world/WorldManager';
import { transact } from './InventorySystem';

export interface CombatUnit extends Point { id: string; hp: number; kind: 'player' | 'guard' | 'enemy' | 'npc'|'building'; radius?:number; villageId?: string | null }
export function shotgunDamage(range:number,angle=0){const band=Math.max(range/3,Math.abs(angle)/(Math.PI*2/9));return band<=1/3?105:band<=2/3?50:15;}
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
      if (!this.game.world.isWater(p.x,p.z) && (type==='guard'&&!this.c.villageAlerts.includes(villageId??'')||!spawnProtected(this.s,p)) && distance(p,this.s.player) > radius + .8 && solids.every(s => distance(s,p) > s.radius + radius + .12) && Object.values(this.c.actors).every(a => a.hp <= 0 || distance(a,p) > radius + (a.type === 'polar_bear' ? .75 : .4) + .2)) { valid = p; break; }
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
      for(const wave of (isNight(this.s)?['day',`night:${Math.floor(this.s.elapsed/1200)}`]:['day'])){
      const key = wave==='day'?`encounter:${x}:${z}`:`${wave}:encounter:${x}:${z}`; if (this.c.encounters.includes(key)) continue;
      if(this.s.spawnProtection&&this.s.spawnProtection.remaining>0&&distance({x:x*64+32,z:z*64+32},this.s.spawnProtection)<SPAWN_RADIUS+46)continue;
      this.c.encounters.push(key); const rng = new SeededRNG(derive(this.s.world.seeds.wildlife, 'encounter', x, z));
      const groups: { type: ActorType; count: number; x: number; z: number }[] = [
        { type: 'polar_bear', count: 1, x: x * 64 + rng.range(14, 50), z: z * 64 + rng.range(14, 50) }
      ];
      if(derive(this.s.world.seeds.wildlife,'wolf-pack',x,z)%3===0||x===0&&z===0)groups.push({type:'wolf',count:3+Math.floor(rng.next()*10),x:x*64-24,z:z*64+25});
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
    }}
  }
  units(): CombatUnit[] {
    const units: CombatUnit[] = [{ ...this.s.player, id: 'player', kind: 'player' }];
    for (const a of Object.values(this.c.actors)) if (a.hp > 0 && distance(a, this.s.player) < 85 && this.game.settlement.refuge(a.id)?.phase !== 'hidden') units.push({ ...a, kind: a.type === 'guard' ? 'guard' : 'enemy' });
    for (const w of this.s.workers) if (w.hp > 0 && distance(w, this.s.player) < 85&&this.game.settlement.refuge(w.id)?.phase!=='hidden') units.push({ ...w, ...this.game.settlement.position(w.id,w),kind: 'npc' });
    for (const r of this.game.world.settlements(this.s.player, 2)) { const npc = this.game.npc(r); if (npc.hp > 0&&this.game.settlement.refuge(npc.id)?.phase!=='hidden') units.push({ ...this.game.settlement.position(npc.id,r.trader), id: npc.id, hp: npc.hp, kind: 'npc', villageId: r.id.startsWith('village:') ? r.id : null }); }
    for(const building of this.game.settlement.structures()){
      const integrity=this.game.settlement.integrity(building);if(integrity.stage!=='gone'&&distance(building,this.s.player)<85)units.push({...building,hp:integrity.hp,kind:'building',radius:BUILDINGS[building.type].radius});
    }
    return units;
  }
  damage(target: CombatUnit, amount: number, ownerId: string, bleed = false) {
    if(target.kind==='building'){
      if(ownerId==='bleed')return 0;
      const lost=this.game.settlement.damage(target.id,amount,target);
      if(lost>0){if(this.damageEvents.length>=64)this.damageEvents.shift();this.damageEvents.push({x:target.x,z:target.z,amount:lost,targetId:target.id,bleed:false});}return lost;
    }
    const before=target.id==='player'?this.s.player.hp:this.c.actors[target.id]?.hp??this.s.workers.find(w=>w.id===target.id)?.hp??target.hp;
    if (before <= 0 || target.id==='player'&&((this.s.player.invulnerable??0)>0||spawnProtected(this.s))) return 0;
    const enemy=this.c.actors[target.id];
    if(enemy&&(enemy.type==='wolf'||enemy.type==='polar_bear')&&isNight(this.s))amount*=.75;
    if(enemy&&this.hostile(enemy)&&inPlayerHeat(this.s,enemy)&&ownerId!=='furnace')amount*=2;
    if (target.id === 'player' && inPlayerHeat(this.s)) amount *= .5;
    if (target.id === 'player'){this.s.player.hp = Math.max(0, this.s.player.hp - amount);if(amount>0&&this.s.furnaces.some(f=>structureIntact(this.s,f.id)&&distance(f,this.s.player)<heatRadius(f)))this.s.player.recentDamage=3;}
    else if (this.c.actors[target.id]) {
      const actor = this.c.actors[target.id], wasAlive = actor.hp > 0; actor.hp = Math.max(0, actor.hp - amount);
      if (ownerId === 'player') { actor.alerted = true; for (const member of Object.values(this.c.actors)) if (member.groupId === actor.groupId) member.alerted = true; }
      if (actor.villageId && ownerId === 'player' && !this.c.villageAlerts.includes(actor.villageId)) this.c.villageAlerts.push(actor.villageId);
      if (wasAlive && actor.hp <= 0) {
        this.c.kills++; delete this.c.statuses[actor.id];
        if (actor.weapon && equipmentDrops(this.s.world.seeds.loot, actor.id)) this.c.drops.push({ id: this.nextId('drop'), x: actor.x, z: actor.z, weapon: actor.weapon, uses: actor.weapon==='molotov'?1:weaponUses(actor.weapon) });
        this.game.notify(`${actor.type === 'polar_bear' ? 'Polar bear' : actor.type === 'guard' ? 'Guard' : actor.type==='wolf'?'Wolf':'Raider'} defeated.`);
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
    if((target.kind==='npc'||enemy?.type==='guard')&&before<=amount&&this.s.changes.refuges)delete this.s.changes.refuges[target.id];
    const hurtWorker=this.s.workers.find(w=>w.id===target.id);
    if((target.kind==='npc'||enemy?.type==='guard')&&before>amount&&(ownerId!=='bleed'||!!hurtWorker)&&(!hurtWorker||hurtWorker.hp<50))this.game.settlement.flee(target.id,target);
    if(this.damageEvents.length>=64)this.damageEvents.shift();
    this.damageEvents.push({x:target.x,z:target.z,amount:Math.min(before,amount),targetId:target.id,bleed:ownerId==='bleed'});
    if (bleed&&before>amount) this.c.statuses[target.id] = { ...this.c.statuses[target.id],bleed: 7, tick: 0, bleedDamage:7 };
    return Math.min(before,amount);
  }
  attack(target: Point): boolean {
    if (this.game.paused || this.game.dead || (this.s.player.stunned??0)>0 || this.c.cooldown > 0) return false;
    const weapon = this.c.weapons.find(w => w.id === this.c.equipped && w.uses > 0);
    this.game.gathering=undefined;
    const type=weapon?.type??'punch',def=type==='punch'?{type:'melee',cooldown:1,range:1,damage:2}:WEAPONS[type];
    this.c.cooldown=def.cooldown;this.lastAttack=this.s.elapsed;
    this.fireWeapon('player',this.s.player,target,type,weapon?.id);
    if(weapon&&def.type!=='melee'){weapon.uses--;if(weapon.uses===0)this.game.notify(`${WEAPONS[weapon.type].name} is worn out. Equip a replacement.`);}
    return true;
  }
  attackAssisted():boolean {
    if(this.game.paused||this.game.dead||(this.s.player.stunned??0)>0||this.c.cooldown>0)return false;
    const p=this.s.player,weapon=this.c.weapons.find(w=>w.id===this.c.equipped&&w.uses>0);
    const type=weapon?.type??'punch',range=type==='punch'?1:Math.min(12,WEAPONS[type].range);
    const target=this.units().filter(u=>(u.kind==='enemy'||u.kind==='guard'&&!!u.villageId&&this.c.villageAlerts.includes(u.villageId))&&distance(u,p)<=range+this.hurtRadius(u)&&this.assistReach(p,u,type)&&!this.blocked(p,u,u.id)).sort((a,b)=>distance(a,p)-distance(b,p)||a.id.localeCompare(b.id))[0];
    if(target)p.heading=Math.atan2(target.x-p.x,target.z-p.z);
    return this.attack(target??{x:p.x+Math.sin(p.heading)*12,z:p.z+Math.cos(p.heading)*12});
  }
  private assistReach(origin:Point,unit:CombatUnit,weapon:WeaponType|'punch'){
    if(weapon!=='punch'&&WEAPONS[weapon].type!=='melee')return true;
    const heading=Math.atan2(unit.x-origin.x,unit.z-origin.z);
    for(let t=.1;t<=.8;t+=.025){const blade=bladeSegment(origin,heading,weapon,t);if(this.touches(unit,blade.a,blade.b))return true;}return false;
  }
  private hurtRadius(unit:CombatUnit){if(unit.kind==='building')return unit.radius??2;return this.c.actors[unit.id]?.type==='polar_bear'?1.95:this.c.actors[unit.id]?.type==='wolf'?1.6:.65;}
  private touches(unit:CombatUnit,a:Point,b:Point,padding=.1){
    if(unit.kind==='building')return segmentDistance(unit,a,b)<=(unit.radius??2)+padding;
    const actor=this.c.actors[unit.id];
    if(actor?.type!=='polar_bear'&&actor?.type!=='wolf')return segmentDistance(unit,a,b)<=.65+padding;
    const dx=Math.sin(actor.heading),dz=Math.cos(actor.heading),back=actor.type==='wolf'?.68:.8,front=actor.type==='wolf'?1.1:1.3,radius=actor.type==='wolf'?.45:.7;
    return segmentSegmentDistance(a,b,{x:actor.x-dx*back,z:actor.z-dz*back},{x:actor.x+dx*front,z:actor.z+dz*front})<=radius+padding;
  }
  private blocked(a:Point,b:Point,targetId?:string){return this.game.solids(b).some(s=>(!('id'in s)||s.id!==targetId)&&distance(s,a)>s.radius+.2&&segmentDistance(s,a,b)<s.radius)||!this.game.world.visible(a,b);}
  private canHit(ownerId: string, target: CombatUnit) {
    if (ownerId === target.id || target.hp <= 0 || target.id==='player'&&spawnProtected(this.s)&&ownerId!=='player') return false;
    if (ownerId === 'player') return true;
    const owner = this.c.actors[ownerId];
    if(owner?.type==='wolf')return target.kind!=='building'&&this.c.actors[target.id]?.groupId!==owner.groupId;
    return owner?.type === 'guard' ? target.kind === 'enemy' || target.kind === 'player' && !!owner.villageId && this.c.villageAlerts.includes(owner.villageId) : target.kind !== 'enemy'||this.c.actors[target.id]?.type==='wolf';
  }
  fireWeapon(ownerId: string, from: Point, target: Point, weapon: WeaponType|'punch', weaponId?:string) {
    if (ownerId !== 'player') this.actorAttacks.set(ownerId, this.s.elapsed);
    // `from` can be an Actor or Player: never spread it into a shot, since its id would replace the projectile id.
    const def = weapon==='punch'?{type:'melee' as const,cooldown:1,range:1,damage:2}:WEAPONS[weapon], d = distance(from, target), dx = (target.x - from.x) / (d || 1), dz = (target.z - from.z) / (d || 1);
    if (def.type === 'melee') {
      const damage = weapon === 'spear' ? 3 + derive(this.s.world.seeds.wildlife, ownerId, this.c.sequence++, 0) % 8 : def.damage;
      this.c.projectiles.push({id:this.nextId('swing'),ownerId,kind:'swing',x:from.x,z:from.z,fromX:from.x,fromZ:from.z,targetX:from.x+dx*def.range,targetZ:from.z+dz*def.range,age:0,duration:meleeDuration(weapon),damage,weapon,...(weaponId?{weaponId}:{}),hitIds:[],wearCharged:false});
    } else if (def.type === 'pellet') {
      const volleyId=this.nextId('volley'),hitIds:string[]=[];
      for(let i=-2;i<=2;i++){const a=Math.atan2(dx,dz)+i*Math.PI/9;this.c.projectiles.push({id:this.nextId('pellet'),ownerId,kind:'pellet',x:from.x,z:from.z,fromX:from.x,fromZ:from.z,targetX:from.x+Math.sin(a)*3,targetZ:from.z+Math.cos(a)*3,age:0,duration:.15,damage:def.damage,volleyId,hitIds,weapon:'shotgun',aim:Math.atan2(dx,dz)});}
    } else {
      const range = def.type === 'arrow' ? def.range : Math.min(def.range, Math.max(1, d));
      this.c.projectiles.push({ id: this.nextId('projectile'), ownerId, kind: def.type, x: from.x, z: from.z, fromX: from.x, fromZ: from.z, targetX: from.x + dx * range, targetZ: from.z + dz * range, age: 0, duration: range / (def.type === 'arrow' ? 24 : 10), damage: def.damage, weapon });
    }
  }
  private stepProjectile(p: Projectile, dt: number) {
    const old={x:p.x,z:p.z},previous=p.age/p.duration;p.age+=dt;const t=Math.min(1,p.age/p.duration);
    if(p.kind==='swing'){
      const owner=p.ownerId==='player'?this.s.player:this.c.actors[p.ownerId];
      if(!owner||owner.hp<=0||p.ownerId==='player'&&(this.s.player.stunned??0)>0||this.game.settlement.refuge(p.ownerId))return false;
      if(!p.weapon||p.damage<=0)return t<1; // Legacy swings were cosmetic.
      p.x=owner.x;p.z=owner.z;const hits=p.hitIds??(p.hitIds=[]),units=this.units().filter(u=>this.canHit(p.ownerId,u)&&!hits.includes(u.id));
      const steps=Math.max(1,Math.ceil((t-previous)*48));
      for(let i=0;i<=steps;i++){
        const phase=previous+(t-previous)*i/steps;if(phase<.1||phase>.8)continue;
        const blade=bladeSegment(owner,owner.heading,p.weapon,phase);
        for(const unit of units)if(!hits.includes(unit.id)&&this.touches(unit,blade.a,blade.b)&&!this.blocked(owner,unit,unit.id)){
          hits.push(unit.id);const lost=this.damage(unit,p.damage,p.ownerId,p.weapon==='machete');if(lost>0&&p.weapon==='stone_sword'&&derive(this.s.world.seeds.wildlife,'stone-stun',this.c.sequence++)%10===0){const a=this.c.actors[unit.id];if(a&&a.hp>0)a.stunned=1;}
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
      const hit=this.units().filter(u=>this.canHit(p.ownerId,u)&&!(p.hitIds??[]).includes(u.id)&&this.touches(u,a,b,.06)&&!this.blocked(old,u,u.id)).sort((a,b)=>distance(a,old)-distance(b,old))[0];
      if(hit){
        const angle=Math.atan2(Math.sin(Math.atan2(hit.x-p.fromX,hit.z-p.fromZ)-(p.aim??0)),Math.cos(Math.atan2(hit.x-p.fromX,hit.z-p.fromZ)-(p.aim??0)));
        const lost=this.damage(hit,p.kind==='pellet'?shotgunDamage(distance({x:p.fromX,z:p.fromZ},hit),angle):p.damage,p.ownerId);
        if(lost>0&&p.kind==='arrow'&&hit.kind!=='building')this.c.statuses[hit.id]={...this.c.statuses[hit.id],bleed:5,tick:0,bleedDamage:3};
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
      for (const n of this.game.nodesInChunk(chunk)) if (n.resource === 'wood' && distance(n, point) <= 4 && this.game.nodeRemaining(n) > 0 && !this.c.charredNodes.includes(n.id)) this.c.charredNodes.push(n.id);
      chunk.trees.forEach((tree, i) => { const id = `tree:${chunk.id.replace(',', ':')}:${i}`; if (distance(tree, point) <= 4 && !this.c.charredTrees.includes(id)&&this.s.changes.terrain?.[id]!=='felled') this.c.charredTrees.push(id); });
    }
    this.game.revision++;
  }
  update(dt: number) {
    this.clearSpawnZone();this.ensureEncounters(); this.c.cooldown = Math.max(0, this.c.cooldown - dt);
    const weather = this.c.weather; weather.remaining -= dt;
    if (weather.remaining <= 0) { weather.mode = weather.mode === 'clear' ? 'snow' : 'clear'; weather.cycle++; weather.remaining = weather.mode === 'snow' ? 55 : 90 + derive(this.s.world.seeds.wildlife, 'weather', weather.cycle) % 61; this.game.notify(weather.mode === 'snow' ? 'Blizzard incoming. Fuel burns 3× faster; enemies track you from farther away.' : 'The storm has passed.'); }
    for (const [id, status] of Object.entries(this.c.statuses)) { status.tick += Math.min(dt,status.bleed); status.bleed = Math.max(0,status.bleed-dt); while (status.tick >= 1 - 1e-8) { status.tick = Math.max(0, status.tick - 1); const u = this.units().find(u => u.id === id); if (u) this.damage(u, status.bleedDamage??2, 'bleed'); } status.wolfTick=(status.wolfTick??0)+Math.min(dt,status.wolfBleed??0);status.wolfBleed=Math.max(0,(status.wolfBleed??0)-dt);while(status.wolfTick>=1-1e-8){status.wolfTick=Math.max(0,status.wolfTick-1);const u=this.units().find(u=>u.id===id);if(u)this.damage(u,4,'bleed');}if (status.bleed <= 1e-8 && status.wolfBleed<=1e-8) delete this.c.statuses[id]; }
    for (const fire of this.c.fires) {
      const active=Math.min(dt,Math.max(0,fire.remaining));fire.remaining -= dt; fire.tick += active;
      while (fire.tick >= 1 - 1e-8) { fire.tick = Math.max(0, fire.tick - 1); for (const u of this.units()) if (distance(u, fire) <= 4+(u.kind==='building'?(u.radius??2):0)) this.damage(u, u.kind==='building'?50:3, fire.ownerId); }
      if (fire.remaining <= 1e-8 && !fire.charred) { fire.charred = true; this.charTimber(fire); }
    }
    this.c.fires = this.c.fires.filter(f => f.remaining > 1e-8);
    this.c.projectiles = this.c.projectiles.filter(p => this.stepProjectile(p, dt));
    const units=this.units(),snow = weather.mode === 'snow';
    for (const actor of Object.values(this.c.actors)) {
      if(actor.hp<=0)continue;
      if(this.game.settlement.refuge(actor.id)?.phase!=='hidden'){this.heatEntry(actor);this.heatBurn(actor,dt);}
      if(actor.hp<=0)continue;
      actor.stunned=Math.max(0,(actor.stunned??0)-dt);if(actor.stunned>0){this.velocities.delete(actor.id);continue;}
      if(distance(actor,this.s.player)>70&&!(actor.type==='wolf'&&actor.pursuitId==='player')){if(actor.type!=='wolf'){delete actor.pursuitId;actor.alerted=false;actor.retreating=true;}continue;}
      actor.cooldown = Math.max(0, actor.cooldown - dt); actor.roamTimer = Math.max(0, actor.roamTimer - dt);
      if(this.game.settlement.refuge(actor.id)){this.velocities.delete(actor.id);continue;}
      const guard = actor.type === 'guard';
      const wolf=actor.type==='wolf';
      const targets=units.filter(u=>(u.id==='player'?this.s.player.hp:this.c.actors[u.id]?.hp??this.s.workers.find(w=>w.id===u.id)?.hp??this.s.changes.npcs[u.id]?.hp??u.hp)>0&&this.canHit(actor.id,u));
      let target=actor.pursuitId?targets.find(u=>u.id===actor.pursuitId):undefined;
      if(target&&!wolf&&distance(target,actor)>40){actor.retreating=true;actor.alerted=false;target=undefined;delete actor.pursuitId;}
      if(actor.retreating){if(distance(actor,{x:actor.homeX,z:actor.homeZ})>4){this.walk(actor,{x:actor.homeX,z:actor.homeZ},dt,1.8);continue;}actor.retreating=false;}
      if(!target)target=targets.filter(u=>distance(u,actor)<(actor.alerted?30:snow?27:guard?16:18)&&(!wolf||u.kind!=='building')).sort((a,b)=>distance(a,actor)-distance(b,actor)||a.id.localeCompare(b.id)).find(u=>!this.blocked(actor,u,u.id));
      if(target)actor.pursuitId=target.id;else delete actor.pursuitId;
      const weapon = actor.weapon, range = weapon ? WEAPONS[weapon].range : 1.65;
      if (target) {
        const d = distance(actor, target); this.face(actor, Math.atan2(target.x - actor.x, target.z - actor.z), dt);
        if (d < range && actor.cooldown === 0) {
          actor.cooldown = weapon ? WEAPONS[weapon].cooldown : 1.5;
          if (weapon) this.fireWeapon(actor.id, actor, target, weapon); else this.bite(actor,target);
        }
        if (d > (weapon === 'bow' ? 8 : weapon === 'molotov' ? 6 : weapon === 'shotgun' ? 2.2 : 1.35)) this.walk(actor, target, dt, actor.type==='wolf'?3.2:actor.type === 'polar_bear' ? 2.1 : 1.8);
      } else {
        if (actor.roamTimer <= 0) { actor.roamTimer = 3 + derive(this.s.world.seeds.wildlife, actor.id, Math.floor(this.s.elapsed / 4)) % 5; const a = derive(this.s.world.seeds.wildlife, actor.id, Math.floor(this.s.elapsed / 5)) / 4294967296 * Math.PI * 2; actor.targetX = actor.homeX + Math.cos(a) * (guard ? 5 : 11); actor.targetZ = actor.homeZ + Math.sin(a) * (guard ? 5 : 11); }
        this.walk(actor, { x: actor.targetX, z: actor.targetZ }, dt, 1.1);
      }
      this.heatEntry(actor);
    }
  }
  private bite(actor:Actor,target:CombatUnit){
    this.actorAttacks.set(actor.id,this.s.elapsed);
    const critical=actor.type==='polar_bear'&&derive(this.s.world.seeds.wildlife,'bear-critical',this.c.sequence++)%2===0;
    const lost=this.damage(target,actor.type==='wolf'?7:actor.type==='polar_bear'?(critical?30:15):5,actor.id);
    if(!lost)return;
    if(actor.type==='wolf')this.c.statuses[target.id]={...this.c.statuses[target.id],bleed:this.c.statuses[target.id]?.bleed??0,tick:this.c.statuses[target.id]?.tick??0,wolfBleed:12,wolfTick:this.c.statuses[target.id]?.wolfTick??0};
    if(actor.type==='polar_bear'&&target.id==='player'&&derive(this.s.world.seeds.wildlife,'bear-stun',this.c.sequence++)%10===0)this.s.player.stunned=3;
  }
  clearSpawnZone(){
    const zone=this.s.spawnProtection;if(!zone||zone.remaining<=0)return;
    for(const actor of Object.values(this.c.actors))if(actor.hp>0&&this.hostile(actor)&&spawnProtected(this.s,actor)){
      const start=Math.atan2(actor.x-zone.x,actor.z-zone.z);
      for(let i=0;i<64;i++){const angle=start+i*.4,r=SPAWN_RADIUS+5+Math.floor(i/16)*6,p={x:zone.x+Math.sin(angle)*r,z:zone.z+Math.cos(angle)*r};
        if(!this.game.world.isWater(p.x,p.z)&&this.game.solids(p).every(s=>distance(s,p)>s.radius+1)){actor.x=p.x;actor.z=p.z;actor.heatInside=false;actor.heatBurn=0;actor.cooldown=Math.max(1,actor.cooldown);delete actor.pursuitId;this.velocities.delete(actor.id);break;}
      }
    }
  }
  private face(actor: Actor, angle: number, dt: number) {
    actor.heading += Math.atan2(Math.sin(angle - actor.heading), Math.cos(angle - actor.heading)) * (1 - Math.exp(-dt * 8));
  }
  private hostile(actor:Actor){return actor.type!=='guard'||!!actor.villageId&&this.c.villageAlerts.includes(actor.villageId);}
  private heatBurn(actor:Actor,dt:number){
    if(!this.hostile(actor)||!inPlayerHeat(this.s,actor)){actor.heatBurn=0;return;}
    actor.heatBurn=(actor.heatBurn??0)+dt;
    while(actor.heatBurn>=1-1e-8&&actor.hp>0){actor.heatBurn=Math.max(0,actor.heatBurn-1);this.damage({...actor,kind:actor.type==='guard'?'guard':'enemy'},12,'furnace');}
  }
  private heatEntry(actor: Actor) {
    const hostile = actor.type !== 'guard' || !!actor.villageId && this.c.villageAlerts.includes(actor.villageId);
    const sources = playerHeatSources(this.s);
    const inside = sources.some(f => distance(f,actor) < heatRadius(f) + (actor.heatInside ? .35 : 0));
    if (inside && !actor.heatInside && hostile && actor.hp > 0) this.damage({ ...actor, kind: actor.type === 'guard' ? 'guard' : 'enemy' }, ACTOR_HP[actor.type] * .1, 'furnace');
    actor.heatInside = inside;
  }
  private walk(actor: Actor, target: Point, dt: number, speed: number) {
    if(this.hostile(actor)&&inPlayerHeat(this.s,actor))speed*=.5;
    if(this.game.world.isWater(actor.x,actor.z))speed*=.1;
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
      if (!crowd && (!this.hostile(actor)||!spawnProtected(this.s,p)) && penetration(p) <= Math.max(.001,current-.00001)) {
        actor.x=p.x;actor.z=p.z;this.velocities.set(actor.id,{x:Math.sin(angle)*step/dt,z:Math.cos(angle)*step/dt});this.face(actor,angle,dt);return;
      }
    }
    this.velocities.set(actor.id,{x:0,z:0});
  }
  pickup(dropId: string) {
    const drop = this.c.drops.find(d => d.id === dropId); if (!drop || distance(drop, this.s.player) > 3) return false;
    this.c.weapons.push({ id: this.nextId('weapon'), type: drop.weapon, uses: drop.weapon==='molotov'?1:Math.min(drop.uses,weaponUses(drop.weapon)) }); this.c.drops = this.c.drops.filter(d => d.id !== dropId); this.game.notify(`Picked up ${WEAPONS[drop.weapon].name}.`); return true;
  }
}
