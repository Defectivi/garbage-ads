import type { GameState, Furnace, Point } from '../game/GameState';
import { distance } from '../world/WorldManager';
export const heatRadius = (f: Furnace) => f.fuel + f.charcoal > 0 ? 12 + (f.level - 1) * 8 : 0;
export const furnaceTier = (level: number) => Math.floor(level / 5);
export function playerHeatSources(state: GameState) {
  return state.furnaces.filter(f => f.id === 'home' || state.buildings.some(b => b.id === f.id && b.type === 'furnace')).filter(f => heatRadius(f) > 0);
}
export function inPlayerHeat(state: GameState, point: Point = state.player) { return playerHeatSources(state).some(f => distance(f, point) < heatRadius(f)); }
export function temperature(state: GameState) { return -18 - Math.sin(state.elapsed / 200) * 8; }
export function sheltered(state: GameState) { return state.furnaces.some(f => distance(f, state.player) < heatRadius(f)) || state.buildings.some(b => b.type === 'shelter' && distance(b, state.player) < 5); }
export function updateSurvival(state: GameState, dt: number, sprint = false) {
  state.elapsed += dt;
  for (const f of state.furnaces) {
    const consumption = dt * (state.combat.weather.mode === 'snow' ? 3 : 1) / (1 + (f.level - 1) * .1);
    const used = Math.min(f.charcoal, consumption * .5); f.charcoal -= used;
    f.fuel = Math.max(0, f.fuel - (consumption - used * 2));
  }
  const delta = sheltered(state) ? 12 : state.settings.difficulty === 'relaxed' ? -.08 : -(Math.abs(temperature(state)) * .035 + .25);
  state.player.warmth = Math.max(0, Math.min(100, state.player.warmth + delta * dt * (sprint && delta < 0 ? 2 : 1)));
}
