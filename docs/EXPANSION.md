# Furnace recovery, destructible settlements and natural gathering

This user-directed increment was implemented in three checked steps: survival/unarmed rules, three-second gathering and natural resources, then structures/civilian sheltering/scattered village supplies. The original specification remains in PROJECT_SPEC.md; the newer user requests described here supersede its earlier starting equipment and furnace-defense rules.

## New worlds and survival

New expeditions construct fresh state and immediately replace the local save. The home furnace starts at level 1; generated village furnaces also start at level 1. Player buildings, structure damage, chopped trees, broken boulders, shelter records and collected supplies do not carry over. The renderer clears old furnace geometry/reinforcements. Existing full saves retain their actual upgrades and equipment when explicitly loaded; configured sandbox imports continue honoring their chosen starting settings.

New players have no weapon and can punch for 2 HP with a one-second cooldown. Punches work with existing assisted targeting, actual-contact collision and damage numbers, without durability. The player/NPC rigs include a punch clip. Existing usable owned weapons remain available normally.

Inside any active furnace range, three uninterrupted seconds restore 25 HP, repeating every three seconds up to 100. Leaving an active range or extinguishing its heat resets the interval. Overlapping furnaces do not stack healing. Merely being near an unlit furnace does not heal. Dead players do not self-revive.

Hostiles inside an active player-owned heat zone retain the 10%-maximum-HP entry penalty, take twice subsequent damage (including fire and bleed) and move at half speed. The entry penalty itself is not doubled. Peaceful guards are excluded until hostile. Village heat heals the player but does not confer the player's owned-zone combat defenses. The player retains 50% incoming damage reduction in owned heat zones.

Every recovery restores five seconds of damage immunity, including fire/bleed/direct hits, and clears prior player bleed. The protection timer persists across full saves and pauses with simulation. The HUD shows remaining shield time and the next 25-HP healing interval.

## Gathering and natural resource stages

F / touch Interact starts a three-second gathering action. Repeated presses cannot stack simultaneous actions. Hold F to repeat after completion. Moving away, movement input, resource exhaustion or attacking cancels a pending action without an award. Pause freezes progress; loading a save cancels this transient action. Actual awards still occur once through the atomic collection function and reuse world-to-HUD feedback.

Standing decorative conifers are gatherable. Completing a chop records the tree as felled, removes its standing collision/instances, plays a short falling-tree effect and exposes a finite log supply of `3 + floor(tree scale * 2)` wood. Gathering each wood from that supply takes another three seconds. Workers can also fell trees and collect their logs when choosing nearby wood sources; their gather interval is three seconds.

Tree instances visibly shake while chopping. Supported devices receive a short vibration on a chopping interaction. Reduced motion skips shaking, falling motion and haptics; the authoritative felling/log transition remains identical. Falling-tree effects are capped at eight and disposed on completion/world replacement.

A deterministic third of nonstarter stone nodes are large boulders, with larger geometry and blocking collision. Breaking one takes three seconds and exposes three smaller stone fragments. Their quantities sum to the remaining original deposit, including partially depleted older saves. Each fragment resource collection takes three seconds. The guaranteed starter stone remains a small accessible deposit. Tree/rock stages and remaining quantities persist through chunk eviction and save/load. Fire converts remaining timber instead of duplicating a chopped tree's resources.

## Buildings and civilians

| Type | Intact HP | Ruined HP | Salvage after destroying the ruin |
| --- | --- | --- | --- |
| Worker hut / village house | 1,000 | 250 | 1 wood + 1 stone |
| Storehouse | 2,000 | 500 | 2 wood + 2 stone |
| Trail shelter | 500 | 125 | 1 wood + 1 stone |
| Furnace | 1,500 | 375 | 3 wood + 3 stone |

Hut and storehouse HP match the explicit request; shelter/furnace HP and salvage scaling use the defaults shown above. At zero intact HP a building becomes its type's ruined model with 25% maximum HP. Overkill does not skip that second stage. Destroying the ruin removes its collision/model and creates one persistent salvage pile. Looting that pile awards its resources once through inventory transactions. Buildings ignore bleed ticks and cannot acquire bleed status; direct machete hits still damage them. They can be struck by normal combat and fire. Integrity bars and nearby structure status show actual health/stage.

Only intact huts support their workers; only intact storehouses add capacity or accept storage interactions. Ruined/destroyed furnaces lose fuel and heat. Furnace/save records and worker identities are retained as soft-deleted structures for compatibility. A destroyed bound furnace falls back to an intact furnace during recovery when available.

Damaged civilian traders, workers and village guards move to a nearby intact house (workers prefer their own hut), enter shelter, and disappear from exposed combat targets. They wait 12 seconds and then walk back. A ruined house ejects its occupants. Sheltered traders cannot trade until they return. Injured guards stop attacking while retreating, hiding and returning; healthy guards keep defending. Guards resume defense after returning, and attacking a guard still alerts the village. Enemies retain their roaming/combat behavior. The changes do not introduce an additional ordinary-villager population beyond the game's existing civilians and workers.

## Scattered village loot

Six persistent supply piles appear around each fixed village. Each pile independently rolls:

- 50%: a meat or fish stack.
- 40%: wood, stone, metal or gold.
- 10%: one random weapon from the six weapon types, with 100 uses.

These supplies are scattered in the village, not dropped by NPCs. Weapon pickup equips it. The existing separate enemy equipment-drop rule is preserved. Material/food stacks contain 2-4 units. There is no forced weapon guarantee in each village, preserving the requested probabilities. Failed capacity checks leave the pile intact; collected piles remain collected after reload. Salvage uses the same pickup flow. Supply pickup is immediate; the three-second work action applies to harvesting natural nodes.

## Save compatibility and verification

Format 2 accepts optional player `invulnerable` and `heatTime` timers; optional terrain stages, structure integrity, civilian/guard refuge records, looted-pile IDs and salvage piles in `changes`; and the projectile-only `punch` action. Equipment still accepts only actual weapon types. New records are validated before import replaces the world. Existing saves without these fields receive default empty records, preserving earlier generated layout/depletion and owned equipment. Pending gather actions, path caches, haptics and falling meshes are cosmetic/transient and never serialized.

The production build and all 62 simulation tests pass. The focused browser expansion suite passed timed collection, healing, unarmed start, both building HP/stages, bleed immunity, civilian sheltering, tree shake/fall/logs, boulder fragments, village weapon pickup, shield, new-world visual/save reset and reduced-motion touch gathering. All eleven browser suites passed across the regression pass and focused reruns: expansion, hits, projectiles, recovery, presentation, foundation, browser, UI, combat, settlement and production. The foundation mesh-count check now verifies harvestable standing trees separately from scattered resources. After the final wall-entry collision regression, the build and 62 tests passed again, followed by repeated expansion/projectile/combat/production browser checks. `git diff --check` passed. Mobile vibration depends on device/browser support; automated checks use touch emulation rather than physical phones.

Verified captures: [ruined structures](screenshots/expansion-ruins.png), [falling tree](screenshots/expansion-tree.png), [large boulder](screenshots/expansion-boulder.png), [stone fragments](screenshots/expansion-fragments.png), [village shelter and supplies](screenshots/expansion-village.png), [touch gathering](screenshots/expansion-mobile.png).

## Injured guard clarification

Injured village guards now share house refuge behavior with civilians and workers. Their combat and melee swings stop during retreat/return, their actor position follows the refuge path, and their model and exposed combat target disappear only once sheltered. Healthy guards continue defending. Village retaliation remains active when the player attacks. Guard refuge records round-trip through format-2 saves; hostile enemy refuge imports remain invalid.

Validation: production build and all 64 simulation tests passed. Browser guard shelter, combat, expansion and production suites passed, including model visibility, house destruction, return to duty and existing touch gathering/combat paths.
