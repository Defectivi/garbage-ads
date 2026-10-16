import type {Balances} from './definitions';
export const MAX_FURNACE_LEVEL=50;
export const MAX_RADIUS_LEVEL=20;
export const fuelInterval=(level:number)=>1+(level-1)*.2;
/** Indexed by destination level. Food supplies the builders in later tiers. */
export function furnaceCost(level:number):Partial<Balances>{
 if(level<=1||level>MAX_FURNACE_LEVEL)return{};
 if(level===2)return{wood:30};if(level===3)return{wood:60};if(level<=5)return{wood:90};
 if(level<=10)return{wood:100+(level-6)*10,metal:level<=7?10:20};
 const tier=Math.floor((level-11)/5),step=(level-11)%5;
 return{wood:150+tier*50+step*10,stone:20+tier*25+step*5,metal:25+tier*25+step*5,charcoal:5+tier*5,...(level>=16?{gold:5+(tier-1)*5+step}:{}),...(level>=21?{meat:5+(tier-2)*5+step,fish:5+(tier-2)*5+step}:{})};
}
