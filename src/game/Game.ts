import {isNight} from '../systems/DayNight';
import {harvestRoute,workerHarvestReach} from '../systems/WorkerHarvest';
import {CITY_OFFERS} from '../data/cityStore';
import {maxPlayerHP} from './GameState';
import {beginSpawnProtection} from '../systems/SpawnProtection';
import {furnaceCost,MAX_FURNACE_LEVEL,expandsAtLevel} from '../data/furnaces';
import {movementMultiplier,updateExposure} from '../systems/StatusSystem';
import { SettlementSystem } from '../systems/SettlementSystem';
import type { SettlementEvent } from './PresentationEvents';
import { MOVEMENT,GATHER_SECONDS,INT32_MAX } from './GameConfig';
import { BUILDINGS, RESOURCE_IDS, balances, type Balances, type BuildingType, type Resource } from '../data/definitions';
import { WorldManager, distance, type Chunk, type Node, type Ruin, type FishingSpot } from '../world/WorldManager';
import type { GameState, Point, Worker } from './GameState';
import { transact, single, negate, exchange, type Result } from '../systems/InventorySystem';
import { updateSurvival } from '../systems/SurvivalSystem';
import { trader } from '../data/trades';
import { derive } from '../utils/SeededRNG';
import { route } from '../systems/Navigation';
import { CombatSystem } from '../systems/CombatSystem';
import { WEAPONS, weaponCost, weaponUses, type WeaponType } from '../data/weapons';
export interface Input { x: number; z: number; sprint?: boolean }
export class Game {
  readonly world: WorldManager;
  readonly combat: CombatSystem;
  readonly settlement:SettlementSystem;
  paused = true;
  message = 'Welcome to the northern wilderness.';
  revision = 0;
  readonly collectionEvents: { resource: Resource; amount: number; x: number; z: number }[] = [];
  readonly actionEvents: SettlementEvent[] = [];
  private action(event: SettlementEvent) { if(this.actionEvents.length>=24)this.actionEvents.shift();this.actionEvents.push(event); }
  lastGather = -100;
  gathering?:{node:Node;remaining:number};
  readonly terrainEvents:{id:string;x:number;z:number;scale:number}[]=[];
  private collected(resource: Resource, amount: number, point: Point) {
    if (this.collectionEvents.length >= 32) this.collectionEvents.shift();
    this.collectionEvents.push({ resource, amount, x: point.x, z: point.z });
  }
  fishing?: { spot: FishingSpot; remaining: number };
  readonly harvestTargets=new Map<string,Node>();
  private unavailableSources=new Map<string,Map<string,number>>();
  private fuelTasks=new Map<string,string>();
  private paths = new Map<string, Point[]>();
  private velocity = { x: 0, z: 0 };
  constructor(public state: GameState) { for(const w of state.combat.weapons)w.uses=Math.min(w.uses,weaponUses(w.type));this.world = new WorldManager(state.world); this.combat = new CombatSystem(this);this.settlement=new SettlementSystem(this); }
  get inventoryLimit() { return this.state.settings.inventoryLimit ? Math.min(INT32_MAX,this.state.settings.inventoryLimit + this.state.buildings.filter(b => b.type === 'storage'&&this.settlement.intact(b.id)).length * 50) : 0; }
  get dead() { return this.state.player.hp <= 0 || this.state.settings.difficulty === 'survival' && this.state.player.warmth <= 0; }
  notify(message: string) { this.message = message; }
  nodeRemaining(node: Node) { if(node.id.startsWith('fish:'))return Math.max(0,node.amount-(this.state.changes.fishing[node.id]??0));return this.state.changes.nodes[node.id] ?? node.amount; }
  nodeResource(node: Node): Resource { return this.state.combat.charredNodes.includes(node.id) ? 'charcoal' : node.resource; }
  nodesInChunk(chunk: Chunk): Node[] {
    const terrain=this.state.changes.terrain??{};
    const nodes=chunk.nodes.filter(n=>!this.state.buildings.some(b=>b.id==='starter:hut'&&distance(b,n)<3.5)).filter(n=>!this.world.bridgeAt(n.x,n.z)).filter(n=>this.state.world.generationVersion<4||!this.world.villages().some(v=>distance(v,n)<15)).flatMap((n):Node[]=>{
      const large=n.resource==='stone'&&!n.id.startsWith('starter:')&&derive(this.state.world.seeds.resources,n.id)%3===0;
      if(!large)return[n];
      if(terrain[n.id]==='broken')return Array.from({length:3},(_,i)=>({...n,id:`fragment:${n.id}:${i}`,x:n.x+Math.cos(i*2.1)*.6,z:n.z+Math.sin(i*2.1)*.6,amount:Math.floor(this.nodeRemaining(n)/3)+(i<this.nodeRemaining(n)%3?1:0),radius:.4,kind:'fragment' as const}));
      return[{...n,kind:'boulder',radius:1.7}];
    });
    return [...nodes,...chunk.trees.flatMap((tree,i):Node[]=>{
      const id=`tree:${chunk.cx}:${chunk.cz}:${i}`;if(this.world.bridgeAt(tree.x,tree.z))return[];
      if(this.state.combat.charredTrees.includes(id))return[{...tree,id:`charcoal:${id}`,resource:'charcoal',amount:3,radius:.4}];
      if(terrain[id]==='felled')return[{...tree,id:`log:${id}`,resource:'wood',amount:3+Math.floor(tree.scale*2),radius:.7,kind:'log'}];
      return[{...tree,id,resource:'wood',amount:1,radius:.38*tree.scale,kind:'tree',scale:tree.scale}];
    })];
  }
  nodes() { return this.world.around(this.state.player).flatMap(chunk => this.nodesInChunk(chunk)); }
  solids(point: Point) {
    const trees = this.world.around(point).flatMap(c => c.trees.flatMap((t, i) => (this.world.bridgeAt(t.x,t.z)||this.state.combat.charredTrees.includes(`tree:${c.cx}:${c.cz}:${i}`)||this.state.changes.terrain?.[`tree:${c.cx}:${c.cz}:${i}`]==='felled') ? [] : [{ ...t, radius: .38 * t.scale }]));
    const ruins=this.world.settlements(point).flatMap(r=>[...(this.npc(r).hp>0&&this.settlement.refuge(`npc:${r.id}`)?.phase!=='hidden'?[{id:`npc:${r.id}`,...this.settlement.position(`npc:${r.id}`,r.trader),radius:.5}]:[]),{...r.container,radius:.65}]);
    const rocks=this.world.around(point).flatMap(c=>this.nodesInChunk(c)).filter(n=>n.kind==='boulder'&&this.nodeRemaining(n)>0).map(n=>({...n,radius:1.45}));
    return [...trees,...rocks,...ruins,...this.settlement.structures(point).filter(b=>this.settlement.integrity(b).stage!=='gone').map(b=>({...b,radius:BUILDINGS[b.type].radius}))];
  }
  move(point: Point, dx: number, dz: number, radius = .42,ignoreId?:string) {
    let x = point.x + dx, z = point.z + dz;
    for (const s of this.solids({ x, z })) {
      if('id' in s&&s.id===ignoreId)continue;
      const d = Math.hypot(x - s.x, z - s.z), min = s.radius + radius;
      if (d < min) { x = s.x + (d ? (x - s.x) / d : 1) * min; z = s.z + (d ? (z - s.z) / d : 0) * min; }
    }
    const bridge=this.world.bridgeAt(point.x,point.z)??this.world.bridgeAt(x,z);
    if(bridge&&Math.abs(point.z-bridge.z)<bridge.halfLength-.4&&Math.abs(z-bridge.z)<bridge.halfLength-.4){
      const oldSide=point.x-bridge.x;if(Math.abs(oldSide)<=bridge.halfWidth)x=bridge.x+Math.max(-2.3+radius,Math.min(2.3-radius,x-bridge.x));
      else if(Math.abs(x-bridge.x)<2.3+radius)x=bridge.x+Math.sign(oldSide)*(2.3+radius);
    }
    point.x = x; point.z = z;
  }
  stopMovement() { this.velocity.x = 0; this.velocity.z = 0; }
  update(dt: number, input: Input = { x: 0, z: 0 }) {
    if (this.paused || this.dead) return;
    dt = Math.min(.1, Math.max(0, dt));
    updateExposure(this.state,dt,this.world.isWater(this.state.player.x,this.state.player.z));
    const len = Math.hypot(input.x, input.z), factor = 1 - Math.exp(-dt * MOVEMENT.response);
    const sprint = !!input.sprint && len > .1, speed = (sprint ? MOVEMENT.sprintSpeed : MOVEMENT.walkSpeed)*movementMultiplier(this.state,sprint);
    if(speed===0)this.stopMovement();
    const oldSpeed=Math.hypot(this.velocity.x,this.velocity.z);if(oldSpeed>speed&&oldSpeed>0){this.velocity.x*=speed/oldSpeed;this.velocity.z*=speed/oldSpeed;}
    this.velocity.x += (input.x / Math.max(1, len) * speed - this.velocity.x) * factor;
    this.velocity.z += (input.z / Math.max(1, len) * speed - this.velocity.z) * factor;
    const beforeMove={x:this.state.player.x,z:this.state.player.z};
    this.move(this.state.player, this.velocity.x * dt, this.velocity.z * dt);
    if (len > .1) this.state.player.heading = Math.atan2(input.x, input.z);
    this.combat.update(dt); updateSurvival(this.state, dt, sprint,distance(beforeMove,this.state.player)>.0001);
    for (const r of this.world.settlements(this.state.player)) if (distance(r, this.state.player) < 20 && !this.state.discovered.includes(r.id)) { this.state.discovered.push(r.id); this.notify(`Discovered ${r.name}. Search the chest and speak to the trader.`); }
    if (this.fishing) {
      if (distance(this.fishing.spot, this.state.player) > 3 || len > .1) { this.fishing = undefined; this.notify('Fishing cancelled.'); }
      else if ((this.fishing.remaining -= dt) <= 0) {
        const f = this.fishing.spot, previous = this.state.changes.fishing[f.id] ?? 0, catchSize = Math.min(f.availability - previous, 1 + derive(this.state.world.seeds.resources, f.id, previous, 0) % 3);
        const result = transact([{ account: this.state.inventory, delta: { fish: catchSize }, capacity: this.inventoryLimit }], this.state.settings);
        if (result.ok) { this.state.changes.fishing[f.id] = previous + catchSize; this.collected('fish', catchSize, f); this.notify(`Caught ${catchSize} fish. Eat them for warmth or barter at a settlement.`); } else this.notify(result.error);
        this.fishing = undefined;
      }
    }
    if(this.gathering){
      const task=this.gathering;
      if((this.state.player.stunned??0)>0||len>.1||distance(task.node,this.state.player)>3||this.nodeRemaining(task.node)<=0){this.gathering=undefined;this.notify('Gathering cancelled.');}
      else{const before=task.remaining;task.remaining-=dt;if(Math.floor(before/.65)!==Math.floor(task.remaining/.65))this.lastGather=this.state.elapsed;if(task.remaining<=1e-8){this.gathering=undefined;const result=this.gather(task.node);if(!result.ok)this.notify(result.error);}}
    }
    this.updateCampfires(dt);
    this.settlement.update(dt);
    this.updateConstruction(dt);
    this.updateWorkers(dt);
  }
  startGather(node:Node):Result {
    if(this.paused||this.dead)return{ok:false,error:'Resume before gathering.'};
    if((this.state.player.stunned??0)>0)return{ok:false,error:'Wait for the stun to end.'};
    if(this.gathering||this.fishing)return{ok:false,error:'Finish the current action first.'};
    if(distance(node,this.state.player)>3||this.nodeRemaining(node)<=0)return{ok:false,error:'Approach an available resource.'};
    this.gathering={node:{...node},remaining:gatherSeconds(this.nodeResource(node))};this.lastGather=this.state.elapsed;this.notify(`Gathering ${this.nodeResource(node)} / ${this.gathering.remaining}s`);return{ok:true};
  }
  private breakNatural(node:Node):boolean {
    if(node.kind!=='tree'&&node.kind!=='boulder')return false;
    const terrain=this.state.changes.terrain??(this.state.changes.terrain={});if(terrain[node.id])return true;
    terrain[node.id]=node.kind==='tree'?'felled':'broken';
    if(node.kind==='tree'){if(this.terrainEvents.length>=16)this.terrainEvents.shift();this.terrainEvents.push({id:node.id,x:node.x,z:node.z,scale:node.scale??1});}
    this.revision++;this.notify(node.kind==='tree'?'Tree felled. Gather the timber.':'Boulder broken. Gather the smaller stones.');return true;
  }
  gather(node: Node): Result {
    if (distance(this.state.player, node) > 3) return { ok: false, error: 'Move closer to gather this resource.' };
    const left = this.nodeRemaining(node); if (left <= 0) return { ok: false, error: 'This resource is exhausted.' };
    if(this.breakNatural(node))return{ok:true};
    const resource = this.nodeResource(node), result = transact([{ account: this.state.inventory, delta: single(resource, 1), capacity: this.inventoryLimit }], this.state.settings);
    if (result.ok) { this.state.changes.nodes[node.id] = left - 1; this.lastGather = this.state.elapsed; this.collected(resource, 1, node); if (left === 1) this.revision++; this.notify(`+1 ${resource}`); }
    return result;
  }
  feed(id = 'home', resource: 'wood' | 'charcoal' = Math.max(0,this.state.inventory.charcoal)+Math.max(0,this.state.stockpile.charcoal)>0?'charcoal':'wood'): Result {
    const f = this.state.furnaces.find(f => f.id === id);
    if (!f || !this.settlement.intact(f.id)||distance(f, this.state.player) > 4) return { ok: false, error: 'Approach a furnace to add fuel.' };
    this.bindFurnace(id);
    const fuel = resource === 'charcoal' ? 30 : 10;
    if (f.fuel + f.charcoal > 3600 - fuel) return { ok: false, error: 'Furnace fuel capacity is 3600 units.' };
    const account = this.state.inventory[resource] > 0 ? this.state.inventory : this.state.stockpile;
    const r = transact([{ account, delta: single(resource, -1) }], this.state.settings);
    if (r.ok) { this.action({kind:'fuel',x:f.x,z:f.z,label:`+${fuel} fuel`,costs:[{resource,amount:1,stock:account===this.state.stockpile?1:0}]}); if (resource === 'charcoal') f.charcoal += fuel; else f.fuel += fuel; this.notify(resource === 'charcoal' ? 'Added 30 seconds of charcoal fuel at level 1.' : 'Added 10 seconds of wood fuel at level 1.'); } return r;
  }
  bindFurnace(id:string): boolean {
    const f=this.state.furnaces.find(f=>f.id===id);
    if(!f || !this.settlement.intact(f.id)||this.dead || distance(f,this.state.player)>4)return false;
    this.state.respawnFurnaceId=id;
    this.notify('Respawn point set at this furnace.');return true;
  }
  recover(): boolean {
    if(!this.dead)return false;
    const f=this.state.furnaces.find(f=>f.id===this.state.respawnFurnaceId&&this.settlement.intact(f.id))??this.state.furnaces.find(f=>this.settlement.intact(f.id))??this.state.furnaces[0];
    let spawn:Point|undefined;
    for(let i=0;i<128;i++){
      const angle=i*2.399963,r=2.6+Math.floor(i/16)*1.2,p={x:f.x+Math.sin(angle)*r,z:f.z+Math.cos(angle)*r};
      if(!this.world.isWater(p.x,p.z)&&this.solids(p).every(s=>distance(s,p)>s.radius+.5)&&Object.values(this.state.combat.actors).every(a=>a.hp<=0||distance(a,p)>3.5)&&this.state.combat.fires.every(fire=>distance(fire,p)>4.5)){spawn=p;break;}
    }
    if(!spawn){this.notify('No clear recovery spot near this furnace. Return to Home to save your progress, or start a new world.');return false;}
    for(const account of [this.state.inventory,this.state.stockpile])for(const resource of RESOURCE_IDS)if(account[resource]>0)account[resource]=Math.floor(account[resource]/2);
    this.state.player={...spawn,heading:0,warmth:100,hp:100,hunger:20,invulnerable:5,heatTime:0};delete this.state.combat.statuses.player;
    beginSpawnProtection(this.state);this.combat.clearSpawnZone();
    this.fishing=undefined;this.gathering=undefined;this.stopMovement();this.notify('Recovered at your furnace. Half of carried and stored supplies were lost.');return true;
  }
  eat(resource: 'fish' | 'meat'): Result {
    const p=this.state.player;if(this.dead||(p.foodCooldown??0)>0)return{ok:false,error:'Wait three seconds between meals.'};
    const r=transact([{account:this.state.inventory,delta:single(resource,-1)}],this.state.settings);
    if(r.ok){const hunger=resource==='meat'?3:2;p.hunger=Math.min(20,(p.hunger??20)+hunger);p.hp=Math.min(maxPlayerHP(this.state),p.hp+5);p.foodCooldown=3;this.notify(`Meal: +5 HP, +${hunger} hunger. Next meal in 3s.`);}return r;
  }
  stash(): Result {
    if (!this.state.furnaces.some(f => this.settlement.intact(f.id)&&distance(f, this.state.player) < 5) && !this.state.buildings.some(b => b.type === 'storage' &&this.state.changes.structures?.[b.id]?.stage!=='gone'&&distance(b, this.state.player) < 5)) return { ok: false, error: 'Approach a furnace or storehouse.' };
    const give = balances(); for (const r of RESOURCE_IDS) give[r] = Math.max(0, this.state.inventory[r]);
    return transact([{ account: this.state.inventory, delta: negate(give) }, { account: this.state.stockpile, delta: give }], this.state.settings);
  }
  withdraw(resource: Resource, count = 1): Result {
    if (!this.state.furnaces.some(f => this.settlement.intact(f.id)&&distance(f, this.state.player) < 5) && !this.state.buildings.some(b => b.type === 'storage' &&this.state.changes.structures?.[b.id]?.stage!=='gone'&&distance(b, this.state.player) < 5)) return { ok: false, error: 'Approach storage to retrieve supplies.' };
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
  build(type: BuildingType, point: Point, rotation=0): Result {
    const invalid = this.validPlacement(type, point); if (invalid) return { ok: false, error: invalid };
    const cost = BUILDINGS[type].costs, stock: Partial<Record<Resource, number>> = {}, carried: Partial<Record<Resource, number>> = {};
    for (const k of RESOURCE_IDS) { const n = (cost as Partial<Record<Resource, number>>)[k] ?? 0; stock[k] = -Math.min(Math.max(0, this.state.stockpile[k]), n); carried[k] = -n - stock[k]!; }
    const r = transact([{ account: this.state.stockpile, delta: stock }, { account: this.state.inventory, delta: carried }], this.state.settings);
    if (!r.ok) return r;
    const id = `built:${this.state.nextId++}`; this.state.buildings.push({ id, type, ...point, rotation,...(type==='hut'?{construction:10}:type==='shelter'?{burnTime:15,pulseTime:0}:{}) }); this.paths.clear();
    if (type === 'furnace') this.state.furnaces.push({ id, ...point, fuel: 0, charcoal: 0, level: 1 });
    this.action({kind:'build',...point,label:BUILDINGS[type].name+(type==='hut'?' construction started':' built'),costs:RESOURCE_IDS.filter(k=>(cost as Partial<Record<Resource,number>>)[k]).map(resource=>({resource,amount:(cost as Partial<Record<Resource,number>>)[resource]!,stock:-stock[resource]!}))});
    this.revision++; this.notify(type==='hut'?'Worker hut construction started / 10 seconds.':`${BUILDINGS[type].name} built.`); return r;
  }
  upgradeFurnace(id = 'home'): Result {
    const info=this.furnaceUpgrade(id);if(!info.ok)return{ok:false,error:info.error!};
    const f=info.furnace!,cost=info.cost,stock:Partial<Balances>={},carried:Partial<Balances>={};
    for(const k of RESOURCE_IDS){const n=cost[k]??0;stock[k]=-Math.min(n,Math.max(0,this.state.stockpile[k]));carried[k]=-n-stock[k]!;}
    const r=transact([{account:this.state.stockpile,delta:stock},{account:this.state.inventory,delta:carried}],this.state.settings);
    if(r.ok){f.level++;this.action({kind:'upgrade',x:f.x,z:f.z,label:`Level ${f.level} / ${expandsAtLevel(f.level)?'+8 heat range':'fuel efficiency improved'}`,costs:RESOURCE_IDS.filter(k=>cost[k]).map(resource=>({resource,amount:cost[resource]!,stock:-stock[resource]!}))});this.notify(`Furnace level ${f.level}. ${expandsAtLevel(f.level)?'Heat range expanded.':'Heat range unchanged.'} Fuel lasts longer.`);}return r;
  }
  furnaceUpgrade(id?:string){
    const furnace=id?this.state.furnaces.find(f=>f.id===id):[...this.state.furnaces].filter(f=>this.settlement.intact(f.id)).sort((a,b)=>distance(a,this.state.player)-distance(b,this.state.player))[0];
    const cost=furnaceCost((furnace?.level??1)+1),missing=RESOURCE_IDS.filter(k=>Math.max(0,this.state.inventory[k])+Math.max(0,this.state.stockpile[k])<(cost[k]??0));
    const error=!furnace||distance(furnace,this.state.player)>5||!this.settlement.intact(furnace.id)?'Approach a furnace to upgrade it.':furnace.level>=MAX_FURNACE_LEVEL?'Furnace is fully upgraded (level 50).':missing.length&&!this.state.settings.allowDebt?'Gather '+missing.map(k=>`${(cost[k]??0)-Math.max(0,this.state.inventory[k])-Math.max(0,this.state.stockpile[k])} ${k}`).join(', ')+' to upgrade.':undefined;
    return{ok:!error,error,furnace,cost,missing};
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
    if (r.ok) { for (const [resource, amount] of Object.entries({ wood: 3 + ruin.houses, stone: 3, metal: 2 + ruin.variant, fish: 2, gold: 2 })) this.collected(resource as Resource, amount, ruin.container); this.state.changes.containers.push(ruin.id); this.revision++; this.notify('Salvaged timber, stone, metal, food and a little gold.'); } return r;
  }
  npc(ruin: Ruin) { const def = trader(ruin), saved = this.state.changes.npcs[def.id]; return { ...def, inventory: saved?.inventory ?? def.inventory, hp: saved?.hp ?? 100 }; }
  buyWeapon(ruin: Ruin, type: WeaponType): Result {
    if(this.settlement.refuge(`npc:${ruin.id}`))return{ok:false,error:'This trader is taking shelter. Return when it is safe.'};
    if (distance(ruin.trader, this.state.player) > 4 || this.npc(ruin).hp <= 0) return { ok: false, error: 'Approach a living trader to buy weapons.' };
    const npc = this.npc(ruin), next = { ...npc.inventory }, cost = weaponCost(type);
    const result = exchange(this.state.inventory, next, cost, {}, this.state.settings, this.inventoryLimit);
    if (result.ok) { this.state.changes.npcs[npc.id] = { inventory: next, hp: npc.hp }; const id = `weapon:${this.state.combat.sequence++}`; this.state.combat.weapons.push({ id, type, uses: weaponUses(type) }); this.state.combat.equipped = id; this.notify(`${WEAPONS[type].name} purchased and equipped. ${weaponUses(type)} uses; infinite ammunition.`); }
    return result;
  }
  buyCity(storeId:string,offerId:string):Result {
    const store=this.state.buildings.find(b=>b.id===storeId&&b.type==='city_store'),offer=CITY_OFFERS.find(o=>o.id===offerId);
    if(!store||!offer||(!this.settlement.intact(store.id)||this.settlement.burning(store))||distance(store,this.state.player)>5)return{ok:false,error:'Approach an intact City Store.'};
    if(offer.weapon&&this.state.combat.weapons.length>=500)return{ok:false,error:'Equipment storage is full.'};
    const r=transact([{account:this.state.inventory,delta:{gold:-offer.gold,...(offer.resource?{[offer.resource]:offer.amount!}:{})},capacity:this.inventoryLimit}],this.state.settings);
    if(r.ok){if(offer.weapon){const id=`weapon:${this.state.combat.sequence++}`;this.state.combat.weapons.push({id,type:offer.weapon,uses:weaponUses(offer.weapon)});this.state.combat.equipped=id;}this.notify(`Purchased ${offer.name} for ${offer.gold} gold.`);}return r;
  }
  trade(ruin: Ruin, offerId: string): Result {
    if(this.settlement.refuge(`npc:${ruin.id}`))return{ok:false,error:'This trader is taking shelter. Return when it is safe.'};
    if (this.npc(ruin).hp <= 0 || distance(ruin.trader, this.state.player) > 4) return { ok: false, error: 'Approach the trader before exchanging goods.' };
    const npc = this.npc(ruin), offer = npc.offers.find(o => o.id === offerId); if (!offer) return { ok: false, error: 'Unknown trade offer.' };
    const inventory = { ...npc.inventory };
    const result = exchange(this.state.inventory, inventory, offer.give, offer.receive, this.state.settings, this.inventoryLimit);
    if (result.ok) { this.state.changes.npcs[npc.id] = { inventory, hp: npc.hp }; this.notify(`Trade completed with ${npc.name}.`); } return result;
  }
  private updateCampfires(dt:number){
    for(const b of this.state.buildings.filter(b=>b.type==='shelter'&&this.settlement.intact(b.id))){
      const active=Math.min(dt,b.burnTime??15);b.burnTime=Math.max(0,(b.burnTime??15)-dt);b.pulseTime=(b.pulseTime??0)+active;
      while(b.pulseTime>=1-1e-8){b.pulseTime=Math.max(0,b.pulseTime-1);const p=this.state.player;if(p.hp>0&&distance(p,b)<=5){p.hp=Math.min(maxPlayerHP(this.state),p.hp+maxPlayerHP(this.state)*.06);p.warmth=Math.min(100,p.warmth+6);}
        for(const w of this.state.workers)if(w.hp>0&&distance(w,b)<=5)w.hp=Math.min(100,w.hp+6);
        for(const a of Object.values(this.state.combat.actors))if(a.type==='guard'&&a.hp>0&&!this.state.combat.villageAlerts.includes(a.villageId??'')&&distance(a,b)<=5)a.hp=Math.min(125,a.hp+7.5);
        for(const r of this.world.settlements(b)){const n=this.npc(r);if(n.hp>0&&distance(this.settlement.position(n.id,r.trader),b)<=5)this.state.changes.npcs[n.id]={inventory:n.inventory,hp:Math.min(100,n.hp+6)};}
      }
    }
  }
  private updateConstruction(dt:number){
    for(const hut of this.state.buildings){
      if(hut.type!=='hut'||hut.construction===undefined||!this.settlement.intact(hut.id))continue;
      hut.construction=Math.max(0,hut.construction-dt);if(hut.construction>1e-8)continue;
      delete hut.construction;
      for(let i=0;i<2;i++){const id=`worker:${hut.id}:${i}`;if(!this.state.workers.some(w=>w.id===id))this.state.workers.push({id,hutId:hut.id,hp:100,x:hut.x+(i?1:-1),z:hut.z+3,sourceId:null,load:0,progress:0,state:'seeking'});}
      this.revision++;this.notify('Worker hut ready. Two gatherers have joined the settlement.');this.action({kind:'build',x:hut.x,z:hut.z,label:'Hut complete / 2 workers',costs:[]});
    }
  }
  private workerFurnaces(hut:Point){return this.state.furnaces.filter(f=>(f.id==='home'||this.state.buildings.some(b=>b.id===f.id&&b.type==='furnace'))&&this.settlement.intact(f.id)&&f.fuel+f.charcoal<=20&&distance(f,hut)<=26).sort((a,b)=>a.fuel+a.charcoal-b.fuel-b.charcoal||distance(a,hut)-distance(b,hut));}
  private tendFurnace(worker:Worker,hut:Point,dt:number){
    if(worker.hp<50)return false;
    const carried=worker.resource==='wood'&&worker.load>0;
    const furnace=(carried||this.state.stockpile.wood>=1)?this.workerFurnaces(hut)[0]:undefined;
    if(!furnace){if(this.fuelTasks.delete(worker.id))this.paths.delete(worker.id);return false;}
    if(this.fuelTasks.get(worker.id)!==furnace.id){this.paths.delete(worker.id);this.fuelTasks.set(worker.id,furnace.id);worker.sourceId=null;worker.progress=0;worker.state='returning';}
    const target={x:furnace.x,z:furnace.z+3};
    if(distance(worker,target)<1.8){
      if(carried)worker.load--;else{const r=transact([{account:this.state.stockpile,delta:{wood:-1}}],this.state.settings);if(!r.ok)return false;}
      const relit=furnace.fuel+furnace.charcoal<=0;furnace.fuel+=10;if(relit)this.notify('A worker relit the furnace with wood.');
      this.paths.delete(worker.id);this.fuelTasks.delete(worker.id);worker.state=worker.load?'returning':'seeking';return true;
    }
    let path=this.paths.get(worker.id);if(!path){const solids=this.solids(hut),valid=(p:Point)=>!this.world.isWater(p.x,p.z)&&solids.every(s=>distance(s,p)>s.radius+.6);path=route(worker,target,valid);this.paths.set(worker.id,path);}
    const next=path[0];if(!next){worker.progress+=dt;if(worker.progress>=3){worker.progress=0;this.paths.delete(worker.id);}return true;}
    const d=distance(worker,next),step=Math.min(d,dt*3.8);this.move(worker,(next.x-worker.x)/(d||1)*step,(next.z-worker.z)/(d||1)*step,.3);if(d<.4)path.shift();return true;
  }
  private updateWorkers(dt: number) {
    this.harvestTargets.clear();
    for (const w of this.state.workers) {
      if(w.hp>0&&w.hp<50&&!this.settlement.refuge(w.id))this.settlement.flee(w.id,w);
      if (w.hp <= 0||this.settlement.refuge(w.id)||isNight(this.state)) {this.paths.delete(w.id);this.fuelTasks.delete(w.id);w.progress=0;continue;}
      const hut = this.state.buildings.find(b => b.id === w.hutId); if (!hut||!this.settlement.intact(hut.id)) continue;
      if(this.tendFurnace(w,hut,dt))continue;
      const needsWood=this.workerFurnaces(hut).length>0;
      const sources = this.world.around(hut).flatMap(c => [...this.nodesInChunk(c),...c.fishing.map((f):Node=>({...f,amount:f.availability,resource:'fish' as const,radius:.4}))]).filter(n => (['wood','stone','fish'].includes(this.nodeResource(n))) && distance(n, hut) < 26 && this.nodeRemaining(n) > 0 && !this.world.isWater(n.x, n.z));
      const blocked=this.unavailableSources.get(w.id);for(const [id,until]of blocked??[])if(until<=this.state.elapsed)blocked!.delete(id);const available=sources.filter(n=>!blocked?.has(n.id));
      let source = available.find(n => n.id === w.sourceId);
      if (w.load >= 3 || !source && w.load > 0) w.state = 'returning';
      if (!source && !w.load) { source = available.sort((a,b)=>(needsWood?Number(b.resource==='wood')-Number(a.resource==='wood'):0)||this.state.stockpile[a.resource]-this.state.stockpile[b.resource]||distance(a,w)-distance(b,w))[0];if(source)w.resource=source.resource as 'wood'|'stone'|'fish'; w.sourceId = source?.id ?? null; w.state = source ? 'seeking' : 'blocked'; this.paths.delete(w.id); }
      if (w.state === 'blocked') { w.progress += dt; if (w.progress < 3) continue; w.progress = 0; w.state = w.load ? 'returning' : 'seeking'; this.paths.delete(w.id); }
      if (w.state === 'gathering') {
        if(source&&distance(w,source)>=workerHarvestReach(source)){w.state='seeking';w.progress=0;this.paths.delete(w.id);continue;}
        if(source)this.harvestTargets.set(w.id,source);
        w.progress += dt;
        if(source&&w.progress>=gatherSeconds(source.resource)-1e-8&&(source.kind==='tree'||source.kind==='boulder')){this.breakNatural(source);w.sourceId=source.kind==='tree'?`log:${source.id}`:`fragment:${source.id}:0`;w.state='seeking';w.progress=0;this.harvestTargets.delete(w.id);this.paths.delete(w.id);continue;}
        if (source && w.progress >= gatherSeconds(source.resource)-1e-8) { if(source.resource==='fish')this.state.changes.fishing[source.id]=(this.state.changes.fishing[source.id]??0)+1;else this.state.changes.nodes[source.id] = this.nodeRemaining(source) - 1; if (this.nodeRemaining(source) === 0) this.revision++; w.load++; w.progress = 0; }
        if (!source || w.load >= 3) { w.state = 'returning'; this.paths.delete(w.id); }
        continue;
      }
      if (!source && !w.load) { w.state = 'blocked'; continue; }
      const destinations = [...this.state.furnaces.filter(f=>this.settlement.intact(f.id)).map(f => ({ x: f.x, z: f.z + 3 })), ...this.state.buildings.filter(b => b.type === 'storage'&&this.settlement.intact(b.id)).map(b => ({ x: b.x, z: b.z + 3.4 }))];
      const destination = destinations.sort((a, b) => distance(a, w) - distance(b, w))[0];
      const target = w.state === 'returning' ? destination : source!;
      if(!target){w.state='blocked';continue;}
      if (distance(w, target) < (w.state === 'returning' ? 1.8 : workerHarvestReach(source!))) {
        if (w.state === 'returning') {
          const r = transact([{ account: this.state.stockpile, delta: { [w.resource??'wood']: w.load } }], this.state.settings);
          if (r.ok) { w.load = 0; w.sourceId = null; w.state = 'seeking'; this.paths.delete(w.id); } else w.state = 'blocked';
        } else { w.state = 'gathering'; w.progress = 0;this.harvestTargets.set(w.id,source!); }
        continue;
      }
      let path = this.paths.get(w.id);
      if (!path) {
        const solids = this.solids(hut);
        const valid = (p: Point) => !this.world.isWater(p.x, p.z) && solids.every(s => distance(s, p) > s.radius + .6);
        path=harvestRoute(w,target,w.state==='returning'?1.8:workerHarvestReach(source!),valid);this.paths.set(w.id,path);
        if(!path.length){
          if(source&&w.state!=='returning'){let unavailable=this.unavailableSources.get(w.id);if(!unavailable){unavailable=new Map();this.unavailableSources.set(w.id,unavailable);}unavailable.set(source.id,this.state.elapsed+10);w.sourceId=null;}
          w.state='blocked';w.progress=0;continue;
        }
      }
      const next = path[0]; if (!next) { this.paths.delete(w.id); continue; }
      const d = distance(w, next), step = Math.min(d, dt * 3.8); this.move(w, (next.x - w.x) / (d || 1) * step, (next.z - w.z) / (d || 1) * step, .3);
      if (d < .4) path.shift();
    }
  }
}

export const gatherSeconds=(resource:Resource)=>GATHER_SECONDS[resource];
