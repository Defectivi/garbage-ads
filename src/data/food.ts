/** Shared by the authoritative transaction and inventory presentation. */
export const FOOD_COOLDOWN = 3;
export const FOOD = { fish: { hunger: 2, health: 5 }, meat: { hunger: 3, health: 5 } } as const;
export type Food = keyof typeof FOOD;
