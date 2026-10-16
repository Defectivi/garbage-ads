# Spawn protection and readable warmth

New worlds start with 60 base fuel seconds, a completed worker hut at (-7,-7), and two 100-HP workers. The starter hut has 500 HP and a 125-HP ruined stage; purchased huts retain 1000 HP. Existing full saves retain their actual camp and fuel.

New-world and recovery protection lasts 12 simulation seconds in a 100-unit radius anchored at the spawn point (one unit is one metre for this rule). Nearby hostiles are moved to clear, dry positions outside the area on recovery; hostile movement and encounter spawning cannot enter while active. Deferred encounters become available after expiry. Incoming player damage is blocked inside the zone; leaving it forfeits area protection. Peaceful guards remain neutral. The countdown pauses with the game and persists through saves rather than resetting on load. The existing five-second recovery immunity also remains.

Active furnaces show a wider, brighter terrain-following boundary and a translucent animated orange/gold flame-like aura throughout their true heat radius. Effects follow upgrades and disappear when fuel runs out or the furnace is ruined. Each furnace owns one bounded mesh; replaced geometry/materials are disposed. Reduced motion freezes the wisps. Ordinary fog still affects the aura.

Bridge water classification and walking height use the same fixed deck footprint as the rendered timber bridge. Side rails constrain movement across the deck; forward entry and exit remain open. Trees and resource deposits are excluded from decks. Off-bridge water still causes hypothermia, and crossing a bridge does not cure an existing condition.

Whiteouts smoothly bring fog closer to the camera, reducing visible terrain and entities. The storm distance accounts for camera zoom and render distance; snowfall, triple fuel consumption and increased enemy detection remain.

## Verification

All 94 simulation tests and the production build passed. The new `npm run test:spawn` browser suite verifies real new-world defaults, protection expiry and respawn, aura animation/upgrade/shutdown, stronger storm fog, bridge rails and off-bridge hypothermia, plus mobile reduced motion. Existing suites isolate the initial camp to retain their focused fixtures; the spawn suite tests the actual defaults. Browser tests use headless Edge and emulated touch, not physical devices.

All 15 browser suites passed across the regression run and focused reruns: spawn, browser, camp, expansion, settlement, combat, guards, production, UI, foundation, recovery, wilderness, hits, projectiles and presentation. The exploration touch fixture now waits for terrain loading and sends native emulated touch events. `git diff --check` passed.

Verified captures: [starting camp and aura](screenshots/spawn-starting-camp.png), [whiteout visibility](screenshots/spawn-whiteout.png), and [mobile reduced-motion HUD](screenshots/spawn-mobile.png).
