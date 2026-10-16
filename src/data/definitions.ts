export const RESOURCES = {
  wood: { name: 'Wood', icon: '◒', description: 'Furnace fuel, shelter and timber construction.' },
  stone: { name: 'Stone', icon: '⬡', description: 'Foundations, furnaces and sturdy storage.' },
  meat: { name: 'Meat', icon: '◔', description: 'Food; eat to restore warmth on a long journey.' },
  fish: { name: 'Fish', icon: '⋉', description: 'River catch. Eat for warmth or barter for supplies.' },
  metal: { name: 'Metal', icon: '▱', description: 'Salvaged metal for infrastructure and barter.' },
  gold: { name: 'Gold', icon: '✧', description: 'A portable trade good; direct barter also works.' },
  charcoal: { name: 'Charcoal', icon: '◆', description: 'Charred timber. 30 seconds of base fuel; preferred over wood.' }
} as const;
export type Resource = keyof typeof RESOURCES;
export const RESOURCE_IDS = Object.keys(RESOURCES) as Resource[];
export type Balances = Record<Resource, number>;
export function balances(values: Partial<Balances> = {}): Balances { return { wood: 0, stone: 0, meat: 0, fish: 0, metal: 0, gold: 0, charcoal: 0, ...values }; }
export const BUILDINGS = {
  hut: { name: 'Worker hut', costs: { wood: 20 }, radius: 2, effect: '10s construction; two workers gather wood, stone and fish.', color: 0x896445 },
  storage: { name: 'Storehouse', costs: { wood: 20, stone: 10 }, radius: 2.4, effect: 'Store or retrieve resources here; +50 carried capacity if a limit is enabled.', color: 0x627e83 },
  shelter: { name: 'Campfire', costs: { wood: 5 }, radius: .8, effect: '5m aura: allies recover 6% HP and warmth each second for 15s.', color: 0x997f5a },
  city_store: { name: 'City Store', costs: { wood:20, stone:10, metal:5 }, radius:2.4, effect:'Buy weapons and supply bundles for gold. Interact to shop.', color:0x947b43 },
  furnace: { name: 'Outpost furnace', costs: { metal: 10, stone: 5 }, radius: 1.5, effect: 'A second fuelled heat source. Starts empty.', color: 0x435d68 }
} as const;
export type BuildingType = keyof typeof BUILDINGS;
