# FYWS: Frostbound implementation plan and feature audit

Authoritative source: [PROJECT_SPEC.md](PROJECT_SPEC.md), a byte-identical copy of the supplied `D:/Downloads/Instructions.md` (1,427 lines; SHA-256 `5f89b9f508d7ebf64180e2aa0f39e2f73ecb58bcdc6246ba2b6b5c06e07a87e3`). The document defines project requirements; the current user request limits this cycle to inspection, planning and Phase 1. It does not request all phases at once.

Inspection started from clean commit `80e72ca`. There were no uncommitted changes and no Git remotes. The active stack already matches the brief: TypeScript, Three.js, Vite and DOM/CSS. The archived Phaser prototype is inactive. Baseline: 20 automated tests passed and `npm run build` passed. No engine migration or dependency replacement is warranted.

## Incremental plan

1. **Phase 1, current cycle:** preserve and verify the 3D foundation; align identity; separate RNG streams with legacy compatibility; improve camera/movement input and resource rendering; add focused regressions; run every available suite and build.
2. **Phase 2:** review economy, furnace, workers and survival. Correct furnace model indexing to the new explicit level-5/10/15 rule; retain stored state.
3. **Phase 3:** audit river crossings, settlement placement, chunks, stable IDs and persistent exploration changes across seed/configuration ranges.
4. **Phase 4:** review combat collision/range, damage and death handling; complete fixed weapon slots, F/pickup and aim controls with desktop/touch tests.
5. **Phase 5:** review trader inventory policy, guard hostility and territory, village defense and persistence; restrict equipment drops to eligible hostiles.
6. **Phase 6:** review encounter pressure and limits, weather/fire timing, eligible wooden-building and stockpile burning, charcoal conversion and persistence.
7. **Phase 7:** audit JSON schema completeness, permitted sandbox settings, limits, malformed imports and migrations against the full brief.
8. **Phase 8:** refine HUD, hotbar, feedback, accessibility, responsive layouts and simulation/rendering performance; complete pinch zoom and UI toggles.
9. **Phase 9:** clean-checkout validation, license selection and attribution review, release documentation and public repository preparation. Remote publication and Windows packaging are separate later work.

Each phase inspects existing behavior first, makes focused changes, and verifies them before proceeding. Existing systems from later phases remain playable; their presence is not a claim of full compliance.

## Existing feature audit

| Area | Existing implementation inspected | Findings and current action |
| --- | --- | --- |
| Architecture / local runtime | `main.ts`, package/lockfile, Vite/TS config, renderer, game state, UI and systems | Suitable Three.js architecture already exists. Retain it. `Game` and `App` have broad responsibilities; split when a concrete change requires it rather than creating empty modules. |
| 3D visuals / chunks | `Renderer`, `WorldManager` | Terrain, trees, rocks, snow, follow camera, orbit, zoom, instancing and chunk disposal exist. Fixed resource props disappearing in outer rendered chunks by querying each chunk's own nodes. |
| Movement / input | `Game.update/move`, `App` pointer/keyboard handlers | Camera-relative movement and collision exist. Added configurable movement defaults, radial joystick dead zone, right-side touch orbit and complete held-input reset on blur/pause. Touch sprint now holds instead of toggles. Pinch and dedicated ranged aim remain pending. |
| Seeds / reproducibility | `GameConfig`, `SeededRNG`, generation and save callers | Six streams existed. Village guards and equipment drops shared wildlife. Generation 3 adds independent village and loot seeds; imports preserve generations 1/2 with legacy defaults. Six pre-change world fingerprints guard compatibility. |
| Gathering / HUD | `Game.gather`, node queries, resource definitions and HUD refresh | Wood/stone/metal collection and seven material totals exist. Preserve transactions and state. Rendering now reads nodes from the rendered chunk, including burned-tree charcoal. |
| Economy / survival / construction | `InventorySystem`, `SurvivalSystem`, `Game` methods, existing tests | Atomic balances, negative sandbox resources, fuel/warmth, 5-wood huts, workers, 30-wood upgrades and persistence already exist and pass baseline tests. Model tier is currently `(level-1)/5`; the new brief explicitly requires level 5, 10, 15. Schedule that correction for Phase 2. |
| Exploration / NPCs | `WorldManager`, `Game`, `Panels`, existing integration tests | Rivers, fishing, ruins, three fixed villages, traders, guards and village furnaces exist. Broader placement/territory and stock policy audits remain in Phases 3/5. |
| Combat / fire / weather | `CombatSystem`, weapon data, combat renderer/tests | Shared attacks, HP, wear, drops, bleed, fire zones, weather and charcoal exist. Inspection finds missing melee/shotgun occlusion, guard equipment-drop eligibility, per-hit spear rolls, and wooden-building/stockpile burning. These are later-phase gaps, not Phase 1 completion claims. |
| Saves / modding | `SaveSystem`, schemas/docs, existing tests | Editable full saves/sandbox JSON, failure-safe imports, format-1 migration and negative balances exist. Added strict generation-3 seeds with generation-1/2 fallback. Keep existing storage key and save format. Full schema/limit audit remains Phase 7. |
| Identity / release | package metadata, HTML title, workspace, README, Git config | Local identity is now FYWS-Frostbound; npm identifier is lowercase `fyws-frostbound`. Browser title is FYWS: Frostbound; game title stays Frostbound. Existing workspace filename and folder retained. No remote configured or renamed. License selection remains the owner's decision; MIT is a reasonable permissive option, not an applied license. |

## Phase 1 changes and verification

- Added `MovementInput.ts`; kept the working renderer and authoritative game state.
- Added village and loot seeds, generation-3 validation, legacy defaults and static-world compatibility fixtures captured before changing generation.
- Fixed outer-chunk resource rendering and held input/velocity reset; added joystick dead zone and native touch gesture checks.
- Updated local identity, README, save notes and this plan; copied the full authoritative brief without changing the original file.
- New simulation tests cover all eight seed fields, subsystem isolation, six legacy fingerprints, migration/drop consistency, analog movement, 30/60/120 FPS movement and distant chunk regeneration.
- New browser tests use native mouse/touch input for movement, orbit, zoom, dead zone, hold sprint, blur and typing isolation, and check resource meshes in outer chunks.

Final verification in this workspace:

| Command | Actual result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed: TypeScript and Vite production build |
| `npm.cmd test` | Passed: 27 tests, 0 failures (20 existing plus 7 foundation regressions) |
| `npm.cmd run test:browser` | Passed: movement, gathering, fuel, placement, saves/imports, map, fishing, ruins, trade, settings, pause and touch |
| `npm.cmd run test:ui` | Passed: inventory actions, quantities, atomic failure feedback, responsive portrait/landscape panels |
| `npm.cmd run test:combat` | Passed: attack/wear, weapon purchase, village storm renderer, mobile attack, no browser exceptions |
| `npm.cmd run test:foundation` | Passed: outer-chunk resource meshes, seed zero, native mouse/touch movement and orbit, zoom, typing isolation, dead zone, blur reset and hold sprint |
| `npm.cmd run test:production` | Passed: production UI/input/pause, no development hook, graceful WebGL failure |
| `git diff --check` | Passed |

Phase 1's navigable, reproducible 3D foundation is verified. Existing features remain available. Later phase compliance is explicitly pending; the next planned step is the Phase 2 economy/survival audit and furnace tier correction. No dependency upgrades, remote operations, license declaration or desktop packaging were performed. Physical mobile hardware, full-seed-space placement and endurance profiling are outside this Phase 1 pass.

## Subsequent user-directed presentation work

After the Phase 1 pass, the user requested investigation of browser flicker, replacement of the primitive player and weapons with an animated survivor, and world-to-HUD resource collection feedback. This is a separate authorized presentation increment, not a claim that Phases 2-9 are complete. The existing uncommitted Phase 1 changes were preserved. See [PRESENTATION.md](PRESENTATION.md) for model provenance, animation scope, collection semantics, flicker corrections and verification.

## Subsequent user-directed settlement and NPC work

The next requested increment adds settlement action feedback, original rigged NPC/enemy variants, clearer trading, bounded enemy steering and active owned-furnace combat protection. Furnace model milestones are now corrected to levels 5, 10, 15 and subsequent multiples of five. This does not complete the remaining Phase 2 audit or later phases. See [SETTLEMENT.md](SETTLEMENT.md) for behavior and verified results. The production build, 37 simulation tests and seven browser suites passed.

## Subsequent user-directed controls and recovery work

Movement-led facing, hit-based melee wear and blade poses, independently wrapped snowfall, persistent furnace binding, keyboard shortcuts and the revised death choices are implemented as another incremental change. The user clarified that Return to Home means the title menu and recovery loses half of both carried and stored supplies. See [RECOVERY.md](RECOVERY.md) for behavior, save compatibility, captures and actual verification. This does not claim the remaining roadmap phases are complete.

## Subsequent user-directed assisted attacks and hit feedback

Nearest-hostile assistance on left click/touch Attack, visible actual-damage numbers, shared blade sweep collision, projectile contact, one-hit durability/volley deduplication and the requested weapon buffs are implemented and tested. See [HITS.md](HITS.md) for behavior and results. The local commit also includes the earlier uncommitted foundation, presentation, settlement and recovery increments so the asset/runtime dependencies are complete. Remaining roadmap phases are still pending.

## Subsequent user-directed survival, resource and settlement expansion

Implemented in three checked increments: fresh-world/unarmed/healing/heat-debuff/respawn rules; timed collection and staged natural resources; and persistent building integrity, civilian sheltering and scattered village loot. The user clarified repeating healing and that weighted loot is scattered around villages. Buildings are bleed-immune; armed guards keep defending under the optional clarification default. See [EXPANSION.md](EXPANSION.md) for assumptions, save validation, behavior and verification. This does not mark the remaining original roadmap phases complete.

## User-directed communities, map tools and performance increment

The original roadmap remains historical; unrelated phases are not declared complete. This request authorizes persistent village names/economies/security, map notes/routes, targeted rendering options and measured FPS, followed by commit and push. Inspection started from clean `e4d0f6f` with Three.js and the existing origin retained.

Implemented stages: versioned naming/legacy fallbacks; persistent community records; reuse of harvesting/navigation/transactions; separate stores and level-5 furnace maintenance; shared combat patrols/retreat/distant simulation; charted marker/waypoint tools; profiling and tree draw-call batching; reversible Budget Meal Mode and independent simulation clock; measured FPS; format-3 exports with old-save reads. See [current behavior, limits and actual verification](COMMUNITIES_MAP_PERFORMANCE.md). Dynamic founding/politics, offline progression, unrelated planned controls and physical-device/endurance testing are not claimed.
