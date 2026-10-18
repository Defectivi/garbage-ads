# Communities, field charts and rendering performance

This increment extends the existing Three.js game, harvesting, navigation, shelter, combat, furnace, transaction and map systems. It does not complete unrelated roadmap items. No runtime dependency was added.

## Identity and community life

New worlds store `namingVersion: 1`. Seed-addressed syllables, regional ending pools and stable identity ordering generate pronounceable names. Collisions retry deterministically, then use a pronounceable suffix. Village positions and IDs are unchanged. Worlds without this version retain their old fixed names as an explicit deterministic fallback. Activated communities save their names and settlement seeds.

A village activates on first approach within the existing 85-unit encounter radius. Thereafter it continues logical simulation independently of rendering and chunk eviction. Unvisited villages initialize lazily, without imaginary offline production. The current world has three villages in Normal/Hard and nine in Easy, bounding population.

Each community has three persistent residents with wood/stone/fish assignments, assigned generated houses, its own 300-unit storage account and storehouse, the existing trader as representative, a guard roster and four patrol waypoints. The trading panel exposes a community ledger. Prepared villager models use the existing harvesting tools; distant residents allocate no character models.

Residents reuse finite nodes, tree/log and boulder/fragment stages, fishing depletion, reachable approaches and physical delivery. Loads hold at most three resources. Village accounts never alias player inventory, player camp stores, trader stock or other villages. Full stores block delivery while retaining carried loads. Initial provisions (12 wood, 6 stone, 6 fish, within resource bounds) are granted once. Chunk re-entry never creates supplies.

Village furnaces start at level 5 with 240 fuel units. Existing village furnaces migrate to at least level 5, retaining fuel, charcoal and higher levels. Workers fuel only their own village from actual carried wood or village charcoal/wood. The existing survival system consumes fuel once, with level efficiency and triple blizzard consumption. Tending starts at 20 fuel units; in the last minute before nightfall, villagers target a 720-unit reserve if supplies/routes permit. Night rest and threats can interrupt preparation; nothing fabricates fuel.

Village fire applies the existing enemy entry penalty, damage multiplier, slow and 12 HP/second burn. Affiliated residents and guards receive incoming-damage reduction inside their active village circle. Player combat protection remains restricted to player-owned heat. Village fires do not attack their own guards or shut down unrelated furnaces. Overlaps do not stack entry charges or burning. Extinguished or ruined sources provide no effects.

Guards retain shared weapon, projectile, damage and cooldown rules. Saved patrol indices select designated waypoints. Engagement targets must remain within 30 units of the village; guards return instead of pursuing indefinitely. Existing village alerts govern retaliation against the player. Local combat continues logically while the player is away, without a separate distant damage/reward formula.

Twice-per-second security checks detect hostiles within 32 units, including an aggressive player, and retain an alert for eight clear seconds. Civilians stop work and retreat through reachable approaches. Houses accept up to four new refuge assignments and exclude player-occupied, burning, unfinished and destroyed shelters. Invalid assignments select another house where possible. Blocked approaches retry with a delay; residents without shelter suspend work. Existing night, collapse and healing behavior remains. Dead residents, representatives and guards are not recreated by re-entry.

Resource searches cache candidates per community for one simulation second; depletion is rechecked before collection. Community harvesting/fueling starts at most two navigation searches per game step. Navigation keeps its existing bounded grids. No offline wall-clock advancement occurs. Loading, pause, hidden-tab pause and death retain existing behavior.

## Field chart

Markers have editable labels and world coordinates. Routes contain 2-128 waypoints. Tap/click charted ground, choose a tool, label and save. Select saved markings to edit or delete; routes support append/undo and snapping to markers. Desktop and touch share controls. Limits are 200 markers and 50 routes.

Exploration records 16-unit cells near the player using terrain sight checks. Missing legacy exploration starts from the player's position and existing discovered places. Uncharted terrain stays concealed; new markers and route waypoints there are refused. Storm/night overlays remain independent of camera zoom. Saved notes may remain visible as memory references without exposing underlying terrain. Route segments clip to the visible chart and charted cells before drawing, bounding work even for distant imported endpoints. Routes never alter terrain, movement or AI navigation.

Labels are trimmed/NFC-normalized, limited to 64 printable characters, and rendered through canvas text or DOM textContent. Imported coordinates, IDs, references, counts and cells are validated before replacement. Full saves retain the journal; sandbox starting configurations omit it.

## Budget Meal Mode and FPS

Settings exposes reversible Budget Meal Mode and measured FPS options. Full saves and sandbox settings retain both; missing legacy preferences mean disabled.

Budget Meal Mode targets at most 30 WebGL renders/second, caps pixel density at 1.25 instead of 1.75, uses 512 instead of 1024 sun shadow maps, updates shadows at most ten times/second, and reduces storm flakes to 450 and furnace embers to 12. Important lighting, terrain, furnace aura, projectiles, damage/resource feedback and weather information remain. Changes apply without restarting. Devices below 30 FPS retain the savings; 30 FPS is not guaranteed.

Identical tree canopy geometry now batches six layers into two instanced material meshes per chunk. Shape, materials, IDs, shaking, falling and collision remain intact. This also benefits ordinary mode. Village definitions are cached without caller sorting changing cached order, and distant workers no longer allocate offscreen models. Tree shaking/falling effects and dirty render records are limited to loaded chunks; distant harvesting still changes authoritative terrain and resources.

A fixed 60 Hz accumulator advances simulation independently of rendered frames. Held attacks, collection, workers, combat, weather, fuel and survival run on simulation steps, including skipped render callbacks. Catch-up is bounded to 250ms per callback rather than an unbounded spiral. Paused/hidden time never advances gameplay.

The counter measures completed WebGL render-call intervals over a rolling two-second window, publishing twice/second. Milliseconds are average intervals between renders, not GPU execution time. Hidden-tab gaps clear stale samples. Title/loading renders are excluded. The 30 FPS target is never substituted for measured FPS.

## Saves and limits

Exports use format 3; reads accept formats 1, 2 and 3 with the same local storage key. This explicitly versions generated-house resident references unsupported by old applications. Terrain generation remains 6; older generations retain geometry. Communities and journals also carry version 1. Missing community records initialize once on approach, or from a previously saved village furnace on Game restoration. Existing fuel, camp/player stores, NPC trading stock, damage and guards remain.

Intentional current limits: lazy activation, fixed village populations, finite initial provisions and no offline wall-clock simulation. Dynamic founding, politics, freehand routes and reconstruction economies are not implemented. Browser checks use headless Edge/touch emulation; physical low-end devices and long-duration endurance are not claimed. Actual command results and profiling measurements follow.


## Measured rendering results

Initial pre-change constrained observation: 16.6 render FPS, median renderer work 52.9ms. The controlled final comparison used the same paused camp scene in headless Edge, seed 42, zoom 34, 1280x800 viewport, device pixel ratio 1.5 and DevTools 4x CPU throttling. Each final sample lasted eight seconds after warm-up; storm intensity was explicitly settled at full strength. Pausing isolates rendering cost and does not benchmark active combat or mass-population load.

| Scene | Budget off FPS | Budget on FPS | Median renderer work, off/on | 95th percentile, off/on |
| --- | ---: | ---: | ---: | ---: |
| Clear | 21.30 | 29.84 | 38.3 / 24.2 ms | 50.3 / 34.8 ms |
| Blizzard | 26.95 | 29.49 | 30.3 / 22.4 ms | 36.3 / 34.2 ms |

The counter's last two-second readings were 29.60 versus independently sampled 29.65 FPS in clear Budget mode, and 29.51 versus 29.40 in storm Budget mode. Measurements count completed WebGL render calls, not monitor scan-out. Shadow refresh frames naturally have more draws than intervening frames; a single frame's draw count is not an average. These environment-specific observations do not guarantee 30 FPS on physical devices. Reproduce with `npm.cmd run test:performance`; raw samples are in ignored `test-results/render-performance.json`.

## Functional command record

- `npm.cmd test`: the clean baseline passed 148 tests. The final run passed all 174 tests with zero failures; the log is `test-results/community-regression-final.log`.
- `npm.cmd run typecheck` and `npm.cmd run build`: passed.
- `npx.cmd tsx --test tests/communities.test.ts tests/map-performance.test.ts`: focused village, journal and timing checks passed during incremental verification.
- `node tests/browser.mjs`: passed movement, gathering, fuel, construction, trade, storage, full/sandbox imports, invalid-import preservation, map, settings, pause and touch.
- `node tests/foundation.mjs`: passed seed zero, outer-chunk resources, merged canopy counts/extents, keyboard/mouse and native touch controls.
- `node tests/worker-harvest.mjs`: passed real forest/boulder paths, axes/pickaxes, staged harvesting and physical delivery.
- `node tests/guard-shelter.mjs`: passed injured guard retreat/hiding, ruin ejection and return to defense.
- `node tests/seed-hud.mjs`: passed text/Uint32 seeds, JSON limits/imports, day/night/weather and mobile HUD.
- `node tests/balance-night.mjs`: passed economy, weapon/food behavior, worker inspection, fixed-distance fog, map weather and torch.
- `node tests/community-map-performance.mjs`: passed community models/ledger, marker/route CRUD, chart bounds/fog restrictions, saved preferences, reversible graphics, FPS display and native touch marker/route operations.
- `node tests/production.mjs`: passed production gameplay/UI, input/pause, excluded development hooks and graceful WebGL failure.
- `npm.cmd run test:performance`: all four constrained measurements and FPS-counter comparisons passed.
- `git diff --check`: passed.

Intermediate checks caught and corrected a shelter transition/retry regression, an out-of-territory guard fixture, stale generation-5 and seven-tree-mesh assertions, letterboxed chart click coordinates, a resident spawn overlapping its furnace and a security countdown phase issue on reload. These are corrected failures, not outstanding passing claims. Physical hardware and endurance verification remain outside this automated run.
