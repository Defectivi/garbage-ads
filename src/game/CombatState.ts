import type { Point } from './GameState';
import type { ActorType, Weapon, WeaponType } from '../data/weapons';
export interface Actor extends Point { patrolIndex?:number; id: string; type: ActorType; hp: number; weapon: WeaponType | null; groupId: string; villageId: string | null; homeX: number; homeZ: number; heading: number; cooldown: number; roamTimer: number; targetX: number; targetZ: number; alerted: boolean; heatInside?: boolean; heatBurn?:number; pursuitId?:string; retreating?:boolean; stunned?:number }
export interface Projectile extends Point { id: string; kind: 'arrow' | 'pellet' | 'bottle' | 'swing'; ownerId: string; targetX: number; targetZ: number; fromX: number; fromZ: number; age: number; duration: number; damage: number; weapon?: WeaponType|'punch'; weaponId?: string; hitIds?: string[]; volleyId?: string; wearCharged?: boolean; aim?:number }
export interface Fire extends Point { id: string; ownerId: string; remaining: number; tick: number; charred: boolean }
export interface Drop extends Point { id: string; weapon: WeaponType; uses: number }
export interface CombatState {
  weapons: Weapon[]; equipped: string | null; cooldown: number; actors: Record<string, Actor>; encounters: string[];
  projectiles: Projectile[]; fires: Fire[]; drops: Drop[];
  statuses: Record<string, { bleed: number; tick: number; wolfBleed?:number; wolfTick?:number; bleedDamage?:number }>; villageAlerts: string[];
  sequence: number; kills: number; charredNodes: string[]; charredTrees: string[];
  weather: { mode: 'clear' | 'snow'; remaining: number; cycle: number };
}
export function freshCombat(): CombatState { return { weapons: [], equipped: null, cooldown: 0, actors: {}, encounters: [], projectiles: [], fires: [], drops: [], statuses: {}, villageAlerts: [], sequence: 1, kills: 0, charredNodes: [], charredTrees: [], weather: { mode: 'clear', remaining: 90, cycle: 0 } }; }
