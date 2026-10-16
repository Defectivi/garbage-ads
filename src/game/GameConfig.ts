import { derive } from '../utils/SeededRNG';
export const GENERATION_VERSION = 4;
export interface WorldConfig { chunkSize: number; initialRegionSize: number; worldScale: number; riverDensity: number; ruinDensity: number; resourceDensity: number }
export interface WorldSpec { seed: number; generationVersion: number; seeds: { terrain: number; rivers: number; biomes: number; resources: number; ruins: number; wildlife: number; villages: number; loot: number }; config: WorldConfig }
export interface Settings { difficulty: 'relaxed' | 'survival'; renderDistance: number; sound: boolean; allowDebt: boolean; inventoryLimit: number; resourceMin: number; resourceMax: number }
export const DEFAULT_SETTINGS: Settings = { difficulty: 'relaxed', renderDistance: 2, sound: true, allowDebt: false, inventoryLimit: 0, resourceMin: -9999999, resourceMax: 9999999 };
export function worldSpec(seed: number, resourceSeed?: number): WorldSpec {
  if (!Number.isInteger(seed) || seed < 0 || seed > 65535) throw new Error('World seed must be an integer from 0 to 65535.');
  if (resourceSeed !== undefined && (!Number.isInteger(resourceSeed) || resourceSeed < 0 || resourceSeed > 65535)) throw new Error('Resource seed must be an integer from 0 to 65535.');
  const stream = (s: string) => derive(seed, s) & 65535;
  return { seed, generationVersion: GENERATION_VERSION, seeds: { terrain: stream('terrain'), rivers: stream('rivers'), biomes: stream('biomes'), resources: resourceSeed ?? stream('resources'), ruins: stream('ruins'), wildlife: stream('wildlife'), villages: stream('villages'), loot: stream('loot') }, config: { chunkSize: 32, initialRegionSize: 256, worldScale: 1, riverDensity: 1, ruinDensity: 1, resourceDensity: 1 } };
}
export function randomSeed() { return crypto.getRandomValues(new Uint16Array(1))[0]; }

/** Local movement defaults; saved world geometry is unaffected. */
export const MOVEMENT = { walkSpeed: 6, sprintSpeed: 9, response: 18, joystickRadius: 34, joystickDeadZone: .18 } as const;

export const GATHER_SECONDS = 1;
