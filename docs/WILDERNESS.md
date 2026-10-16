# Wilderness update

New expeditions use generation 5; generation 4 introduced distant village sites. Hearthwatch (128, 8), Stonehaven (-144, -32) and Northpass (192, 176) are all at least 120 units from the spawn. Existing generations retain their terrain and village coordinates. Packed paths connect village doorways, market areas and entrances, routing around the furnace. Generation-4 villages clear natural resource deposits from the central square; village supply piles remain collectible.

Player and worker harvesting now takes one second per action, including chopping trees, breaking boulders and collecting exposed materials. Cosmetic flights still follow authoritative single awards.

## Wildlife and pursuit

- Wolf packs have 3-12 members, 50 HP each, and original rigged gray canine models. A wolf selects the nearest visible living entity within 18 units (27 in snow), excluding its packmates and buildings. The target remains locked until dead, sheltered or otherwise unavailable; a closer newcomer does not replace it. Wolves can attack wildlife, raiders, villagers, guards and the player. Other enemies and guards can fight wolves.
- Wolf bites deal 7 direct damage, then 4 bleed damage each second for 12 seconds. Another bite refreshes the duration without stacking the damage rate or restarting the current tick. Machete bleeding remains a separate 2-damage effect. Furnace defenses and respawn immunity still apply.
- Wolves do not use the ordinary pursuit cutoff. A wolf pursuing the player continues outside the normal nearby AI radius. Distant non-player encounters hibernate with their wolf target retained until the player returns, matching the world's local simulation scope.
- Other roaming enemies give up beyond 40 units from their target and return to their original area. They also abandon pursuit outside the 70-unit player simulation radius. New encounters can still occur while traveling.
- Bears deal 15 damage, with a deterministic 50% critical chance for 30. Each successful bear hit has a 10% chance to stun the player for 3 seconds; movement, new attacks, current melee and gathering are disabled during the stun. Immunity prevents both damage and the stun.

## Rivers and hypothermia

Rivers are crossable. Their surface has moving flow streaks; reduced-motion preferences freeze the cosmetic flow. Bridges remain dry crossings. Ground placement still rejects water, and workers prefer dry navigation routes.

Entering water gives Hypothermia I: maximum HP becomes 90 (current HP is capped), and movement is reduced by 90%. Sprinting reduces the movement penalty to 50%, with the existing doubled warmth consumption. After five continuous seconds in water, Hypothermia II drains an additional 25 warmth every three seconds while retaining the other penalties. Leaving water returns the effect to level I and resets the exposure/drain timers. Level I persists on land until the player reaches an active furnace or a Molotov fire. Warming restores the maximum to 100; it does not directly grant the missing HP. Existing furnace healing repeats normally up to the current maximum. Enemies also wade slowly in water.

## Interface

E (and the existing I alias) toggles the inventory. M closes an open inventory or toggles the map. Typing in inputs remains unaffected; death and confirmation dialogs retain their existing controls. The HUD shows hypothermia level, bleeding type/duration, stun countdown, respawn shield and furnace protection. Larger squared monospace typography is used throughout, with adaptive status cards for touch layouts.

## Verification

The build and all 75 simulation tests passed. All 13 browser suites passed across the regression run and focused reruns: wilderness, expansion, guards, recovery, combat, UI, foundation, browser, presentation, hits, projectiles, settlement and production. Two tests interrupted by Vite reloads were rerun on stable sources; the collection-pop check now records animation starts so a screenshot cannot miss the brief effect. Existing generation-1/2 fixtures and generation-3 site checks passed. Browser checks use installed Edge with desktop and touch emulation; no physical phone testing is claimed.

Verified captures: [village paths](screenshots/wilderness-village-pathways.png), [river and hypothermia](screenshots/wilderness-river-hypothermia.png), [wolf pack](screenshots/wilderness-wolf-pack.png), [mobile effects](screenshots/wilderness-status-effects-mobile.png).
