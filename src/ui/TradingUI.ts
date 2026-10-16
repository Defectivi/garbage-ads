import type { App } from './App';
import type { Ruin } from '../world/WorldManager';
import { RESOURCE_IDS, RESOURCES, type Balances } from '../data/definitions';
import { WEAPONS, WEAPON_IDS, type WeaponType } from '../data/weapons';
import { exchange, resourceText } from '../systems/InventorySystem';
import { itemIcon } from './Icons';

export function showTrade(app:App,ruin:Ruin,selected?:string,tab:'resources'|'weapons'='resources') {
  const game=app.game,npc=game.npc(ruin);
  const chips=(values:Partial<Balances>)=>RESOURCE_IDS.filter(k=>(values[k]??0)>0).map(k=>`<span class="trade-chip">${itemIcon(k)}<strong>${values[k]}</strong> ${RESOURCES[k].name}</span>`).join('');
  const preview=(give:Partial<Balances>,receive:Partial<Balances>)=>exchange({...game.state.inventory},{...npc.inventory},give,receive,game.state.settings,game.inventoryLimit);
  const problem=(give:Partial<Balances>,receive:Partial<Balances>,fallback:string)=>{
    if(!game.state.settings.allowDebt){const missing=RESOURCE_IDS.filter(k=>(give[k]??0)>0&&game.state.inventory[k]<(give[k]??0));if(missing.length)return 'You need '+missing.map(k=>`${(give[k]??0)-game.state.inventory[k]} more ${RESOURCES[k].name.toLowerCase()}`).join(' and ')+'.';}
    const shortage=RESOURCE_IDS.find(k=>(receive[k]??0)>npc.inventory[k]);return shortage?`The trader does not have enough ${RESOURCES[shortage].name.toLowerCase()} in stock.`:fallback;
  };
  const el=app.modal(npc.name,`<p class="trade-location">${ruin.name} <span> / Prices use carried supplies</span></p><nav class="trade-tabs" aria-label="Trade category"><button data-trade-tab="resources">Resources & barter</button><button data-trade-tab="weapons">Weapons / 100 uses</button></nav><section id="resource-trades"><label>CHOOSE A DEAL<select id="offer">${npc.offers.map(o=>`<option value="${o.id}" ${o.id===selected?'selected':''}>${resourceText(o.give)} → ${resourceText(o.receive)}</option>`).join('')}</select></label><div class="trade-exchange"><div class="trade-pay"><small>YOU PAY</small><div id="trade-give"></div><p id="trade-you-have"></p></div><span class="trade-direction" aria-hidden="true">→</span><div class="trade-receive"><small>YOU RECEIVE</small><div id="trade-receive"></div><p id="trade-stock"></p></div></div><p id="trade-preview" role="status"></p><div class="button-row"><button id="confirm-trade" class="primary">Confirm exchange</button><button id="cancel-trade">Done trading</button></div><details class="trade-ledger"><summary>All material balances</summary><div class="inventory-grid trade-balances"><b>MATERIAL</b><b>YOU</b><b>TRADER</b><b>AFTER</b>${RESOURCE_IDS.map(k=>`<span>${RESOURCES[k].name}</span><span>${game.state.inventory[k]}</span><span>${npc.inventory[k]}</span><strong data-after="${k}"></strong>`).join('')}</div></details></section><section id="weapon-trades" hidden><div class="shop-wallet"><small>YOUR SUPPLIES</small>${chips({wood:game.state.inventory.wood,metal:game.state.inventory.metal,gold:game.state.inventory.gold}) || '<span>No weapon-trading supplies carried.</span>'}</div><p>Buy and immediately equip a weapon. Melee weapons last 100 successful enemy hits. Ranged weapons last 100 shots with unlimited ammunition. This trader's weapon supply is unlimited.</p><div class="weapon-shop">${WEAPON_IDS.map(k=>{
    const w=WEAPONS[k],valid=preview(w.cost,{});
    return `<article class="weapon-offer"><div class="weapon-offer-heading"><b>${w.name}</b><small>${w.type==='melee'?'MELEE':'RANGED'}</small></div><p>${w.description}</p><div class="weapon-price">${chips(w.cost)}</div><button data-buy="${k}" ${valid.ok?'':'disabled'}>Buy & equip</button><small class="weapon-shortage">${valid.ok?'100 / 100 uses included':problem(w.cost,{},valid.error)}</small></article>`;
  }).join('')}</div></section>`);
  el.classList.add('trade-modal');
  const setTab=(value:typeof tab)=>{tab=value;el.querySelector<HTMLElement>('#resource-trades')!.hidden=value!=='resources';el.querySelector<HTMLElement>('#weapon-trades')!.hidden=value!=='weapons';el.querySelectorAll<HTMLButtonElement>('[data-trade-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.tradeTab===value);b.setAttribute('aria-pressed',String(b.dataset.tradeTab===value));});};
  el.querySelectorAll<HTMLButtonElement>('[data-trade-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tradeTab as typeof tab));setTab(tab);
  const select=el.querySelector<HTMLSelectElement>('#offer')!,confirm=el.querySelector<HTMLButtonElement>('#confirm-trade')!;
  const update=()=>{
    const offer=npc.offers.find(o=>o.id===select.value)!,valid=preview(offer.give,offer.receive);
    el.querySelector('#trade-give')!.innerHTML=chips(offer.give);el.querySelector('#trade-receive')!.innerHTML=chips(offer.receive);
    el.querySelector('#trade-you-have')!.textContent=RESOURCE_IDS.filter(k=>offer.give[k]).map(k=>`You have ${game.state.inventory[k]} ${k}`).join(' / ');
    el.querySelector('#trade-stock')!.textContent=RESOURCE_IDS.filter(k=>offer.receive[k]).map(k=>`Trader has ${npc.inventory[k]} ${k}`).join(' / ');
    const status=el.querySelector<HTMLElement>('#trade-preview')!;
    status.textContent=valid.ok?(game.state.settings.allowDebt?'Ready to trade. Sandbox debt is enabled.':'Ready to trade. Supplies change only when you confirm.'):problem(offer.give,offer.receive,valid.error);
    status.classList.toggle('trade-blocked',!valid.ok);confirm.disabled=!valid.ok;confirm.textContent=`Trade ${resourceText(offer.give)} for ${resourceText(offer.receive)}`;
    for(const k of RESOURCE_IDS)el.querySelector(`[data-after="${k}"]`)!.textContent=String(game.state.inventory[k]-(offer.give[k]??0)+(offer.receive[k]??0));
  };select.onchange=update;update();
  confirm.onclick=()=>{const result=game.trade(ruin,select.value);if(result.ok){showTrade(app,ruin,select.value,tab);app.report(result);}else app.report(result);};
  el.querySelector('#cancel-trade')!.addEventListener('click',()=>app.closeModal());
  el.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(button=>button.onclick=()=>{const result=game.buyWeapon(ruin,button.dataset.buy as WeaponType);if(result.ok){showTrade(app,ruin,select.value,'weapons');app.report(result);}else app.report(result);});
}
