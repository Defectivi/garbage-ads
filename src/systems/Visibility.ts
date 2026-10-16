import type {GameState,Point} from '../game/GameState';
import {nightBlend} from './DayNight';
import {distance} from '../world/WorldManager';
export function lightSources(s:GameState):Array<Point & {radius:number}>{
 const held=s.combat.weapons.some(w=>w.id===s.combat.equipped&&w.type==='molotov'&&w.uses>0);
 return [...(held?[{...s.player,radius:9}]:[]),...s.combat.fires.filter(f=>f.remaining>0).sort((a,b)=>distance(a,s.player)-distance(b,s.player)).map(f=>({...f,radius:8})),...s.furnaces.filter(f=>f.fuel+f.charcoal>0&&s.changes.structures?.[f.id]?.stage!=='ruin'&&s.changes.structures?.[f.id]?.stage!=='gone').map(f=>({...f,radius:9})),...s.buildings.filter(b=>b.type==='shelter'&&(b.burnTime??15)>0&&s.changes.structures?.[b.id]?.stage!=='ruin'&&s.changes.structures?.[b.id]?.stage!=='gone').map(b=>({...b,radius:7}))].slice(0,8);
}
export function sightSettings(s:GameState,storm=s.combat.weather.mode==='snow'?1:0){const night=nightBlend(s);return{weight:Math.max(storm,night),near:8-3*night,far:28-6*night,night};}
export function visibilityAt(s:GameState,p:Point){const v=sightSettings(s),smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};let fog=smooth(v.near,v.far,distance(s.player,p));for(const l of lightSources(s))fog*=smooth(l.radius*.45,l.radius,distance(l,p));return fog*v.weight;}
