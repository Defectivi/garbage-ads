import {fuelInterval,MAX_RADIUS_LEVEL} from '../data/furnaces';
import {maxPlayerHP} from '../game/GameState';
import type { GameState, Furnace, Point } from '../game/GameState';
import { distance } from '../world/WorldManager';
export const heatRadius = (f: Furnace) => f.fuel + f.charcoal > 0 ? 12 + (Math.min(MAX_RADIUS_LEVEL,f.level) - 1) * 8 : 0;
export const furnaceTier = (level: number) => Math.floor(level / 5);
export function structureIntact(state:GameState,id:string){return !state.changes.structures?.[id]||state.changes.structures[id].stage==='intact';}
export function playerHeatSources(state: GameState) {
  return state.furnaces.filter(f => f.id === 'home' || state.buildings.some(b => b.id === f.id && b.type === 'furnace')).filter(f => heatRadius(f) > 0&&structureIntact(state,f.id));
}
export function inPlayerHeat(state: GameState, point: Point = state.player) { return playerHeatSources(state).some(f => distance(f, point) < heatRadius(f)); }
export function temperature(state: GameState) { return -18 - Math.sin(state.elapsed / 200) * 8; }
export function sheltered(state: GameState) { return state.furnaces.some(f => structureIntact(state,f.id)&&distance(f, state.player) < heatRadius(f)) || state.buildings.some(b => b.type === 'shelter'&&structureIntact(state,b.id) && distance(b, state.player) < 5); }
export function updateSurvival(state: GameState, dt: number, sprint = false) {
  state.elapsed += dt;
  if(state.spawnProtection)state.spawnProtection.remaining=Math.max(0,state.spawnProtection.remaining-dt);
  if(state.player.invulnerable!==undefined)state.player.invulnerable=Math.max(0,state.player.invulnerable-dt);
  if(state.player.recentDamage!==undefined)state.player.recentDamage=Math.max(0,state.player.recentDamage-dt);
  const heated=state.furnaces.some(f=>structureIntact(state,f.id)&&distance(f,state.player)<heatRadius(f));
  if(heated&&state.player.hp>0){state.player.heatTime=(state.player.heatTime??0)+dt;while(state.player.heatTime>=3-1e-8){state.player.heatTime=Math.max(0,state.player.heatTime-3);state.player.hp=Math.min(maxPlayerHP(state),state.player.hp+healingAmount(state));}}
  else state.player.heatTime=0;

  for (const f of state.furnaces) {
    if(!structureIntact(state,f.id))continue;
    const consumption = dt * (state.combat.weather.mode === 'snow' ? 3 : 1) / fuelInterval(f.level);
    const used = Math.min(f.charcoal, consumption); f.charcoal -= used;
    f.fuel = Math.max(0, f.fuel - (consumption - used));
  }
  const delta = sheltered(state) ? 12 : state.settings.difficulty === 'relaxed' ? -.08 : -(Math.abs(temperature(state)) * .035 + .25);
  state.player.warmth = Math.max(0, Math.min(100, state.player.warmth + delta * dt * (sprint && delta < 0 ? 2 : 1)));
}

export function healingAmount(state:GameState){return (state.player.recentDamage??0)>1e-8?10:25;}
