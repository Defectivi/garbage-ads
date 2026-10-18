import type {GameState} from '../game/GameState';
import {maxPlayerHP} from '../game/GameState';
import type {Hardship} from '../game/GameConfig';
import {ACTOR_HP,type ActorType} from '../data/weapons';
import {derive} from '../utils/SeededRNG';
export const HARDSHIPS:Record<Hardship,{name:string;detail:string}>={
 hunger:{name:'Hollow Belly',detail:'Hunger drains 50% faster.'},
 slow:{name:'Leadfoot',detail:'Movement speed reduced by 20%.'},
 fuel:{name:'Cold Hearth',detail:'Your home furnace starts empty; a village curse extinguishes its current fuel.'},
 health:{name:'Frail Heart',detail:'Maximum HP reduced to 50%.'},
 unprotected:{name:'Unclaimed',detail:'No starting or respawn protection.'}
};
export const MODE_NAMES={easy:'December Mosw',normal:'Frostbound',hard:'Siberia'};
export function actorMaxHP(state:GameState,type:ActorType){return ACTOR_HP[type]*(state.world.mode==='easy'?.7:1);}
export function hungerRate(state:GameState){return (state.world.mode==='easy'?.5:1)*(state.hardships?.includes('hunger')?1.5:1);}
/** Record successful and unsuccessful first-visit rolls before applying any effect. */
export function visitVillage(state:GameState,id:string):Hardship|undefined{
 if(state.world.mode!=='hard'||!id.startsWith('village:'))return;
 const visited=state.villageTrials??(state.villageTrials=[]);if(visited.includes(id))return;visited.push(id);
 if(derive(state.world.seeds.villages,`village-trial:${id}`)/4294967296>=.3)return;
 const active=state.hardships??(state.hardships=[]),choices=(Object.keys(HARDSHIPS) as Hardship[]).filter(k=>!active.includes(k));if(!choices.length)return;
 const choice=choices[derive(state.world.seeds.villages,`village-hardship:${id}`)%choices.length];active.push(choice);
 if(choice==='fuel'){state.furnaces[0].fuel=0;state.furnaces[0].charcoal=0;}
 if(choice==='unprotected'){delete state.spawnProtection;state.player.invulnerable=0;}
 state.player.hp=Math.min(state.player.hp,maxPlayerHP(state));return choice;
}
