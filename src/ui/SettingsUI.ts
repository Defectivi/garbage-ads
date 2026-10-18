import type {App} from './App';
import {validateSettings} from '../systems/SaveSystem';
import {MODE_NAMES,HARDSHIPS} from '../systems/Difficulty';

export function showSettings(app:App){
  const s=app.game.state.settings,world=app.game.state.world;
  const check=(id:string,title:string,description:string,value:boolean|undefined)=>`<label class="setting-toggle" for="${id}"><span><strong>${title}</strong><small>${description}</small></span><input id="${id}" type="checkbox" ${value?'checked':''}></label>`;
  const el=app.modal('Tune your expedition',`<p class="settings-intro">Clear choices. The same wilderness. Changes apply without restarting.</p>
    <section class="expedition-rule"><span class="settings-kicker">WORLD DIFFICULTY / FIXED FOR THIS SAVE</span><strong>${MODE_NAMES[world.mode??'normal']}</strong><p>Starting supplies, enemies, hunger and village rules are chosen when creating a world.${world.hardship?` Permanent hardship: ${HARDSHIPS[world.hardship].name}.`:''}</p><button id="settings-expedition">Choose difficulty for a new expedition</button><small>Returns to the title. Your current world stays intact until you confirm a replacement.</small></section>
    <div class="settings-sections">
      <fieldset><legend><span>01</span> Survival rules</legend><label for="difficulty">Cold exposure</label><select id="difficulty"><option value="relaxed" ${s.difficulty==='relaxed'?'selected':''}>Cold safety — no defeat at zero warmth</option><option value="survival" ${s.difficulty==='survival'?'selected':''}>Lethal cold — zero warmth ends the expedition</option></select><p class="setting-help">This controls cold defeat only. Health, hunger, enemies and your world difficulty still apply.</p></fieldset>
      <fieldset><legend><span>02</span> Graphics & performance</legend><label for="distance">Terrain render distance</label><select id="distance">${[1,2,3].map(n=>`<option value="${n}" ${s.renderDistance===n?'selected':''}>${n===1?'Near':n===2?'Balanced':'Far'} / ${n} chunk${n>1?'s':''}</option>`).join('')}</select><p class="setting-help">Farther terrain costs more graphics work. Storm and night visibility remain limited.</p>${check('budget-meal','Budget Meal Mode','Targets 30 FPS and reduces costly visual effects. Gameplay timing stays unchanged.',s.budgetMeal)}${check('show-fps','Performance readout','Show measured rendering FPS and frame time during play.',s.showFPS)}</fieldset>
      <fieldset><legend><span>03</span> Sound</legend>${check('sound','Winter soundscape','Synthesized ambience and action sounds.',s.sound)}</fieldset>
      <fieldset><legend><span>04</span> Sandbox & supplies</legend><label for="capacity">Carried resource limit</label><input id="capacity" type="number" min="0" max="2147483647" inputmode="numeric" value="${s.inventoryLimit}"><p class="setting-help">0 means unlimited. Storehouses add capacity to a limited pack.</p>${check('debt','Allow resource debt','Sandbox option: building and trading may spend resources below zero.',s.allowDebt)}</fieldset>
    </div><div class="settings-apply"><span>Changes take effect when applied.</span><button id="apply-settings" class="primary">Apply settings</button></div>`);
  el.classList.add('settings-modal');
  el.querySelector('#settings-expedition')!.addEventListener('click',()=>app.menu());
  el.querySelector('#apply-settings')!.addEventListener('click',()=>{
    try{
      const checked=(id:string)=>el.querySelector<HTMLInputElement>(`#${id}`)!.checked,value=(id:string)=>(el.querySelector(`#${id}`) as HTMLInputElement|HTMLSelectElement).value;
      const next=validateSettings({...s,budgetMeal:checked('budget-meal'),showFPS:checked('show-fps'),sound:checked('sound'),allowDebt:checked('debt'),difficulty:value('difficulty'),renderDistance:Number(value('distance')),inventoryLimit:Number(value('capacity'))});
      app.game.state.settings=next;app.game.notify('Settings applied.');app.closeModal();app.refresh();
    }catch(e){app.error(e);}
  });
}
