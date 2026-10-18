# Harvesting motion and field rations

This increment starts from clean commit `23aa276` and keeps the existing Three.js rig, procedural tool meshes, inventory transactions, survival simulation and save format.

## Root causes and changes

The player reused the generic `gather` attack clip, including chest yaw and wrist rotation, without aligning the tool's handle or cutting edge. Its 0.65-second pulses did not match the resource-specific task durations, and the tool disappeared as soon as the task completed. Starting a task also published the pickup timestamp; cancelling before the first rendered frame could therefore play a false completed-action gesture.

`HarvestMotion` now reads the live task's remaining simulation time. Axe and pickaxe poses use a raised wind-up, forward downward strike and 0.18-second cosmetic recovery. Longer ore actions use bounded repeated strikes, with the final strike at task completion. Existing arm IK positions both hands; the tool remains attached to HandR and its edge faces forward. Temporary bone overrides are restored before the next mixer update. Cancel, pause, stun, shelter, death and character reset discard the tool pose. The legacy pickup timestamp is now emitted only by a successful pickup, with obsolete start/repeat pulses removed.

No action waits for recovery: gathering remains wood **0.3s**, stone **0.7s**, metal **1.1s**, gold **2.2s**. Trees and boulders retain their separate breaking and collectible-piece stages. Yields, hit rules and weapon durability are unchanged. These are stylized rig poses, not surface-contact IK; the existing three-unit gathering reach is preserved.

Food already applied hunger and healing immediately through an atomic inventory transaction. However, the inventory replaced its success message with “Supplies updated.” Cooldown errors appeared in an inconspicuous status area, without a remaining-time readout. Menus pause the simulation, so leaving the rucksack open also froze the three-second cooldown.

The field-rations kit now appears before the material grids. It labels food, effects and carried quantities, shows current hunger/HP and low-hunger warnings, and displays the shared cooldown and its paused state. A Resume expedition button closes the rucksack. Success reports actual gains immediately in a sticky status area; the HUD toast is hidden while a dialog presents the same message. Keyboard focus returns to the activated food button. Unchanged live readouts are not rewritten repeatedly. The brief confirmation highlight respects reduced motion.

Fish remains **+2 hunger / +5 HP**, meat **+3 hunger / +5 HP**, with a shared **3-second simulation cooldown**. Hunger is restored before the current HP cap is applied. Existing rules allow eating when full, spending a portion with capped benefits; the UI explicitly explains this. Dead, nonfood, cooldown-blocked and unavailable-food actions reject without spending or applying effects. Empty packs cannot create meals through sandbox debt settings. There is no wall-clock cooldown bypass or delayed application of benefits.

## Changed files

- `src/rendering/HarvestPose.ts`, `PlayerCharacter.ts`: task-driven motion, rig attachment and restoration.
- `src/data/food.ts`, `src/game/Game.ts`: shared food values, validated consumption outcomes and corrected pickup cue.
- `src/ui/InventoryUI.ts`, `App.ts`, `src/styles/main.css`: ration controls, state synchronization, readable feedback and responsive/reduced-motion styling.
- `tests/harvest-food.test.ts`, `tests/harvest-food.mjs`, `package.json`: seven focused unit cases and the `test:rations` browser suite.
- `tests/presentation.mjs`, `tests/combat.mjs`, `tests/workshop-shelter.mjs`: current renderer/community/paused-pose fixtures.
- `README.md`, `docs/IMPLEMENTATION_PLAN.md`, this report: behavior and verification documentation.

There are no new saved fields, generation changes, dependencies or external assets. Existing `foodCooldown` continues to persist and pause through the survival system. Communities, navigation, map notes, furnace consumption and hunger drain are unchanged.

## Verification

Commands actually run from the repository root:

| Command | Result |
| --- | --- |
| `npm.cmd test` | 181 tests passed, 0 failed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run test:rations` | Passed |
| `npm.cmd run test:presentation` | Passed, including final pickup-cue rerun |
| `npm.cmd run test:ui` | Passed, including native emulated touch eating |
| `npm.cmd run test:combat` | Passed |
| `npm.cmd run test:night` | Passed |
| `npm.cmd run test:workshop` | Passed |
| `npm.cmd run test:communities` | Passed |
| `npm.cmd run test:harvest` | Passed |
| `npm.cmd run test:production` | Passed against the final production build |
| `git diff --check` | Passed |

Focused development commands also included `npx.cmd tsx --test tests/harvest-food.test.ts`, the direct `node tests/harvest-food.mjs` equivalent, and `npx.cmd tsx --test --test-name-pattern="before its first render" tests/harvest-food.test.ts`. The quick-cancel regression failed before the pickup-cue correction and passes in the final unit run. Early focused runs also exposed an oblique pickaxe path, test time advancement exceeding Game's per-step cap, and a floating-point exact-zero assertion; those were corrected before the full passing run.

Initial broader runs failed on stale fixtures: fourteen render updates no longer refreshed all twenty-five chunks; a touch pickup fixture relied on proximity instead of the intended loose pile; combat assumed a stationary trader and a hardcoded village furnace ID; the old workshop check expected a harvesting tool to stay visible after pausing. Fixtures now explicitly select the intended source, initialize/isolate the trading community, use its actual furnace identity, allow one update per rendered chunk and verify paused-pose cleanup. These failures and corrected reruns are retained in ignored `test-results/harvest-food-*.log` files.

The new browser suite uses real generated trees, boulders and metal/gold ore at four facing directions. It checks wind-up, impact, recovery, cancellation, inventory interruption, exact awards, rapid food input, keyboard activation, cooldown expiry, HUD synchronization and empty-pack feedback. It also exercises harvesting through the actual Budget Meal Mode RAF loop. Fixed-step unit checks compare gathering yields/timing and meal eligibility with capped and uncapped render scheduling.

Runtime captures in `test-results/harvest-*.png` and `rations-*.png` were visually reviewed at normal and closer gameplay zooms and different orbit/facing directions. Review prompted clearer camera captures and removal of an overlapping HUD toast. The desktop and 390-pixel touch layout show effects, counts, paused cooldown and danger warnings. This is visual review of headless Edge runtime captures, not a claim of physical-device or hands-on human play testing. No new FPS improvement, low-end hardware benchmark, video-motion review or universal contact precision is claimed.
