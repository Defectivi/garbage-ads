import type { Integrity,Refuge,LootPile } from '../systems/SettlementSystem';
import { balances, type Balances, type BuildingType } from '../data/definitions';
import { DEFAULT_SETTINGS, type WorldSpec, type Settings } from './GameConfig';
import { freshCombat, type CombatState } from './CombatState';
export interface Point { x: number; z: number }
export interface Furnace extends Point { id: string; fuel: number; level: number; charcoal: number }
export interface Building extends Point { id: string; type: BuildingType; rotation: number; construction?:number; burnTime?:number; pulseTime?:number }
export interface Worker extends Point { villageId?:string;relocated?:boolean; id: string; hutId: string; hp: number; sourceId: string | null; load: number; resource?:'wood'|'stone'|'fish'; progress: number; state: 'seeking' | 'gathering' | 'returning' | 'blocked' }
export interface NPCState { inventory: Balances; hp: number }
export interface GameState {
  world: WorldSpec;
  spawnProtection?:Point & {remaining:number};
  respawnFurnaceId?: string;
  player: Point & { shelter?:{houseId:string;tick:number}; warmth: number; heading: number; hp: number; hunger?:number; hungerTime?:number; sprintHungerTime?:number; foodCooldown?:number; starvationTime?:number; invulnerable?:number; heatTime?:number; recentDamage?:number; stunned?:number; hypothermia?:{level:1|2;waterTime:number;tick:number} };
  combat: CombatState;
  inventory: Balances; stockpile: Balances;
  furnaces: Furnace[]; buildings: Building[]; workers: Worker[];
  changes: { nodes: Record<string, number>; containers: string[]; fishing: Record<string, number>; npcs: Record<string, NPCState>; terrain?:Record<string,'felled'|'broken'>; treeRegrowth?:Record<string,number>; structures?:Record<string,Integrity>; refuges?:Record<string,Refuge>; lootTaken?:string[]; groundLoot?:Record<string,LootPile> };
  discovered: string[]; elapsed: number; nextId: number; settings: Settings;
}
export function newState(world: WorldSpec, settings: Partial<Settings> = {}): GameState {
  return { world: structuredClone(world), player: { x: 0, z: 4, warmth: 100, heading: 0, hp: 100, hunger:20 }, combat: freshCombat(), inventory: balances({ wood: 12, fish: 3 }), stockpile: balances(), furnaces: [{ id: 'home', x: 0, z: 0, fuel: 60, charcoal: 0, level: 1 }], buildings: [{id:'starter:hut',type:'hut',x:-7,z:-7,rotation:0}], workers: [0,1].map(i=>({id:`worker:starter:hut:${i}`,hutId:'starter:hut',hp:100,x:-7+(i?1:-1),z:-4,sourceId:null,load:0,progress:0,state:'seeking'})), spawnProtection:{x:0,z:4,remaining:12}, changes: { nodes: {}, containers: [], fishing: {}, npcs: {}, terrain:{}, treeRegrowth:{}, structures:{}, refuges:{}, lootTaken:[], groundLoot:{} }, discovered: ['home'], elapsed: 0, nextId: 1, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

export function maxPlayerHP(state:GameState){return (state.player.hypothermia?90:100)*((state.player.hunger??20)<5?.5:1);}
