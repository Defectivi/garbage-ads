import {isNight} from './DayNight';
import {spawnProtected} from './SpawnProtection';
import {maxPlayerHP,type GameState} from '../game/GameState';
export {maxPlayerHP} from '../game/GameState';
import {heatRadius,structureIntact,inPlayerHeat,healingAmount} from './SurvivalSystem';
import {distance} from '../world/WorldManager';
export function movementMultiplier(state:GameState,sprint=false){return ((state.player.stunned??0)>0?0:state.player.hypothermia?(sprint?.5:.1):1)*((state.player.hunger??20)<10?.8:1);}
/** River exposure is simulation state. Bridges are dry; fire clears lingering cold, not a river's exposure. */
export function updateExposure(state:GameState,dt:number,inWater:boolean){
 const p=state.player;if(p.stunned!==undefined)p.stunned=Math.max(0,p.stunned-dt);
 const warm=state.furnaces.some(f=>structureIntact(state,f.id)&&distance(f,p)<heatRadius(f))||state.buildings.some(b=>b.type==='shelter'&&(b.burnTime??15)>0&&structureIntact(state,b.id)&&distance(b,p)<=5)||state.combat.fires.some(f=>f.remaining>0&&distance(f,p)<=4);
 if(!inWater&&warm){delete p.hypothermia;return;}
 if(inWater){
  const h=p.hypothermia??(p.hypothermia={level:1,waterTime:0,tick:0}),previous=h.waterTime;h.waterTime=Math.min(5,h.waterTime+dt);
  if(h.waterTime>=5-1e-8){h.level=2;h.tick+=Math.max(0,dt-Math.max(0,5-previous));while(h.tick>=3-1e-8){h.tick=Math.max(0,h.tick-3);p.warmth=Math.max(0,p.warmth-25);}}
  p.hp=Math.min(p.hp,maxPlayerHP(state));
 }else if(p.hypothermia){p.hypothermia.level=1;p.hypothermia.waterTime=0;p.hypothermia.tick=0;}
}
export function playerEffects(state:GameState):{id:string;label:string;detail:string}[]{
 const p=state.player,status=state.combat.statuses.player,effects=[];
 if(p.shelter)effects.push({id:'shelter',label:'TAKING SHELTER',detail:'Hostile attacks blocked / +3% max HP each second / F to leave'});
 if(spawnProtected(state))effects.push({id:'spawn',label:`SPAWN SAFE ${Math.ceil(state.spawnProtection!.remaining)}s`,detail:'100 m safe area / hostiles kept outside'});
 if((p.hunger??20)<10)effects.push({id:'hunger',label:(p.hunger??20)<=0?'STARVING':'HUNGRY',detail:`Speed -20%${(p.hunger??20)<5?' / max HP -50%':''}${(p.hunger??20)<=0?' / -15 HP each second':''}`});
 if(isNight(state))effects.push({id:'night',label:'NIGHTFALL',detail:'Double encounters / wolves and bears resist 25% damage / hold molotov for light'});
 if(p.hypothermia)effects.push({id:'cold',label:`HYPOTHERMIA ${p.hypothermia.level===2?'II':'I'}`,detail:p.hypothermia.level===2?'Speed -90% / max HP 90 / -25 warmth every 3s':'Speed -90% / max HP 90 / warm up at fire'});
 if((p.stunned??0)>0)effects.push({id:'stun',label:`STUNNED ${p.stunned!.toFixed(1)}s`,detail:'Movement and attacks disabled'});
 if((status?.wolfBleed??0)>0)effects.push({id:'wolf-bleed',label:`WOLF BITE ${Math.ceil(status!.wolfBleed!)}s`,detail:'Bleeding / 4 damage each second'});
 if((status?.bleed??0)>0)effects.push({id:'bleed',label:`BLEEDING ${Math.ceil(status!.bleed)}s`,detail:`${status?.bleedDamage??2} damage each second`});
 if((p.invulnerable??0)>0)effects.push({id:'shield',label:`SHIELDED ${p.invulnerable!.toFixed(1)}s`,detail:'Respawn protection'});
 if(inPlayerHeat(state)&&!p.shelter)effects.push({id:'heat',label:'FURNACE PROTECTION',detail:`Incoming damage -50% / heals ${healingAmount(state)} HP every 3s`});
 return effects;
}
