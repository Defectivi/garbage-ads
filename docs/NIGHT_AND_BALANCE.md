# Hunger, City Stores and night survival

Gathering: wood 0.3s, stone 0.7s, metal 1.1s, gold 2.2s per completed action. Natural trees/boulders still break into finite collectible pieces. Workers use the resource timings and keep simulating regardless of player/render distance. Mouse hover or touch on a visible worker shows current HP / 100; touch labels persist briefly.

## Buildings and shopping

Storehouse: 20 wood + 10 stone, 2000 HP. Ruined stores retain access to all shared storage. Final destruction empties positive shared stockpile balances and leaves floor(10%) of each material in a recoverable ground pile, once. Carried items and negative debts remain unchanged. Storage is a shared account across buildings, so this loss applies to the shared materials, not a second per-building copy. Ordinary structural wood/stone salvage remains separate.

Campfire replaces Trail shelter (internal save type remains `shelter`): 5 wood, five-unit radius, fifteen one-second pulses restoring 6% of each living ally/player's maximum HP and 6 player warmth per pulse. It heals workers, neutral guards and living traders; it does not revive defeated entities. Campfires then extinguish; the spent structure remains. Legacy shelters become fresh 15-second campfires on first simulation after loading.

Outpost furnace: 10 metal + 5 stone, starts empty. City Store: 20 wood + 10 stone + 5 metal, 2000 HP; approach and interact to buy with carried gold. Burning or ruined stores cannot trade. Costs use the existing atomic transaction/capacity/debt rules.

| Gold | Item |
| --- | --- |
| 1 | Wooden sword, bow, 3 fish, 3 wood, or 2 stone (each a separate offer) |
| 3 | Stone sword, 10 fish, or 10 wood (each a separate offer) |

## Weapons

| Weapon | Hit / effect | Uses |
| --- | --- | --- |
| Wooden sword | 8 damage / 1s cooldown | 25 successful enemy hits |
| Stone sword | 12 damage / 1s cooldown / independent 10% chance of 1s enemy stun | 50 successful enemy hits |
| Bow | 10 damage + 3 bleed/second for 5s / 2s cooldown | 100 shots |
| Machete | 25 damage + 7 bleed/second for 7s / 1.5s cooldown | 100 successful enemy hits |
| Shotgun | 15 wide, 50 close, 105 closest / 4s cooldown | 21 shots |
| Molotov | Existing 4m, 10s fire; 50 building damage/second | Fallen/village-found bottles: 1 use; trader purchase: 100 |

Shotgun overlays show three nested sectors: closest within 1m and 13.3 degrees either side, close within 2m and 26.7 degrees, wide within 3m and 40 degrees. The worse of distance/angle determines damage. A target is damaged once per volley. Arrow and visible-blade swept collisions remain authoritative. Stone swords reuse the sword rig with a distinct stone blade. Existing loaded weapons above their new durability limit are capped when the game is constructed. Unlimited ammunition does not bypass durability. Spears and wolf bite bleed retain prior tuning. Weapon bleed refreshes/replaces the weapon bleed channel; wolf bite uses its own channel.

## Hunger and food

Hunger starts at 20. Standing still does not drain it. Actual movement accumulates separate clocks: walking loses 1 every 30 seconds; sprinting loses 2 every 15 seconds. Blocked movement does not count. Below 10, movement is 20% slower; below 5, maximum HP is halved (45 with hypothermia, otherwise 50). At zero, starvation removes 15 HP each second, independently of combat mitigation. Food restores 5 HP; fish gives 2 hunger and meat gives 3, with a shared 3-second simulation cooldown. Food no longer grants the old 35 warmth. Eating increases hunger before healing applies its current HP cap. Recovery resets hunger to 20. Timers pause with the game and persist through full saves.

## Fire, fog and night

Molotov fire prevents affected buildings from sheltering people, ejects hidden occupants, and deals 50 structural HP/second while overlapping a building's footprint. Structures remain bleed-immune. Fire produces local light and clears nearby fog until it expires; equipped usable molotovs act as torches without consuming uses until thrown. Active furnaces and campfires also light their immediate area. Light-source fog clearings are bounded to eight sources, prioritizing held torch and nearby fires.

Day and night alternate every 600 simulation seconds, with a ten-second lighting transition. Night adds one additional deterministic encounter wave per nearby cell per night, including already visited cells, giving twice the normal encounter generation. Guard groups remain unchanged; the spawn-safe area still defers encounters. Wolves and bears take 25% less damage during night. Saved elapsed time determines cycle and wave keys prevent duplicate spawns on reload.

Fog during storms/night measures world distance from the player, independently of camera position/zoom: storm sight fades from 8 to 28m, night from 5 to 22m. Local light clears small circles. All fog-aware terrain, trees, water and characters share uniforms; shader/material/texture resources are reused or disposed. Clear daylight retains ordinary distance fog. The map applies matching visibility fog and nighttime dimming. Distant known-place text remains a navigation reference.

## Validation

All 104 simulation tests passed. All 16 browser suites passed across the full regression run and focused reruns: night, spawn, browser, camp, expansion, settlement, combat, guards, production, UI, foundation, recovery, wilderness, hits, projectiles and presentation. The production build and whitespace checks passed. Browser coverage uses headless Edge with touch emulation and reduced motion; no physical device testing is claimed. `npm run test:night` covers desktop/touch purchase, new weapon pose/spread overlays, food cooldown, worker inspection, fixed-distance fog at multiple zooms, nighttime map and equipped torch. Simulation tests cover timing, night encounters/resistance, exact damage-over-time, fire shelter restrictions, remote workers, atomic purchase and single storage salvage.

Verified captures: [City Store](screenshots/night-city-store.png), [healing campfire](screenshots/night-campfire.png), [molotov torch](screenshots/night-torch.png), [storm/night map](screenshots/night-map.png), [worker touch inspection](screenshots/night-worker-mobile.png).
