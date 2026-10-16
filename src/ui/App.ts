import { DamageEffects } from './DamageEffects';
import { CollectionEffects } from './CollectionEffects';
import { cameraRelativeMovement, joystickMovement } from '../game/MovementInput';
import { WEAPONS } from '../data/weapons';
import { Game } from '../game/Game';
import { newState, type GameState, type Point } from '../game/GameState';
import { MOVEMENT, randomSeed, worldSpec } from '../game/GameConfig';
import { BUILDINGS, RESOURCE_IDS, RESOURCES, type BuildingType } from '../data/definitions';
import { Renderer } from '../rendering/Renderer';
import { distance } from '../world/WorldManager';
import { Panels } from './Panels';
import { loadLocal, saveLocal } from '../systems/SaveSystem';
import { type Result } from '../systems/InventorySystem';
import { temperature, sheltered, inPlayerHeat } from '../systems/SurvivalSystem';
import { AudioSystem } from '../game/audio';
import { itemIcon, uiIcon } from './Icons';
export class App {
  private root = document.getElementById('interface')!;
  private keys = new Set<string>(); private mode: 'menu' | 'game' = 'menu'; private previous = 0; private clock = 0;
  private panels = new Panels(this); private audio = new AudioSystem(); private played = false;
  private stick = { x: 0, z: 0 }; private touchAction = false; private actionTimer = 0; private autosave = 0; private revision = -1;
  private placement?: { type: BuildingType; point: Point; rotation: number };
  private aiming = false; private firing = false; private sprintTouch = false; private lastMessage = ''; private messageTime = 0;
  private resetOrbit = () => {};
  private resetJoystick = () => {};
  private clearInput() {
    this.keys.clear(); this.stick = { x: 0, z: 0 }; this.touchAction = false;
    this.firing = false; this.assistAttack=false; this.sprintTouch = false;
    this.resetOrbit(); this.resetJoystick(); this.game.stopMovement();
    this.root.querySelector('#sprint-button')?.classList.remove('selected');
  }
  private collectionEffects: CollectionEffects;
  private damageEffects:DamageEffects; private assistAttack=false;
  constructor(public game: Game, public renderer: Renderer) { this.damageEffects=new DamageEffects(point=>this.renderer.screenPoint(point)); this.collectionEffects = new CollectionEffects(this.root, point => this.renderer.screenPoint(point)); }
  start() {
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if(this.game.dead&&this.mode==='game')return; if (this.placement) this.cancelBuilding(); else if (this.root.querySelector('.modal-backdrop')) this.closeModal(); else if (this.mode === 'game') this.pause(); return; }
      if ((e.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"]')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if(e.shiftKey&&e.key.toLowerCase()==='s'&&this.mode==='game'&&!this.game.dead){e.preventDefault();this.keys.delete('s');if(!e.repeat){const result=saveLocal(this.game.state);this.game.notify(result.message);this.refresh();}return;}
      this.keys.add(e.key.toLowerCase());
      if (e.repeat || this.mode !== 'game' || this.root.querySelector('.modal-backdrop')) return;
      if (/^[1-6]$/.test(e.key)) this.equip(Number(e.key) - 1);
      if (e.key.toLowerCase() === 'f') this.interact();
      if (['e','i'].includes(e.key.toLowerCase())) this.panels.inventory();
      if (e.key.toLowerCase() === 'b') this.panels.building();
      if (e.key.toLowerCase() === 'm') this.panels.map();
      if (e.key.toLowerCase() === 'p') this.panels.saves();
      if (e.key.toLowerCase() === 'r' && this.placement) { this.placement.rotation += Math.PI / 2; this.previewBuilding(); }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.clearInput());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'game') { this.clearInput(); if (!this.game.paused) this.pause(); } });
    const canvas = this.renderer.webgl.domElement; canvas.addEventListener('contextmenu', e => e.preventDefault());
    let drag: { id: number; x: number } | null = null; let mousePointer = 1;
    this.resetOrbit = () => { const old = drag; drag = null; this.aiming = false; if (old && canvas.hasPointerCapture(old.id)) canvas.releasePointerCapture(old.id); };
    canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') mousePointer = e.pointerId; if (this.mode !== 'game' || this.game.paused) return; if (this.placement && e.button === 0) { const p = this.renderer.groundAt(e.clientX, e.clientY); if (p) { this.placement.point = { x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 }; this.previewBuilding(); } } else if (e.button === 0 && e.pointerType !== 'touch') { this.firing = true; this.assistAttack=true; canvas.setPointerCapture(e.pointerId); this.attack(true); } else if (e.button === 2 || e.pointerType === 'touch' && e.clientX >= canvas.getBoundingClientRect().left + canvas.clientWidth / 2) { drag = { id: e.pointerId, x: e.clientX }; this.aiming = e.button === 2; canvas.setPointerCapture(e.pointerId); } });
    // Pointerdown/up only fire for the first/last mouse button. Handle chords explicitly.
    canvas.addEventListener('mousedown', e => {
      if (this.mode !== 'game' || this.game.paused || this.placement) return;
      if (e.button === 0 && !this.firing) { this.firing = true; this.assistAttack=true; this.attack(true); }
      if (e.button === 2 && !drag) { drag = { id: mousePointer, x: e.clientX }; this.aiming = true; canvas.setPointerCapture(mousePointer); }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.firing = false; if (e.button === 2) this.resetOrbit(); });
    canvas.addEventListener('pointermove', e => { if (drag?.id === e.pointerId && this.mode === 'game' && !this.game.paused) { this.renderer.yaw -= (e.clientX - drag.x) * .008; drag.x = e.clientX; } else if (this.placement && e.pointerType !== 'touch') { const p = this.renderer.groundAt(e.clientX, e.clientY); if (p) { this.placement.point = { x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 }; this.previewBuilding(); } } });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => { if (drag?.id === (e as PointerEvent).pointerId) this.resetOrbit(); if (!(e.type === 'lostpointercapture' && ((e as PointerEvent).buttons & 1))) this.firing = false; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.renderer.zoom = Math.max(16, Math.min(65, this.renderer.zoom + e.deltaY * .025)); }, { passive: false });
    this.menu(); requestAnimationFrame(t => this.frame(t));
  }
  menu() {
    this.collectionEffects.clear(); this.damageEffects.clear(); this.game.collectionEvents.length = 0; this.game.actionEvents.length = 0; this.clearInput(); this.cancelBuilding(); this.mode = 'menu'; this.game.paused = true; this.audio.ambience(false); this.root.className = 'menu';
    this.root.innerHTML = `<header><b>${uiIcon('mountain')} FROSTBOUND</b><span>THE NORTHERN WILDERNESS <i>II</i></span></header><main class="menu-panel"><div class="eyebrow">EXPEDITION II / WHITEOUT</div><h1>THE FIRE<br><em>IS YOURS.</em></h1><p>Build your refuge. Arm your survivors.<br>Outlast the storm and everything it brings.</p><label class="seed-label">WORLD SEED <div class="seed-control"><input id="seed" aria-label="World seed" type="number" min="0" max="65535" value="${this.game.state.world.seed}"><button id="random" title="Generate a random seed" aria-label="Generate a random seed">↻</button></div></label><div class="menu-row"><button id="new-world" class="primary">New expedition ${uiIcon('arrow')}</button></div><button id="enter-world" class="secondary">Enter current world ${uiIcon('arrow')}</button><small id="menu-error" role="alert"></small></main><aside class="menu-coordinate"><span>FIELD GUIDE</span><b>Keep your fire.<br>Find your way.</b><small>ARMED VILLAGES / RAIDERS / BLIZZARDS</small></aside><footer>FYWS: FROSTBOUND <span>WINTER SURVIVAL · SINGLE PLAYER</span></footer>`;
    this.root.querySelector('#new-world')!.addEventListener('click', () => { try { const value = (document.getElementById('seed') as HTMLInputElement).value; if (!value) throw new Error('Enter a world seed (0 to 65535).'); const spec = worldSpec(Number(value)); const next = newState(spec, { ...this.game.state.settings }); if (this.played) this.offerWorld(next, 'Create a clean world? Your current world will be replaced.'); else this.replaceWorld(next); } catch (e) { this.root.querySelector('#menu-error')!.textContent = String(e); } });
    this.root.querySelector('#random')!.addEventListener('click', () => { (document.getElementById('seed') as HTMLInputElement).value = String(randomSeed()); });
    this.root.querySelector('#enter-world')!.addEventListener('click', () => this.enter());
    const extra = document.createElement('div'); extra.className = 'menu-tools'; extra.innerHTML = '<button id="load-save">Load Save</button><button id="import-save">Import Save</button><button id="import-config">Import Sandbox Configuration</button><button id="settings-menu">Settings</button>';
    this.root.querySelector('.menu-panel')!.appendChild(extra);
    extra.querySelector('#load-save')!.addEventListener('click', () => { try { this.offerWorld(loadLocal(), 'Load the saved world? This replaces the active world.'); } catch (e) { this.error(e); } });
    extra.querySelector('#import-save')!.addEventListener('click', () => this.panels.saves('full-save')); extra.querySelector('#import-config')!.addEventListener('click', () => this.panels.saves('sandbox-config')); extra.querySelector('#settings-menu')!.addEventListener('click', () => this.panels.settings());
  }
  enter() {
    this.clearInput(); this.mode = 'game'; this.played = true; this.game.paused = false; this.root.className = 'playing'; this.keys.clear(); this.audio.enabled = this.game.state.settings.sound; this.audio.unlock(); this.audio.ambience(true);
    this.root.innerHTML = `<header><b>${uiIcon('mountain')} FROSTBOUND</b><span id="seed-hud"></span><button id="menu" aria-label="Pause game">Ⅱ <span>Pause</span></button></header><div id="resources" class="resource-bar" aria-label="Carried resources"></div><section class="survival"><div class="exposure-heading">${uiIcon('flame')}<strong id="warmth"></strong></div><div class="warmth-meter"><i></i></div><span id="fuel"></span><small id="location"></small></section><button id="interaction" class="interaction"><kbd>F</kbd><span></span></button><section class="combat-hud"><div class="health-line"><b id="health"></b><span id="weather"></span></div><div class="hp-meter"><i></i></div><div id="weapon-rack"></div><small id="weapon-state"></small><small id="furnace-defense"></small><button id="attack-button">ATTACK <kbd>SPACE</kbd></button><button id="sprint-button">SPRINT <kbd>SHIFT</kbd></button></section><div id="message" role="status"></div><footer><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move / F interact / E inventory / Shift+S save</footer>`;
    this.root.querySelector('#menu')!.addEventListener('click', () => this.pause()); this.root.querySelector('#interaction')!.addEventListener('click', () => this.interact());
    const toolbar = document.createElement('nav'); toolbar.className = 'toolbar'; toolbar.setAttribute('aria-label', 'Field kit'); toolbar.innerHTML = [['inventory', 'pack', 'Rucksack', 'E'], ['build', 'build', 'Build', 'B'], ['map', 'map', 'Map', 'M'], ['saves', 'save', 'World files', 'P'], ['settings', 'settings', 'Settings', '']].map(([id, art, label, key]) => `<button id="${id}" title="${label}${key ? ` (${key})` : ''}" aria-label="${label}">${uiIcon(art)}<span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`).join('');
    this.root.appendChild(toolbar); toolbar.querySelector('#inventory')!.addEventListener('click', () => this.panels.inventory()); toolbar.querySelector('#build')!.addEventListener('click', () => this.panels.building()); toolbar.querySelector('#map')!.addEventListener('click', () => this.panels.map()); toolbar.querySelector('#saves')!.addEventListener('click', () => this.panels.saves()); toolbar.querySelector('#settings')!.addEventListener('click', () => this.panels.settings());
    const touch = document.createElement('div'); touch.className = 'touch-controls'; touch.innerHTML = '<div id="joystick" aria-label="Movement joystick"><i></i></div><button id="touch-interact">F<span>INTERACT</span></button><div class="camera-controls"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button></div>'; this.root.appendChild(touch);
    const joystick = touch.querySelector<HTMLElement>('#joystick')!, knob = joystick.querySelector('i')!; let pointer: number | null = null;
    const move = (e: PointerEvent) => { if (pointer !== e.pointerId) return; const b = joystick.getBoundingClientRect(); let x = e.clientX - b.x - b.width / 2, z = e.clientY - b.y - b.height / 2, d = Math.hypot(x, z); if (d > MOVEMENT.joystickRadius) { x *= MOVEMENT.joystickRadius / d; z *= MOVEMENT.joystickRadius / d; } this.stick = joystickMovement(x, z); knob.style.transform = `translate(${x}px,${z}px)`; };
    joystick.addEventListener('pointerdown', e => { pointer = e.pointerId; joystick.setPointerCapture(e.pointerId); move(e); }); joystick.addEventListener('pointermove', move);
    this.resetJoystick = () => { const old = pointer; pointer = null; this.stick = { x: 0, z: 0 }; knob.style.transform = ''; if (old !== null && joystick.hasPointerCapture(old)) joystick.releasePointerCapture(old); };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, this.resetJoystick);
    const action = touch.querySelector<HTMLElement>('#touch-interact')!; action.addEventListener('pointerdown', e => { action.setPointerCapture(e.pointerId); this.touchAction = true; this.interact(); }); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) action.addEventListener(event, () => { this.touchAction = false; this.firing = false; });
    touch.querySelector('#zoom-in')!.addEventListener('click', () => { this.renderer.zoom = Math.max(16, this.renderer.zoom - 4); }); touch.querySelector('#zoom-out')!.addEventListener('click', () => { this.renderer.zoom = Math.min(65, this.renderer.zoom + 4); });
    this.root.querySelector('#attack-button')!.addEventListener('pointerdown', e => { (e.currentTarget as HTMLElement).setPointerCapture((e as PointerEvent).pointerId); this.firing = true; this.assistAttack=true; this.attack(true); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.root.querySelector('#attack-button')!.addEventListener(event, () => this.firing = false);
    const sprint = this.root.querySelector<HTMLElement>('#sprint-button')!;
    sprint.addEventListener('pointerdown', e => { if (this.game.paused) return; sprint.setPointerCapture(e.pointerId); this.sprintTouch = true; sprint.classList.add('selected'); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) sprint.addEventListener(event, () => { this.sprintTouch = false; sprint.classList.remove('selected'); });
    this.refresh();
  }
  equip(index: number) { const w = this.game.state.combat.weapons.filter(w => w.uses > 0)[index]; if (w) this.game.state.combat.equipped = w.id; this.refresh(); }
  private attack(assist=false) { if(assist){this.game.combat.attackAssisted();return;}const p=this.game.state.player;this.game.combat.attack({x:p.x+Math.sin(p.heading)*12,z:p.z+Math.cos(p.heading)*12}); }

  modal(title: string, content: string) {
    this.root.querySelector('.modal-backdrop')?.remove(); this.game.paused = true; this.collectionEffects.clear(); this.damageEffects.clear(); this.clearInput(); this.audio.ambience(false);
    const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; const panel = document.createElement('section'); panel.className = 'modal'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'dialog-title'); panel.innerHTML = '<button class="close-modal" aria-label="Close dialog">×</button><div class="eyebrow">FROSTBOUND / FIELD KIT</div><h2 id="dialog-title"></h2><div class="modal-content"></div><div id="dialog-status" role="status"></div>';
    panel.querySelector('h2')!.textContent = title; panel.querySelector('.modal-content')!.innerHTML = content; backdrop.appendChild(panel); this.root.appendChild(backdrop); panel.querySelector('.close-modal')!.addEventListener('click', () => this.closeModal()); panel.querySelector<HTMLElement>('.close-modal')!.focus(); return panel;
  }
  closeModal() { if(this.mode==='game'&&this.game.dead)return; this.root.querySelector('.modal-backdrop')?.remove(); this.clearInput(); if (this.mode === 'game') { this.game.paused = false; this.audio.enabled = this.game.state.settings.sound; this.audio.ambience(true); } }
  error(e: unknown) { const message = e instanceof Error ? e.message : String(e); this.game.notify(message); const status = this.root.querySelector('#dialog-status') ?? this.root.querySelector('#menu-error'); if (status) status.textContent = message; }
  report(result: Result) { if (!result.ok) this.error(result.error); else { this.audio.tone('collect'); const el = this.root.querySelector('#dialog-status'); if (el) el.textContent = this.game.message; } this.refresh(); }
  replaceWorld(state: GameState) { this.collectionEffects.clear(); this.damageEffects.clear(); this.cancelBuilding(); this.game = new Game(state); this.renderer.setGame(this.game); this.revision = -1; this.autosave = 0; this.enter(); }
  private offerWorld(state: GameState, message: string) { const el = this.modal('A new chapter?', '<p id="replace-description"></p><div class="button-row"><button id="confirm-world" class="primary">Confirm replacement</button><button id="cancel-world">Cancel</button></div>'); el.querySelector('#replace-description')!.textContent = `${message} Seed ${state.world.seed}, generation ${state.world.generationVersion}.`; el.querySelector('#confirm-world')!.addEventListener('click', () => this.replaceWorld(state)); el.querySelector('#cancel-world')!.addEventListener('click', () => this.closeModal()); }
  private pause() {
    const el = this.modal('The wilderness can wait.', '<p>Simulation is paused. Your fire and workers will wait.</p><p class="control-hints">Desktop: WASD / arrows move, hold Shift to sprint, right-drag to orbit, wheel to zoom. Touch: left joystick moves; drag the right half of the world to orbit. Hold Sprint; use + / - to zoom. Attack uses the equipped weapon; F / Interact uses the nearby prompt. E opens inventory, B builds, M opens the map, Shift+S saves locally. Movement sets facing. Left click and touch Attack assist nearby hostiles; Space attacks forward.</p><div class="button-row"><button id="resume" class="primary">Resume</button><button id="pause-save">Save locally</button><button id="reset-world">Reset this world</button><button id="exit-menu">Exit to Menu</button></div>');
    el.querySelector('#resume')!.addEventListener('click', () => this.closeModal()); el.querySelector('#pause-save')!.addEventListener('click', () => { const r = saveLocal(this.game.state); el.querySelector('#dialog-status')!.textContent = r.message; }); el.querySelector('#exit-menu')!.addEventListener('click', () => this.menu()); el.querySelector('#reset-world')!.addEventListener('click', () => this.offerWorld(newState(this.game.state.world, this.game.state.settings), 'Reset this seed to its original state? Buildings, discoveries and resource changes will be cleared.'));
  }
  beginBuilding(type: BuildingType) {
    this.placement = { type, point: { x: this.game.state.player.x + 7, z: this.game.state.player.z }, rotation: 0 };
    const bar = document.createElement('div'); bar.className = 'placement-bar'; bar.innerHTML = '<strong></strong><small></small><div class="button-row"><button id="place-building" class="primary">Confirm placement</button><button id="rotate-building">Rotate · R</button><button id="cancel-building">Cancel</button></div>'; this.root.querySelector('.placement-bar')?.remove(); this.root.appendChild(bar);
    bar.querySelector('#place-building')!.addEventListener('click', () => this.confirmBuilding()); bar.querySelector('#rotate-building')!.addEventListener('click', () => { this.placement!.rotation += Math.PI / 2; this.previewBuilding(); }); bar.querySelector('#cancel-building')!.addEventListener('click', () => this.cancelBuilding()); this.previewBuilding();
  }
  private previewBuilding() { if (!this.placement) return; const { type, point, rotation } = this.placement, invalid = this.game.validPlacement(type, point), bar = this.root.querySelector('.placement-bar')!; bar.querySelector('strong')!.textContent = `${BUILDINGS[type].name} · ${invalid ? 'Blocked' : 'Ready to place'}`; bar.querySelector('small')!.textContent = invalid || 'Click or tap ground to move the preview. Confirm to spend the building cost.'; (bar.querySelector('#place-building') as HTMLButtonElement).disabled = !!invalid; this.renderer.showPreview(type, point, rotation, !invalid); }
  private confirmBuilding() { if (!this.placement) return; const p = this.placement, r = this.game.build(p.type, p.point, p.rotation); this.report(r); if (r.ok) this.cancelBuilding(); }
  private cancelBuilding() { this.placement = undefined; this.root.querySelector('.placement-bar')?.remove(); this.renderer.showPreview(null); }
  interact() {
    if (this.mode !== 'game' || this.game.paused) return;
    if (this.placement) { this.confirmBuilding(); return; }
    const context = this.context(); if (!context) return;
    if(context.kind==='furnace')this.game.bindFurnace(context.id!);
    if (context.kind === 'drop') this.game.combat.pickup(context.id!);
    else if (context.kind === 'trader') this.panels.trade(context.ruin!);
    else if (context.kind === 'storage') this.panels.inventory();
    else { const result = context.kind === 'node' ? this.game.gather(context.node!) : context.kind === 'furnace' ? this.game.feed(context.id, this.game.state.inventory.wood + this.game.state.stockpile.wood > 0 ? 'wood' : 'charcoal') : context.kind === 'fishing' ? this.game.startFishing(context.spot!) : this.game.search(context.ruin!); this.report(result); }
    this.actionTimer = .45; this.refresh();
  }
  private context() {
    const p = this.game.state.player, chunks = this.game.world.around(p);
    type Context = { kind: 'drop' | 'node' | 'furnace' | 'trader' | 'chest' | 'fishing' | 'storage'; label: string; d: number; id?: string; node?: ReturnType<Game['nodes']>[number]; spot?: typeof chunks[number]['fishing'][number]; ruin?: typeof chunks[number]['ruins'][number] };
    const candidates: Context[] = [];
    for (const n of this.game.nodes()) if (distance(n, p) < 3 && this.game.nodeRemaining(n) > 0 && !this.game.world.isWater(n.x, n.z)) candidates.push({ kind: 'node', label: `Gather ${this.game.nodeResource(n)} · hold F`, d: distance(n, p), node: n });
    for (const f of this.game.state.furnaces) if (distance(f, p) < 4) candidates.push({ kind: 'furnace', label: `Feed furnace / set respawn${this.game.state.respawnFurnaceId===f.id?' / bound':''}`, d: distance(f, p), id: f.id });
    for (const c of chunks) {
      for (const f of c.fishing) if (distance(f, p) < 3) candidates.push({ kind: 'fishing', label: `Fish here · 4 seconds · ${Math.max(0, f.availability - (this.game.state.changes.fishing[f.id] ?? 0))} available`, d: distance(f, p), spot: f });
      for (const r of this.game.world.settlements(p).filter(r => Math.floor(r.x / this.game.world.spec.config.chunkSize) === c.cx && Math.floor(r.z / this.game.world.spec.config.chunkSize) === c.cz)) {
        if (this.game.npc(r).hp > 0 && distance(r.trader, p) < 4) candidates.push({ kind: 'trader', label: `Trade with ${this.game.npc(r).name}`, d: distance(r.trader, p) - .5, ruin: r });
        if (distance(r.container, p) < 3 && !this.game.state.changes.containers.includes(r.id)) candidates.push({ kind: 'chest', label: 'Search abandoned supply chest', d: distance(r.container, p), ruin: r });
      }
    }
    for (const b of this.game.state.buildings) if (b.type === 'storage' && distance(b, p) < 4) candidates.push({ kind: 'storage', label: 'Open shared storage', d: distance(b, p) });
    for (const drop of this.game.state.combat.drops) if (distance(drop,p) < 3) candidates.push({kind:'drop', id:drop.id, label:`Pick up ${WEAPONS[drop.weapon].name}`, d:distance(drop,p)-3});
    const priority = (kind: Context['kind']) => ['trader', 'chest', 'fishing', 'storage'].includes(kind) ? 4 : 0;
    return candidates.sort((a, b) => a.d - priority(a.kind) - b.d + priority(b.kind))[0];
  }
  refresh() {
    if (this.mode !== 'game') return;
    const s = this.game.state;
    this.root.querySelector('#seed-hud')!.textContent = `SEED ${s.world.seed} / GEN ${s.world.generationVersion}`;
    const compact = (n: number) => Math.abs(n) >= 10000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : String(n);
    const resources = this.root.querySelector('#resources')!;
    for (const resource of RESOURCE_IDS) {
      let cell = resources.querySelector<HTMLElement>(`[data-resource="${resource}"]`);
      if (!cell) { cell = document.createElement('span'); cell.dataset.resource = resource; cell.innerHTML = itemIcon(resource) + '<b></b>'; resources.appendChild(cell); }
      const label = `${RESOURCES[resource].name}: ${s.inventory[resource]}`;
      cell.title = label; cell.setAttribute('aria-label', label);
      const value = cell.querySelector('b')!, text = compact(s.inventory[resource]);
      if (value.textContent !== text) value.textContent = text;
      value.classList.toggle('negative', s.inventory[resource] < 0);
    }
    this.root.querySelector('#warmth')!.textContent = `${Math.round(temperature(s))}°C · Warmth ${Math.round(s.player.warmth)}%`;
    this.root.querySelector('#fuel')!.textContent = `Home · ${Math.ceil(s.furnaces[0].fuel + s.furnaces[0].charcoal * 2)}s fuel · Level ${s.furnaces[0].level}`;
    this.root.querySelector('#location')!.textContent = `${this.game.world.biome(s.player.x, s.player.z)} / ${Math.round(s.player.x)}, ${Math.round(s.player.z)}`;
    const c = s.combat, equipped = c.weapons.find(w => w.id === c.equipped);
    this.root.querySelector('#health')!.textContent = `${Math.ceil(s.player.hp)} / 100 HP`;
    (this.root.querySelector('.hp-meter i') as HTMLElement).style.width = `${s.player.hp}%`;
    this.root.querySelector('#weather')!.textContent = c.weather.mode === 'snow' ? 'WHITEOUT / FUEL x3' : `CLEAR / ${Math.ceil(c.weather.remaining)}s`;
    const rack = this.root.querySelector('#weapon-rack')!; const rackHTML = c.weapons.filter(w => w.uses > 0).map((w,i) => `<button data-weapon="${w.id}" class="${w.id === c.equipped ? 'selected' : ''}" title="${WEAPONS[w.type].name}"><kbd>${i < 6 ? i+1 : ''}</kbd><b>${WEAPONS[w.type].name}</b><small>${w.uses}/100</small></button>`).join('');
    if (rack.innerHTML !== rackHTML) { rack.innerHTML = rackHTML; rack.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b => b.onclick = () => { c.equipped = b.dataset.weapon!; this.refresh(); }); }
    this.root.querySelector('#weapon-state')!.textContent = equipped ? `${WEAPONS[equipped.type].name} / ${equipped.uses} uses / ${c.cooldown > 0 ? c.cooldown.toFixed(1)+'s' : 'READY'} / ${equipped&&WEAPONS[equipped.type].type==='melee'?'wear on enemy hit':'unlimited ammo'}` : 'Buy equipment from a trader';
    this.root.querySelector('#furnace-defense')!.textContent = inPlayerHeat(s) ? 'FURNACE SHELTER / 50% less damage / enemies lose 10% max HP on entry' : '';
    const context = this.context(); const button = this.root.querySelector<HTMLButtonElement>('#interaction')!;
    button.querySelector('span')!.textContent = this.game.fishing ? `Fishing… ${Math.ceil(this.game.fishing.remaining)}s` : this.placement ? 'Confirm building placement' : context ? context.label : ''; button.disabled = !context && !this.placement || !!this.game.fishing; button.hidden = !context && !this.placement && !this.game.fishing;
    const message = this.root.querySelector<HTMLElement>('#message')!;
    if (this.lastMessage !== this.game.message) { this.lastMessage = this.game.message; this.messageTime = performance.now(); message.textContent = this.game.message; }
    message.classList.toggle('visible', performance.now() - this.messageTime < 4000);
    (this.root.querySelector('.warmth-meter i') as HTMLElement).style.width = `${s.player.warmth}%`;
    this.root.classList.toggle('danger', s.player.warmth < 25); this.root.querySelector('.survival')!.classList.toggle('safe', sheltered(s));
    if(this.game.dead&&!this.root.querySelector('.death-modal'))this.showDeath();
  }
  private showDeath() {
    const s=this.game.state,f=s.furnaces.find(f=>f.id===s.respawnFurnaceId)??s.furnaces[0];
    const el=this.modal('Your fire is still waiting.', `<div class="death-emblem">${uiIcon('flame')}</div><p class="death-cause">${s.player.hp<=0?'You fell in the wilderness.':'The cold finally caught up with you.'}</p><p>Your settlement, discoveries and world changes remain. Choose how your expedition continues.</p><div class="death-location"><span>RECOVERY FURNACE</span><strong>${f.id==='home'?'Starting refuge':`Furnace at ${Math.round(f.x)}, ${Math.round(f.z)}`}</strong></div><div class="death-actions"><button id="recover" class="primary"><strong>Go Back</strong><span>Lose 50% of carried and stored supplies. Restore health and warmth.</span></button><button id="death-home"><strong>Return to Home</strong><span>Auto saves progress and returns to the title menu.</span></button><button id="death-new" class="death-destructive"><strong>New World</strong><span>Overwrites the local save with a fresh expedition.</span></button></div><small class="death-note">Recovery keeps equipment and buildings. Odd resource stacks round down; existing debts remain.</small>`);
    el.classList.add('death-modal');el.querySelector('.close-modal')?.remove();el.querySelector('.eyebrow')!.textContent='FROSTBOUND / EXPEDITION INTERRUPTED';el.querySelector<HTMLButtonElement>('#recover')!.focus();
    el.querySelector('#recover')!.addEventListener('click',()=>{if(this.game.recover()){this.renderer.playerCharacter.reset();this.closeModal();const result=saveLocal(this.game.state);if(!result.ok)this.game.notify(result.message);this.refresh();}else this.error(this.game.message);});
    el.querySelector('#death-home')!.addEventListener('click',()=>{const result=saveLocal(this.game.state);if(!result.ok){this.error(result.message);return;}this.menu();});
    el.querySelector('#death-new')!.addEventListener('click',()=>{const fresh=newState(worldSpec(randomSeed()),this.game.state.settings),result=saveLocal(fresh);if(!result.ok){this.error(result.message);return;}this.replaceWorld(fresh);});
  }
  private frame(time: number) {
    const dt = Math.min(.05, (time - (this.previous || time)) / 1000); this.previous = time;
    const x = this.stick.x + (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0), z = this.stick.z + (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0), yaw = this.renderer.yaw;
    this.game.update(dt, { ...cameraRelativeMovement(x, z, yaw), sprint: this.keys.has('shift') || this.sprintTouch });
    if (!this.game.paused && !this.placement && (this.firing || this.keys.has(' '))) this.attack(this.firing&&this.assistAttack);
    this.actionTimer -= dt; if (!this.game.paused && (this.keys.has('f') || this.touchAction) && this.actionTimer <= 0 && this.context()?.kind === 'node') this.interact();
    if (this.revision !== this.game.revision) { this.revision = this.game.revision; this.renderer.refreshChunks(); }
    this.renderer.update(dt, time / 1000, !!(x || z) && !this.game.paused, this.aiming);
    if (this.game.collectionEvents.length) {
      const events = this.game.collectionEvents.splice(0); this.refresh();
      if (this.mode === 'game' && !this.root.querySelector('.modal-backdrop')) for (const event of events) this.collectionEffects.spawn(event.resource, event, time);
    }
    if(this.game.actionEvents.length) {
      const actions=this.game.actionEvents.splice(0);this.refresh();
      if(this.mode==='game'&&!this.root.querySelector('.modal-backdrop'))for(const action of actions)this.collectionEffects.spawnAction(action,time);
    }
    const damage=this.game.combat.damageEvents.splice(0);
    if(this.mode==='game'&&!this.game.paused)for(const event of damage)this.damageEffects.spawn(event,time);
    this.damageEffects.update(time);
    this.collectionEffects.update(time);
    this.clock += dt; if (this.clock > .15) { this.clock = 0; this.refresh(); }
    if (!this.game.paused && (this.autosave += dt) > 20) { this.autosave = 0; const r = saveLocal(this.game.state); if (!r.ok) this.game.notify(r.message); }
    requestAnimationFrame(t => this.frame(t));
  }
}
