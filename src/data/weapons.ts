import type { Balances } from './definitions';
export const WEAPONS = {
  wooden_sword: { name: 'Wooden sword', type: 'melee', cooldown: 1, range: 2, damage: 8, uses:25, cost: { wood: 6 }, description: '8 damage per swing; 25 successful hits. Reliable, light, inexpensive.' },
  stone_sword: { name: 'Stone sword', type: 'melee', cooldown: 1, range: 2, damage: 12, uses:50, cost: { gold:3 }, description: '12 damage; 10% chance of a 1s stun. 50 successful hits.' },
  spear: { name: 'Spear', type: 'melee', cooldown: 1.5, range: 2.8, damage: 3, uses:100, cost: { wood: 8, metal: 2 }, description: '3–10 damage per thrust. A little more reach.' },
  machete: { name: 'Machete', type: 'melee', cooldown: 1.5, range: 2, damage: 25, uses:100, cost: { metal: 8, gold: 4 }, description: '25 damage, then 7 bleed damage each second for 7 seconds.' },
  bow: { name: 'Bow', type: 'arrow', cooldown: 2, range: 22, damage: 10, uses:100, cost: { wood: 12, gold: 4 }, description: '10 damage plus 3 bleed/second for 5s. One arrow every 2s.' },
  shotgun: { name: 'Shotgun', type: 'pellet', cooldown: 4, range: 3, damage: 105, uses:21, cost: { metal: 15, gold: 12 }, description: '3-tile, 80° spread every 4 seconds. 15 / 50 / 105 damage in wide / close / closest bands; 21 shots.' },
  molotov: { name: 'Molotov', type: 'bottle', cooldown: 4, range: 12, damage: 3, uses:100, cost: { wood: 6, gold: 6 }, description: '4-tile fire radius for 10 seconds. 3 damage/second. Chars timber.' }
} as const;
export type WeaponType = keyof typeof WEAPONS;
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponType[];
export interface Weapon { id: string; type: WeaponType; uses: number }
export const weaponCost = (type: WeaponType): Partial<Balances> => WEAPONS[type].cost;
export const ACTOR_HP = { polar_bear: 50, wolf: 50, bandit: 125, arsonist: 75, guard: 125 } as const;
export type ActorType = keyof typeof ACTOR_HP;

export const weaponUses=(type:WeaponType)=>WEAPONS[type].uses;
