import type { Balances } from './definitions';
export const WEAPONS = {
  wooden_sword: { name: 'Wooden sword', type: 'melee', cooldown: 1, range: 2, damage: 10, cost: { wood: 6 }, description: '10 damage per swing. Reliable, light, inexpensive.' },
  spear: { name: 'Spear', type: 'melee', cooldown: 1.5, range: 2.8, damage: 3, cost: { wood: 8, metal: 2 }, description: '3–10 damage per thrust. A little more reach.' },
  machete: { name: 'Machete', type: 'melee', cooldown: 1.5, range: 2, damage: 25, cost: { metal: 8, gold: 4 }, description: '25 damage, then 2 bleed damage each second for 10 seconds.' },
  bow: { name: 'Bow', type: 'arrow', cooldown: 2, range: 22, damage: 15, cost: { wood: 12, gold: 4 }, description: 'One 15-damage arrow every 2 seconds. Infinite arrows.' },
  shotgun: { name: 'Shotgun', type: 'pellet', cooldown: 4, range: 3, damage: 95, cost: { metal: 15, gold: 12 }, description: '3-tile, 80° spread every 4 seconds. 12-95 damage: closer is stronger.' },
  molotov: { name: 'Molotov', type: 'bottle', cooldown: 4, range: 12, damage: 3, cost: { wood: 6, gold: 6 }, description: '4-tile fire radius for 10 seconds. 3 damage/second. Chars timber.' }
} as const;
export type WeaponType = keyof typeof WEAPONS;
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponType[];
export interface Weapon { id: string; type: WeaponType; uses: number }
export const weaponCost = (type: WeaponType): Partial<Balances> => WEAPONS[type].cost;
export const ACTOR_HP = { polar_bear: 50, bandit: 125, arsonist: 75, guard: 125 } as const;
export type ActorType = keyof typeof ACTOR_HP;
