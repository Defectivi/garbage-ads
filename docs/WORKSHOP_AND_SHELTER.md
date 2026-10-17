# Workshop, construction, shelter and field feedback

## Construction and crafting

The new blacksmith Workshop costs 25 wood, 10 stone and 3 metal, has a ten-second construction timer and defaults to 1500 HP. Its model includes the forge/fire, brick chimney, steel anvil and workbench. It unlocks when an active, intact, completed furnace at level 5+ covers its full footprint. Any furnace qualifies, including village furnaces; a distant high-level furnace cannot unlock a placement outside its range. All new building footprints must fit inside a ready active furnace's range. The existing 15-unit placement distance, collision, dry-ground and slope rules still apply.

Construction durations are hut 10s, storehouse 5s, campfire 3s, City Store 10s, outpost furnace 30s and Workshop 10s. ?Workplace? in the request is treated as Workshop. Timers are simulation time, persist through saves and pause with menus. All worksites are vulnerable structures. Before completion they provide no services or effects; workers cannot fuel unfinished furnaces. Ruin cancels an unfinished timer without granting workers or any completion reward. Only completed huts create workers, exactly once. Scaffolds scale to their building footprint.

Workshop recipes deliberately reuse existing weapon material prices and durability, rather than introducing a second balance table. They use stored supplies first, then carried supplies; failed transactions spend nothing and create no equipment. Crafted weapons equip immediately. Burning/ruined/unfinished Workshops and full equipment storage reject crafting. The crafting interface shows costs and disables unaffordable recipes.

## Player and worker shelter

F/Interact enters a nearby completed, intact, unburning hut with no hidden or incoming NPC occupants. Player occupancy reserves it from NPC shelter searches. The survivor disappears, movement/gathering/attacks stop, and hostile damage is blocked. The player is removed from enemy target selection; the hut remains a valid damage target, including for wolves or retaliating guards when appropriate. Melee enemies measure building reach against the outer wall, preventing them from getting stuck outside attack distance. A browser check verifies a bear damaging an occupied hut from outside its footprint. Ruin/fire ejects the player. F/Interact also leaves voluntarily. The one-second recovery pulse restores 3% of the current maximum HP and cannot revive a dead player. Furnace healing is suspended while inside; hunger and environmental exposure are not disabled. The HUD reports the actual hut heal and remaining pulse time.

Workers whose own hut becomes a ruin immediately stop production and fuel deliveries, retain their loads and select the nearest generated village. Exposed workers walk there using obstacle-aware local routes and bridge approaches when a river separates them. Existing collapse damage still halves hidden occupants' current HP once. Workers already leaving a refuge finish exiting before migrating. Arrived workers remain displaced civilians, and can use village houses for night/injury shelter. Generation-1 worlds without villages cannot provide a village destination, so displaced workers stop production without falsely claiming arrival.

## Visual and interface changes

Player harvesting uses the existing original axe/pickaxe geometry in the right hand, enlarged for readability, while hiding the equipped combat weapon. Mining stone, metal and gold uses the pickaxe; wood uses the axe. Deliberate gathering faces its selected resource without introducing mouse-driven idle facing.

Furnaces have stone footings, steel bands, layered animated flames and up to 48 floating warm embers per active heat circle. Effects shut off on fuel depletion and are replaced/disposed with range changes. Ember textures, point geometry and owned materials are disposed. Reduced motion freezes flame motion, flicker and ember drift.

Carried resource counters are beside the Frostbound title. On narrow screens the strip can scroll horizontally for long counts. HP under 15% is red with a slow edge warning, 15-99% green and full maximum HP blue. This preserves the request's green values on both sides of 50%. Hunger under 15% is red, 15-49% amber and 50-100% green. Reduced motion disables the critical pulse. Blizzard maps overlay pale blue-gray mist, retaining faint terrain context instead of opaque dark masking; ordinary world visibility remains unchanged.

## Actual verification

- All 137 unit tests passed, covering furnace coverage/level unlocks, per-building timers and saved construction, interrupted sites, atomic crafting, hut occupancy/healing/invulnerability, enemy damage to an occupied hut, migration and save round trips.
- Production TypeScript/Vite build passed.
- Browser suites passed during the update: workshop, camp, night, browser, workers, combat and production. The Workshop suite exercises real construction/models/crafting, visible embers, F-based player shelter/healing/ejection, moving displaced workers, both harvesting tools, computed meter colors, title-side resource placement, pale storm-map pixels and reduced-motion touch layout. Older City Store/campfire fixtures now explicitly complete construction first.
- A separate route check using the actual seed-42 terrain advanced both displaced starting workers to Hearthwatch; no mocked collision or water was used in that check.
- Actual blacksmith, furnace, shelter, mobile HUD and blizzard-map screenshots and close-ups of both player tools were visually inspected. Browser tests use headless Edge/touch emulation; no physical-device testing is claimed.
