import { derive } from '../utils/SeededRNG';
export const GENERATION_VERSION = 6;
export const INT32_MIN=-2147483648,INT32_MAX=2147483647,UINT32_MAX=4294967295;
export interface WorldConfig { chunkSize: number; initialRegionSize: number; worldScale: number; riverDensity: number; ruinDensity: number; resourceDensity: number }
export type DifficultyMode = 'easy'|'normal'|'hard';
export type Hardship = 'hunger'|'slow'|'fuel'|'health'|'unprotected';
export interface WorldSpec { mode?:DifficultyMode; hardship?:Hardship; seed: number; seedText?:string; generationVersion: number; seeds: { terrain: number; rivers: number; biomes: number; resources: number; ruins: number; wildlife: number; villages: number; loot: number }; config: WorldConfig }
export interface Settings { difficulty: 'relaxed' | 'survival'; renderDistance: number; sound: boolean; allowDebt: boolean; inventoryLimit: number; resourceMin: number; resourceMax: number }
export const DEFAULT_SETTINGS: Settings = { difficulty: 'relaxed', renderDistance: 2, sound: true, allowDebt: false, inventoryLimit: 0, resourceMin: INT32_MIN, resourceMax: INT32_MAX };
/** Numeric seeds retain old low-seed layouts; text hashes include every UTF-16 code unit. */
export function parseSeed(input:number|string):{seed:number;seedText?:string}{
 if(typeof input==='number'){if(!Number.isInteger(input)||input<0||input>UINT32_MAX)throw new Error('Numeric seed must be an integer from 0 to 4294967295.');return{seed:input};}
 if(typeof input!=='string')throw new Error('Enter a number or text seed.');
 const text=input.trim().normalize('NFC');if(!text||text.length>128)throw new Error('Enter a seed of 1-128 characters.');
 if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))return parseSeed(Number(text));
 let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return{seed:derive(hash>>>0,'text-seed'),seedText:text};
}
export function worldSpec(input:number|string,resourceSeed?:number):WorldSpec{
 const parsed=parseSeed(input),seed=parsed.seed;
 if(resourceSeed!==undefined&&(typeof resourceSeed!=='number'||!Number.isInteger(resourceSeed)||resourceSeed<0||resourceSeed>UINT32_MAX))throw new Error('Resource seed must be an integer from 0 to 4294967295.');
 const stream=(label:string)=>{const value=derive(seed,label);return seed<=65535?value&65535:value;};
 return {...parsed,generationVersion:GENERATION_VERSION,seeds:{terrain:stream('terrain'),rivers:stream('rivers'),biomes:stream('biomes'),resources:resourceSeed??stream('resources'),ruins:stream('ruins'),wildlife:stream('wildlife'),villages:stream('villages'),loot:stream('loot')},config:{chunkSize:32,initialRegionSize:256,worldScale:1,riverDensity:1,ruinDensity:1,resourceDensity:1}};
}
export function randomSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}

/** Local movement defaults; saved world geometry is unaffected. */
export const MOVEMENT = { walkSpeed: 6, sprintSpeed: 9, response: 18, joystickRadius: 34, joystickDeadZone: .18 } as const;

export const GATHER_SECONDS = {wood:.3,stone:.7,metal:1.1,gold:2.2,charcoal:1,fish:1,meat:1} as const;
