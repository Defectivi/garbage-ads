import type { Point } from '../game/GameState';
export function route(from: Point, to: Point, valid: (p: Point) => boolean): Point[] {
  const cell = 1.5, x0 = Math.floor((Math.min(from.x, to.x) - 8) / cell), z0 = Math.floor((Math.min(from.z, to.z) - 8) / cell);
  const cols = Math.ceil(Math.abs(from.x - to.x) / cell) + 14, rows = Math.ceil(Math.abs(from.z - to.z) / cell) + 14;
  if (cols * rows > 5000) return [];
  const key = (x: number, z: number) => z * cols + x;
  const grid = (p: Point) => ({ x: Math.round(p.x / cell) - x0, z: Math.round(p.z / cell) - z0 });
  const a = grid(from), b = grid(to), start = key(a.x, a.z), goal = key(b.x, b.z), pos = (k: number) => ({ x: (k % cols + x0) * cell, z: (Math.floor(k / cols) + z0) * cell });
  const blocked = new Map<number, boolean>();
  const pass = (x: number, z: number) => { if (x < 0 || z < 0 || x >= cols || z >= rows) return false; const k = key(x, z); if (!blocked.has(k)) blocked.set(k, !valid(pos(k))); return !blocked.get(k); };
  if (!pass(b.x, b.z)) return [];
  const open = [start], cost = new Map([[start, 0]]), came = new Map<number, number>(), closed = new Set<number>();
  const h = (k: number) => Math.hypot(k % cols - b.x, Math.floor(k / cols) - b.z);
  while (open.length && closed.size < 3000) {
    let best = 0; for (let i = 1; i < open.length; i++) if (cost.get(open[i])! + h(open[i]) < cost.get(open[best])! + h(open[best])) best = i;
    const curr = open.splice(best, 1)[0]; if (curr === goal) { const out: Point[] = []; let k = curr; while (k !== start) { out.push(pos(k)); k = came.get(k)!; } return out.reverse(); }
    closed.add(curr); const x = curr % cols, z = Math.floor(curr / cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (!pass(x + dx, z + dz) || dx && dz && (!pass(x + dx, z) || !pass(x, z + dz))) continue;
      const n = key(x + dx, z + dz), g = cost.get(curr)! + Math.hypot(dx, dz); if (closed.has(n) || g >= (cost.get(n) ?? Infinity)) continue;
      cost.set(n, g); came.set(n, curr); if (!open.includes(n)) open.push(n);
    }
  }
  return [];
}
