import { balances, type Balances, type BuildingType } from '../data/definitions';
import { DEFAULT_SETTINGS, type WorldSpec, type Settings } from './GameConfig';
import { freshCombat, type CombatState } from './CombatState';
export interface Point { x: number; z: number }
export interface Furnace extends Point { id: string; fuel: number; level: number; charcoal: number }
export interface Building extends Point { id: string; type: BuildingType; rotation: number }
export interface Worker extends Point { id: string; hutId: string; hp: number; sourceId: string | null; load: number; progress: number; state: 'seeking' | 'gathering' | 'returning' | 'blocked' }
export interface NPCState { inventory: Balances; hp: number }
export interface GameState {
  world: WorldSpec;
  player: Point & { warmth: number; heading: number; hp: number };
  combat: CombatState;
  inventory: Balances; stockpile: Balances;
  furnaces: Furnace[]; buildings: Building[]; workers: Worker[];
  changes: { nodes: Record<string, number>; containers: string[]; fishing: Record<string, number>; npcs: Record<string, NPCState> };
  discovered: string[]; elapsed: number; nextId: number; settings: Settings;
}
export function newState(world: WorldSpec, settings: Partial<Settings> = {}): GameState {
  return { world: structuredClone(world), player: { x: 0, z: 4, warmth: 100, heading: 0, hp: 100 }, combat: freshCombat(), inventory: balances({ wood: 12, fish: 3 }), stockpile: balances(), furnaces: [{ id: 'home', x: 0, z: 0, fuel: 100, charcoal: 0, level: 1 }], buildings: [], workers: [], changes: { nodes: {}, containers: [], fishing: {}, npcs: {} }, discovered: ['home'], elapsed: 0, nextId: 1, settings: { ...DEFAULT_SETTINGS, ...settings } };
}
