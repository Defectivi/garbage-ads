import { SeededRNG, derive, noise, smooth } from '../utils/SeededRNG';
import type { WorldSpec } from '../game/GameConfig';
import type { Point } from '../game/GameState';
import type { Resource } from '../data/definitions';
export interface Node extends Point { id: string; resource: Resource; amount: number; radius: number; kind?:'tree'|'boulder'|'fragment'|'log'; scale?:number }
export interface Tree extends Point { scale: number }
export interface Ruin extends Point { id: string; name: string; variant: number; houses: number; trader: Point; container: Point }
export interface Village extends Ruin { guardCount: number }
export const VILLAGE_SITES = [{ id: 'village:hearth', name: 'Hearthwatch', x: 40, z: 8 }, { id: 'village:quarry', name: 'Stonehaven', x: -72, z: -32 }, { id: 'village:river', name: 'Northpass', x: 132, z: 112 }];
export interface FishingSpot extends Point { id: string; availability: number }
export interface Chunk { id: string; cx: number; cz: number; trees: Tree[]; nodes: Node[]; ruins: Ruin[]; fishing: FishingSpot[] }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export class WorldManager {
  private cache = new Map<string, Chunk>();
  constructor(readonly spec: WorldSpec) {}
  river(x: number, z: number) {
    const s = this.spec.seeds, row = Math.round((z - 48) / 128);
    let center = 48 + row * 128 + Math.sin(x / 31 + s.rivers * .01) * 6 + Math.sin(x / 83 + s.terrain * .01) * 10;
    if (this.spec.generationVersion >= 2) for (const v of VILLAGE_SITES) if (Math.abs(x - v.x) < 34 && Math.abs(center - v.z) < 30) center += (center > v.z ? 1 : -1) * (30 - Math.abs(center - v.z)) * smooth((34 - Math.abs(x - v.x)) / 8);
    const width = 3.4 * this.spec.config.riverDensity + noise(s.rivers, x / 38, row) * 1.8;
    return { center, width, distance: Math.abs(z - center), row, crossing: Math.abs(x - Math.round(x / 64) * 64) < 2.4 };
  }
  height(x: number, z: number) {
    const { terrain } = this.spec.seeds, scale = this.spec.config.worldScale;
    const raw = (noise(terrain, x / (62 * scale), z / (62 * scale)) - .4) * 8 + noise(terrain ^ 5182, x / 17, z / 17) * 1.5;
    const home = smooth((Math.hypot(x, z) - 10) / 18); let base = .8 * (1 - home) + raw * home;
    if (this.spec.generationVersion >= 2) for (const v of VILLAGE_SITES) { const edge = smooth((distance(v, { x, z }) - 15) / 8); base = .8 * (1 - edge) + base * edge; }
    const r = this.river(x, z); if (this.spec.config.riverDensity === 0) return base;
    const bank = smooth((r.distance - r.width) / 9);
    return (-1.1 + Math.min(1, r.distance / r.width) * .8) * (1 - bank) + base * bank;
  }
  walkHeight(x: number, z: number) { const r = this.river(x, z); return this.spec.config.riverDensity > 0 && r.crossing && r.distance < r.width + 2 ? .65 : this.height(x, z); }
  isWater(x: number, z: number) { const r = this.river(x, z); return this.spec.config.riverDensity > 0 && r.distance < r.width + .2 && !r.crossing; }
  biome(x: number, z: number) { return noise(this.spec.seeds.biomes, x / 70, z / 70) > .56 ? 'Pinewood' : noise(this.spec.seeds.biomes, x / 25, z / 25) < .32 ? 'Rocky uplands' : 'Snowfields'; }
  villages(): Village[] { return this.spec.generationVersion < 2 ? [] : VILLAGE_SITES.map((v, i) => ({ ...v, variant: i, houses: 3, trader: { x: v.x - 5, z: v.z + 5 }, container: { x: v.x + 5, z: v.z + 5 }, guardCount: 3 + derive(this.spec.seeds.villages, v.id) % 3 })); }
  settlements(point: Point, radius = 1): Ruin[] { const chunks = this.around(point, radius); return [...chunks.flatMap(c => c.ruins), ...this.villages().filter(v => distance(v, point) < this.spec.config.chunkSize * (radius + 1))]; }
  ruin(rx: number, rz: number): Ruin | undefined {
    const rng = new SeededRNG(derive(this.spec.seeds.ruins, 'ruin', rx, rz));
    if ((rx !== 0 || rz !== 0) && rng.next() > this.spec.config.ruinDensity * .65 || this.spec.config.ruinDensity === 0) return;
    const x = rx * 128 + rng.range(48, 78); let z = rz * 128 + rng.range(-36, -18);
    const river = this.river(x, z); if (river.distance < river.width + 18) z = river.center - river.width - 22;
    const variant = Math.floor(rng.range(0, 3));
    return { id: `ruin:${rx}:${rz}`, x, z, name: ['Pinefall Trading Post', 'Old Quarry Hamlet', 'Riverwatch Camp'][variant], variant, houses: 2 + Math.floor(rng.range(0, 3)), trader: { x: x - 5, z: z + 5 }, container: { x: x + 4, z: z + 5 } };
  }
  nearbyRuins(cx: number, cz: number) {
    const n = this.spec.config.chunkSize, rx = Math.floor(cx * n / 128), rz = Math.floor(cz * n / 128), out: Ruin[] = [];
    for (let x = rx - 1; x <= rx + 1; x++) for (let z = rz - 1; z <= rz + 1; z++) { const p = this.ruin(x, z); if (p) out.push(p); }
    return out;
  }
  chunk(cx: number, cz: number): Chunk {
    const id = `${cx},${cz}`, cached = this.cache.get(id); if (cached) return cached;
    const n = this.spec.config.chunkSize, rng = new SeededRNG(derive(this.spec.seeds.resources, 'chunk-nodes', cx, cz));
    const nodes: Node[] = [], trees: Tree[] = [], fishing: FishingSpot[] = [], ruins = this.nearbyRuins(cx, cz);
    for (let i = 0; i < Math.floor(14 * this.spec.config.resourceDensity); i++) {
      const x = cx * n + rng.range(1, n - 1), z = cz * n + rng.range(1, n - 1);
      // Coordinates depend only on the resource stream; terrain determines accessibility, not placement.
      const resource: Resource = i % 5 === 0 ? 'metal' : i % 2 ? 'wood' : 'stone';
      const amount = 5 + Math.floor(rng.range(0, 7)); if (Math.hypot(x, z) < 6) continue;
      nodes.push({ id: `node:${cx}:${cz}:${i}`, x, z, resource, amount, radius: resource === 'wood' ? .7 : .9 });
    }
    if (cx === 0 && cz === 0) nodes.push({ id: 'starter:wood', x: 3.8, z: 4, resource: 'wood', amount: 30, radius: .7 });
    if (cx === -1 && cz === 0) nodes.push({ id: 'starter:stone', x: -4, z: 3, resource: 'stone', amount: 25, radius: .9 });
    const veg = new SeededRNG(derive(this.spec.seeds.biomes, 'trees', cx, cz));
    for (let i = 0; i < 35; i++) {
      const x = cx * n + veg.range(.7, n - .7), z = cz * n + veg.range(.7, n - .7), scale = veg.range(.8, 1.5), sparse = veg.next();
      if (Math.hypot(x, z) < 13 || this.isWater(x, z) || ruins.some(r => distance(r, { x, z }) < 15) || this.villages().some(v => distance(v, { x, z }) < 19) || (this.biome(x, z) !== 'Pinewood' && sparse > .35)) continue;
      trees.push({ x, z, scale });
    }
    if (this.spec.config.riverDensity > 0) {
      const x = cx * n + n * .4, r = this.river(x, cz * n + n / 2), z = r.center - r.width - 1.5;
      if (Math.floor(z / n) === cz) fishing.push({ id: `fish:${cx}:${r.row}`, x, z, availability: 8 + derive(this.spec.seeds.resources, 'fish', cx, r.row) % 16 });
    }
    const result = { id, cx, cz, trees, nodes, fishing, ruins: ruins.filter(r => Math.floor(r.x / n) === cx && Math.floor(r.z / n) === cz) };
    if (this.cache.size > 128) this.cache.delete(this.cache.keys().next().value!); this.cache.set(id, result); return result;
  }
  around(point: Point, radius = 1) { const n = this.spec.config.chunkSize, cx = Math.floor(point.x / n), cz = Math.floor(point.z / n), out: Chunk[] = []; for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) out.push(this.chunk(x, z)); return out; }
}
