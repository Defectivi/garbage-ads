import {newState} from '../../src/game/GameState';
import type {Settings,WorldSpec} from '../../src/game/GameConfig';
/** Isolate existing mechanics from the new starting camp and temporary safe zone. */
export function simulationState(world:WorldSpec,settings:Partial<Settings>={}){const state=newState(world,settings);delete state.spawnProtection;state.buildings=[];state.workers=[];return state;}
