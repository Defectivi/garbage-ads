# Assisted attacks, swept hits and damage feedback

This user-directed increment follows the presentation, settlement, projectile and recovery work. It changes targeting, combat contact, balance and damage feedback without resetting world saves.

## Targeting

Movement still sets facing. Left mouse click (including held fire) and the touch Attack button select the nearest living hostile that is within the equipped weapon's usable reach, with ranged assistance capped at 12 world units. Peaceful guards are excluded, and walls/solids block assistance. The chosen hostile determines the attack heading; mouse hover alone does not rotate the player. Space remains a forward-facing attack. No available target falls back to forward fire. Cooldowns are respected before turning or attacking.

## Collision and durability

The old instant narrow melee cone is replaced by a sampled swept blade segment derived from the same `meleePath` function as the rendered arm/blade pose. Target body capsules include outfit width; bears use a heading-aligned long capsule that covers their torso and muzzle. Sampling across each time step prevents a low frame rate from skipping a blade contact. A swing records already-hit IDs, follows its living owner, and can hit each unit once. Only the first successful enemy/guard hit consumes one durability from the actual attacking weapon; subsequent targets and bleed ticks do not charge additional wear. Hit state is saved during unfinished swings.

Arrows test the travel segment including shaft and arrowhead extent. Shotgun damage is applied by traveling pellets rather than the previous instant cone. Five pellets share per-volley hit IDs, so multiple pellets contacting one unit do not multiply damage, while different units in the fan can be hit. Bottle/character contact checks the shared rendered arc height; a contact creates fire at impact and applies 3 initial damage. An airborne bottle passing above a character does not count as body contact. Molotov fire still burns for 10 seconds. These are game collision volumes aligned with the assets, not pixel/triangle-level collision.

## Balance

| Weapon | Current damage |
| --- | --- |
| Wooden sword | 10 per hit; 1s cooldown |
| Machete | 25 on contact; 2 HP/sec bleed for 10 seconds; 1.5s cooldown |
| Shotgun | `round(12 + 83 * (1 - clamp(distance, 0, 3) / 3))`: 95 at zero distance, 12 at 3 units; 4s cooldown |

Other weapon damage, HP, furnace defense and unlimited ammunition rules remain as configured. Machete contact refreshes bleed; it does not stack independent bleed instances. Bleed ticks count only elapsed bleed time, avoiding extra damage from a large final update.

## Damage numbers

The authoritative damage function emits a bounded queue with actual HP lost, after furnace protection and remaining-HP clamping. The UI projects numbers at the damaged unit, uses amber for other units and coral for incoming damage/bleed, and removes completed numbers after one second. At most 32 numbers render and at most 64 events queue. Reduced motion keeps readable numbers without upward travel and clears them after 600ms. Effects have no access to inventory, HP or damage transactions and are cleared when changing world or opening panels.

## Verification

51 simulation tests pass, including assisted targeting/range/blockers, side-of-sweep hits, actual rendered blade tip positions, one wear charge for multiple targets, pellet contact/falloff/deduplication, arrowhead and bottle contact, actual damage reporting, queue limits and mid-swing save/load. All ten browser suites passed: hits, projectiles, recovery, presentation, foundation, browser, UI, combat, settlement and production. After adding a final bear-muzzle coverage regression, the build and all 51 tests passed again; focused hit, combat and production browser checks were repeated. `git diff --check` passed. Mobile checks use touch emulation; physical hardware and long-duration profiling were not performed.

Actual captures: [desktop damage](screenshots/damage-desktop.png) and [touch damage](screenshots/damage-mobile.png).
