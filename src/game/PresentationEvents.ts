import type { Resource } from '../data/definitions';
import type { Point } from './GameState';
export interface SettlementEvent extends Point {
  kind:'fuel'|'upgrade'|'build'; label:string;
  costs:{resource:Resource;amount:number;stock:number}[];
}
