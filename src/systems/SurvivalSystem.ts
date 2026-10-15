import type { GameState, Furnace } from '../game/GameState';
import { distance } from '../world/WorldManager';
export const heatRadius = (f: Furnace) => f.fuel > 0 ? 12 + (f.level - 1) * 8 : 0;
export function temperature(state: GameState) { return -18 - Math.sin(state.elapsed / 200) * 8; }
export function sheltered(state: GameState) { return state.furnaces.some(f => distance(f, state.player) < heatRadius(f)) || state.buildings.some(b => b.type === 'shelter' && distance(b, state.player) < 5); }
export function updateSurvival(state: GameState, dt: number) {
  state.elapsed += dt;
  for (const f of state.furnaces) f.fuel = Math.max(0, f.fuel - dt / (1 + (f.level - 1) * .1));
  const delta = sheltered(state) ? 12 : state.settings.difficulty === 'relaxed' ? -.08 : -(Math.abs(temperature(state)) * .035 + .25);
  state.player.warmth = Math.max(0, Math.min(100, state.player.warmth + delta * dt));
}
