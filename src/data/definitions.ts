export const RESOURCES = {
  wood: { name: 'Wood', icon: '◒', description: 'Furnace fuel, shelter and timber construction.' },
  stone: { name: 'Stone', icon: '⬡', description: 'Foundations, furnaces and sturdy storage.' },
  meat: { name: 'Meat', icon: '◔', description: 'Food; eat to restore warmth on a long journey.' },
  fish: { name: 'Fish', icon: '⋉', description: 'River catch. Eat for warmth or barter for supplies.' },
  metal: { name: 'Metal', icon: '▱', description: 'Salvaged metal for infrastructure and barter.' },
  gold: { name: 'Gold', icon: '✧', description: 'A portable trade good; direct barter also works.' },
  charcoal: { name: 'Charcoal', icon: '◆', description: 'Charred timber. Twice the fuel and half the consumption rate of wood.' }
} as const;
export type Resource = keyof typeof RESOURCES;
export const RESOURCE_IDS = Object.keys(RESOURCES) as Resource[];
export type Balances = Record<Resource, number>;
export function balances(values: Partial<Balances> = {}): Balances { return { wood: 0, stone: 0, meat: 0, fish: 0, metal: 0, gold: 0, charcoal: 0, ...values }; }
export const BUILDINGS = {
  hut: { name: 'Worker hut', costs: { wood: 5 }, radius: 2, effect: 'One woodcutter; delivers to camp storage.', color: 0x896445 },
  storage: { name: 'Storehouse', costs: { wood: 8, stone: 4 }, radius: 2.4, effect: 'Store or retrieve resources here; +50 carried capacity if a limit is enabled.', color: 0x627e83 },
  shelter: { name: 'Trail shelter', costs: { wood: 6, stone: 2 }, radius: 1.8, effect: 'Recover warmth within 5 units, even away from home.', color: 0x997f5a },
  furnace: { name: 'Outpost furnace', costs: { wood: 10, stone: 8, metal: 2 }, radius: 1.5, effect: 'A second fuelled heat source. Starts empty.', color: 0x435d68 }
} as const;
export type BuildingType = keyof typeof BUILDINGS;
