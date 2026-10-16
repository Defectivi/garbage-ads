# Settlement feedback, characters, trading and furnace defense

This user-directed increment preserves the earlier Phase 1 and player-presentation work. It adds real transaction feedback, replaces remaining primitive character builders, clarifies trading and changes the requested combat rules. It does not claim that all roadmap phases are complete.

## Supply feedback

Successful fueling, furnace upgrades and building placement emit transient `SettlementEvent` records after the atomic resource transaction commits. Failed or cancelled actions emit no effect and spend nothing. Events stay out of save JSON and the queue is capped at 24.

Cost icons travel from the relevant HUD resource counter to the world target. Costs paid from camp storage start at the Rucksack control and are labeled as stores; mixed costs split into separate carried/stored flights. A world receipt then rises and travels toward the furnace-fuel status or Build control. Fuel receipts show the fuel gain, upgrades show the resulting level and +8 heat range, and houses/buildings show their actual completed name. Build-panel fuel/upgrade actions close the panel after success so the world feedback remains visible. There is no additional charge when a flight arrives.

The existing 12-flight cap, cleanup and reduced-motion preference apply to both collections and spending. Authoritative balances and structures change immediately. Travel and number/status accents are cosmetic.

Furnace appearance now follows the explicit specification: `floor(level / 5)`, changing at levels 5, 10, 15, 20 and 25. Fuel and other state are retained.

## Original character library

All character models are original source-authored assets; no third-party model or new package was downloaded. The existing project-license decision remains unchanged. Regenerate local GLBs with `npm.cmd run asset:survivor`.

| Role | Prepared appearances | Live integration |
| --- | --- | --- |
| Traders | Mara, Ivo, Nell | Existing village/ruin traders |
| Workers | Copper, Slate | Recruited hut workers |
| Additional residents | Moss, Plum | Prepared for additional ordinary residents; no new simulated resident population is claimed |
| Guards | Watch, Warden | Existing village guards |
| Bandits | Ash, Rust, Frost | Existing roaming groups |
| Arsonists | Ember, Cinder | Existing Molotov enemies |
| Polar bears | Ivory, Frost | Existing wildlife |

There are 14 humanoid NPC appearances and 2 bear models, in addition to the player. Humanoids share the working 17-bone survivor rig with distinct palettes, proportions, headwear and gear: caps, open-front hoods, satchels, tools, guard panels and fuel packs. Bears use an original continuous contour quadruped mesh and a 10-bone rig with four articulated legs, a shoulder hump, muzzle, ears and paws. These replace the previous box/capsule NPC and sphere-built bear renderers.

`NPCCharacter` loads each template once, uses `SkeletonUtils.clone` for independent armatures, shares immutable mesh/material assets, and releases per-instance skeleton/weapon/mixer state on removal. Actual displacement selects idle/walk; real worker activity selects gathering; actual enemy attacks select the corresponding action. Human weapons use hand bones and bow/shotgun actions use the shared arm solver. NPC death retains the existing despawn behavior. These are stylized authored animations, not motion capture or full terrain-adaptive foot IK.

## Enemy movement

The old enemy steering called the general overlap-resolution movement routine. When an actor began inside a solid, collision correction could immediately eject it by more than its normal movement budget, then a second steering attempt could move it again. Placeholder legs also cycled when stationary. Together these produced the dashing/sliding look.

Enemy spawns now search for dry, unoccupied positions outside solids and the player. Enemy movement uses bounded candidate steps, acceleration, smooth heading changes, obstacle steering and group spacing. Even a legacy actor embedded in a building cannot jump more than its per-step movement budget. Chase speeds are 1.8 world units/sec for humanoids and 2.1 for bears; roaming remains 1.1. Cooldowns and specified damage/HP stay unchanged. Idle models stop walking, and each rig animates from actual movement.

## Furnace protection

An active **player-owned heat circle** means the home furnace or a player-built furnace with remaining wood/charcoal energy. Village furnaces continue to supply warmth but do not grant this player's combat defense. An extinguished furnace grants neither rule.

- The player takes **50% of incoming damage** while inside such a circle. The central damage method applies this to melee, projectiles, burning and bleeding. Fractional HP is retained: a 5-HP hit becomes 2.5 HP.
- A hostile enemy loses **10% of its maximum HP on entry**: bear 5, bandit 12.5, arsonist 7.5. A hostile guard loses 12.5; peaceful guards are not harmed.
- This is an entry penalty, not damage every frame or every second. An enemy must exit and re-enter to pay again. Overlapping owned circles count as one protected region.
- A 0.35-unit exit margin prevents boundary jitter from repeatedly charging entry damage. Expansion or activation of a heat circle can create a new entry.
- Actor `heatInside` is saved as an optional boolean. Older saves initialize missing flags from the actor's current location, so loading an already-inside actor does not inflict a free extra hit. Save format remains compatible with format 2.

The HUD explicitly displays furnace protection when active. Warmth, fuel consumption, sprint exposure, combat damage values and weapon durability continue through the existing systems.

## Trading

The trade modal uses readable navy panels, larger labels and separate Resources/Weapons tabs. The selected resource deal shows **You pay**, **You receive**, current holdings and trader stock. Only valid exchanges enable confirmation. Shortages identify the exact missing materials, and NPC stock/capacity/range failures preserve atomic behavior. Full balances remain available behind an optional disclosure.

The weapon tab shows the carried trading supplies, six clearly priced weapon cards, descriptions, 100-use durability and disabled/unavailable states. Buying explicitly equips the purchased weapon and refreshes affordability. Weapon supply remains explicitly unlimited as configured by the existing game; resource offers use real NPC inventories. Sandbox debt remains supported and is labeled when enabled.

## Verification

`npm.cmd test` now includes 37 tests. New cases exercise every damage source under protection, extinguished/village/player-owned furnaces, per-entry max-HP damage, overlap and save/legacy behavior, bounded movement and valid spawns, atomic settlement feedback, furnace model milestones, and all prepared rig structures.

`npm.cmd run test:settlement` exercises fueling, upgrading, hut placement, model tier five, disabled/unaffordable trades, successful barter and shotgun purchase, touch trading, reduced motion, rigged live residents and a rendered lineup of all 16 prepared NPC/enemy appearances. Actual captures are written under `test-results/`. Verified: production build, all 37 simulation tests, and all seven browser suites (settlement, presentation, foundation, browser, UI, combat and production) passed. `git diff --check` passed. Physical mobile hardware and long-duration profiling were not part of this increment.

Verified captures: [NPC and enemy lineup](screenshots/npc-lineup.png), [desktop trading](screenshots/trading-desktop.png), [mobile trading](screenshots/trading-mobile.png).

## Projectile identity correction

The subsequent report of enemies launching themselves exposed a separate bug from collision steering. `fireWeapon` spread the full firing actor into each projectile after assigning the new ID. The actor's ID overwrote that ID, so the shared renderer object cache moved the character along the projectile path. Shots now copy only the source coordinates, retaining unique IDs. Renderer cache keys also separate actors, projectiles, fires and drops, protecting against colliding IDs in older saves.

Original reusable projectile templates now include a wooden arrow with a steel head and three feathers, shotgun pellets with short tracers, a melee arc, and a tumbling Molotov with an original 64-by-64 glass/paper/soot texture and lit cloth wick. The same textured Molotov is held by characters. These code-authored assets use no downloaded artwork or added dependencies. Flight clones share bounded template geometry/materials; expired shots leave the scene. Existing weapon cadence, damage, durability and impact/fire logic remain unchanged.

Verified after this correction: production build; all 39 simulation tests; projectile, combat and production browser suites. The new `test:projectiles` suite checks three ranged enemy attacks across their flight paths, stationary shooters, legacy ID isolation, cleanup, desktop and touch layouts. The simulation regression passes complete actor and player objects through every weapon to prevent ID/field leakage. Actual projectile previews are in [projectile assets](screenshots/projectile-assets.png).
