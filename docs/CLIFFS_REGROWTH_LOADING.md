# Ore cliffs, tree regrowth and prepared world entry

## World and resources

Generation 6 adds deterministic 28-46-unit rocky cliffs outside the starting clearing, village footprints, ruins, rivers and lakes. Movement collision applies to players, workers and enemies; cliffs also block line of sight. Original faceted rock meshes have snow caps and visible strata. Nine finite ore deposits surround each base: three each of gold, stone and metal. Gold holds 4-8 units per deposit; stone/metal hold 8-14. Deposits are on dry ground outside the impassable footprint and use existing resource-specific mining timings and exact-once inventory awards. Cliff sites follow the terrain stream; deposit quantities follow the resource stream. The map shows gray, gold-rimmed cliffs beneath the existing night/storm visibility overlay.

Generation 1-5 saves remain supported and retain their terrain and sites. Start a generation-6 expedition to find cliffs; older worlds still gain regrowth, gold drops and prepared loading.

Bandits independently roll 25% for 0-4 gold. Zero is a valid outcome, so the chance of a nonempty gold pile is 20%. Gold uses persisted ground loot, ordinary pickup/capacity rules and the existing world-to-HUD feedback. The weapon roll and durability rules remain separate. Repeated damage to a defeated bandit cannot generate another pile.

## Renewable trees

Chopping or burning a standing tree leaves a stump. Its saved deadline is 1200 simulation seconds after felling. Mouse hover or touch shows a minutes/seconds countdown; paused games and loading do not advance it. Mature trees return even outside rendered chunks, restoring collision and another finite timber cycle. Completed timers are removed; consumed tree/log/charcoal depletion is reset only for the new cycle. Old ground timber/charcoal disappears when the tree returns; previously collected inventory is preserved. Stale log references cannot collect the previous cycle again.

Legacy felled/burned trees receive a fresh deadline on restoration. An intact building occupying the stump footprint defers growth and retries after 30 seconds. Due work is capped at eight trees and a soft three-millisecond budget per update (one already-started operation may exceed that budget). Large due batches therefore finish across frames rather than synchronously. No offline wall-clock growth is applied.

## Loading and frame work

World entry now displays real preparation progress. The simulation stays paused while the visible chunk region and one outer ring are prepared. At default distance this warms 49 chunk records and builds 25 visible meshes. Nearby character assets must be ready, and graphics programs are compiled before the HUD opens. Error feedback permits returning to the title without losing the active state. Returning to a warm world reuses its caches and yields less often.

During play the renderer builds one nearby chunk mesh per frame, prioritizes chunks nearest the player, and prefetches the next ring when no mesh is pending. Harvesting, felling and regrowth dirty their affected chunks rather than rebuilding the whole visible region. Bounded caches retain lake/cliff region membership; returned arrays remain independent so caller sorting cannot alter generation. Cache contents, loading progress and timing metrics are transient.

This reduces avoidable generation and rendering work; there is no guaranteed FPS target or measured before/after FPS claim. Final standalone headless Edge observations for seed 42: 49 prepared chunks in 1106.5 ms, maximum individual chunk preparation 16.4 ms, sampled post-load frame interval median 11.9 ms / 95th percentile 12.3 ms. Concurrent browser runs were slower. These are environment-specific observations, not physical-device benchmarks.

## Actual verification

- All 129 unit tests passed: generation and old-version compatibility, dry ore placement, collision/sight, finite mining and resource timings, tree deadlines, repeated harvest cycles, pause/save behavior, malformed-timer rejection, gold roll distribution, and duplicate-death prevention.
- TypeScript/Vite production build passed.
- Browser suites passed during this update: cliffs, browser, harvest, seeds, camp, expansion and production. Coverage includes real timed gold mining, actual stump picking/countdown/regrowth, exactly one rebuilt harvesting chunk, untouched loading survival clocks, 49-chunk preparation, shader/character readiness, mobile reduced-motion loading, imports/seed validation, worker chopping/mining and survival/building regressions.
- Browser fixtures now wait for asynchronous world entry, including confirmed replacements; invalid seed validation continues to stay on the title.
- Actual cliff, stump, desktop and mobile loading captures were visually inspected. Tests use headless Edge/touch emulation; no physical-device testing is claimed.
