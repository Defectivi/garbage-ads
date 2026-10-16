import type {GameState} from '../game/GameState';
export const DAY_SECONDS=600;
export const isNight=(state:GameState)=>Math.floor(state.elapsed/DAY_SECONDS)%2===1;
export function nightBlend(state:GameState){const t=state.elapsed%(DAY_SECONDS*2);return t<DAY_SECONDS?(state.elapsed>=1200?Math.max(0,1-t/10):0):Math.min(1,(t-DAY_SECONDS)/10);}
