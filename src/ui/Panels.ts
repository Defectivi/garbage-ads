import type { App } from './App';
import { BUILDINGS, RESOURCES, RESOURCE_IDS, type BuildingType } from '../data/definitions';
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
    const el = this.app.modal('Make a place in the snow', `<p>Build near your survivor on clear, dry ground. Costs use stored resources first, then carried supplies.</p><div class="building-list">${(Object.keys(BUILDINGS) as BuildingType[]).map(k => `<button data-building="${k}"><b>${BUILDINGS[k].name}</b><small>${resourceText(BUILDINGS[k].costs)}</small><span>${BUILDINGS[k].effect}</span></button>`).join('')}</div><button id="expand" class="secondary">Expand nearest furnace · 30 wood / +8 heat radius</button>`);
    el.querySelectorAll<HTMLButtonElement>('[data-building]').forEach(b => b.addEventListener('click', () => { this.app.closeModal(); this.app.beginBuilding(b.dataset.building as BuildingType); }));
    el.querySelector('#expand')!.addEventListener('click', () => { const f = [...this.app.game.state.furnaces].sort((a, b) => Math.hypot(a.x - this.app.game.state.player.x, a.z - this.app.game.state.player.z) - Math.hypot(b.x - this.app.game.state.player.x, b.z - this.app.game.state.player.z))[0]; this.app.report(this.app.game.upgradeFurnace(f.id)); this.app.refresh(); });
  }
  trade(ruin: Ruin, selected?: string) {
    const game = this.app.game, npc = game.npc(ruin);
    const el = this.app.modal(npc.name, `<p>Trading at ${ruin.name}. Barter and gold prices are both supported. No exchange occurs until you confirm.</p><div class="inventory-grid trade-balances"><b>RESOURCE</b><b>YOU</b><b>TRADER</b><b>YOU AFTER</b>${RESOURCE_IDS.map(k => `<span>${RESOURCES[k].name}</span><span>${game.state.inventory[k]}</span><span>${npc.inventory[k]}</span><strong data-after="${k}"></strong>`).join('')}</div><label>CHOOSE AN EXCHANGE<select id="offer">${npc.offers.map(o => `<option value="${o.id}" ${selected === o.id ? 'selected' : ''}>${o.title}</option>`).join('')}</select></label><p id="trade-preview"></p><div class="button-row"><button id="confirm-trade" class="primary">Confirm exchange</button><button id="cancel-trade">Cancel</button></div>`);
    const select = el.querySelector<HTMLSelectElement>('#offer')!;
    const preview = () => { const o = npc.offers.find(o => o.id === select.value)!; el.querySelector('#trade-preview')!.textContent = `You give ${resourceText(o.give)}. You receive ${resourceText(o.receive)}.`; for (const k of RESOURCE_IDS) el.querySelector(`[data-after="${k}"]`)!.textContent = String(game.state.inventory[k] - (o.give[k] ?? 0) + (o.receive[k] ?? 0)); };
    select.addEventListener('change', preview); preview();
    el.querySelector('#confirm-trade')!.addEventListener('click', () => { const result = game.trade(ruin, select.value); this.app.report(result); if (result.ok) this.trade(ruin, select.value); });
    el.querySelector('#cancel-trade')!.addEventListener('click', () => this.app.closeModal());
  }
  settings() {
    const s = this.app.game.state.settings;
    const el = this.app.modal('Travel at your own pace', `<p>Relaxed mode allows long journeys without cold defeat. Survival makes warmth a real constraint. Changing settings does not reset the world.</p><label>DIFFICULTY<select id="difficulty"><option value="relaxed" ${s.difficulty === 'relaxed' ? 'selected' : ''}>Relaxed exploration</option><option value="survival" ${s.difficulty === 'survival' ? 'selected' : ''}>Survival</option></select></label><div class="form-grid"><label>RENDER DISTANCE (CHUNKS)<input id="distance" type="number" min="1" max="3" value="${s.renderDistance}"></label><label>CARRIED LIMIT (0 = UNLIMITED)<input id="capacity" type="number" min="0" max="9999999" value="${s.inventoryLimit}"></label></div><label class="check"><input id="debt" type="checkbox" ${s.allowDebt ? 'checked' : ''}> Allow resource debt for costs and trades</label><label class="check"><input id="sound" type="checkbox" ${s.sound ? 'checked' : ''}> Synthesized sound</label><button id="apply-settings" class="primary">Apply settings</button>`);
    el.querySelector('#apply-settings')!.addEventListener('click', () => {
      try { const next = validateSettings({ ...s, difficulty: el.querySelector<HTMLSelectElement>('#difficulty')!.value, renderDistance: Number(el.querySelector<HTMLInputElement>('#distance')!.value), inventoryLimit: Number(el.querySelector<HTMLInputElement>('#capacity')!.value), allowDebt: el.querySelector<HTMLInputElement>('#debt')!.checked, sound: el.querySelector<HTMLInputElement>('#sound')!.checked }); this.app.game.state.settings = next; this.app.game.notify('Settings applied.'); this.app.closeModal(); } catch (e) { this.app.error(e); }
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
    const known = game.state.discovered.filter(k => k.startsWith('ruin:')).map(k => { const [, x, z] = k.split(':'); return game.world.ruin(Number(x), Number(z)); }).filter(r => !!r);
    const el = this.app.modal('A field guide to the north', `<p>North is up. The chart covers 256 × 256 units around you; the world continues beyond its edges. Blue marks rivers. Cross at timber bridges every 64 east/west units.</p><canvas id="map-canvas" width="512" height="512"></canvas><div class="map-key"><span>● You</span><span>▲ Home</span><span>■ Discovered ruins</span></div><p id="map-rumour"></p><div id="known-places"></div>`);
    el.querySelector('#map-rumour')!.textContent = ruin && !game.state.discovered.includes(ruin.id) ? `A rumour of old rooftops: ${Math.round(ruin.x)} east, ${Math.abs(Math.round(ruin.z))} north of home.` : 'Follow blue fishing markers along accessible riverbanks. Search chests near ruined houses.';
    const list = el.querySelector('#known-places')!; for (const r of known) { const row = document.createElement('p'); row.textContent = `${r!.name} · ${Math.round(r!.x)}, ${Math.round(r!.z)}`; list.appendChild(row); }
    const ctx = el.querySelector<HTMLCanvasElement>('#map-canvas')!.getContext('2d')!;
    for (let x = 0; x < 512; x += 4) for (let z = 0; z < 512; z += 4) { const wx = p.x - 128 + x / 2, wz = p.z - 128 + z / 2, river = game.world.river(wx, wz); ctx.fillStyle = game.world.spec.config.riverDensity && river.distance < river.width ? river.crossing ? '#a18b6b' : '#5c96ad' : game.world.biome(wx, wz) === 'Pinewood' ? '#9bb9b1' : '#e1ece9'; ctx.fillRect(x, z, 4, 4); }
    const dot = (x: number, z: number, color: string, size: number) => { ctx.fillStyle = color; ctx.fillRect((x - p.x + 128) * 2 - size / 2, (z - p.z + 128) * 2 - size / 2, size, size); };
    dot(p.x, p.z, '#b15e36', 9); dot(0, 0, '#345463', 9); for (const r of known) dot(r!.x, r!.z, '#81644a', 8);
  }
}
