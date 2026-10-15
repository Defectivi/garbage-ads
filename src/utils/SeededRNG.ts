/** Mulberry32, retained from v1. All generation streams are coordinate-addressable. */
export class SeededRNG {
  constructor(private state: number) {}
  next() { let t = this.state = (this.state + 0x6d2b79f5) | 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  range(min: number, max: number) { return min + this.next() * (max - min); }
}
/** FNV-1a over UTF-16 code units, followed by an integer avalanche. Stable unsigned 32-bit output. */
export function derive(seed: number, label: string, x = 0, z = 0) {
  let h = (2166136261 ^ seed) >>> 0;
  for (const c of `${label}:${x}:${z}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h ^ h >>> 16) >>> 0;
}
export const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function noise(seed: number, x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
  const v = (dx: number, dz: number) => derive(seed, 'noise', ix + dx, iz + dz) / 4294967296;
  const a = v(0, 0) * (1 - fx) + v(1, 0) * fx, b = v(0, 1) * (1 - fx) + v(1, 1) * fx;
  return a * (1 - fz) + b * fz;
}
