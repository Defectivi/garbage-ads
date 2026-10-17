import {isNight} from './DayNight';
import { segmentDistance } from '../game/CombatGeometry';
import type { Game } from '../game/Game';
import type { Building,Point } from '../game/GameState';
import { BUILDINGS,RESOURCE_IDS,type Balances } from '../data/definitions';
import {weaponUses,type WeaponType } from '../data/weapons';
import { villageLoot,structureMaxHP,SALVAGE_AMOUNT } from '../data/settlement';
import { transact,type Result } from './InventorySystem';
import { distance } from '../world/WorldManager';
import { route } from './Navigation';

export interface Structure extends Building {initialRuin?:boolean;generated?:boolean}
export interface Integrity {hp:number;stage:'intact'|'ruin'|'gone'}
export interface Refuge extends Point {houseId:string;homeX:number;homeZ:number;phase:'fleeing'|'hidden'|'returning';remaining:number;reason?:'night'}
export interface LootPile extends Point {id:string;resources:Partial<Balances>;weapon?:WeaponType;category?:string}
export class SettlementSystem {
  private paths=new Map<string,Point[]>();
  constructor(private game:Game){}
  structures(point:Point=this.game.state.player,radius=1):Structure[]{
    const g=this.game;
    return [...g.state.buildings,...g.state.furnaces.filter(f=>!g.state.buildings.some(b=>b.id===f.id)).map(f=>({...f,type:'furnace' as const,rotation:0})),...g.world.settlements(point,radius).flatMap(r=>Array.from({length:r.houses},(_,i)=>({id:`house:${r.id}:${i}`,type:'hut' as const,x:r.x+(i-1)*6,z:r.z-3,rotation:i%2?.1:-.1,generated:true,initialRuin:!r.id.startsWith('village:')&&i%2===0})))];
  }
  integrity(structure:Structure):Integrity{return this.game.state.changes.structures?.[structure.id]??{hp:structureMaxHP(structure)*(structure.initialRuin?.25:1),stage:structure.initialRuin?'ruin':'intact'};}
  intact(id:string){return this.game.state.changes.structures?.[id]?.stage===undefined||this.game.state.changes.structures[id].stage==='intact';}
  ready(id:string){return this.intact(id)&&!this.game.state.buildings.some(b=>b.id===id&&(b.construction??0)>0);}
  damage(id:string,amount:number,point:Point):number{
    const structure=this.structures(point,2).find(b=>b.id===id);if(!structure)return 0;
    const old=this.integrity(structure);if(old.stage==='gone')return 0;
    const lost=Math.min(old.hp,amount),next:Integrity={...old,hp:Math.max(0,old.hp-amount)};
    if(next.hp===0){
      if(old.stage==='intact'){next.stage='ruin';next.hp=structureMaxHP(structure)*.25;}
      else{next.stage='gone';const n=SALVAGE_AMOUNT[structure.type];const loot=this.game.state.changes.groundLoot??(this.game.state.changes.groundLoot={});loot[`salvage:${id}`]={id:`salvage:${id}`,x:structure.x,z:structure.z,resources:{wood:n,stone:n}};
        if(structure.type==='storage'){const remains:Partial<Balances>={};for(const k of RESOURCE_IDS){const amount=Math.max(0,this.game.state.stockpile[k]);remains[k]=Math.floor(amount*.1);if(amount>0)this.game.state.stockpile[k]=0;}loot[`stored:${id}`]={id:`stored:${id}`,x:structure.x,z:structure.z,resources:remains};}}
      this.game.revision++;this.paths.clear();
    }
    (this.game.state.changes.structures??(this.game.state.changes.structures={}))[id]=next;
    if(next.stage!=='intact'){
      const placed=this.game.state.buildings.find(b=>b.id===id);if(placed)delete placed.construction;
      if(this.game.state.player.shelter?.houseId===id)this.game.leaveHut();
      const f=this.game.state.furnaces.find(f=>f.id===id);if(f){f.fuel=0;f.charcoal=0;}
      for(const [npc,refuge]of Object.entries(this.game.state.changes.refuges??{}))if(refuge.houseId===id){const worker=this.game.state.workers.find(w=>w.id===npc);if(worker&&refuge.phase==='hidden'&&old.stage==='intact'&&next.stage==='ruin')worker.hp*=.5;refuge.phase='returning';refuge.remaining=0;this.paths.delete(npc);}
    }
    return lost;
  }
  loot(point:Point=this.game.state.player):LootPile[]{
    const g=this.game,taken=g.state.changes.lootTaken??[];
    return [...g.world.villages().filter(v=>distance(v,point)<100).flatMap(v=>Array.from({length:6},(_,i)=>{
      const id=`supplies:${v.id}:${i}`,angle=i*Math.PI/3+.35,x=v.x+Math.cos(angle)*12,z=v.z+Math.sin(angle)*12;
      return{id,x,z,...villageLoot(g.state.world.seeds.loot,id)};
    }).filter(p=>!taken.includes(p.id))),...Object.values(g.state.changes.groundLoot??{}).filter(p=>distance(p,point)<100)];
  }
  pickup(id:string):Result{
    const g=this.game,pile=this.loot().find(p=>p.id===id);if(!pile||distance(pile,g.state.player)>3)return{ok:false,error:'Approach these supplies.'};
    if(pile.weapon&&g.state.combat.weapons.length>=500)return{ok:false,error:'Equipment storage is full.'};
    const result=transact([{account:g.state.inventory,delta:pile.resources,capacity:g.inventoryLimit}],g.state.settings);if(!result.ok)return result;
    if(pile.weapon){const key=`weapon:${g.state.combat.sequence++}`;g.state.combat.weapons.push({id:key,type:pile.weapon,uses:pile.weapon==='molotov'?1:weaponUses(pile.weapon)});g.state.combat.equipped=key;}
    for(const resource of RESOURCE_IDS){const amount=pile.resources[resource]??0;if(amount>0){if(g.collectionEvents.length>=32)g.collectionEvents.shift();g.collectionEvents.push({resource,amount,x:pile.x,z:pile.z});}}
    if(g.state.changes.groundLoot?.[id])delete g.state.changes.groundLoot[id];else(g.state.changes.lootTaken??(g.state.changes.lootTaken=[])).push(id);
    g.notify(pile.weapon?`Found and equipped ${pile.weapon.replaceAll('_',' ')}.`:'Supplies collected.');return{ok:true};
  }
  burning(point:Point & {type?:keyof typeof BUILDINGS}){return this.game.state.combat.fires.some(f=>f.remaining>0&&distance(f,point)<=4+(point.type?BUILDINGS[point.type].radius:0));}
  refuge(id:string){return this.game.state.changes.refuges?.[id];}
  position(id:string,fallback:Point):Point{return this.refuge(id)??fallback;}
  flee(id:string,point:Point,night=false){
    const g=this.game,worker=g.state.workers.find(w=>w.id===id),old=this.refuge(id);
    if(old){old.remaining=12;if(old.phase==='returning')old.phase='fleeing';return;}
    const houses=this.structures(point,2).filter(b=>b.id!==g.state.player.shelter?.houseId&&b.type!=='furnace'&&b.type!=='shelter'&&!this.burning(b)&&this.integrity(b).stage==='intact'&&!b.construction&&(night?worker?.villageId?b.id.startsWith(`house:${worker.villageId}:`)&&distance(b,point)<36:b.id===worker?.hutId:distance(b,point)<36)).sort((a,b)=>(a.id===worker?.hutId?-100:distance(a,point))-(b.id===worker?.hutId?-100:distance(b,point)));
    const house=houses[0];if(!house)return;
    (g.state.changes.refuges??(g.state.changes.refuges={}))[id]={houseId:house.id,x:point.x,z:point.z,homeX:point.x,homeZ:point.z,phase:'fleeing',remaining:12,...(night?{reason:'night' as const}:{})};this.paths.delete(id);
  }
  update(dt:number){
    const g=this.game,night=isNight(g.state);
    if(night)for(const w of g.state.workers)if(w.hp>0&&!this.refuge(w.id))this.flee(w.id,w,true);
    for(const [id,refuge]of Object.entries(g.state.changes.refuges??{})){
      const actor=g.state.combat.actors[id];
      if((actor&&actor.hp<=0)||g.state.workers.some(w=>w.id===id&&w.hp<=0)){delete g.state.changes.refuges![id];this.paths.delete(id);continue;}
      if(distance(refuge,g.state.player)>100&&!g.state.workers.some(w=>w.id===id))continue;
      const house=this.structures(refuge,2).find(b=>b.id===refuge.houseId),worker=g.state.workers.find(w=>w.id===id);
      if(!house||this.burning(house)||this.integrity(house).stage!=='intact'){refuge.phase='returning';this.paths.delete(id);}
      if(refuge.phase==='hidden'){if(worker)worker.hp=Math.min(100,worker.hp+dt*5);refuge.remaining=worker&&night&&(house?.id===worker.hutId||!!worker.villageId)?12:worker&&refuge.reason==='night'&&worker.hp>=50?0:Math.max(0,refuge.remaining-dt);if(refuge.remaining<=0){refuge.phase='returning';this.paths.delete(id);}else continue;}
      const target=refuge.phase==='fleeing'?{x:house!.x-.7*Math.cos(house!.rotation)+(BUILDINGS[house!.type].radius+.5)*Math.sin(house!.rotation),z:house!.z+.7*Math.sin(house!.rotation)+(BUILDINGS[house!.type].radius+.5)*Math.cos(house!.rotation)}:{x:refuge.homeX,z:refuge.homeZ};
      if(distance(refuge,target)<.4){if(refuge.phase==='fleeing'){refuge.phase='hidden';refuge.remaining=12;}else delete g.state.changes.refuges![id];this.paths.delete(id);continue;}
      let path=this.paths.get(id);if(!path){const solids=g.solids(refuge).filter(s=>!('id'in s)||s.id!==id),valid=(p:Point)=>!g.world.isWater(p.x,p.z)&&solids.every(s=>distance(s,p)>s.radius+.35),clear=(a:Point,b:Point)=>solids.every(s=>segmentDistance(s,a,b)>s.radius+.3);path=valid(target)&&clear(refuge,target)?[target]:route(refuge,target,valid);if(path.length&&valid(target)&&clear(path[path.length-1],target))path.push(target);this.paths.set(id,path);}
      const next=path[0];if(!next){this.paths.delete(id);continue;}const d=distance(next,refuge),step=Math.min(d,dt*3.8),oldX=refuge.x,oldZ=refuge.z;g.move(refuge,(next.x-refuge.x)/(d||1)*step,(next.z-refuge.z)/(d||1)*step,.3,id);if(d<.4)path.shift();if(worker){worker.x=refuge.x;worker.z=refuge.z;}if(actor){actor.x=refuge.x;actor.z=refuge.z;if(Math.hypot(refuge.x-oldX,refuge.z-oldZ)>1e-6)actor.heading=Math.atan2(refuge.x-oldX,refuge.z-oldZ);}
    }
  }
}
