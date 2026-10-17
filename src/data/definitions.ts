export const RESOURCES = {
  wood: { name: 'Wood', icon: '◒', description: 'Furnace fuel, shelter and timber construction.' },
  stone: { name: 'Stone', icon: '⬡', description: 'Foundations, furnaces and sturdy storage.' },
  meat: { name: 'Meat', icon: '◔', description: 'Eat for 5 HP and 3 hunger. Shared 3-second meal cooldown.' },
  fish: { name: 'Fish', icon: '⋉', description: 'Eat for 5 HP and 2 hunger, or barter for supplies.' },
  metal: { name: 'Metal', icon: '▱', description: 'Salvaged metal for infrastructure and barter.' },
  gold: { name: 'Gold', icon: '✧', description: 'A portable trade good; direct barter also works.' },
  charcoal: { name: 'Charcoal', icon: '◆', description: 'Charred timber. 30 seconds of base fuel; preferred over wood.' }
} as const;
export type Resource = keyof typeof RESOURCES;
export const RESOURCE_IDS = Object.keys(RESOURCES) as Resource[];
export type Balances = Record<Resource, number>;
export function balances(values: Partial<Balances> = {}): Balances { return { wood: 0, stone: 0, meat: 0, fish: 0, metal: 0, gold: 0, charcoal: 0, ...values }; }
export const CONSTRUCTION_SECONDS={hut:10,storage:5,shelter:3,city_store:10,furnace:30,workshop:10} as const;
export const BUILDINGS = {
  workshop:{name:'Workshop',costs:{wood:25,stone:10,metal:3},radius:2.6,effect:'Craft weapons. Requires a level 5 furnace covering its footprint.',color:0x7e6450},
  hut: { name: 'Worker hut', costs: { wood: 20 }, radius: 2, effect: 'Two workers gather supplies and tend nearby furnaces.', color: 0x896445 },
  storage: { name: 'Storehouse', costs: { wood: 20, stone: 10 }, radius: 2.4, effect: 'Store or retrieve resources here; +50 carried capacity if a limit is enabled.', color: 0x627e83 },
  shelter: { name: 'Campfire', costs: { wood: 5 }, radius: .8, effect: '5m aura: allies recover 6% HP and warmth each second for 15s.', color: 0x997f5a },
  city_store: { name: 'City Store', costs: { wood:20, stone:10, metal:5 }, radius:2.4, effect:'Buy weapons and supply bundles for gold. Interact to shop.', color:0x947b43 },
  furnace: { name: 'Outpost furnace', costs: { metal: 10, stone: 5 }, radius: 1.5, effect: 'A second fuelled heat source. Starts empty.', color: 0x435d68 }
} as const;
export type BuildingType = keyof typeof BUILDINGS;
