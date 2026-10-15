import { RESOURCE_IDS, type Balances, type Resource } from '../data/definitions';
import type { Settings } from '../game/GameConfig';
export interface Transaction { account: Balances; delta: Partial<Balances>; capacity?: number }
export type Result = { ok: true } | { ok: false; error: string };
/** Validate every proposed balance before mutating any party. No clamping or silent debt forgiveness. */
export function transact(entries: Transaction[], rules: Pick<Settings, 'allowDebt' | 'resourceMin' | 'resourceMax'>): Result {
  const proposed = new Map<Balances, Balances>();
  for (const entry of entries) {
    const next = proposed.get(entry.account) ?? { ...entry.account };
    for (const key of RESOURCE_IDS) {
      const delta = entry.delta[key] ?? 0;
      if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(next[key])) return { ok: false, error: `Invalid numeric value for ${key}.` };
      const value = next[key] + delta;
      if (!Number.isSafeInteger(value) || value < rules.resourceMin || value > rules.resourceMax) return { ok: false, error: `${key} must remain between ${rules.resourceMin} and ${rules.resourceMax}.` };
      if (delta < 0 && value < 0 && !rules.allowDebt) return { ok: false, error: `Insufficient ${key}. Enable sandbox debt to permit this action.` };
      next[key] = value;
    }
    proposed.set(entry.account, next);
  }
  for (const entry of entries) if (entry.capacity && RESOURCE_IDS.reduce((n, k) => n + Math.max(0, proposed.get(entry.account)![k]), 0) > entry.capacity) return { ok: false, error: `Inventory limit (${entry.capacity}) reached.` };
  for (const [account, values] of proposed) Object.assign(account, values);
  return { ok: true };
}
export const negate = (cost: Partial<Balances>) => Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, -v!])) as Partial<Balances>;
export function exchange(a: Balances, b: Balances, give: Partial<Balances>, receive: Partial<Balances>, settings: Settings, capacity = 0): Result {
  const delta: Partial<Balances> = {};
  for (const key of RESOURCE_IDS) delta[key] = (receive[key] ?? 0) - (give[key] ?? 0);
  return transact([{ account: a, delta, capacity }, { account: b, delta: negate(delta) }], settings);
}
export function resourceText(values: Partial<Balances>) { return RESOURCE_IDS.filter(k => values[k]).map(k => `${values[k]} ${k}`).join(' + ') || 'Nothing'; }
export const single = (key: Resource, count: number): Partial<Balances> => ({ [key]: count });
