import { projectileHeight } from '../game/CombatGeometry';
import { ProjectileModels } from './ProjectileModels';
import { NPCCharacter } from './NPCCharacter';
import { characterStyle, bearAppearance } from '../data/characters';
import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { ActorType, WeaponType } from '../data/weapons';
import { ACTOR_HP } from '../data/weapons';
import { distance } from '../world/WorldManager';

import { weaponMesh, disposeWeapon } from './WeaponModels';
export { weaponMesh, disposeWeapon } from './WeaponModels';

export class CombatRenderer {
  readonly group = new THREE.Group();
  private projectileModels = new ProjectileModels();
  private objects = new Map<string, THREE.Group>(); private characters = new Map<string,NPCCharacter>();
  private geometry = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 7, 5), cylinder: new THREE.CylinderGeometry(1, 1, 1, 6), ring: new THREE.RingGeometry(3.7, 4, 48).rotateX(-Math.PI / 2), disc: new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2) };
  private mats = { white: new THREE.MeshStandardMaterial({ color: 0xe6e9df }), black: new THREE.MeshStandardMaterial({ color: 0x28353d }), guard: new THREE.MeshStandardMaterial({ color: 0x3c6874 }), bandit: new THREE.MeshStandardMaterial({ color: 0x4d504a }), arsonist: new THREE.MeshStandardMaterial({ color: 0x9e5539 }), fur: new THREE.MeshStandardMaterial({ color: 0xbda788 }), red: new THREE.MeshBasicMaterial({ color: 0xce6e4e }), green: new THREE.MeshBasicMaterial({ color: 0x82b694 }), fire: new THREE.MeshBasicMaterial({ color: 0xff9437, transparent: true, opacity: .42, depthWrite: false }), core: new THREE.MeshBasicMaterial({ color: 0xffd16d }), dark: new THREE.MeshBasicMaterial({ color: 0x24363e }), gold: new THREE.MeshBasicMaterial({ color: 0xf3ce7c }) };
  private piece(g: THREE.Group, geometry: keyof CombatRenderer['geometry'], material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const mesh = new THREE.Mesh(this.geometry[geometry], material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); g.add(mesh); return mesh; }
  private actor(type: ActorType, weapon: WeaponType | null, id: string) {
    const bear = type === 'polar_bear'||type==='wolf';
    const appearance = type==='wolf'?(id.length%2?'wolf-slate':'wolf-ash'):bear ? bearAppearance(id) : characterStyle(type,id).id;
    const visual = new NPCCharacter(appearance); this.characters.set(id,visual); const g=visual.object;g.userData.actorId=id;
    const bar = new THREE.Group(); bar.name = 'health'; bar.position.y = bear ? 2.5 : 2.4;
    this.piece(bar, 'box', this.mats.dark, 0, 0, 0, 1.6, .14, .02); const fill = this.piece(bar, 'box', type === 'guard' ? this.mats.green : this.mats.red, 0, 0, .02, 1.5, .08, .02); fill.name = 'fill'; g.add(bar); return g;
  }
  clear() { for (const visual of this.characters.values()) visual.dispose(); this.characters.clear(); for (const g of this.objects.values()) { const weapons: THREE.Object3D[] = []; g.traverse(o => { if (o.name === 'held-weapon') weapons.push(o); }); weapons.forEach(disposeWeapon); g.removeFromParent(); } this.objects.clear(); }
  update(game: Game, camera: THREE.Camera, time: number, dt = 1/60) {
    const c = game.state.combat, needed = new Set<string>();
    const get = (id: string, make: () => THREE.Group) => { needed.add(id); let g = this.objects.get(id); if (!g) { g = make(); this.objects.set(id, g); this.group.add(g); } return g; };
    for (const actor of Object.values(c.actors).filter(a => a.hp > 0 && distance(a, game.state.player) < 55).sort((a, b) => distance(a, game.state.player) - distance(b, game.state.player)).slice(0, 40)) {
      const g = get(`actor:${actor.id}`, () => this.actor(actor.type, actor.weapon, actor.id));
      const visual=this.characters.get(actor.id)!,refuge=game.settlement.refuge(actor.id);
      visual.update(actor,game.world.walkHeight(actor.x,actor.z),actor.heading,game.paused?0:dt,game.state.elapsed,actor.weapon,refuge?-100:game.combat.actorAttacks.get(actor.id)??-100);
      g.visible=visual.ready&&refuge?.phase!=='hidden';g.userData.refuge=refuge?.phase;
      const health = g.getObjectByName('health')!; health.quaternion.copy(g.quaternion).invert().multiply(camera.quaternion); (health.getObjectByName('fill') as THREE.Mesh).scale.x = 1.5 * actor.hp / ACTOR_HP[actor.type]; health.visible = distance(actor, game.state.player) < 26 || actor.hp < ACTOR_HP[actor.type];
    }
    for (const p of c.projectiles) {
      const g = get(`projectile:${p.id}`, () => this.projectileModels.create(p.kind));
      const t = Math.min(1,p.age / p.duration),height=projectileHeight(p.kind,t,game.world.walkHeight(p.fromX,p.fromZ),game.world.walkHeight(p.targetX,p.targetZ));
      g.position.set(p.x,height,p.z);g.rotation.set(0,Math.atan2(p.targetX-p.fromX,p.targetZ-p.fromZ),0);
      if(p.kind==='bottle')g.rotateX(t*Math.PI*3);else if(p.kind==='arrow')g.rotateX(-Math.atan2(game.world.walkHeight(p.targetX,p.targetZ)-game.world.walkHeight(p.fromX,p.fromZ),Math.hypot(p.targetX-p.fromX,p.targetZ-p.fromZ)));

    }
    for (const f of c.fires) {
      const g = get(`fire:${f.id}`, () => { const group = new THREE.Group(); this.piece(group, 'disc', this.mats.fire, 0, .07, 0, 1, 1, 1); this.piece(group, 'ring', this.mats.red, 0, .08, 0, 1, 1, 1); for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 1 + i % 3; this.piece(group, 'sphere', this.mats.core, Math.cos(a) * r, .5, Math.sin(a) * r, .16, .65, .16); } return group; });
      g.position.set(f.x, game.world.height(f.x, f.z), f.z); g.children.slice(2).forEach((o, i) => { o.scale.y = .4 + Math.sin(time * 10 + i) * .3; });
    }
    for (const d of c.drops) {
      const g = get(`drop:${d.id}`, () => { const group = new THREE.Group(); group.add(weaponMesh(d.weapon)); this.piece(group, 'sphere', this.mats.gold, 0, .6, 0, .12, .12, .12); return group; }); g.position.set(d.x, game.world.height(d.x, d.z), d.z); g.rotation.y = time;
    }
    for (const [id, group] of this.objects) if (!needed.has(id)) { this.characters.get(group.userData.actorId)?.dispose(); this.characters.delete(group.userData.actorId); const weapons: THREE.Object3D[] = []; group.traverse(o => { if (o.name === 'held-weapon') weapons.push(o); }); weapons.forEach(disposeWeapon); group.removeFromParent(); this.objects.delete(id); }
  }
}
