import type {GameState,Point} from '../game/GameState';
export const SPAWN_RADIUS=100,SPAWN_SECONDS=12;
export function spawnProtected(state:GameState,point:Point=state.player){const zone=state.spawnProtection;return !state.hardships?.includes('unprotected')&&!!zone&&zone.remaining>0&&Math.hypot(point.x-zone.x,point.z-zone.z)<SPAWN_RADIUS;}
export function beginSpawnProtection(state:GameState){if(state.hardships?.includes('unprotected')){delete state.spawnProtection;state.player.invulnerable=0;return;}state.spawnProtection={x:state.player.x,z:state.player.z,remaining:SPAWN_SECONDS};}
