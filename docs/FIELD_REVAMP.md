# Worker actions, generation 7 and expedition settings

## Inspection and scope

Workers still played the old generic gather clip with a tool attached. They did not use the player's task-driven downward pose. Sword rendering and collision shared a horizontal waist sweep. Ranged grips existed, but NPC grips lacked the player's release/recoil details. Procedural overrides needed restoration before subsequent mixer samples to avoid accumulated arm poses.

Rivers were sinusoidal east/west rows. Existing terrain noise and small ridges produced undulations rather than discrete broad mountain features. Bridge centers were filtered when rendering trees, but bridge approaches/canopies and steep ground were not consistently excluded.

Settings used the inherited light modal palette inside a title screen with light text, producing poor contrast. Its label “Difficulty” actually controlled only defeat at zero warmth. The real Easy/Normal/Hard expedition rules already existed in the title setup and are fixed when the world is created. Title utilities were small text buttons with little explanation.

The implementation retains Three.js, local generated models, inventory transactions, harvesting durations/yields, weapon damage/cooldowns/durability and fixed simulation timing. No dependency or remote asset was added.

## Actions

`HarvestPose` is shared between player and worker rigs. Worker phase comes from authoritative worker progress and the existing resource duration; it never awards resources. Both hands follow the attached axe/pickaxe through the same wind-up and downward strike. Paused workers retain their sampled pose. Leaving work, sheltering or changing tools restores the procedural arm overrides before sampling another action.

`ActionPose` supplies common arm restoration and bow release, shotgun recoil/muzzle flash and Molotov throw poses. Player and human NPC rigs use the same helpers. Animal attack clips remain intact. Projectile creation and damage remain in `CombatSystem`.

Sword/machete motion now raises beside the shoulder, cuts diagonally down and forward, and recovers. `CombatGeometry.meleePath` remains the single path for both rendering and swept contact. Spear thrusts and punches retain their existing paths. Damage values, attack durations, successful-hit wear and one-hit-per-target rules are unchanged; the blade's requested new trajectory changes its contact shape.

## Terrain and compatibility

New worlds use **generation 7**. Existing saves keep generations 1–6; loading never silently upgrades their terrain or regenerates their resource IDs. Save format remains 3, with the same old-save readers. Validation explicitly accepts generation 6 as well as 7. Golden generation-6 samples were captured from commit `331fb8d` before these generator changes.

Generation 7 combines existing meandering rivers with a seeded oblique tributary family. Channels can cross. Terrain, water rendering, fishing-bank selection, hypothermia, maps and bridges consult the same channel functions. Bridges use suitable regular crossings; junctions without safe bank clearance have no bridge. This is a deterministic procedural network, not a fluid or watershed simulation.

`Highlands` adds regional elongated mountain masses and lower foothills. Mountain contributions range from 32–66 height units before existing home/village flattening, river carving and overlapping terrain contributions. Existing unclimbable ore cliffs remain separate. Smooth elevation supports ordinary terrain navigation and line-of-sight checks.

Steep faces expose restrained slate rock using the terrain normals already computed during chunk construction. This adds no terrain draw calls or per-frame height queries. Fishing posts that would fall inside another channel at a new junction are omitted.

Trees require gentle ground (gradient at most 0.3, approximately 17°) in generation 7. Bridge footprints receive 1.6 units of vegetation clearance in all versions. Rendering, collectible tree candidates and map vegetation share the eligibility rule. Old chunk tree arrays and stable IDs are retained; covered bridge vegetation is omitted rather than renumbered. Tree regrowth reuses eligible original tree locations.

Seed-only highland regions, river samples and height samples have bounded caches. Mutable depletion, construction and community state remain outside these caches. Loading-screen preparation and the previous conservative collision caches remain active.

## Interface

Settings now has a scoped dark palette, larger labels and descriptions, numbered Survival/Graphics/Sound/Sandbox sections, native keyboard/touch controls and an always-reachable Apply area. Budget Meal Mode, measured FPS, distance, sound, inventory limits and resource-debt settings retain their existing validation and persistence fields.

The expedition card displays the world's actual difficulty and permanent hardship. Its button returns to title setup to choose a difficulty for a **new** expedition; it does not modify an existing world's startup grants or enemy rules. The old relaxed/survival field is now accurately labeled **Cold exposure**, with explicit safe/lethal choices explaining its real effect. Both choices retain hunger, health and hostile threats.

The title's Expedition Desk has four labeled actions with descriptions and touch targets: local load, full-world import, sandbox-configuration import and settings. Existing save/import confirmation rules remain in place.

## Changed systems

- `rendering/HarvestPose`, `ActionPose`, `PlayerCharacter`, `NPCCharacter`, `MeleePose`, `WeaponModels`, `Renderer`, and `game/CombatGeometry`: shared task/attack poses, restoration, impact geometry and cosmetic feedback. Bone references and snapshot quaternions are reused between frames.
- `world/WorldManager`, `Highlands`, `NaturalChunkCache`, `game/GameConfig`, `systems/SaveSystem`, `ui/MapPainter`: versioned terrain, bounded immutable caches, vegetation, shared water rules, validation and map compatibility.
- `ui/SettingsUI`, `Panels`, `App`, `styles/main.css`: settings structure/palette, truthful difficulty controls and expedition utilities. Light title-screen save/confirmation dialogs now explicitly use the dark text palette instead of inheriting the title's light text.
- Focused field-revamp unit/browser tests, generation-6 fixtures, updated foundation/recovery/worker fixtures, scripts and documentation.

## Verification

Commands actually run from the repository root:

| Command | Result |
| --- | --- |
| `npm.cmd test` | Final run: **194 passed**, zero failed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run test:field-revamp` | Passed, including the final player hurt/recoil interruption check |
| `npm.cmd run test:harvest` | Passed, including rerun after pose snapshot reuse |
| `npm.cmd run test:rations` | Passed, including Budget Meal Mode harvesting and exact yields |
| `npm.cmd run test:hits` | Passed |
| `npm.cmd run test:combat` | Passed |
| `npm.cmd run test:spawn` | Passed: expiry/respawn, bridges/water, storm fog and touch HUD |
| `npm.cmd run test:cliffs` | Passed: loading remains paused, regrowth, ores and responsive loading |
| `npm.cmd run test:communities` | Passed, including rerun: ledger, residents, map CRUD/fog and saved graphics preferences |
| `npm.cmd run test:difficulty` | Passed, including rerun: desktop/touch modes, hardships, loadouts and saved world difficulty |
| `npm.cmd run test:escape` | Passed |
| `npm.cmd run test:ui` | Passed: inventory, food, storage, invalid actions and touch layouts |
| `npm.cmd run test:production` | Passed against the final build: game/input/pause, no development hook, graceful WebGL failure |
| `node tests/spawn-performance.mjs` with `PERFORMANCE_LABEL=generation7` and `generation7-bridge-bounds` | Both isolated probes passed; identical final actor states/encounter keys |
| `git diff --check` | Passed |

Focused development commands included `npx.cmd tsx --test tests/hits.test.ts tests/recovery.test.ts tests/worker-harvest.test.ts`, `npx.cmd tsx --test tests/field-revamp.test.ts tests/worker-harvest.test.ts`, and direct `node tests/field-revamp.mjs` runs. The first broad unit run passed 183/188: stale generation/horizontal-motion expectations were updated, synthetic worker fixtures explicitly opt into their artificial tree eligibility (including reload), and a real backwards-contact regression from the first blade path was corrected by keeping the hand forward during the wind-up. All original assisted-target/peaceful-guard and visible-blade contact assertions pass in the final run. An early browser action fixture reused the same attack stamp for successive weapons; it now supplies distinct attack events. Failed development runs are not counted as successful verification.

The six added unit cases cover generation-6 fingerprints, actual channel intersections and dry bridge rules, significant mountain relief and slope/bridge vegetation exclusion across three seeds, save/load generations 1–7, four-facing shared tool poses/interruption cleanup, and shared ranged/throw grips and effects. The final full suite also covers existing fixed-step timing, gathering yields, durability, communities, imports and map state.

Reviewed runtime captures include `settings-desktop.png`, `settings-390.png`, `settings-844.png`, `expedition-desk-*.png`, `workers-downward-impact.png`, `action-*.png`, `highlands-gameplay.png` and `tributary-intersection.png` in ignored `test-results/`. Review led to an opaque Apply area, a reachable close button, more clearance above the mobile title footer and slope rock shading. An initial terrain capture used a zoom beyond the gameplay limit and was replaced with a normal zoom. Worker/weapon captures use actual cloned rigs sampled at controlled phases; they are not a claim of hands-on motion or physical-device testing.

The existing loading browser check measured 3.95 seconds for seed 42 on this host during one run (49 terrain chunks and 65 collision chunks). This is an observation, not a before/after performance claim. A headless environment cannot establish smooth performance across low-end phones. Broad mountain masses and procedural river families are implemented; erosion, watershed flow simulation, terrain editing and a general animation-authoring tool are outside this increment.

The final isolated spawn probe used headless Edge, seed 42, 1280×800 and 4× DevTools CPU throttling. Across 62 post-protection fixed 1/60-second steps, update median/p95/worst were **21.9/36.8/127.6 ms**, with 74 actors and a 70 ms first actor-render call. The preceding generation-7 sample was 31.8/52.5/180.8 ms. Inspection identified bridge queries evaluating all river channels even far from a possible bridge; an early rejection now uses the exact existing lateral bound before querying channels. Final actors and encounter keys are identical between those probes, and the full 194-test suite passed again after this correction. These single-run CPU observations have host/JIT/GC variability, are not rendering FPS, and are not a fair comparison against generation 6's different world. They do not establish a guaranteed 30 FPS or eliminate constrained-device lag. Raw results remain in ignored `spawn-performance-generation7*.json` files.
