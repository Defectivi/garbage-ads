import { derive } from '../utils/SeededRNG';
import { WEAPON_IDS } from './weapons';

export const STRUCTURE_HP={hut:1000,storage:2000,shelter:500,furnace:1500} as const;
export const SALVAGE_AMOUNT={hut:1,storage:2,shelter:1,furnace:3} as const;
export function villageLoot(seed:number,id:string){
  const roll=derive(seed,`category:${id}`)%100,choice=derive(seed,`contents:${id}`),amount=2+choice%3;
  if(roll<50)return{category:'food' as const,resources:{[choice%2?'meat':'fish']:amount}};
  if(roll<90)return{category:'materials' as const,resources:{[(['wood','stone','metal','gold'] as const)[choice%4]]:amount}};
  return{category:'weapon' as const,resources:{},weapon:WEAPON_IDS[choice%WEAPON_IDS.length]};
}
