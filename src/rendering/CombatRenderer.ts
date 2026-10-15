import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { ActorType, WeaponType } from '../data/weapons';
import { ACTOR_HP } from '../data/weapons';
import { distance } from '../world/WorldManager';

const metal = new THREE.MeshStandardMaterial({ color: 0x718b98, roughness: .55 });
const wood = new THREE.MeshStandardMaterial({ color: 0x725137 });
const blade = new THREE.MeshStandardMaterial({ color: 0xc4d1d0, metalness: .6, roughness: .35 });
export function weaponMesh(type: WeaponType): THREE.Group {
  const g = new THREE.Group(); g.name = 'held-weapon';
  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  if (type === 'shotgun') { box(.14, .17, .95, metal, 0, 0, .3); box(.2, .22, .4, wood, 0, -.02, -.2); }
  else if (type === 'bow') { const arc = new THREE.Mesh(new THREE.TorusGeometry(.48, .045, 4, 10, Math.PI), wood); arc.rotation.z = -Math.PI / 2; g.add(arc); const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -.48, 0), new THREE.Vector3(0, .48, 0)]), new THREE.LineBasicMaterial({ color: 0xd7d4b0 })); g.add(line); }
  else if (type === 'molotov') { const bottle = new THREE.Mesh(new THREE.CylinderGeometry(.09, .14, .4, 6), new THREE.MeshStandardMaterial({ color: 0x576f43, transparent: true, opacity: .9 })); g.add(bottle); box(.06, .18, .06, new THREE.MeshBasicMaterial({ color: 0xffb754 }), 0, .26); }
  else { const spear = type === 'spear'; box(.09, spear ? 1.5 : .4, .1, wood, 0, spear ? .2 : -.2); box(type === 'wooden_sword' ? .18 : .14, spear ? .35 : .65, .06, type === 'wooden_sword' ? wood : blade, 0, spear ? 1.1 : .3); }
  g.position.set(.48, 1.1, .28); g.rotation.x = type === 'spear' ? Math.PI / 3 : .3; return g;
}
export function disposeWeapon(g: THREE.Object3D) { g.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose(); }); g.removeFromParent(); }

export class CombatRenderer {
  readonly group = new THREE.Group();
  private objects = new Map<string, THREE.Group>();
  private geometry = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 7, 5), cylinder: new THREE.CylinderGeometry(1, 1, 1, 6), ring: new THREE.RingGeometry(3.7, 4, 48).rotateX(-Math.PI / 2), disc: new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2) };
  private mats = { white: new THREE.MeshStandardMaterial({ color: 0xe6e9df }), black: new THREE.MeshStandardMaterial({ color: 0x28353d }), guard: new THREE.MeshStandardMaterial({ color: 0x3c6874 }), bandit: new THREE.MeshStandardMaterial({ color: 0x4d504a }), arsonist: new THREE.MeshStandardMaterial({ color: 0x9e5539 }), fur: new THREE.MeshStandardMaterial({ color: 0xbda788 }), red: new THREE.MeshBasicMaterial({ color: 0xce6e4e }), green: new THREE.MeshBasicMaterial({ color: 0x82b694 }), fire: new THREE.MeshBasicMaterial({ color: 0xff9437, transparent: true, opacity: .42, depthWrite: false }), core: new THREE.MeshBasicMaterial({ color: 0xffd16d }), dark: new THREE.MeshBasicMaterial({ color: 0x24363e }), gold: new THREE.MeshBasicMaterial({ color: 0xf3ce7c }) };
  private piece(g: THREE.Group, geometry: keyof CombatRenderer['geometry'], material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const mesh = new THREE.Mesh(this.geometry[geometry], material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); g.add(mesh); return mesh; }
  private actor(type: ActorType, weapon: WeaponType | null) {
    const g = new THREE.Group(), bear = type === 'polar_bear';
    if (bear) {
      this.piece(g, 'sphere', this.mats.white, 0, 1.05, 0, .75, .7, 1.3); this.piece(g, 'sphere', this.mats.white, 0, 1.4, 1.1, .58, .52, .65); this.piece(g, 'sphere', this.mats.black, 0, 1.35, 1.7, .19, .13, .12);
      for (const x of [-.48, .48]) for (const z of [-.7, .7]) this.piece(g, 'box', this.mats.white, x, .4, z, .38, .8, .38);
      for (const x of [-.3, .3]) this.piece(g, 'sphere', this.mats.white, x, 1.85, 1.1, .17, .2, .13);
    } else {
      const coat = this.mats[type]; this.piece(g, 'box', coat, 0, 1, 0, .76, .94, .5); this.piece(g, 'sphere', type === 'guard' ? this.mats.guard : this.mats.black, 0, 1.7, 0, .4, .4, .38); this.piece(g, 'box', this.mats.fur, 0, 1.62, .3, .4, .2, .12);
      for (const x of [-.2, .2]) { const leg = this.piece(g, 'box', this.mats.black, x, .3, 0, .23, .6, .27); leg.name = `leg:${x}`; }
      this.piece(g, 'box', type === 'guard' ? this.mats.gold : this.mats.red, 0, 1.25, .29, .56, .12, .08);
      if (weapon) g.add(weaponMesh(weapon));
    }
    const bar = new THREE.Group(); bar.name = 'health'; bar.position.y = bear ? 2.5 : 2.4;
    this.piece(bar, 'box', this.mats.dark, 0, 0, 0, 1.6, .14, .02); const fill = this.piece(bar, 'box', type === 'guard' ? this.mats.green : this.mats.red, 0, 0, .02, 1.5, .08, .02); fill.name = 'fill'; g.add(bar); return g;
  }
  clear() { for (const g of this.objects.values()) { const weapons: THREE.Object3D[] = []; g.traverse(o => { if (o.name === 'held-weapon') weapons.push(o); }); weapons.forEach(disposeWeapon); g.removeFromParent(); } this.objects.clear(); }
  update(game: Game, camera: THREE.Camera, time: number) {
    const c = game.state.combat, needed = new Set<string>();
    const get = (id: string, make: () => THREE.Group) => { needed.add(id); let g = this.objects.get(id); if (!g) { g = make(); this.objects.set(id, g); this.group.add(g); } return g; };
    for (const actor of Object.values(c.actors).filter(a => a.hp > 0 && distance(a, game.state.player) < 55).sort((a, b) => distance(a, game.state.player) - distance(b, game.state.player)).slice(0, 40)) {
      const g = get(actor.id, () => this.actor(actor.type, actor.weapon)); g.position.set(actor.x, game.world.walkHeight(actor.x, actor.z), actor.z); g.rotation.y = actor.heading;
      for (const x of [-.2, .2]) { const leg = g.getObjectByName(`leg:${x}`); if (leg) leg.rotation.x = Math.sin(time * 9) * .25 * Math.sign(x); }
      const health = g.getObjectByName('health')!; health.quaternion.copy(camera.quaternion); (health.getObjectByName('fill') as THREE.Mesh).scale.x = 1.5 * actor.hp / ACTOR_HP[actor.type]; health.visible = distance(actor, game.state.player) < 26 || actor.hp < ACTOR_HP[actor.type];
    }
    for (const p of c.projectiles) {
      const g = get(p.id, () => { const group = new THREE.Group(); this.piece(group, p.kind === 'bottle' ? 'cylinder' : 'box', p.kind === 'bottle' ? this.mats.green : this.mats.gold, 0, 0, 0, p.kind === 'bottle' ? .14 : .045, p.kind === 'bottle' ? .35 : .045, p.kind === 'arrow' ? .9 : .25); return group; });
      const t = p.age / p.duration; g.position.set(p.x, game.world.height(p.x, p.z) + 1.3 + (p.kind === 'bottle' ? Math.sin(Math.PI * t) * 3 : 0), p.z); g.rotation.y = Math.atan2(p.targetX - p.fromX, p.targetZ - p.fromZ); if (p.kind === 'bottle') g.rotation.z = t * 8;
    }
    for (const f of c.fires) {
      const g = get(f.id, () => { const group = new THREE.Group(); this.piece(group, 'disc', this.mats.fire, 0, .07, 0, 1, 1, 1); this.piece(group, 'ring', this.mats.red, 0, .08, 0, 1, 1, 1); for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 1 + i % 3; this.piece(group, 'sphere', this.mats.core, Math.cos(a) * r, .5, Math.sin(a) * r, .16, .65, .16); } return group; });
      g.position.set(f.x, game.world.height(f.x, f.z), f.z); g.children.slice(2).forEach((o, i) => { o.scale.y = .4 + Math.sin(time * 10 + i) * .3; });
    }
    for (const d of c.drops) {
      const g = get(d.id, () => { const group = new THREE.Group(); group.add(weaponMesh(d.weapon)); this.piece(group, 'sphere', this.mats.gold, 0, .6, 0, .12, .12, .12); return group; }); g.position.set(d.x, game.world.height(d.x, d.z), d.z); g.rotation.y = time;
    }
    for (const [id, group] of this.objects) if (!needed.has(id)) { const weapons: THREE.Object3D[] = []; group.traverse(o => { if (o.name === 'held-weapon') weapons.push(o); }); weapons.forEach(disposeWeapon); group.removeFromParent(); this.objects.delete(id); }
  }
}
