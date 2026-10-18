import {mapTools} from './MapTools';
import {heatRadius} from '../systems/SurvivalSystem';
import {CITY_OFFERS} from '../data/cityStore';
import {WEAPON_IDS,WEAPONS,weaponCost,weaponUses} from '../data/weapons';
import {paintMap} from './MapPainter';
import { showTrade } from './TradingUI';
import type { App } from './App';
import { BUILDINGS, CONSTRUCTION_SECONDS, RESOURCES, RESOURCE_IDS, type BuildingType } from '../data/definitions';
import { exportFull, exportSandbox, importJSON, loadLocal, saveLocal, validateSettings } from '../systems/SaveSystem';
import { resourceText } from '../systems/InventorySystem';
import type { Ruin } from '../world/WorldManager';
import type { GameState } from '../game/GameState';
import { showInventory } from './InventoryUI';
export class Panels {
  constructor(private app: App) {}
  inventory() {
    showInventory(this.app);

  }
  building() {
    const el = this.app.modal('Make a place in the snow', `<p>Build wholly inside an active furnace range, on clear dry ground. Workshop requires its covering furnace at level 5. Costs use stored resources first, then carried supplies.</p><div class="building-list">${(Object.keys(BUILDINGS) as BuildingType[]).map(k => `<button data-building="${k}" ${k==='workshop'&&!this.app.game.state.furnaces.some(f=>f.level>=5&&this.app.game.settlement.ready(f.id)&&heatRadius(f)>0&&Math.hypot(f.x-this.app.game.state.player.x,f.z-this.app.game.state.player.z)<=heatRadius(f)+15)?'disabled title="Upgrade a nearby active furnace to level 5"':''}><b>${BUILDINGS[k].name}</b><small>${resourceText(BUILDINGS[k].costs)}</small><span>${CONSTRUCTION_SECONDS[k]}s construction / ${BUILDINGS[k].effect}</span></button>`).join('')}</div>`);
    const fuel = document.createElement('button'); fuel.textContent = 'Fuel nearest furnace / 1 charcoal / 30 base fuel seconds'; el.querySelector('.modal-content')!.appendChild(fuel); fuel.onclick = () => { const p = this.app.game.state.player, f = [...this.app.game.state.furnaces].sort((a,b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]; const result=this.app.game.feed(f.id,'charcoal');this.app.report(result);if(result.ok)this.app.closeModal(); };
    el.querySelectorAll<HTMLButtonElement>('[data-building]').forEach(b => b.addEventListener('click', () => { this.app.closeModal(); this.app.beginBuilding(b.dataset.building as BuildingType); }));
  }
  trade(ruin: Ruin, selected?: string) { showTrade(this.app,ruin,selected); }
  workshop(id:string){
    const g=this.app.game,shop=g.state.buildings.find(b=>b.id===id);if(!shop||!g.settlement.ready(id)||g.settlement.burning(shop))return;
    const el=this.app.modal('The Workshop',`<p>Forge and equip weapons. Recipes use stored supplies first, then carried materials. Crafting uses the existing weapon material prices.</p><div class="weapon-shop">${WEAPON_IDS.map(type=>{const cost=weaponCost(type),missing=RESOURCE_IDS.filter(k=>Math.max(0,g.state.inventory[k])+Math.max(0,g.state.stockpile[k])<(cost[k]??0));return `<article class="weapon-offer"><h3>${WEAPONS[type].name}</h3><p>${WEAPONS[type].description}</p><strong>${resourceText(cost)}</strong><button data-craft="${type}" ${missing.length&&!g.state.settings.allowDebt?'disabled':''}>Craft & equip / ${weaponUses(type)} uses</button></article>`;}).join('')}</div>`);el.classList.add('trade-modal','workshop-modal');
    el.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach(b=>b.onclick=()=>{const result=g.craftWeapon(id,b.dataset.craft as typeof WEAPON_IDS[number]);this.app.report(result);if(result.ok){this.workshop(id);document.getElementById('dialog-status')!.textContent=g.message;}});
  }
  cityStore(id:string){
    const g=this.app.game,store=g.state.buildings.find(b=>b.id===id);if(!store||g.settlement.burning(store)||!g.settlement.ready(id)){g.notify('The City Store is unavailable while burning or ruined.');return;}
    const el=this.app.modal('City Store',`<p>Prices use carried gold. Weapons equip immediately; bundles go into your pack.</p><div class="shop-wallet">YOUR GOLD <strong>${g.state.inventory.gold}</strong></div><div class="weapon-shop">${CITY_OFFERS.map(o=>`<article class="weapon-offer"><h3>${o.name}</h3><p>${o.weapon?weaponUses(o.weapon)+' uses':'Supply bundle'}</p><button data-city-buy="${o.id}" ${g.state.inventory.gold<o.gold&&!g.state.settings.allowDebt?'disabled':''}>Buy / ${o.gold} gold</button></article>`).join('')}</div>`);el.classList.add('city-store-modal');
    el.querySelectorAll<HTMLButtonElement>('[data-city-buy]').forEach(b=>b.onclick=()=>{const result=g.buyCity(id,b.dataset.cityBuy!);this.app.report(result);if(result.ok){const message=g.message;this.cityStore(id);document.getElementById('dialog-status')!.textContent=message;}});
  }
  settings() {
    const s = this.app.game.state.settings;
    const el = this.app.modal('Travel at your own pace', `<p>Relaxed mode allows long journeys without cold defeat. Survival makes warmth a real constraint. Changing settings does not reset the world.</p><label>DIFFICULTY<select id="difficulty"><option value="relaxed" ${s.difficulty === 'relaxed' ? 'selected' : ''}>Relaxed exploration</option><option value="survival" ${s.difficulty === 'survival' ? 'selected' : ''}>Survival</option></select></label><div class="form-grid"><label>RENDER DISTANCE (CHUNKS)<input id="distance" type="number" min="1" max="3" value="${s.renderDistance}"></label><label>CARRIED LIMIT (0 = UNLIMITED)<input id="capacity" type="number" min="0" max="2147483647" value="${s.inventoryLimit}"></label></div><label class="check"><input id="debt" type="checkbox" ${s.allowDebt ? 'checked' : ''}> Allow resource debt for costs and trades</label><label class="check"><input id="sound" type="checkbox" ${s.sound ? 'checked' : ''}> Synthesized sound</label><label class="check"><input id="budget-meal" type="checkbox" ${s.budgetMeal?'checked':''}> Budget Meal Mode</label><p class="setting-help">For computers and phones running on a survival budget. Targets 30 FPS and reduces expensive visual effects while keeping gameplay unchanged.</p><label class="check"><input id="show-fps" type="checkbox" ${s.showFPS?'checked':''}> Show measured FPS and frame time</label><button id="apply-settings" class="primary">Apply settings</button>`);
    el.querySelector('#apply-settings')!.addEventListener('click', () => {
      try { const next = validateSettings({ ...s,budgetMeal:el.querySelector<HTMLInputElement>('#budget-meal')!.checked,showFPS:el.querySelector<HTMLInputElement>('#show-fps')!.checked, difficulty: el.querySelector<HTMLSelectElement>('#difficulty')!.value, renderDistance: Number(el.querySelector<HTMLInputElement>('#distance')!.value), inventoryLimit: Number(el.querySelector<HTMLInputElement>('#capacity')!.value), allowDebt: el.querySelector<HTMLInputElement>('#debt')!.checked, sound: el.querySelector<HTMLInputElement>('#sound')!.checked }); this.app.game.state.settings = next; this.app.game.notify('Settings applied.'); this.app.closeModal(); } catch (e) { this.app.error(e); }
    });
  }
  saves(mode: 'full-save' | 'sandbox-config' = 'full-save') {
    const el = this.app.modal('Your world, in a file', `<p>Generation ${this.app.game.state.world.generationVersion} · Seed ${this.app.game.state.world.seed}. Full saves restore a world. Sandbox configurations create a clean one with the configured starting resources.</p><div class="button-row"><button id="save-local">Save locally</button><button id="load-local">Load local save</button><button id="export-full">Export full save</button><button id="export-sandbox">Export sandbox config</button></div><label>IMPORT MODE<select id="import-mode"><option value="full-save" ${mode === 'full-save' ? 'selected' : ''}>Restore full world save</option><option value="sandbox-config" ${mode === 'sandbox-config' ? 'selected' : ''}>Start fresh from sandbox configuration</option></select></label><label>SELECT A JSON FILE<input id="import-file" type="file" accept=".json,application/json"></label><label>OR EDIT / PASTE JSON<textarea id="import-text" rows="8" spellcheck="false" placeholder="Paste a frostbound JSON document"></textarea></label><div class="button-row"><button id="validate-import" class="primary">Validate import</button><button id="edit-sandbox">Fill with current sandbox config</button></div><p id="import-result" role="status"></p><button id="replace-world" class="danger-button" hidden>Confirm: replace active world</button>`);
    let pending: GameState | undefined;
    const text = el.querySelector<HTMLTextAreaElement>('#import-text')!, modeInput = el.querySelector<HTMLSelectElement>('#import-mode')!, result = el.querySelector('#import-result')!, confirm = el.querySelector<HTMLButtonElement>('#replace-world')!;
    const invalidate = () => { pending = undefined; confirm.hidden = true; }; text.addEventListener('input', invalidate); modeInput.addEventListener('change', invalidate);
    el.querySelector('#save-local')!.addEventListener('click', () => { const r = saveLocal(this.app.game.state); result.textContent = r.message; });
    el.querySelector('#load-local')!.addEventListener('click', () => { try { pending = loadLocal(); result.textContent = `Local seed ${pending.world.seed} validated. Confirm replacement below.`; confirm.hidden = false; } catch (e) { invalidate(); result.textContent = String(e); } });
    const download = (sandbox: boolean) => { const json = sandbox ? exportSandbox(this.app.game.state) : exportFull(this.app.game.state), url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `frostbound-${this.app.game.state.world.seed}-${sandbox ? 'sandbox' : 'world'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    el.querySelector('#export-full')!.addEventListener('click', () => download(false)); el.querySelector('#export-sandbox')!.addEventListener('click', () => download(true));
    el.querySelector('#edit-sandbox')!.addEventListener('click', () => { text.value = exportSandbox(this.app.game.state); modeInput.value = 'sandbox-config'; invalidate(); });
    el.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async e => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; invalidate(); if (file.size > 12000000) { result.textContent = 'File is larger than 12 MB.'; return; } try { text.value = await file.text(); result.textContent = 'File read. Validate before replacing the world.'; } catch { result.textContent = 'The file could not be read.'; } });
    el.querySelector('#validate-import')!.addEventListener('click', () => { invalidate(); try { pending = importJSON(text.value, modeInput.value as typeof mode); result.textContent = `${modeInput.value} validated · seed ${pending.world.seed} · ${pending.buildings.length} buildings. The current world is unchanged. Confirm replacement to continue.`; confirm.hidden = false; } catch (e) { result.textContent = e instanceof Error ? e.message : String(e); } });
    confirm.addEventListener('click', () => { if (pending) { const next = pending; pending = undefined; this.app.replaceWorld(next); } });
  }
  map() {
    const game = this.app.game, p = game.state.player, ruin = game.world.ruin(0, 0)!;
    const known = game.state.discovered.filter(k => k.startsWith('ruin:')).map(k => { const [, x, z] = k.split(':'); return game.world.ruin(Number(x), Number(z)); }).filter(r => !!r).concat(game.world.villages());
    const el = this.app.modal('A field guide to the north', `<p>North is up. The chart covers 256 × 256 units around you; the world continues beyond its edges. Deep blue marks rivers and lakes. Green pines are individual trees; gray contours mark hills; gold-rimmed rock marks unclimbable ore cliffs. Bridges every 64 east/west units keep you dry. You can wade across elsewhere, but river water causes lasting hypothermia; warm up beside an active furnace or fire.</p><canvas id="map-canvas" width="512" height="512"></canvas><div class="map-key"><span class="key-water">Water / hypothermia</span><span class="key-forest">Pine forest</span><span class="key-hill">High ground</span><span class="key-cliff">Ore cliffs</span><span class="key-village">Villages / gold</span><span>Ruins / brown</span><span class="key-player">You / red</span><span class="key-home">Home / navy</span></div><p id="map-rumour"></p><div id="known-places"></div>`);
    el.querySelector('#map-rumour')!.textContent = ruin && !game.state.discovered.includes(ruin.id) ? `A rumour of old rooftops: ${Math.round(ruin.x)} east, ${Math.abs(Math.round(ruin.z))} north of home.` : 'Follow blue fishing markers along accessible riverbanks. Search chests near ruined houses.';
    const list = el.querySelector('#known-places')!; for (const r of known) { const row = document.createElement('p'); row.textContent = `${r!.name} · ${Math.round(r!.x)}, ${Math.round(r!.z)}`; list.appendChild(row); }
    mapTools(el,game,known);
  }
}
