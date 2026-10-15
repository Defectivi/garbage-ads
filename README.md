# Frostbound · Volume II

Repository name: **`frostbound`**. Open `frostbound.code-workspace` for that name in VS Code; the existing workspace directory stays in place.

A local, moddable **Three.js winter survival sandbox**. Explore beyond the furnace clearing, follow rivers, fish, discover ruined settlements, salvage chests, barter with traders, build a camp, and edit your world through portable JSON. There is no backend, login, monetization, or runtime asset download.

## Run

Node.js **20.19+ or 22.12+** is required.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. On Windows PowerShell with script restrictions, use `npm.cmd` instead of `npm`. Vite prints a LAN address for phone testing on the same network.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The built application is in `dist/`; preview serves it at **http://localhost:4173**. Serve it over HTTP rather than opening HTML directly. Dependencies are needed for installation; once built, all gameplay and assets work without contacting external services. This is not an installable service-worker PWA: keep a local server running to load/reload it offline.

## Start exploring

1. Enter a **world seed from 0 to 65535**, randomize it, or enter the current world.
2. **E** gathers resources within three units. Hold it to repeatedly gather timber, stone, or metal. Guaranteed wood and stone sources are beside home.
3. Approach a furnace and press E to burn **one wood for 60 seconds of fuel**. Heating rings indicate actual warmth recovery. Initial fuel lasts 100 seconds.
4. Open **Build**. A **hut costs 5 wood** and recruits a working woodcutter. Storehouses, trail shelters, and outpost furnaces have distinct functional effects. Preview, rotate, confirm or cancel construction.
5. The map gives a rumour of a generated settlement. Follow it, search the chest, and interact with the trader. Gold purchases and direct resource barter are supported.
6. Follow a riverbank to a **blue fishing post**. Interact and remain still for four seconds to catch fish. Fish can restore warmth or be traded.
7. Use **Save / JSON** to save locally, download full worlds, or create/import fresh sandbox starting configurations.

### Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Virtual joystick |
| Interact / gather | E; hold for resource gathering | Interact; hold for gathering |
| Orbit camera | Right-mouse drag | Drag on terrain |
| Zoom | Mouse wheel | + / − buttons |
| Inventory / storage / food | I or Inventory | Inventory |
| Construction | B or Build | Build |
| Rotate preview | R or Rotate | Rotate |
| Confirm placement | E or Confirm placement | Confirm placement |
| Map | M | Map |
| Save / import / export | P | Save / JSON |
| Close / cancel / pause | Escape | Close / Cancel / Menu |

Tap/click terrain to reposition a selected building preview. Placement is limited to 15 units from the survivor and rejects deep water, steep slopes, solid overlaps, occupied player space, the home delivery apron, and essential trader/chest/fishing access. Costs spend positive stored resources first, then carried resources. Failed/cancelled purchases do not spend anything.

The default **Relaxed exploration** mode loses warmth slowly and has no cold defeat. **Survival** makes exposure dangerous; a defeat dialog lets you recover at home without deleting your world. Furnaces, shelters, food, and cold exposure all affect actual player warmth. There is no timed expedition victory in v2.

## Resources and camp simulation

The **Rucksack** uses a recessed, Minecraft-inspired material grid, original pixel item artwork, readable quantities, and a survivor preview. Select a material in the carried grid or camp-storage row to inspect it; use **Store supplies**, **Take 1**, or the food buttons for actual transactions. Empty squares are visual space, not an additional slot-capacity rule. The interface displays aggregate material totals, including negative or large sandbox balances. Mobile layouts use six columns. Inventory actions preserve their success/error feedback.

Definitions live in `src/data/definitions.ts`: wood, stone, meat, fish, metal, gold. **Carried inventory and settlement stockpiles are separate.** Store positive carried supplies beside any furnace or storehouse; retrieve resources there through inventory controls. The optional carried limit counts positive units only; a storehouse adds 50 capacity when a limit is enabled. Negative balances are retained, not silently cancelled by storage.

Each resource balance defaults to the inclusive integer range **−9,999,999 to 9,999,999**. Imports may contain negative values, including the extremes. By default, a cost cannot take its account below zero. Enable **Allow resource debt** to permit that behavior, including trading counterparties. The central transaction system validates every account before committing a cost, transfer, or exchange. Limits and finite integer arithmetic remain enforced with debt enabled.

Hut workers seek reachable wood nodes within 26 units of their hut, use obstacle-aware routes, chop one unit every two seconds, carry up to three, and physically return to the nearest storage/furnace delivery area. Wood enters the shared stockpile **on delivery**. Depleted, inaccessible, or full-destination scenarios pause production. Workers do not automatically feed the fire. Simulation continues for constructed camps outside the rendered area and pauses with menus or a hidden tab.

The **30-wood furnace expansion** adds **8 units** of heat radius in v2 world coordinates and improves fuel efficiency by 10% of base duration per level. Level 1 radius is 12; supported levels are 1–25. The conversion from the much larger v1 canvas coordinates is deliberate. Extinguished furnaces provide no heat at any level. Outpost furnaces start empty. Trail shelters recover warmth within five units without fuel.

Rivers are carved valleys with visible banks, water, and timber bridges every 64 east/west units. Deep water blocks movement; bridges are explicit crossings. Fish availability and deterministic catches are persisted per location. Chest loot, mined nodes, discoveries, NPC stock, buildings, workers, and furnace modifications survive leaving and reloading chunks.

## World generation

The world is **not bounded to the initial clearing or initial region**. Default chunks are 32 × 32 units; the starting-region scale is 256 × 256 units. Additional positive and negative chunks are generated as you explore. Initial region size is metadata for the starting scale, not a hard boundary or a request to build the entire world up front.

The renderer loads a square of nearby chunks (distance 1–3, default 2), creates at most two chunk render groups per frame, and disposes distant geometries, instancing buffers and nonshared materials. Repeated trees and resource props are instanced. Static generation caches at most 129 chunks; persistent modifications live separately in save state. Terrain uses world-coordinate samples at shared edges, so generation order cannot change it. WebGL 2 is required and initialization failures produce a readable error.

Generation version **2** uses Mulberry32 plus independent coordinate-addressed streams. Stream seeds are 16-bit values derived from the world seed with FNV-1a and a documented integer avalanche in `src/utils/SeededRNG.ts`. Stream labels are terrain, rivers, biomes, resources, ruins, and wildlife. Resource coordinates/amounts use only their resource stream; changing that stream does not move terrain, rivers, or trees. Terrain/rivers intentionally cooperate to carve waterways. The wildlife stream seeds enemies, equipment drops, and weather.

Exported JSON includes every stream seed and the generation configuration. Edit `world.seeds.resources` to customize resources independently. `world.config` supports chunk size, starting-region scale, terrain scale, river density, ruin density, and resource density. With densities set to zero, the corresponding optional features can be absent; default settings provide rivers and a starting-region ruin. Resource candidates that lie in deep water are not rendered or harvestable; other accessible nodes and guaranteed starter sources remain available.

## Saves and sandbox JSON

**Local save:** one v2 slot under `frostbound.world.v2`, saved manually or every 20 seconds of active simulation. No old world is automatically loaded over the main menu; use **Load Save**. Storage failures are reported; export JSON as an alternative. v1's `frostbound-save` key is left untouched.

**Full save** restores the exact mutable world. **Sandbox configuration** always creates a clean player at home and applies starting balances, home furnace parameters, settings and generation rules. It does **not** carry over old buildings, positions, NPC trades, discoveries, node depletion, or fishing catches. These are deliberately different import modes.

See [docs/SAVE_FORMAT.md](docs/SAVE_FORMAT.md), [examples/sandbox-config.json](examples/sandbox-config.json), and [examples/full-world.json](examples/full-world.json). In Save / JSON, **Fill with current sandbox config** gives an editable starting document. Import requires **Validate import**, then a separate **Confirm: replace active world** action. Validation and cancellation never mutate the active world. Editing text or changing modes invalidates a pending import. Downloads are valid JSON, not browser-specific binary data.

Format version **1** and generation version **1** are supported. Unknown versions are rejected clearly, rather than silently regenerating a different world. No v1 Phaser-save migration is claimed. Future generation changes must introduce a new generation version and an explicit compatibility/migration path. Imported coordinates are limited to ±1,000,000 units to retain useful numeric precision. Larger imported inventories are permitted within resource bounds; if an enabled carrying limit is already exceeded, additions remain blocked until space is freed.

## Architecture and v1 preservation

```text
src/
  main.ts                       Initialization and graceful WebGL error screen
  game/Game.ts                  Simulation coordinator and interaction actions
  game/GameState.ts             Serializable, renderer-independent state
  game/GameConfig.ts            Seeds, generation version, settings
  game/audio.ts                 Original synthesized v1 audio, retained
  world/WorldManager.ts         Coordinate terrain/rivers/biomes/ruins/nodes, bounded cache
  systems/InventorySystem.ts    Atomic, bounded transactions and barter
  systems/SurvivalSystem.ts     Fuel, heat, environmental cold, warmth
  systems/Navigation.ts         Worker and test navigation
  systems/SaveSystem.ts         Versioned validation, detached import, exports, local saves
  rendering/Renderer.ts         Three.js camera, lighting, meshes, chunks, cleanup
  ui/App.ts                     Input, touch controls, loop, modal lifecycle, previews
  ui/Panels.ts                  Inventory, trades, building, settings, map and JSON UI
  data/definitions.ts           Resource and building definitions
  data/trades.ts                Trader specializations and offer definitions
  utils/SeededRNG.ts            Deterministic RNG, hash derivation and smooth noise
  styles/main.css               Desktop, mobile and landscape interfaces
```

The inspected v1 source, tests, README and configuration are preserved in **`archive/frostbound-v1.zip`**. The active project runs **only Three.js**; Phaser was removed. The original Vite/TypeScript setup, local fonts, synthesized audio, interaction loop, 5-wood huts and 30-wood expansion concepts were retained where compatible. The small timed arena, sprite renderer and round-local model were replaced because they could not represent the required 3D persistent sandbox.

## Verification and milestone status

```sh
npm test
npm run typecheck
npm run build
# With the dev server running in another terminal:
npx playwright install chromium
npm run test:browser
# Inventory / field-kit UI checks (dev server running):
npm run test:ui
# With npm run preview serving the production build:
npm run test:production
```

The browser suite uses installed Microsoft Edge on Windows if available, otherwise Playwright Chromium. Set `BROWSER_EXECUTABLE` to choose a Chromium executable. Outputs/screenshots are in ignored `test-results/`.

The first major milestone's 17 criteria are implemented: navigable 3D terrain, keyboard/touch movement, unsigned 16-bit seeds, reproducible terrain and separate resources, gathering, inventory, real heat survival, rivers/fishing, explorable ruins, NPC barter, saved construction, full JSON restore, clean sandbox imports, negative resources, failure-safe imports, and build/gameplay verification.

Validation includes 14 simulation/data tests and a browser scenario covering actual keyboard movement/gathering, fuel changes, rotated hut placement, inventory/storage, JSON download/re-import, rejected imports, fishing, ruins/chests, NPC trades, chunk modifications, negative-balance fresh sandbox import, settings, pause and mobile controls. A production smoke check covers initialization, seed zero, UI/pause, absence of development hooks, and graceful WebGL failure. Long-distance browser navigation accelerates real movement/collision/simulation updates; it does not claim a human playthrough. Physical iOS/Android hardware and long-duration browser endurance have not been tested.

Deliberate first-milestone limits: simple procedural low-poly art, repeating but seed-varied ruin layouts, fixed trade offers, seven resources, finite fish/loot reserves, one gathering worker role, shared camp storage, no entering building interiors, and no advanced processing chains or dynamic market pricing. Those are extension work, not placeholder buttons in the current interface.

All mesh artwork and synthesized sounds are original procedural work. Bundled DM Sans and Libre Caslon Display use the SIL Open Font License; notices ship in `public/licenses/` and the production build.

## Combat and whiteouts

Start a new expedition for terrain generation 2 and its three fixed villages: Hearthwatch (40, 8), Stonehaven (-72, -32), and Northpass (132, 112). Villages have traders, 3-5 armed guards, and a furnace. Old terrain-generation-1 saves keep their original terrain and ruins. Bandits roam in groups of 2-10; polar bears and arsonists also patrol. Guards fight enemies and retaliate when you attack their village.

Aim at terrain and hold left click to attack. Space or the touch Attack button targets the closest hostile. Equip from the weapon rack, keys 1-6, or the Rucksack equipment list. Hold Shift to sprint (9 rather than 6 units/sec), or toggle the touch Sprint button; exposure consumes twice the warmth. Starter equipment is a wooden sword. Traders sell all six weapons using carried resources, and defeated armed actors have a deterministic 7% equipment drop chance. Collect drops with E. Player weapons have 100 attacks and unlimited ammo; enemy weapons never wear out.

| Weapon | Damage | Cooldown | Effect |
| --- | --- | --- | --- |
| Wooden sword | 5 | 1s | Melee arc |
| Spear | Random 3-10 | 1.5s | Longer melee reach |
| Machete | 10 | 1.5s | 2 bleed damage/sec for 5s; hits refresh bleed |
| Bow | 15 | 2s | Traveling arrow, 22-unit range |
| Shotgun | 8-35 | 4s | 3-unit, 80-degree cone; closer targets take more damage |
| Molotov | 3/sec | 4s | Traveling bottle, 4-unit radius, 10s fire; friendly fire applies |

One world unit is one tile. Bow damage, machete cooldown, shotgun damage bounds/cone, and molotov cooldown/DOT were unspecified and are the initial tuning above. All values live in `src/data/weapons.ts` and `src/systems/CombatSystem.ts`. Player, traders, and workers have 100 HP; bears 50, bandits/guards 125, arsonists 75. Combat defeat returns you home through the recovery dialog.

Fire converts timber nodes and standing trees into gatherable charcoal after ten seconds. Charcoal adds 120 furnace energy (wood adds 60) and consumes energy at half the wood rate, giving four times the total heating duration per unit. Use the Build panel charcoal-fuel button near a furnace. E feeds wood first, falling back to charcoal. A whiteout starts after 90 seconds, lasts 55 seconds, triples fuel consumption, reduces visibility, and increases enemy detection distance. Clear intervals thereafter last 90-150 seconds. Furnace reinforcement and chimney models change after each five purchased upgrades (levels 6, 11, 16, 21).

Save format 2 includes HP, actors, equipment durability, projectiles, fire, bleed, drops, weather, village hostility, and burned terrain. Format 1 files migrate with full health, a starter sword, and zero charcoal. Full saves retain combat state; sandbox imports reset encounters but retain the configured starting equipment. JSON imports validate all combat fields before replacing the active world.

Run `node tests/combat.mjs` for desktop/mobile combat UI smoke checks (requires the dev server). `npm test` includes combat simulation and persistence regressions.
