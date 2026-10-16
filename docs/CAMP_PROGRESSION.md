# Camp progression, hills and lakes

This increment changes gameplay in three verified stages: furnace/combat rules, construction and worker economy, then terrain/map presentation. Existing save data and earlier terrain generations are preserved.

## Furnaces and combat

T upgrades the nearest intact furnace within five units. Upgrading is removed from Build. The desktop/touch HUD shows the next cost, greys unavailable upgrades, and explains shortages when attempted. Missing carried-resource counters flash gently red; reduced motion uses a static highlight. Costs use stored materials first, then carried materials, as a single transaction. The sandbox debt option remains supported.

The maximum is level 50. Heat radius starts at 12 and expands only at levels 5, 10 and 20, reaching 20, 28 and 36 units respectively. There are at most three expansions. Model reinforcements still update every five levels. Each level adds 0.2 seconds to the base one-second fuel consumption interval. Wood adds 10 fuel units, charcoal adds 30; charcoal is selected and consumed first. Charcoal no longer has an extra hidden duration multiplier. The HUD estimates remaining real fuel time at the current level/weather. Snow retains triple consumption. See the [generated full cost table](FURNACE_UPGRADES.md); food costs provision builders. The partly specified level 6-10 sequence is completed as 100/110/120/130/140 wood and 10/10/20/20/20 metal.

All hostiles in active player-owned heat burn for exactly 12 HP per second, without double-damage multiplication or overlap stacking. This includes wolves and retaliating guards; peaceful guards and civilians remain safe. The entry penalty, doubled other damage and slowed hostile movement remain. Burning applies even beyond the ordinary 70-unit AI radius when a large furnace reaches them; small visible flames mark burning actors.

Damage received inside an active furnace sets a three-second recent-damage timer. Healing ticks restore 10 HP while that timer is active, returning to 25 after three damage-free seconds. Healing still uses a three-second interval and the player's current maximum HP. Bears retain 15/30 damage and a 50% critical chance, but stun chance is now an independent 10% for three seconds.

Warmth is always displayed beside health as well as in the temperature panel.

## Worker huts

New huts cost 20 wood and take ten simulation seconds to complete. The construction frame has 1000 HP; ruined/destroyed huts do not complete construction. The countdown pauses with the game and persists in full saves. Completion creates exactly two 100-HP workers once. Existing completed huts and their workers are retained on load, including older one-worker huts.

Workers gather wood, stone and fish food, favoring the least-stocked available material. They fell trees, break boulders, collect finite deposits and fish at nearby bank markers, then physically deliver typed loads into stockpiles. Fish gathering shares depletion with player fishing, preventing duplicate supplies. A hut needs a fishing marker within its 26-unit work radius to supply fish.

Workers keep working at 50 HP and seek shelter below 50, including after bleed damage. Their own intact, completed hut is preferred. Sheltered workers recover 5 HP per second during the existing twelve-second refuge stay, allowing them to return safely. Ruining a house exposes its occupants. Other civilian and guard refuge behavior is retained.

## Terrain and map

New worlds use generation 5, with stronger rolling ridges and deterministic elliptical lakes. Spawn, village areas and lake placement clearances are protected. Lakes use the river water rendering/flow and apply the same persistent hypothermia rules. Existing generation 1-4 terrain is unchanged. Higher ground physically occludes models, and sampled terrain sight checks prevent acquiring targets through hills. Distance-sorted acquisition avoids checking every potential target's sight line unnecessarily.

The map distinguishes snow, forests, high ground, rivers, lakes and dry bridges. Individual surviving trees are drawn as pines; felled/charred trees disappear. Named village/ruin markers, home/player markers, a north label and scale improve orientation. The chart remains centered on the survivor and covers 256 by 256 units.

## Validation

The production build and all 87 simulation tests passed, including charcoal priority with a resource debt in the other account. All 14 browser suites passed across the regression run and focused reruns: camp, expansion, settlement, combat, guards, production, UI, foundation, browser, recovery, wilderness, hits, projectiles and presentation. The mobile orbit fixture now uses exposed terrain rather than the new HUD, and the noncombat exploration suite isolates enemy activity while separate suites retain combat/refuge coverage. Browser checks use Edge with desktop and touch emulation, including reduced motion; no physical device testing is claimed.

Final focused reruns: camp and production passed again after the fuel-account edge fix and the high-level mobile panel size check. `git diff --check` passed. Verified captures: [construction](screenshots/camp-hut-construction.png), [lake and hills](screenshots/camp-lake-hills.png), [terrain map](screenshots/camp-terrain-map.png), [mobile HUD](screenshots/camp-camp-hud-mobile.png), [all-material upgrade](screenshots/camp-upgrade-materials-mobile.png), [furnace burning](screenshots/camp-furnace-enemy-burn.png).

## Three-expansion update verification

Radius now expands only at levels 5/10/20, with a maximum of three expansions. Verified all levels 1-50, exact expansion notifications, extinguished/charcoal heat and save round trips in the 119 passing unit tests. Build and camp, spawn, settlement and production browser checks passed. Camp browser assertions check both rendered heat meshes at the milestones and at non-expanding levels 4/9/15/21/50; mobile layout was visually checked with the 3/3 count visible.
