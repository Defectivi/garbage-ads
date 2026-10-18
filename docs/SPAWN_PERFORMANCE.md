# Spawn-protection expiry performance

## Findings and implementation

The twelve-second protection boundary deferred several encounter regions until the same simulation step. Seed 42 creates 74 actors there. Spawning, steering and line-of-sight queries repeatedly reconstructed nine chunks of natural collision geometry, including bridge/cliff/village eligibility checks. Actor crowd checks repeatedly allocated lists and computed distances to distant actors. Projectile queries also rebuilt the same combat-unit list within an unchanged portion of a simulation step. Hostile character templates were first requested at this boundary.

This increment keeps the existing Three.js architecture and encounter rules:

- `NaturalChunkCache.ts` caches only immutable, seed-derived candidates per chunk using a WeakMap. Depletion, felling, charcoal, regrowth, fragments, shelters and building integrity remain live.
- `Game.ts` reuses those candidates. Optional conservative query bounds reduce AI collision and sight work; ordinary player movement still uses the original full collision query.
- `CombatSystem.ts` preserves spawn ordering, RNG use and all actors. It reuses actor references within a step, rejects obviously distant crowd candidates before the original exact checks, and reuses combat-unit snapshots only until movement or damage invalidates them. Snapshots are cleared in `finally` and never retained across simulation steps.
- `WorldManager.ts` retains recently queried chunks using a bounded 128-entry LRU cache. Cold preloading cannot continually evict frequently used collision chunks.
- `Renderer.ts` prepares bounded prospective collision neighborhoods during the paused loading screen, yielding between chunks and leaving cache headroom. `NPCCharacter.ts` prepares shared hostile model templates there too. This does not create actors, activate communities, explore terrain, spend fuel or advance protection time.

Protection remains twelve simulation seconds. Spawn counts, enemy intelligence, AI cadence, collision results, harvesting, combat, workers, hunger and fuel rules are unchanged. No saved fields, save-version change, dependency or external asset was added. Budget Meal Mode retains its separate rendering cap and existing simulation clock.

## Measurements

Headless Microsoft Edge, 1280 × 800, seed 42, normal graphics, DevTools 4× CPU throttling. These are constrained-browser results on the available computer, not physical low-end hardware measurements or a guaranteed frame rate.

| Measurement | Baseline | Final implementation |
| --- | ---: | ---: |
| Post-protection fixed-step update median | 301.8 ms | 18.1 ms |
| Post-protection fixed-step update p95 | 363.0 ms | 44.3 ms |
| Worst sampled fixed-step update | 667.9 ms | 204.4 ms |
| First actor renderer call | 66.6 ms | 65.3 ms |
| Live post-expiry rendering | 0.38 FPS | 4.62 FPS |
| Longest live transition frame gap | 2757.3 ms | 706.6 ms |

The fixed-step harness runs 80 identical 1/60-second updates around expiry, measuring updates separately from rendering. All 74 final actor IDs, types, HP and coordinates and all encounter keys match the baseline exactly. A separate unit replay compares complete game state with unrestricted collision queries and freshly rebuilt unit lists over 180 updates.

The live harness lets gameplay run normally and counts actual WebGL-drawing RAF callbacks. FPS is render count divided by the full observation window, including stalls; it is not the target FPS or the inverse of a median frame gap. The final sequential comparison used the previous commit's production build for the baseline and the development server for the updated implementation. Post-expiry windows were 5.30 seconds and 4.55 seconds respectively. The short windows and host/JIT/GC variability limit precision. Protection wall time was 18.85 seconds before and 13.24 seconds after; simulation protection still lasts twelve seconds. Severe throttling still produces substantial ongoing lag after enemies activate. This change reduces the spike; it does not establish smooth 30 FPS on every device.

During development, an instrumented wrapper initially failed to forward the optional collision-query radius; that was corrected before the final measurements above. Earlier live-harness runs failed because a short protected sampling window contained no draws, and because the baseline preview server had stopped. The final harness samples the full protected interval and saves results before assertions. These harness failures are not reported as passing game verification.

Raw measurements and reviewed runtime screenshots are in ignored `test-results/spawn-performance-*.json`, `spawn-live-*.json` and `spawn-live-*.png`. The optimized expiry screenshot shows the ready world, correct HUD and visible survivor/camp. This was review of a headless runtime capture, not physical-device or hands-on motion testing.

## Verification

The seven focused unit cases cover original collision equivalence, reduced repeated eligibility work, live terrain mutations/save reload, live shelter/building changes, state-free loading preparation, complete fixed-step replay equivalence, and bounded/LRU cache behavior. The two browser measurement scripts assert successful execution and actual rendering; they deliberately impose no universal FPS threshold.

Commands actually run from the repository root:

| Command | Result |
| --- | --- |
| `npx.cmd tsx --test tests/spawn-performance.test.ts` | Seven focused cases passed |
| `npx.cmd tsx --test tests/worker-harvest.test.ts` | Four worker cases passed |
| `npm.cmd test` | Final run: 188 passed, zero failed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed; Vite produced the production bundle |
| `node tests/spawn-performance.mjs` with `PERFORMANCE_LABEL=final` | Passed; fixed-step measurements above |
| `node tests/spawn-live.mjs` with `COMPARE_BASELINE_URL=http://localhost:4173` | Both baseline and updated live cases passed; measurements above |
| `npm.cmd run test:spawn` | Passed: protection expiry/respawn, furnace aura, storm visibility, bridges/water and touch HUD |
| `npm.cmd run test:cliffs` | Passed: paused loading, ready models/terrain, tree regrowth, cliff ore and touch loading |
| `npm.cmd run test:combat` | Passed |
| `npm.cmd run test:harvest` | Passed |
| `npm.cmd run test:communities` | Passed |
| `npm.cmd run test:rations` | Passed, including Budget Meal Mode harvesting |
| `npm.cmd run test:production` | Passed against the updated production build |
| `git diff --check` | Passed |

The first full unit run passed 187 of 188 cases. Its blocked-boulder test mutated a chunk's source array after that immutable chunk had already been queried. The fixture now supplies a replacement chunk with the additional reachable resource, matching how generation/cache replacement works; the worker behavior assertions are unchanged. Its focused rerun and the full rerun passed. The failed run was not counted as a successful verification.
