# Frostbound JSON format 2 / generations 1, 2 and 3

Both documents require `format: "frostbound"`, `formatVersion: 2`, `mode`, and `world`. JSON is parsed as data and never evaluated. UI strings from files are never inserted into HTML. Files over 12 MB, nonfinite/fractional resource numbers, invalid types, IDs, coordinates or unsupported versions are rejected before any state replacement.

## Shared `world`

```json
{
  "seed": 48192,
  "generationVersion": 3,
  "seeds": { "terrain": 100, "rivers": 200, "biomes": 300, "resources": 27341, "ruins": 400, "wildlife": 500, "villages": 600, "loot": 700 },
  "config": {
    "chunkSize": 32,
    "initialRegionSize": 256,
    "worldScale": 1,
    "riverDensity": 1,
    "ruinDensity": 1,
    "resourceDensity": 1
  }
}
```

The top-level seed and all eight stream seeds are unsigned 16-bit integers, including zero and 65535. Explicit stream seeds are authoritative: changing `world.seed` alone changes the displayed identifying seed, not the stored streams. Use **New World** to derive all streams from a different seed, or edit the individual streams deliberately. Generation is a function of the complete world specification, not the displayed seed alone.

Chunk size: integer 16–64; initial region: integer 64–4096; world scale: 0.5–4; densities: 0–3. Terrain samples are continuous world coordinates. Generated stable IDs include `node:chunkX:chunkZ:index`, `fish:chunkX:riverRow`, and `ruin:regionX:regionZ`. Regions for ruins are 128 units wide. Building IDs use `built:N`; workers refer to their hut ID. Coordinate addressing supports negatives.

## Common balances and settings

A balance is a complete object containing integer `wood`, `stone`, `meat`, `fish`, `metal`, `gold`, and `charcoal` values. Missing values are invalid. The inclusive default range is **−9,999,999 to 9,999,999**; negative values are valid, independent of debt settings. `null`, strings, fractions, NaN/infinity representations, and out-of-range values are not accepted.

```json
{
  "difficulty": "relaxed",
  "renderDistance": 2,
  "sound": true,
  "allowDebt": false,
  "inventoryLimit": 0,
  "resourceMin": -9999999,
  "resourceMax": 9999999
}
```

Difficulty is `relaxed` or `survival`; render distance is integer 1–3. Inventory limit is integer 0–9,999,999 (zero disables it). Custom resourceMin may be −9,999,999 through −1; resourceMax may be 1 through 9,999,999. Every imported balance, including NPC accounts, must fit those configured bounds. Debt controls *spending*, not whether a negative balance may be imported. Transactions commit all accounts or none.

## `mode: "sandbox-config"`

Required `startingState` fields:

| Field | Meaning |
| --- | --- |
| `resources` | Complete carried balance object |
| `stockpile` | Complete settlement balance object |
| `furnace` | `{ "level": 1, "fuel": 100 }`; level integer 1–25, fuel 0–3600 seconds |
| `settings` | Complete settings object above |

Import constructs a **new** home furnace, fresh player at `(0,4)` with 100 warmth, empty building/worker lists, empty mutable-world changes, and only home discovered. It then applies the specified balances, furnace and settings. It does not inspect an earlier world to fill missing fields. Unknown extra fields do not restore previous state. Export the result as a full save to preserve later play.

## `mode: "full-save"`

Required `state` fields:

| Field | Contents |
| --- | --- |
| `player` | `{x,z,warmth,heading}`; warmth 0–100, finite numeric heading |
| `inventory`, `stockpile` | Complete balance objects |
| `furnaces` | Array of `{id,x,z,fuel,level}`; first and unique home must be at 0,0 |
| `buildings` | Array of `{id,type,x,z,rotation}`; types `hut`, `storage`, `shelter`, `furnace` |
| `workers` | Array of `{id,hutId,x,z,sourceId,load,progress,state}` |
| `changes.nodes` | Stable resource ID → remaining amount (nonnegative integer) |
| `changes.fishing` | Stable fishing ID → total caught (nonnegative integer) |
| `changes.containers` | Searched ruin IDs |
| `changes.npcs` | Stable NPC ID → `{inventory: complete balance object}` |
| `discovered` | `home` or `ruin:regionX:regionZ` IDs |
| `elapsed` | Finite nonnegative simulation seconds |
| `nextId` | Integer counter greater than existing building numbers |
| `settings` | Complete settings object |

Every coordinate must be finite and within ±1,000,000. IDs must be short safe alphanumeric/colon/comma/underscore/dash strings, with no duplicate entity/furnace IDs or prototype-property keys. Each worker references a hut; one worker per hut is supported. A built furnace must have matching fuel state and location. Worker load is integer 0–3; progress is 0–100; states are `seeking`, `gathering`, `returning`, `blocked`. A sourceId is a stable node ID or null. Unsupported or inaccessible sources are handled by the simulation's search/blocked states.

Static terrain, trees and unmodified node amounts are regenerated; they are not serialized as meshes. Deltas above restore modifications regardless of render/cache eviction. Pending fishing animations, camera position and UI dialogs are transient; cancelling/closing them does not apply a catch or a trade.

## Confirmation and compatibility

1. Select the matching mode and file, or paste/edit JSON.
2. **Validate import** parses into a detached state and reports errors.
3. A separate **Confirm: replace active world** action commits the validated state.
4. Changing the text or mode invalidates that pending state. Closing the dialog cancels it.

Failure leaves the live state and existing local save unchanged. Successful import does not pretend to be a merge. Local autosave will subsequently save the imported world after active play; export the old world first if you want to retain it too.

Formats 1 and 2 are supported. Format 1 migrates with charcoal zero, full HP, and fresh combat equipment/state. Terrain generation 1 is preserved; generation 2 adds fixed, flattened villages. Unknown versions are rejected. Format 2 full saves additionally require player/worker/NPC HP, furnace charcoal energy, and validated combat state (actors, weapons, cooldowns, projectiles, fire zones, bleed, drops, encounters, burned trees/nodes, village hostility and weather). Sandbox equipment is optional and encounters always start fresh.

## Phase 1 generation compatibility

New worlds use generation 5 and require eight explicit unsigned 16-bit stream seeds. The village stream determines guard composition; the loot stream determines equipment drops. Neither changes terrain, rivers, vegetation or resource positions. Generation 4 moves villages to distant fixed sites; generations 1-4 preserve their original layouts. Save format remains 2 with backward-compatible optional state extensions.

Generations 1 and 2 still load. Missing `seeds.villages` and `seeds.loot` default to the saved wildlife seed, exactly matching the old algorithms. Explicit zero is preserved; null, fractional and out-of-range values are rejected. Generation 3 never silently fills missing seeds. Imported legacy worlds retain their generation version, layouts, changes and drop outcomes; export writes the normalized seed fields.

## Furnace-entry compatibility

Actor records may include optional boolean `heatInside`. New actors store it to preserve whether they are already inside the union of active player-owned heat circles. Older actors without the field initialize it from their current location when the Game is reconstructed, avoiding repeated entry damage on load. Invalid nonboolean values are rejected. Settlement animation events and steering velocity caches are transient and are never serialized.

## Recovery binding

Full-save state may include `respawnFurnaceId`, an entity ID that must reference an existing furnace. Missing values in earlier saves fall back to the starting home furnace. Sandbox imports start unbound at home. Format remains 2. Recovery restores health/warmth, clears player bleed, and halves positive carried and stored resource balances once; negative debts, equipment, buildings and world changes persist. The title-menu death action saves the defeated state, so reopening it presents the recovery choices. New World explicitly replaces the local slot.

## Swept-hit compatibility

Projectiles may additionally contain `weapon`, `weaponId`, `hitIds`, `volleyId` and `wearCharged`. These optional validated fields retain melee hit/durability deduplication and per-volley shotgun deduplication across saves. Missing fields remain accepted for older format-2 saves; old zero-damage swings/pellets finish as cosmetic effects. Bleed duration now accepts 0-10 seconds (old 0-5 values remain valid). Damage-number events and DOM effects are transient and never saved.

## Settlement and terrain expansion

Format 2 additionally accepts optional player `invulnerable` (0-5s) and `heatTime` (0-3s), `changes.terrain` (felled/broken stages), `changes.structures` (validated stage/HP), `changes.refuges` (known civilian/worker/guard and house, phase/position/timer), `changes.lootTaken` (unique generated village-pile IDs), and `changes.groundLoot` (validated persistent salvage). Missing fields default to empty records. Projectile `weapon` may be the action `punch`; equipment arrays still accept only real weapons. New state has an empty equipment array. Existing format-2 equipment persists when loaded. Pending gathering and falling-tree effects are not saved and cannot duplicate awards. Generated houses use stable `house:<settlement-id>:<index>` IDs. Intact and ruined structures remain in their original building/furnace records even after disappearance, with their stage stored separately; this preserves worker and furnace references.

Wilderness optional fields: actors can be `wolf` (50 HP) and may carry `pursuitId` and `retreating`; statuses may additionally contain `wolfBleed` (0-12 seconds) and `wolfTick` (0-1). Player `stunned` accepts 0-3 seconds, and `hypothermia` contains `level` (1 or 2), `waterTime` (0-5) and `tick` (0-3). Hypothermic imports cap current HP at 90. Older records remain valid. These effects persist across full saves and reset on new worlds/respawn.

Camp progression: furnace levels accept 1-50. Player `recentDamage` (0-3 seconds) and actor `heatBurn` (0-1) persist combat-healing/burning timers. Huts may have `construction` (0-10 seconds), and cannot contain workers until completion. Completed huts support up to two workers (legacy one-worker saves remain valid); each worker optionally stores `resource` (`wood`, `stone`, `fish`) for typed deliveries. Worker fishing consumes the same persistent `changes.fishing` availability as player fishing. Generation 5 adds independently seeded lakes and taller hills; prior terrain generations remain supported.
