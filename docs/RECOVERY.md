# Controls, melee, weather and recovery

This is a user-directed increment following the settlement and projectile corrections. Existing world generation, resource transactions, construction, trading and projectile identities are preserved.

## Facing and shortcuts

Movement input (camera-relative keyboard or joystick) controls facing. The last direction persists at rest. Attacks fire forward, including mouse click, Space and touch Attack; mouse movement and camera drag no longer choose targets or change player heading. CombatSystem no longer mutates player heading when firing.

| Control | Action |
| --- | --- |
| E | Inventory (I remains an alias) |
| F | World interaction; hold to gather |
| B | Build |
| M | Map |
| Shift+S | Immediate local save; consumes the S key so the chord does not move backward |
| P | Save/import/export panel |

Input fields retain normal typing. Touch inventory, interaction, building, map and save buttons remain available. Shift+S reserves that chord; use Shift+Down arrow for backward sprint.

## Melee

The hand socket originally left blades pointing back up toward the forearm, and the reused gather animation looked like a punch. Sword/machete rest orientation now points away from the forearm. A shared arm solver and explicit weapon orientation drive a broad horizontal chest-height sweep, with a shoulder turn and recovery. Spear uses a forward thrust. This applies to players and armed human NPCs; ranged weapon grips remain intact.

Melee swings retain their cooldown and animation on a miss but spend no durability. A swing that hits one or several enemies/guards spends exactly one use. NPCs/workers and timber do not count as enemy hits. Bleeding ticks do not spend additional durability. Ranged weapons still spend one use per shot. Enemy weapons remain unlimited.

## Weather

The old 180-point cloud moved and reset as one object using global time, causing a visible snap and flakes falling below the ground together. `SnowWeather` independently wraps flakes through a player-centered 88-by-88-by-44 volume. Wind, fall speed, particle count, size and opacity transition with storm intensity. A soft alpha sprite replaces square points, and zoom-aware fog keeps the survivor legible at high orbit distances. The sun dims during storms. Rendering uses up to 900 shared points, one draw call and one texture; reduced motion freezes flake travel and caps density at 220. Pause freezes weather simulation. Fuel still burns three times faster during snow and enemy detection retains its existing snow modifier.

## Furnaces and death choices

Interacting with a furnace immediately binds the respawn furnace, including village furnaces and unsuccessful fueling due to a shortage. Binding requires proximity and a living player; it persists in compatible full saves. The starting furnace is the fallback for earlier saves. The active bound furnace appears in the interaction prompt and on the death screen.

- **Go Back:** find dry, unoccupied ground near the bound furnace, restore 100 HP/warmth, clear player bleeding and remove half of every positive carried and stored resource balance. Remaining stacks round down (9 becomes 4); debts remain unchanged. Equipment and buildings remain. The recovery guard prevents repeated deductions. Recovery is saved locally; a failed local write is reported.
- **Return to Home:** save the complete defeated state and return to the title menu. Re-entering that world presents recovery choices. Save failure keeps the current death screen visible.
- **New World:** generate a fresh expedition using current settings and replace the local save before entering it. Save failure preserves the current world.

The new navy/amber death panel states the cause, recovery furnace and each consequence. It has no dismiss button, and Escape cannot bypass death. Buttons and content adapt to narrow touch screens.

## Verification

The build and 44 simulation tests pass. New tests cover facing, successful-hit wear, furnace binding and save compatibility, safe recovery and resource deductions, horizontal weapon transforms, and independently wrapped/reduced-motion snow. All nine browser suites passed across the completed regression run and focused reruns: recovery, projectiles, presentation, foundation, browser, UI, combat, settlement and production. The initial broad run had a mobile recovery tap timeout and a transient collection-flight wait timeout; focused reruns passed, and the mobile fixture now uses seed 42 and closes its desktop page first. The final build, 44 tests, recovery suite (including local-storage failure preservation) and production suite passed after the last changes. `git diff --check` passed. Mobile checks use touch emulation; physical hardware and endurance profiling were not performed.

Verified captures: [death screen](screenshots/death-desktop.png), [touch death screen](screenshots/death-mobile.png), [storm](screenshots/storm-reworked.png), [melee pose](screenshots/melee-machete.png).
