import { balances, type Balances } from './definitions';
import type { Ruin } from '../world/WorldManager';
export interface Offer { id: string; title: string; give: Partial<Balances>; receive: Partial<Balances> }
export function trader(r: Ruin) {
  const common: Offer[] = [{ id: 'barter-metal', title: 'River catch for salvaged metal', give: { fish: 40 }, receive: { metal: 10 } }, { id: 'sell-fish', title: 'Sell two fish', give: { fish: 2 }, receive: { gold: 3 } }];
  const special: Offer[][] = [
    [{ id: 'buy-wood', title: 'A bundle for the road', give: { gold: 2 }, receive: { wood: 8 } }, { id: 'barter-stone', title: 'Stone for timber', give: { stone: 4 }, receive: { wood: 6 } }],
    [{ id: 'buy-metal', title: 'Quarry salvage', give: { gold: 3 }, receive: { metal: 5 } }, { id: 'buy-stone', title: 'Foundation stone', give: { wood: 5 }, receive: { stone: 10 } }],
    [{ id: 'buy-fish', title: 'Fresh river fish', give: { wood: 4 }, receive: { fish: 6 } }, { id: 'buy-food', title: 'A warm meal', give: { gold: 2 }, receive: { meat: 3 } }]
  ];
  return { id: `npc:${r.id}`, name: ['Mara · Timber trader', 'Ivo · Quarry salvager', 'Nell · River merchant'][r.variant], inventory: balances({ wood: 80, stone: 100, fish: r.variant === 2 ? 160 : 50, metal: r.variant === 1 ? 150 : 60, meat: 30, gold: 100 }), offers: [...special[r.variant], ...common] };
}
