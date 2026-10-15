# Frostbound JSON format 2 / generations 1 and 2

Both documents require `format: "frostbound"`, `formatVersion: 2`, `mode`, and `world`. JSON is parsed as data and never evaluated. UI strings from files are never inserted into HTML. Files over 12 MB, nonfinite/fractional resource numbers, invalid types, IDs, coordinates or unsupported versions are rejected before any state replacement.

## Shared `world`

```json
{
  "seed": 48192,
  "generationVersion": 1,
  "seeds": { "terrain": 100, "rivers": 200, "biomes": 300, "resources": 27341, "ruins": 400, "wildlife": 500 },
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

The top-level seed and all six stream seeds are unsigned 16-bit integers, including zero and 65535. Explicit stream seeds are authoritative: changing `world.seed` alone changes the displayed identifying seed, not the stored streams. Use **New World** to derive all streams from a different seed, or edit the individual streams deliberately. Generation is a function of the complete world specification, not the displayed seed alone.

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
