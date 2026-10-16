import type {Game} from '../game/Game';
import {RESOURCE_IDS,type Resource} from '../data/definitions';
import {fuelInterval,furnaceExpansions,expandsAtLevel,FURNACE_EXPANSION_LEVELS} from '../data/furnaces';
import {itemIcon} from './Icons';
export function updateFurnaceUpgrade(root:HTMLElement,game:Game,attempt:()=>void){
 const host=root.querySelector('#furnace-upgrade');if(!host)return;
 let button=host.querySelector<HTMLButtonElement>('button');
 if(!button){host.innerHTML='<button id="upgrade-furnace"><kbd>T</kbd><strong></strong></button><div class="upgrade-costs"></div><small class="upgrade-help"></small>';button=host.querySelector('button')!;button.onclick=attempt;}
 const info=game.furnaceUpgrade(),f=info.furnace,maxed=!!f&&f.level>=50;
 button.setAttribute('aria-disabled',String(!info.ok));button.classList.toggle('unavailable',!info.ok);button.title=info.error??'Spend the shown supplies and upgrade this furnace.';
 button.querySelector('strong')!.textContent=maxed?'Furnace maxed / 50':`Upgrade / ${f?.level??1} > ${(f?.level??1)+1}`;
 const html=maxed?'':RESOURCE_IDS.filter(k=>info.cost[k]).map(k=>`<span class="${info.missing.includes(k)?'cost-missing':''}" title="${k}">${itemIcon(k)}<b>${info.cost[k]}</b></span>`).join('');
 const costs=host.querySelector('.upgrade-costs')!;if(costs.innerHTML!==html)costs.innerHTML=html;
 const expansions=furnaceExpansions(f?.level??1),nextExpansion=FURNACE_EXPANSION_LEVELS.find(level=>level>(f?.level??1));
 host.querySelector('.upgrade-help')!.textContent=!f||Math.hypot(f.x-game.state.player.x,f.z-game.state.player.z)>5?'Move within 5 units of a furnace.':maxed?`Fuel interval ${fuelInterval(50).toFixed(1)}s / expansions 3/3`:`${expandsAtLevel(f.level+1)?'+8 range + fuel':'Fuel +' } / expansions ${expansions}/3${nextExpansion?` / next at ${nextExpansion}`:''}`;
}
export function flashMissing(root:HTMLElement,resources:Resource[]){
 for(const resource of resources){const el=root.querySelector<HTMLElement>(`#resources [data-resource="${resource}"]`);if(!el)continue;
  for(const animation of el.getAnimations())if(animation.id==='missing-resource')animation.cancel();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.classList.add('resource-shortage');setTimeout(()=>el.classList.remove('resource-shortage'),1200);}
  else{const animation=el.animate([{backgroundColor:'#d45d5100',color:'#edecdc'},{backgroundColor:'#d45d51b0',color:'#ffe0cf',offset:.4},{backgroundColor:'#d45d5100',color:'#edecdc'}],{duration:1200,easing:'ease-in-out'});animation.id='missing-resource';}
 }
}
