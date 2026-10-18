import type {Game} from '../game/Game';
import type {Point,Worker,VillageCommunity} from '../game/GameState';
import {balances} from '../data/definitions';
import {derive} from '../utils/SeededRNG';
import {distance,type Village} from '../world/WorldManager';
import {isNight} from './DayNight';
/** Communities activate once on approach; after that simulation is independent of render/chunk lifetime. */
export class VillageCommunitySystem{
 private securityClock=0;
 constructor(private game:Game){}
 ensure(v:Village):VillageCommunity{
  if(!this.village(v.id))throw new Error('Unknown village identity.');
  const s=this.game.state,all=s.communities??(s.communities={});let community=all[v.id];
  if(!community){community=all[v.id]={version:1,id:v.id,name:v.name,seed:derive(s.world.seeds.villages,`settlement:${v.id}`),leaderId:`npc:${v.id}`,furnaceId:`${v.id}:furnace`,storageId:`store:${v.id}`,stockpile:balances({wood:Math.min(12,s.settings.resourceMax),stone:Math.min(6,s.settings.resourceMax),fish:Math.min(6,s.settings.resourceMax)}),capacity:300,workerIds:[],guardIds:Array.from({length:v.guardCount},(_,i)=>`guard:${v.id}:${i}`),patrol:[{x:v.x-11,z:v.z+10},{x:v.x+11,z:v.z+10},{x:v.x+11,z:v.z-11},{x:v.x-11,z:v.z-11}],security:{threatIds:[],calmTime:0}};
   for(let i=0;i<3;i++){const id=`resident:${v.id}:${i}`;community.workerIds.push(id);if(!s.workers.some(w=>w.id===id))s.workers.push({id,communityId:v.id,assignment:(['wood','stone','fish'] as const)[i],hutId:`house:${v.id}:${i}`,hp:100,x:v.x+(i-1)*6,z:v.z+4,sourceId:null,load:0,progress:0,state:'seeking'});}
  }
  this.game.world.rememberVillageName(v.id,community.name);
  let furnace=s.furnaces.find(f=>f.id===community.furnaceId);if(!furnace){furnace={id:community.furnaceId,x:v.x,z:v.z+1,fuel:240,charcoal:0,level:5};s.furnaces.push(furnace);}else furnace.level=Math.max(5,furnace.level);
  return community;
 }
 active(){return Object.values(this.game.state.communities??{});}
 village(id:string){return this.game.world.villages().find(v=>v.id===id);}
 near(point:Point,radius=42){return this.active().some(c=>{const v=this.village(c.id);return v&&distance(point,v)<radius;});}
 home(worker:Worker){if(!worker.communityId)return undefined;const v=this.village(worker.communityId);if(!v)return undefined;const i=Number(worker.hutId.split(':').at(-1));return{id:worker.hutId,type:'hut' as const,x:v.x+(i-1)*6,z:v.z-3,rotation:i%2?.1:-.1};}
 update(dt:number){
  for(const c of this.active())c.security.calmTime=Math.max(0,c.security.calmTime-dt);
  this.securityClock-=dt;if(this.securityClock>1e-8)return;this.securityClock+=.5;
  for(const c of this.active()){
   const v=this.village(c.id)!;const threats=Object.values(this.game.state.combat.actors).filter(a=>a.hp>0&&a.type!=='guard'&&!(a.type==='polar_bear'&&this.game.state.world.mode==='easy'&&!a.alerted)&&distance(a,v)<32);
   const playerThreat=this.game.state.combat.villageAlerts.includes(c.id)&&this.game.state.player.hp>0&&distance(this.game.state.player,v)<32;
   c.security.threatIds=[...(playerThreat?['player']:[]),...threats.map(a=>a.id)].slice(0,32);if(c.security.threatIds.length)c.security.calmTime=8;
   const threatened=c.security.calmTime>0;
   for(const id of [...c.workerIds,c.leaderId]){const worker=this.game.state.workers.find(w=>w.id===id),point=worker??v.trader;if(worker?.hp===0||id===c.leaderId&&this.game.npc(v).hp<=0){if(this.game.state.changes.refuges)delete this.game.state.changes.refuges[id];continue;}const refuge=this.game.settlement.refuge(id);
    if(worker&&!this.game.settlement.intact(worker.hutId)){const replacement=Array.from({length:3},(_,i)=>`house:${c.id}:${i}`).find(h=>this.game.settlement.intact(h)&&this.game.state.workers.filter(w=>w.hutId===h&&w.hp>0).length<2);if(replacement)worker.hutId=replacement;}
    if(threatened){if(!refuge)this.game.settlement.flee(id,point);else if(refuge.phase==='hidden')refuge.remaining=12;}
    else if(refuge?.phase==='hidden'&&refuge.reason!=='night'&&(!worker||worker.hp>=50))refuge.remaining=0;
    if(worker&&isNight(this.game.state)&&!refuge)this.game.settlement.flee(id,point,true);
   }
  }
 }
}
