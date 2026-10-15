import * as THREE from 'three';
import type { Game } from '../game/Game';
import { BUILDINGS, type BuildingType } from '../data/definitions';
import { heatRadius } from '../systems/SurvivalSystem';
import type { Chunk, Ruin } from '../world/WorldManager';
import { SeededRNG } from '../utils/SeededRNG';

const mat = (color: number, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .92, ...extra });
export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, .1, 220);
  readonly webgl: THREE.WebGLRenderer;
  yaw = .45; zoom = 34; private target = new THREE.Vector3();
  private chunks = new Map<string, THREE.Group>(); private entities = new THREE.Group(); private markers = new THREE.Group();
  private player = this.person(0xc98b49); private dynamic = new Map<string, THREE.Group>();
  private preview?: THREE.Group; private ray = new THREE.Raycaster(); private sun: THREE.DirectionalLight;
  private snowfall: THREE.Points;
  private materials = { snow: mat(0xe4edf0), dark: mat(0x314e5b), wood: mat(0x87664b), ice: mat(0x658d9f), metal: mat(0x5a7279), fire: mat(0xffa343, { emissive: 0xff781c, emissiveIntensity: 1.6 }), water: mat(0x407e9c, { roughness: .25, metalness: .25, transparent: true, opacity: .87 }) };
  constructor(private host: HTMLElement, public game: Game) {
    try { this.webgl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { throw new Error('Frostbound needs WebGL 2. Enable hardware acceleration or try a modern browser with WebGL support.'); }
    this.webgl.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.webgl.shadowMap.enabled = true; this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.outputColorSpace = THREE.SRGBColorSpace; this.webgl.toneMapping = THREE.ACESFilmicToneMapping; this.webgl.toneMappingExposure = 1.18;
    host.appendChild(this.webgl.domElement); this.scene.background = new THREE.Color(0xb4cbd9); this.scene.fog = new THREE.Fog(0xb4cbd9, 42, 110);
    this.scene.add(new THREE.HemisphereLight(0xd8ebff, 0x75899a, 2.2));
    this.sun = new THREE.DirectionalLight(0xfff5dd, 3); this.sun.position.set(-22, 35, 15); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 100 }); this.sun.shadow.bias = -.001; this.sun.shadow.normalBias = .04;
    this.scene.add(this.sun, this.sun.target, this.entities, this.markers, this.player);
    const snow = new Float32Array(180 * 3), rng = new SeededRNG(1938);
    for (let i = 0; i < 180; i++) { snow[i * 3] = rng.range(-35, 35); snow[i * 3 + 1] = rng.range(0, 22); snow[i * 3 + 2] = rng.range(-35, 35); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(snow, 3)); this.snowfall = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf1f9ff, size: .07, transparent: true, opacity: .55, depthWrite: false })); this.scene.add(this.snowfall);
    const marker = new THREE.Mesh(new THREE.RingGeometry(.48, .6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc38e50, transparent: true, opacity: .65, depthTest: false, depthWrite: false })); marker.position.y = .04; marker.renderOrder = 100; this.player.add(marker);
    this.camera.position.set(20, 28, 30); this.target.set(0, 1, 0); this.resize();
  }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  private box(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) { const m = this.mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z); group.add(m); return m; }
  private person(color: number) {
    const g = new THREE.Group(), coat = mat(color), fur = mat(0xd9c9ad), boots = mat(0x2d414f);
    g.add(this.mesh(new THREE.CapsuleGeometry(.37, .45, 3, 7), coat, 0, 1, 0));
    g.add(this.mesh(new THREE.SphereGeometry(.38, 10, 8), fur, 0, 1.7, 0));
    g.add(this.mesh(new THREE.SphereGeometry(.29, 10, 8), coat, 0, 1.74, 0));
    g.add(this.mesh(new THREE.BoxGeometry(.33, .15, .08), boots, 0, 1.68, .28));
    for (const side of [-1, 1]) { const leg = this.mesh(new THREE.CapsuleGeometry(.13, .27, 2, 6), boots, side * .18, .34); leg.name = `leg${side}`; g.add(leg); }
    this.box(g, 0, 1.03, -.36, .48, .52, .22, mat(0x617a74)); return g;
  }
  private building(type: BuildingType | 'ruin', rotation = 0) {
    const group = new THREE.Group();
    if (type === 'furnace') {
      const steel = this.materials?.metal ?? mat(0x5a7279), dark = this.materials?.dark ?? mat(0x314e5b);
      group.add(this.mesh(new THREE.CylinderGeometry(.82, 1.2, 2.4, 10), steel, 0, 1.6));
      group.add(this.mesh(new THREE.CylinderGeometry(.32, .42, 2, 8), dark, 0, 3.65));
      for (const side of [-1, 1]) this.box(group, side * .7, .3, 0, .2, .6, .6, dark);
      const flame = this.mesh(new THREE.SphereGeometry(.65, 8, 6), this.materials.fire, 0, 1.15, .93); flame.scale.set(.8, 1.15, .25); flame.name = 'flame'; group.add(flame);
      for (let i = -1; i <= 1; i++) this.box(group, i * .32, 1.2, 1.06, .07, 1.3, .08, dark);
      const light = new THREE.PointLight(0xff8d32, 30, 18, 1.6); light.position.set(0, 2, 1.3); light.name = 'warm-light'; group.add(light);
    } else {
      const wood = this.materials.wood, snow = this.materials.snow, wall = mat(type === 'storage' ? 0x6d8385 : 0x9b7953);
      this.box(group, 0, .15, 0, 4.4, .3, 3.8, mat(0x83949b));
      if (type === 'ruin') {
        this.box(group, -1.8, 1.25, 0, .3, 2.3, 3.4, wood); this.box(group, .4, 1, -1.5, 3.7, 1.9, .3, wood);
        for (let i = 0; i < 4; i++) { const b = this.box(group, .5 + i * .35, .4 + i * .05, .6, 3.5, .25, .25, wood); b.rotation.y = i * .4; }
        this.box(group, -1.8, 2.5, 0, .5, .2, 3.7, snow);
      } else {
        this.box(group, 0, 1.25, 0, 3.8, 2.4, 3.2, wall);
        for (let i = 0; i < 5; i++) this.box(group, 0, .4 + i * .43, 1.62, 3.85, .08, .07, wood);
        const roof = this.mesh(new THREE.ConeGeometry(3.1, 2, 4), snow, 0, 3.25); roof.rotation.y = Math.PI / 4; roof.scale.z = .9; group.add(roof);
        this.box(group, -.75, 1, 1.66, .85, 1.8, .09, this.materials.dark);
        this.box(group, .85, 1.45, 1.68, .8, .7, .1, mat(0xf6be6c, { emissive: 0xa35d1d, emissiveIntensity: .7 }));
        this.box(group, .85, 1.45, 1.75, .05, .8, .04, wood);
        this.box(group, 1, 3.7, -.5, .5, 1.3, .5, this.materials.metal);
      }
    }
    group.rotation.y = rotation; return group;
  }
  private instance(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, points: { x: number; y: number; z: number; sx?: number; sy?: number; sz?: number; rotation?: number }[]) {
    if (!points.length) { geometry.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geometry, material, points.length), o = new THREE.Object3D();
    points.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1); o.rotation.y = p.rotation ?? 0; o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  private chunk(data: Chunk) {
    const g = new THREE.Group(), w = this.game.world, size = w.spec.config.chunkSize, x0 = data.cx * size, z0 = data.cz * size;
    const terrain = new THREE.PlaneGeometry(size, size, 16, 16); terrain.rotateX(-Math.PI / 2); terrain.translate(x0 + size / 2, 0, z0 + size / 2);
    const pos = terrain.attributes.position, colors: number[] = [], color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = w.height(x, z); pos.setY(i, y); const river = w.river(x, z); color.setHex(y < .1 && river.distance < river.width + 2 ? 0x839ea9 : 0xe0ebef); color.multiplyScalar(1 - Math.max(0, y) * .007); colors.push(color.r, color.g, color.b); }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
    const ground = this.mesh(terrain, mat(0xffffff, { vertexColors: true })); ground.castShadow = false; g.add(ground);
    const trees = data.trees.map(t => ({ ...t, y: w.height(t.x, t.z) }));
    this.instance(g, new THREE.CylinderGeometry(.16, .25, 2.2, 5), this.materials.wood, trees.map(t => ({ x: t.x, y: t.y + t.scale, z: t.z, sx: t.scale, sy: t.scale, sz: t.scale })));
    for (let layer = 0; layer < 3; layer++) {
      const scale = 1 - layer * .23;
      this.instance(g, new THREE.ConeGeometry(1.7 * scale, 2.5, 7), this.materials.dark, trees.map(t => ({ x: t.x, y: t.y + (2.5 + layer * 1.25) * t.scale, z: t.z, sx: t.scale, sy: t.scale, sz: t.scale })));
      this.instance(g, new THREE.ConeGeometry(1.78 * scale, 2.35, 7), this.materials.snow, trees.map(t => ({ x: t.x, y: t.y + (2.75 + layer * 1.25) * t.scale, z: t.z, sx: t.scale, sy: t.scale, sz: t.scale })));
    }
    for (const resource of ['wood', 'stone', 'metal'] as const) {
      const points = data.nodes.filter(n => n.resource === resource && this.game.nodeRemaining(n) > 0 && !w.isWater(n.x, n.z)).map(n => ({ x: n.x, y: w.height(n.x, n.z) + .45, z: n.z, sx: resource === 'wood' ? 1.3 : .9, sy: resource === 'wood' ? .5 : .8, sz: .7, rotation: n.x }));
      this.instance(g, resource === 'wood' ? new THREE.CylinderGeometry(.4, .4, 2, 7).rotateZ(Math.PI / 2) : new THREE.DodecahedronGeometry(.85, 0), this.materials[resource === 'wood' ? 'wood' : resource === 'stone' ? 'ice' : 'metal'], points);
    }
    if (w.spec.config.riverDensity > 0) {
      const vertices: number[] = [];
      for (let x = x0; x < x0 + size; x += 2) {
        const a = w.river(x, z0 + size / 2), b = w.river(x + 2, z0 + size / 2);
        if (a.center + a.width < z0 || a.center - a.width > z0 + size) continue;
        const za = Math.max(z0, a.center - a.width), zb = Math.min(z0 + size, a.center + a.width), zc = Math.max(z0, b.center - b.width), zd = Math.min(z0 + size, b.center + b.width);
        vertices.push(x, .12, za, x, .12, zb, x + 2, .12, zc, x, .12, zb, x + 2, .12, zd, x + 2, .12, zc);
      }
      if (vertices.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals(); const water = this.mesh(geo, this.materials.water); water.castShadow = false; g.add(water); }
      for (let x = Math.ceil(x0 / 64) * 64; x < x0 + size; x += 64) { const r = w.river(x, z0 + size / 2); if (r.center < z0 || r.center >= z0 + size) continue; this.box(g, x, .45, r.center, 4.7, .4, r.width * 2 + 3, this.materials.wood); for (const side of [-1, 1]) this.box(g, x + side * 2.3, 1.05, r.center, .12, .16, r.width * 2 + 3, this.materials.snow); }
    }
    for (const r of data.ruins) this.addRuin(g, r);
    for (const f of data.fishing) { const post = this.mesh(new THREE.CylinderGeometry(.08, .08, 1.5, 5), this.materials.wood, f.x, w.height(f.x, f.z) + .75, f.z); g.add(post); this.box(g, f.x, w.height(f.x, f.z) + 1.35, f.z, .85, .4, .12, mat(0x5a94a6)); }
    return g;
  }
  private addRuin(g: THREE.Group, r: Ruin) {
    const w = this.game.world;
    for (let i = 0; i < r.houses; i++) { const h = this.building(i % 2 ? 'hut' : 'ruin', i % 2 ? .1 : -.1); h.position.set(r.x + (i - 1) * 6, w.height(r.x + (i - 1) * 6, r.z - 3), r.z - 3); g.add(h); }
    const npc = this.person([0x668985, 0x8e719a, 0x487c9d][r.variant]); npc.position.set(r.trader.x, w.height(r.trader.x, r.trader.z), r.trader.z); g.add(npc);
    const chest = this.game.state.changes.containers.includes(r.id) ? this.materials.dark : this.materials.wood;
    this.box(g, r.container.x, w.height(r.container.x, r.container.z) + .5, r.container.z, 1.4, .9, 1, chest);
    this.box(g, r.trader.x, w.height(r.trader.x, r.trader.z) + 2.6, r.trader.z, .45, .45, .1, mat(0xf4cf7c, { emissive: 0xaa7524 }));
  }
  private dispose(group: THREE.Group) {
    group.traverse(o => { if (o instanceof THREE.Mesh) { if (o instanceof THREE.InstancedMesh) o.dispose(); o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) if (!Object.values(this.materials).includes(m as THREE.MeshStandardMaterial)) m.dispose(); } }); group.removeFromParent();
  }
  refreshChunks() { for (const g of this.chunks.values()) this.dispose(g); this.chunks.clear(); }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; this.webgl.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setGame(game: Game) { this.game = game; this.refreshChunks(); this.dispose(this.entities); this.entities = new THREE.Group(); this.scene.add(this.entities); this.dynamic.clear(); this.target.set(game.state.player.x, 1, game.state.player.z); }
  groundAt(clientX: number, clientY: number) {
    const bounds = this.webgl.domElement.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2((clientX - bounds.x) / bounds.width * 2 - 1, -(clientY - bounds.y) / bounds.height * 2 + 1), this.camera);
    const terrain = Array.from(this.chunks.values()).map(g => g.children[0]); const hit = this.ray.intersectObjects(terrain, false)[0]; return hit ? { x: hit.point.x, z: hit.point.z } : undefined;
  }
  showPreview(type: BuildingType | null, point?: { x: number; z: number }, rotation = 0, valid = false) {
    if (this.preview && this.preview.userData.type !== type) { this.dispose(this.preview); this.preview = undefined; }
    if (!type || !point) return;
    if (!this.preview) {
      this.preview = this.building(type); this.preview.userData.type = type;
      this.preview.traverse(o => { if (o instanceof THREE.PointLight) o.intensity = 0; if (o instanceof THREE.Mesh) { const old = o.material as THREE.MeshStandardMaterial; if (!Object.values(this.materials).includes(old)) old.dispose(); o.material = mat(0x69caad, { transparent: true, opacity: .55 }); } }); this.scene.add(this.preview);
    }
    this.preview.traverse(o => { if (o instanceof THREE.Mesh) (o.material as THREE.MeshStandardMaterial).color.setHex(valid ? 0x69caad : 0xd8776c); });
    this.preview.rotation.y = rotation; this.preview.position.set(point.x, this.game.world.height(point.x, point.z), point.z);
  }
  update(dt: number, time: number, moving: boolean) {
    const game = this.game, p = game.state.player, height = game.world.walkHeight(p.x, p.z);
    this.snowfall.position.set(p.x + Math.sin(time * .08) * 5, height - time * .7 % 11, p.z);
    (this.scene.fog as THREE.Fog).far = game.state.settings.renderDistance === 1 ? 56 : 110;
    const target = new THREE.Vector3(p.x, height + 1.1, p.z), blend = 1 - Math.exp(-dt * 6); this.target.lerp(target, blend);
    // High orbit clears all player-buildable roofs; terrain clearance also protects hills.
    const offset = new THREE.Vector3(Math.sin(this.yaw) * this.zoom, this.zoom * .92, Math.cos(this.yaw) * this.zoom);
    this.camera.position.copy(this.target).add(offset); this.camera.position.y = Math.max(this.camera.position.y, game.world.height(this.camera.position.x, this.camera.position.z) + 9); this.camera.lookAt(this.target);
    this.sun.position.set(p.x - 22, height + 35, p.z + 15); this.sun.target.position.set(p.x, height, p.z);
    this.player.position.set(p.x, height, p.z); this.player.rotation.y = p.heading;
    for (const side of [-1, 1]) this.player.getObjectByName(`leg${side}`)!.rotation.x = moving ? Math.sin(time * 12) * .5 * side : 0;
    const needed = game.world.around(p, game.state.settings.renderDistance), ids = new Set(needed.map(c => c.id));
    for (const [id, g] of this.chunks) if (!ids.has(id)) { this.dispose(g); this.chunks.delete(id); }
    // Budget generation to two rendered chunks per frame.
    let budget = 2; for (const c of needed) if (!this.chunks.has(c.id) && budget-- > 0) { const group = this.chunk(c); this.scene.add(group); this.chunks.set(c.id, group); }
    const entityIds = new Set<string>();
    for (const b of [...game.state.buildings, ...game.state.furnaces.filter(f => !game.state.buildings.some(b => b.id === f.id)).map(f => ({ ...f, type: 'furnace' as const, rotation: 0 }))]) {
      entityIds.add(b.id); let group = this.dynamic.get(b.id);
      if (!group) { group = this.building(b.type, b.rotation); this.dynamic.set(b.id, group); this.entities.add(group); }
      group.position.set(b.x, game.world.height(b.x, b.z), b.z);
      if (b.type === 'furnace') {
        const furnace = game.state.furnaces.find(f => f.id === b.id)!; const active = furnace.fuel > 0;
        const flame = group.getObjectByName('flame')!; flame.visible = active; flame.scale.y = .95 + Math.sin(time * 9) * .13;
        (group.getObjectByName('warm-light') as THREE.PointLight).intensity = active ? 35 + Math.sin(time * 11) * 3 : 0;
        const old = group.getObjectByName('heat-ring') as THREE.Mesh | undefined, radius = heatRadius(furnace);
        if (old?.userData.radius !== radius) {
          if (old) { old.geometry.dispose(); (old.material as THREE.Material).dispose(); group.remove(old); }
          const ring = this.mesh(new THREE.RingGeometry(Math.max(.01, radius - .07), Math.max(.02, radius), 72), new THREE.MeshBasicMaterial({ color: 0xe8b97a, transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }));
          ring.geometry.rotateX(-Math.PI / 2); const v = ring.geometry.attributes.position;
          for (let i = 0; i < v.count; i++) v.setY(i, game.world.height(b.x + v.getX(i), b.z + v.getZ(i)) - group.position.y + .06);
          ring.name = 'heat-ring'; ring.userData.radius = radius; ring.castShadow = false; group.add(ring);
        }
      }
    }
    for (const worker of game.state.workers) {
      entityIds.add(worker.id); let group = this.dynamic.get(worker.id); if (!group) { group = this.person(0x5b9ca6); this.dynamic.set(worker.id, group); this.entities.add(group); }
      group.position.set(worker.x, game.world.walkHeight(worker.x, worker.z), worker.z);
      for (const side of [-1, 1]) group.getObjectByName(`leg${side}`)!.rotation.x = worker.state === 'returning' || worker.state === 'seeking' ? Math.sin(time * 10) * .5 * side : 0;
    }
    for (const [id, group] of this.dynamic) if (!entityIds.has(id)) { this.dispose(group); this.dynamic.delete(id); }
    this.webgl.render(this.scene, this.camera);
  }
}
