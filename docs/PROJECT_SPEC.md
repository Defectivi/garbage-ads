# FYWS: Frostbound
## Unified Master Engineering Brief
### 3D Procedural Winter Survival, Exploration, Combat, Trading, Modding, and Repository Management

You are the lead game architect, senior TypeScript engineer, 3D gameplay programmer, procedural-world specialist, AI engineer, UI/UX designer, QA engineer, and repository maintainer for **FYWS: Frostbound**.

Your responsibility is to transform the existing project into a functional, expandable, moddable, browser-based 3D winter survival sandbox while preserving useful existing work.

This document is the authoritative project specification. Treat its requirements as the source of truth when making architectural and implementation decisions.

The intended result is an explorable wilderness with procedural terrain, rivers, forests, ruined towns, villages, hostile wildlife, bandits, arsonists, armed guards, NPC trading, weapons, construction, survival systems, weather, and player-controlled sandbox configurations.

The game must be playable locally, work without a mandatory backend, and support portable JSON saves that players can freely modify.

---

# PART I. PROJECT IDENTITY AND AUTHORITY

## 1. Official project identity

- **Official game title:** Frostbound
- **Official repository name:** `FYWS-Frostbound`
- **Displayed project branding:** `FYWS: Frostbound`
- **Project acronym:** FYWS
- **Acronym meaning:** "Fuck You Whiteout Survival"
- **Project category:** 3D winter survival, exploration, and sandbox simulation.
- **Initial runtime:** Browser.
- **Primary language:** TypeScript.
- **Target rendering engine:** Three.js.
- **Development server and bundler:** Vite.
- **Save interchange format:** JSON.
- **Long-term distribution goal:** Public GitHub repository, browser releases, and eventually a standalone Windows executable.

FYWS is an intentionally irreverent developer-facing project name. Preserve its meaning in the README and project documentation without forcing profanity into every gameplay interface.

The game itself should simply be called **Frostbound**.

## 2. Development authority

You may inspect and modify the existing project's source code, dependencies, configuration, documentation, and local repository structure as needed to implement the specification.

You are authorized to:
- Refactor existing game systems.
- Add new modules and reorganize source files.
- Replace incompatible rendering architecture when justified.
- Install appropriate dependencies.
- Update package metadata and application titles.
- Create and maintain project documentation.
- Add automated tests.
- Create or update Git configuration files.
- Improve asset organization.
- Prepare the project for public GitHub hosting.
- Maintain the project's identity as FYWS: Frostbound.

However, full development authority does not mean unlimited permission to perform destructive or externally consequential operations.

Do not silently discard uncommitted work, delete unrelated files, overwrite user-owned data, expose secrets, force-push, delete remote branches, publish releases, or change remote repository visibility without the appropriate authorization.

Inspect Git status and existing changes before performing potentially destructive operations. Preserve useful history and functioning code wherever possible.

## 3. Inspect the workspace first

The existing workspace is named `garbage ads`. It contains a Vite and TypeScript project and may already include a partial game implementation.

Before modifying files:
1. Inspect the source tree.
2. Read `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, and `vite.config.ts`.
3. Identify the existing rendering engine and game architecture.
4. Locate implemented movement, terrain, resource collection, furnace, survival, building, save, and UI systems.
5. Determine which features are functional, incomplete, or missing.
6. Inspect Git status and repository configuration.
7. Identify the least disruptive migration path to the target architecture.
8. Produce a concise implementation plan.
9. Begin implementation immediately after inspection and planning.

Do not assume a feature exists merely because it appeared in an earlier conversation. Do not replace the entire project with a generic starter template.

If the current prototype uses Phaser or another 2D rendering engine, migrate to Three.js deliberately if true 3D exploration cannot be supported adequately by the existing architecture. Preserve transferable gameplay logic and data structures. Do not maintain two competing rendering engines without a concrete technical reason.

If the project already uses a suitable 3D engine, avoid unnecessary migration.

---

# PART II. GAME DESIGN AND TECHNICAL FOUNDATION

## 4. Core game vision

Frostbound is an open-ended winter survival sandbox.

The player begins near a furnace in a snowy wilderness. They can gather wood, collect stone, maintain the fire, construct buildings, recruit workers, and expand their settlement.

However, the furnace must not confine the player to a single small arena.

The player should eventually be able to:
- Explore forests and hills.
- Follow rivers.
- Fish for food.
- Search abandoned settlements.
- Discover fixed villages.
- Trade with NPCs.
- Obtain weapons and equipment.
- Fight polar bears, bandits, and arsonists.
- Encounter armed village guards.
- Build and expand a settlement.
- Explore increasingly distant areas.
- Experiment with resources, starting conditions, and world generation.
- Export, modify, and reimport their game state.

The game should support extended play sessions rather than forcing every session into a short survival timer.

Survival mechanics should create meaningful decisions, not arbitrary restrictions. The player should have freedom to explore without being forced into a particular progression path.

## 5. Technical stack

Use:
- TypeScript for game logic and data structures.
- Three.js for genuine 3D rendering, cameras, lighting, meshes, and environmental effects.
- Vite for development and builds.
- HTML and CSS for game menus and HUD elements.
- A deterministic random-number generator for procedural generation.
- JSON for portable saves and sandbox configurations.
- LocalStorage or IndexedDB for local persistence, chosen according to data volume and performance requirements.
- An appropriate test framework compatible with the existing project.

Do not introduce React merely for the sake of using it. Add a UI framework only if the actual architecture justifies it.

Do not require a backend, online account, external API, or network connection for core gameplay. Do not integrate advertising or monetization during initial development.

## 6. Source architecture

Adapt the existing project to a modular structure similar to the following:

```text
src/
  main.ts
  game/
    Game.ts
    GameConfig.ts
    GameState.ts
    GameLoop.ts
  rendering/
    Renderer.ts
    CameraController.ts
    Lighting.ts
    EnvironmentRenderer.ts
    EntityRenderer.ts
    EffectsRenderer.ts
  world/
    WorldManager.ts
    WorldCoordinates.ts
    ChunkManager.ts
    TerrainGenerator.ts
    RiverGenerator.ts
    BiomeGenerator.ts
    ResourceGenerator.ts
    VillageGenerator.ts
    RuinGenerator.ts
    WorldPersistence.ts
  entities/
    Player.ts
    NPC.ts
    Enemy.ts
    PolarBear.ts
    Bandit.ts
    Arsonist.ts
    Guard.ts
    Worker.ts
    Furnace.ts
    Building.ts
    ResourceNode.ts
    Projectile.ts
  systems/
    MovementSystem.ts
    CombatSystem.ts
    HealthSystem.ts
    AIController.ts
    ProjectileSystem.ts
    StatusEffectSystem.ts
    SurvivalSystem.ts
    WeatherSystem.ts
    ResourceSystem.ts
    InventorySystem.ts
    TradingSystem.ts
    BuildingSystem.ts
    FishingSystem.ts
    FireSystem.ts
    SaveSystem.ts
  ui/
    MainMenu.ts
    HUD.ts
    InventoryUI.ts
    TradingUI.ts
    CombatUI.ts
    BuildingUI.ts
    SaveImportExportUI.ts
    SandboxUI.ts
    SettingsUI.ts
  data/
    resources.ts
    items.ts
    weapons.ts
    enemies.ts
    buildings.ts
    NPCDefinitions.ts
    biomes.ts
    weather.ts
  utils/
    SeededRNG.ts
    Validation.ts
    MathUtils.ts
    EventBus.ts
  styles/
    main.css
```

This is a suggested separation of responsibilities, not a requirement to create empty files for every listed name.

Keep rendering, simulation, persistence, and interface code separate. Use centralized data definitions and configuration for gameplay statistics. Avoid circular dependencies, duplicated authoritative state, giant classes, and UI code that directly mutates rendering internals.

---

# PART III. MOVEMENT, CAMERA, AND PROCEDURAL WORLD

## 7. Genuine 3D exploration

The game must render a navigable 3D environment rather than a static isometric image.

Implement an elevated three-quarter or third-person camera with:
- Smooth player following.
- Controlled rotation.
- Zoom.
- Collision-aware camera positioning where practical.
- Consistent world coordinates.
- Clear visibility of nearby terrain and entities.

## Required control scheme: desktop, tablet, and mobile

Controls are a core feature, not optional polish. Implement and document the following scheme. Keep controls configurable where practical, show contextual prompts, and prevent gameplay actions from triggering while the player is typing into a text field.

### Desktop: keyboard and mouse
- **W / A / S / D:** move forward / left / backward / right relative to the camera.
- **Arrow keys:** alternate movement controls.
- **Left Shift (hold):** sprint. Sprinting consumes warmth at the specified 2× rate.
- **Mouse movement while holding the right mouse button:** rotate/orbit the camera.
- **Mouse wheel:** zoom the camera in or out.
- **Left mouse button:** use/attack with the currently equipped weapon. For ranged weapons, attack toward the current aim point; for melee weapons, swing at a valid target in range.
- **Right mouse button (hold):** aim ranged weapons and rotate the camera. Releasing it does not fire.
- **E:** interact with a nearby NPC, trader, door, furnace, resource node, or other contextual object; show the relevant interaction prompt first.
- **F:** pick up a nearby dropped item when one is available.
- **1–6:** equip the corresponding weapon slot: bow, shotgun, Molotov, wooden sword, spear, machete. Empty slots do nothing.
- **Mouse wheel while not zooming a camera gesture / dedicated hotbar controls:** cycle weapon slots only if the implementation can do so without making camera zoom unreliable. Prefer the explicit 1–6 keys as the dependable selection method.
- **I:** open/close inventory.
- **M:** open/close the map, if the map interface has been implemented; otherwise do not show a fake binding.
- **Escape:** pause the game or close the topmost active interface.
- **Enter / Escape:** confirm / cancel only where the active UI explicitly supports those actions.

The left mouse button must work with every equipped weapon, including melee weapons and Molotovs. Respect each weapon's configured cooldown, durability, aim rules, collision, and hit detection. Never make attacks bypass the shared combat system.

### Tablet and mobile: touch controls
- **Left virtual joystick:** move the player in any direction. The joystick must have a visible thumb area, a dead zone, and smooth return to neutral when released.
- **Swipe/drag on the right side of the screen:** rotate the camera. Ignore camera gestures that begin on UI buttons or the left movement joystick.
- **Attack button:** use/attack with the currently equipped weapon. Hold or repeat only when appropriate for that weapon's cooldown; never bypass cooldowns.
- **Aim button (ranged weapons):** hold to enter aiming mode and adjust aim by dragging on the right side; tap Attack to fire/throw. Melee weapons can hide or disable Aim.
- **Interact button:** appears when a contextual interaction is in range and opens/interacts with that target.
- **Pickup button:** appears near a collectible dropped item.
- **Weapon slots / hotbar:** tap a slot to equip that weapon. Keep all six weapon slots accessible without obscuring essential gameplay.
- **Sprint button:** hold to sprint and apply the same 2× warmth consumption rule as desktop Shift.
- **Inventory button:** open/close inventory.
- **Pause button:** open the pause menu.
- **Camera zoom:** use a two-finger pinch gesture where supported; provide visible zoom controls as an accessible fallback.

### Input and accessibility requirements
- Detect coarse-pointer/touch devices and adapt the interface, while still allowing keyboard and mouse on hybrid devices.
- Do not require hover on touch devices. Use tap states and clear labels/icons.
- Make touch targets comfortably sized, keep HUD controls away from screen edges/notches, and support portrait/landscape layouts where practical.
- Avoid accidental camera movement when the user taps buttons, drags inventory items, or operates the joystick.
- Show concise contextual hints for desktop and touch controls in the opening/tutorial UI and pause menu.
- Keep control labels accurate to the bindings actually implemented. If a binding is not implemented, do not advertise it as functional.
- Test keyboard/mouse and touch control paths independently, including combat, camera, inventory, trading, and interaction.

Use delta-time-based movement. Movement and attack timing must not depend on rendering frame rate.

Use delta-time-based movement. Movement and attack timing must not depend on rendering frame rate.

Implement terrain-aware movement, collision checks, interaction distances, and obstacles.

## 8. World scale and chunk management

The world must extend beyond the initial clearing.

Use chunk-based world generation so the game renders nearby terrain rather than attempting to render the entire world at once.

Initial development parameters:
- Starting playable region: approximately 256 × 256 world units.
- Chunk dimensions: approximately 32 × 32 world units.
- Configurable render distance.
- Incremental chunk generation and loading.
- Persistent modifications for previously visited areas.
- Deterministic regeneration of static world features.

These values must be configurable. Do not impose an arbitrary permanent boundary at the initial region.

Generate additional terrain as the player explores, subject to reasonable browser performance and world-coordinate constraints.

Use instanced meshes, merged geometry, batching, or equivalent optimizations for repeated trees, rocks, and other objects.

Prevent chunks from generating inconsistent terrain or duplicate objects at their boundaries.

## 9. World seed

Use an unsigned 16-bit world seed:
- Minimum: `0`
- Maximum: `65535`
- Number of possible seeds: `65536`

Allow the player to generate a random seed or enter a custom seed. Display the active seed in the world interface and preserve it in saves.

The same world seed, generation version, configuration, and generation rules must produce the same static world layout.

## 10. Independent random-number streams

The world seed must not force every resource distribution or simulation result to be identical.

Use separate deterministic RNG streams for:
1. Terrain and elevation.
2. River placement.
3. Biome and vegetation distribution.
4. Resource placement.
5. Ruins and points of interest.
6. Villages.
7. Wildlife and encounter generation.
8. Loot and other relevant procedural systems.

Derive independent stream seeds deterministically or store separate subsystem seeds in the world configuration.

**Required invariant:** changing the resource-generation seed must not alter terrain geometry or river placement.

Likewise, loading chunks in a different order must not change their generated contents.

Use coordinate-based or independently seeded generation instead of relying on one global sequential RNG whose output changes whenever an unrelated object is added.

Use generation-version identifiers to distinguish changes in world-generation algorithms.

## 11. Terrain and biomes

Generate a coherent snowy landscape containing:
- Snow-covered lowlands.
- Rolling hills.
- Rocky outcrops.
- Dense and sparse evergreen forests.
- Open clearings.
- Rivers and riverbanks.
- Ruined towns.
- Fixed villages.
- Potential construction locations.

Terrain must be navigable. Do not generate critical objects inside inaccessible terrain or allow trees and buildings to float or sink excessively.

Use deterministic terrain generation and appropriate height, slope, and collision calculations.

## 12. Rivers and fishing

Generate deterministic rivers with coherent paths, widths, banks, and water surfaces.

The player must not be able to walk across deep water as if it were ordinary terrain. Provide appropriate crossing locations where supported.

Implement functional fishing:
1. The player approaches an accessible riverbank.
2. The player interacts with a valid fishing location.
3. Fishing consumes a configurable amount of simulation time.
4. Fish are awarded according to location availability and fishing rules.
5. The fish are added to the appropriate inventory.
6. Changes to persistent fishing locations are saved when necessary.

Fish availability may vary by region. Fishing must produce actual resources, not merely a decorative animation.

## 13. Ruined towns

Generate ruined settlements as persistent points of interest.

Possible contents include abandoned houses, collapsed wooden structures, old storage buildings, broken fences, scattered timber, stone debris, metal salvage, searchable containers, abandoned equipment, and isolated survivors or traders where appropriate.

Use procedural layouts and stable identifiers.

Allow the player to explore ruins, collect salvage, search containers, and return to previously visited locations.

Persist collected resources, searched containers, and other meaningful world changes.

## 14. Fixed villages

Generate persistent villages at suitable locations.

Villages may contain wooden houses, storage buildings, trading areas, NPC residents, resource stockpiles, armed guards, paths and fences, and functional furnaces.

Villages must have stable locations and layouts for a given generation version.

They must not spawn inside rivers, impassable terrain, or occupied locations.

Village residents and inventories must persist according to the save rules.

Villages are distinct from temporary roaming encounters and must not regenerate their original stockpiles every time a player reloads a chunk.

---

# PART IV. RESOURCE ECONOMY, FURNACE, AND CONSTRUCTION

## 15. Resource definitions

Implement a unified, data-driven resource and inventory system.

| Resource | Sources | Uses |
|---|---|---|
| Wood | Fallen logs, trees, ruins, traders | Fuel, construction, repairs |
| Stone | Rock deposits, ruins, traders | Foundations and upgrades |
| Meat | Wildlife and traders | Food and trade |
| Fish | Rivers and traders | Food and trade |
| Metal | Ruins, deposits, traders | Advanced structures and equipment |
| Gold | Rare discoveries and traders | Specialized trades |
| Charcoal | Burned wood and eligible structures | High-value furnace fuel |

Resource definitions must include identifiers, display names, descriptions, and relevant gameplay properties.

Allow new resource types to be added without rewriting the entire inventory or trading system.

## 16. Resource limits and negative balances

The game is a freely modifiable single-player sandbox.

Players may intentionally configure negative resource balances, create absurd starting inventories, or experiment with unusual economic scenarios.

Use a default resource range of `-9,999,999` to `9,999,999`.

Enforce the range during gameplay and JSON import. Do not silently reset negative values to zero or reject a valid negative balance simply because it is negative.

Reject malformed numbers, `NaN`, infinity, and invalid structures. Prevent arithmetic overflow and unintended values outside the configured range.

Implement a centralized resource transaction system for adding resources, removing resources, applying construction costs, exchanging goods, trading with NPCs, refunding failed operations, updating inventory, and recording optional transaction history.

Resource transactions must be atomic. If a transaction fails, do not partially modify the player's or NPC's inventory.

If the current game distinguishes carried inventory from settlement stockpiles, preserve that distinction.

## 17. Furnace and survival

The furnace is the player's main survival tool, but it must not prevent the player from exploring the wider world.

Implement fuel storage, fuel consumption over simulation time, heat generation, heating radius, upgrade levels, environmental temperature, player warmth or cold exposure, visible active and inactive states, and configurable survival difficulty.

Temperature must affect actual gameplay.

The player can venture beyond the furnace's heating radius, but extreme cold creates a meaningful survival concern.

Provide a relaxed sandbox setting that allows exploration without unavoidable severe cold.

Furnace upgrades must affect measurable gameplay properties, including configured heat output, radius, or fuel efficiency.

Persist furnace state.

## 18. Furnace model upgrades

Upgrade the rendered furnace model at every five completed upgrades.

Use:

`modelTier = floor(upgradeLevel / 5)`

Expected progression:
- Levels 1–4: basic appearance.
- Level 5: first upgraded appearance.
- Level 10: second upgraded appearance.
- Level 15: third upgraded appearance.
- Continue for later multiples of five.

If the existing game starts at level zero, preserve that indexing correctly.

Each model tier must be visibly distinct through changes such as reinforced metal, larger components, additional chimneys, insulation, structure, glow, or smoke.

The displayed model tier must match the actual furnace state. The model change must not reset fuel, inventory, or other world state.

Village furnaces use the same tier rules for their own upgrades.

## 19. Construction and worker systems

Implement a data-driven building system.

Initial buildings include furnace and furnace upgrades, worker huts, storage structures, basic shelters, and resource-processing structures where supported.

Each building definition should specify costs, footprint, placement rules, rendering representation, and gameplay effects.

Support building selection, placement preview, confirmation, cancellation, and rotation where appropriate.

Reject invalid placements that overlap prohibited objects or obstruct essential interactions.

Construction costs must use the centralized transaction system.

Worker huts may employ workers who automatically gather configured resources.

Workers must have defined gathering rates, valid sources, range or assignment rules, inventory destinations, and failure conditions.

Workers must be functioning simulation entities rather than decorative characters.

---

# PART V. COMBAT, ENEMIES, AND WEAPONS

## 20. Unified health system

Implement one authoritative health and damage system for the player, NPCs, polar bears, bandits, arsonists, and armed guards.

| Entity | Maximum HP |
|---|---:|
| Player | 100 |
| Ordinary NPC or trader | 100 |
| Polar bear | 50 |
| Bandit | 125 |
| Arsonist | 75 |
| Armed village guard | 125 |

The explicit values for hostile entities and guards override the ordinary character baseline.

All living entities must have current health, maximum health, damage handling, death state, and appropriate visual feedback.

Prevent dead entities from attacking, trading, or dropping the same reward multiple times.

Damage from melee, projectiles, burning, and other hazards must pass through the unified health system.

## 21. Hostile wildlife and enemy behavior

### Polar bears
- Maximum health: 50 HP.
- Damage: 5 HP per successful hit.
- Combat style: close-range melee.
- Spawn locations: suitable snowy wilderness and forests.
- Behavior: roam, detect the player, pursue, attack, and disengage according to configured rules.

Make detection range, movement speed, attack cooldown, and aggression configurable.

Prevent spawning inside buildings, inaccessible terrain, or the player's collision volume.

### Bandits
- Maximum health: 125 HP each.
- Group size: randomly generated groups of 2–10.
- Weapons: bow, shotgun, or machete.

Bandits roam the wilderness and attack when their configured aggression conditions are met.

Weapon-specific behavior:
- Bow users maintain distance and fire projectiles.
- Shotgun users approach a suitable range.
- Machete users close distance for melee attacks.

Maintain reasonable group spacing and prevent bandits from overlapping into a single point.

Use deterministic encounter generation where practical.

### Arsonists
- Maximum health: 75 HP.
- Weapon: Molotov cocktail.
- Behavior: roam, detect targets, throw Molotovs, and attempt to ignite eligible wooden structures and exposed wood stockpiles.

Arsonists must use the actual projectile and fire systems.

A nearby arsonist must not magically burn buildings without a valid projectile impact or other explicitly implemented fire mechanism.

## 22. Player weapons and equipment

Implement six weapons in two categories.

**Ranged:** bow, shotgun, Molotov cocktail.

**Melee:** wooden sword, spear, machete.

Weapons must be real inventory items.

Allow the player to acquire weapons through NPC trades and eligible enemy equipment drops.

The player can equip weapons, switch equipment, attack, inspect durability, and see remaining uses.

### Infinite ammunition and weapon durability

Ammunition is infinite for the initial implementation.

Player-owned weapons have a maximum of 100 uses per weapon instance.

These are separate rules: ammunition is unlimited, but weapon durability is not.

Each successful attack consumes one weapon use:
- Bow shot: one use.
- Shotgun blast: one use.
- Molotov throw: one use.
- Wooden sword swing: one use.
- Spear swing: one use.
- Machete swing: one use.

Treat Molotovs as reusable weapon instances with 100 throws rather than one-use consumables.

After 100 uses, the weapon becomes unusable until an appropriate repair or replacement mechanic is implemented.

Display remaining durability in the HUD and inventory.

Enemy weapons are exempt from the player's 100-use limit.

Centralize weapon statistics in configuration files.

## 23. Bow

- Attack interval: 2 seconds per arrow.
- Ammunition: infinite.
- Player weapon durability: 100 uses.

Fire a visible arrow projectile toward the intended target or aim direction.

The arrow must travel through the world and deal damage only on a valid collision. Missed arrows must not damage unrelated entities.

Prevent firing outside the cooldown or without a valid aim direction.

Support both player and bandit use.

## 24. Shotgun

- Attack interval: 4 seconds.
- Effective attack distance or area: 3 tiles.
- Ammunition: infinite.
- Player weapon durability: 100 uses.

Implement a visible short-range blast with a clearly defined impact area.

Damage decreases as distance increases. Enemies closest to the blast receive the highest damage. Enemies farther away receive progressively less damage. Enemies outside the effective area receive no damage.

The initial damage curve must be configurable and documented because exact damage values have not yet been specified.

Each enemy should receive damage at most once per blast unless the chosen projectile model explicitly implements multiple independent hits.

Support player, bandit, and armed guard usage.

## 25. Molotov cocktail

- Fire radius: 4 tiles.
- Burn duration: 10 seconds.
- Ammunition: infinite.
- Player weapon durability: 100 throws.
- Attack cooldown: configurable.

Throw a visible bottle projectile with a trajectory and valid impact location.

On impact:
1. Create a burning area with a 4-tile radius.
2. Apply damage over time to eligible hostile entities within the area.
3. Continue the burn for 10 seconds.
4. Use configurable damage intervals.
5. Ignite eligible wooden objects and resource piles.
6. Apply fire rules to wooden buildings.
7. Extinguish the burning area when its duration expires or a valid extinguishing mechanic is used.

Use simulation time rather than frame-by-frame damage application.

Prevent duplicate burn ticks, duplicate damage, and unbounded fire-effect creation.

The fire system must persist meaningful world changes.

## 26. Wooden sword

- Damage: 5 HP per successful hit.
- Cooldown: 1 second.
- Player durability: 100 uses.

Implement a short-range swing with valid target checks and visible feedback.

## 27. Spear

- Damage: randomly selected from 3–10 HP inclusive.
- Cooldown: 1.5 seconds.
- Player durability: 100 uses.

Roll damage once per successful hit.

Give the spear a configurable reach longer than the wooden sword.

Use the appropriate seeded or simulation RNG rather than rolling damage repeatedly during the attack animation.

## 28. Machete

- Direct damage: 10 HP.
- Bleed duration: 5 seconds.
- Bleed damage: 2 HP per second.
- Player durability: 100 uses.

A successful hit applies direct damage and a bleeding status effect.

Bleeding must use the centralized health system.

For repeated hits, refresh the existing bleed duration instead of creating unlimited independent effects.

Stop bleeding when the effect expires or the target dies.

Display a readable status indicator.

## 29. Combat consistency

All weapons and enemies must use shared systems for attack cooldowns, hit detection, projectiles, damage, status effects, durability, and death handling.

Prevent:
- Multiple attacks during one cooldown.
- Damage through walls.
- Hits outside configured melee range.
- Duplicate damage from one projectile.
- Damage to unrelated targets.
- Dead enemies continuing to attack.
- Bleeding or burning effects that persist indefinitely.
- Weapon durability consumption when an attack fails before execution, unless explicitly configured.

Use simulation-time or delta-time-based logic. Keep combat configurable and extensible.

## 30. Equipment drops

Each eligible defeated hostile enemy has a **7% chance to drop one eligible piece of its actual equipment**.

Supported equipment includes bows, shotguns, machetes, and Molotov weapons where appropriate.

Select the drop from equipment the defeated enemy actually carried.

Roll once per eligible death. A successful drop must create a collectible item or inventory reward.

Player-acquired dropped weapons follow the normal 100-use durability limit. Enemy equipment is exempt from that restriction before being acquired.

Use deterministic loot-generation streams where appropriate.

Do not apply this rule automatically to peaceful NPCs or village guards unless a separate configurable rule explicitly allows it.

---

# PART VI. NPCS, TRADING, AND ARMED VILLAGES

## 31. NPC trading

NPCs must support functional resource and weapon trading.

Each NPC should have a stable identifier, display name, location, inventory, trade offers, optional settlement affiliation, and optional dialogue or descriptive text.

Supported resources include wood, stone, meat, fish, metal, gold, and charcoal where configured.

NPCs may buy, sell, or directly exchange goods.

Example: a trader exchanges 40 fish for 10 metal.

The trading interface must display player balances, NPC inventory, available offers, quantities exchanged, proposed resulting balances, weapon durability where relevant, and confirmation/cancellation controls.

Trades must update both parties atomically.

NPCs must not sell unavailable inventory unless their configuration explicitly allows unlimited stock.

Allow different settlements to specialize in different resources. Direct barter must be supported without requiring gold for every transaction.

## 32. Fixed village guards

Villages generate armed guard groups containing 3–5 guards.

Each guard has:
- Maximum health: 125 HP.
- Weapon: shotgun or machete.
- Stable identity.
- Village affiliation.
- Patrol or defense behavior.
- Configurable detection and alert range.

Guards protect their village and remain near their assigned territory unless pursuing a valid threat.

Guards are not automatically hostile to the player.

When the player attacks a guard:
1. The attacked guard identifies the player as a threat.
2. The guard retaliates.
3. Nearby guards may become alerted.
4. Alerted guards can pursue and attack the player.
5. Guards disengage according to configured hostility rules.

Apply consistent hostility rules when peaceful NPCs are attacked, if their faction supports calling for help.

Prevent recursive alert events, duplicate damage, and attacks without valid targets.

Guards use the shared combat system and weapon definitions.

## 33. Village furnaces

Villages may contain functional furnaces.

Each village furnace has its own fuel, heat output, heating radius, and upgrade state.

Village furnaces must not automatically share inventory or fuel with the player's furnace.

Allow interaction where appropriate.

Use the same furnace model-tier rules at upgrades 5, 10, 15, and subsequent multiples of five.

---

# PART VII. WEATHER, SPRINTING, FIRE, AND CHARCOAL

## 34. Snowfall

Implement a functional weather system with at least clear or overcast weather, active snowfall, and optional transitions between states.

Snowfall must be represented in simulation state, not merely as particles.

During active snowfall, furnace fuel consumption becomes **3 times the normal rate**.

Apply this multiplier through the fuel-consumption system. Do not multiply fuel use per rendered frame.

Snowfall must also increase hostile encounter pressure through configurable spawn probabilities, encounter intervals, or detection modifiers.

Prevent uncontrolled enemy spawning.

Use reasonable spawn limits, encounter cooldowns, valid terrain checks, and minimum spawn distances.

Do not spawn enemies inside occupied buildings, peaceful village interiors, or the player's collision volume.

Display the active weather state and relevant danger warnings in the HUD.

## 35. Sprinting and warmth

Holding Shift enables sprinting.

Sprinting increases movement speed and applies a **2× warmth-consumption multiplier**.

Requirements:
- Delta-time-based movement.
- Configurable sprint speed.
- Collision and terrain restrictions remain active.
- Releasing Shift restores normal movement.
- Sprinting cannot pass through obstacles.
- Warmth depletion follows the existing survival rules.
- Safe heated environments retain their configured warmth behavior.

If normal cold exposure drains warmth at a given rate, sprinting doubles that rate.

Make the increased warmth cost visible.

## 36. Fire and burning wood

Implement a persistent environmental fire system.

Eligible wood can enter a burning state when exposed to valid fire effects.

The system must track burning state, burn duration or progress, material quantity, destruction state, charcoal yield, and persistent world modifications.

Small wood piles, large stockpiles, and wooden buildings may use different burn durations and material rules.

Do not make every wooden building instantly disappear after one Molotov impact.

When eligible wood is fully consumed, convert the recoverable material into charcoal according to a configurable conversion ratio.

Remove or update the original wood object so that the same material cannot be collected twice.

Persist the result across chunk unloading and reloading.

Prevent conversion exploits that generate unlimited resources.

## 37. Charcoal fuel properties

Charcoal is a separate resource and furnace fuel.

Its specified properties are:
- Twice the fuel value of ordinary wood.
- Half the normal baseline consumption rate of wood.

Implement these as explicit fuel properties in configuration.

Apply environmental multipliers consistently. Snowfall's 3× multiplier must not accidentally be applied twice.

Display charcoal separately in inventory and allow it to be selected as furnace fuel.

Document the conversion ratio and the resulting behavior.

---

# PART VIII. VISUAL PRESENTATION AND GAME UI

## 38. Visual identity

Create a cohesive, attractive survival-game interface.

The world and HUD should look like an intentional game rather than a debug prototype.

Use a winter-survival palette: deep navy and blue-gray, snow-white and pale blue, warm amber and orange for fire, and red for danger and health loss.

Use consistent typography, spacing, iconography, and visual hierarchy.

Subtle animation, translucent surfaces, readable panels, and appropriate environmental effects are encouraged.

Do not obscure the world with unnecessary interface panels.

## 39. Environment visuals

Implement snow-covered evergreen forests, rocky terrain, rivers and riverbanks, ruined wooden settlements, fixed villages, furnace glow and smoke, character and enemy silhouettes, visible projectiles, fire and burning effects, optional snow particles and atmospheric fog, and lighting that contrasts cool snow with warm furnace illumination.

Use original or appropriately licensed assets.

Do not copy Whiteout Survival's proprietary art, logos, characters, or source code.

The game must not rely on inaccessible external assets or runtime downloads for essential visuals.

## 40. HUD

Display player health, warmth or cold exposure, equipped weapon, remaining weapon uses, resource balances, furnace fuel and status, current weather, hostile warnings, relevant interaction prompts, and world seed where appropriate.

Use readable icons, labels, and numerical values.

Communicate danger through more than color alone.

## 41. Inventory and hotbar

Implement functional inventory and quick weapon selection.

Show item names, quantities, categories, weapon properties, and durability.

The player must be able to equip weapons, switch weapons, inspect their remaining uses, and use available items.

All inventory controls must affect actual game state.

## 42. Combat feedback

Provide readable feedback for weapon swings, projectile firing and impact, damage taken, enemy health loss, bleeding, burning, death, equipment drops, low weapon durability, guard retaliation, and snowfall-related danger.

Use appropriate visual effects and optional audio when suitable assets are available.

Avoid excessive screen shake or visual effects that obscure combat.

## 43. Menus

Implement functional interfaces for:
- Main menu.
- New world.
- Custom seed.
- Enter world.
- Load save.
- Inventory.
- Trading.
- Building.
- Sandbox configuration.
- Full-save import/export.
- Settings.
- Pause.
- Return to menu.

Buttons must perform their advertised actions.

Do not use decorative controls that imply functionality that has not been implemented.

Support desktop first while maintaining usable mobile layouts.

---

# PART IX. JSON SAVES AND FULL SANDBOX CONTROL

## 44. Core principle

The player owns their single-player game state.

The save format is intentionally editable.

Do not attempt to prevent legitimate modification of resource counts, starting conditions, or other permitted sandbox parameters.

Do not add anti-cheat systems or server-authoritative restrictions to a single-player game.

However, imported JSON must never be treated as executable code.

## 45. Two distinct import modes

### Mode A: Full world save

Import an existing world and restore its state.

Include:
- World seed.
- Generation version.
- Relevant subsystem seeds.
- World-generation configuration.
- Player position and state.
- Health and warmth.
- Resource balances and inventory.
- Weapon durability.
- Furnace state and upgrades.
- Buildings.
- Workers.
- NPCs and inventories.
- Village and guard state where persistence is required.
- Discovered locations.
- Persistent resource-node changes.
- Fire and charcoal-related world changes.
- Relevant chunk modifications.
- Weather state if persistent.
- Other gameplay progression.

Static terrain should be regenerated deterministically where practical, while mutable world changes are stored separately.

The imported save must reconstruct the intended world without relying on unrecorded previous-session state.

### Mode B: Sandbox starting configuration

Import modified configuration data onto a fresh world.

The process must:
1. Generate a new game state.
2. Generate the world using the configured seed and generation rules.
3. Apply the imported starting resources and permitted settings.
4. Leave unrelated previous buildings, player positions, and old-world state behind unless explicitly requested.
5. Begin with a fresh settlement and appropriate initial entities.
6. Allow the player to export the resulting world as a full save.

Do not accidentally restore an old settlement when the player requested a blank canvas.

## 46. Example JSON configuration

Use a versioned schema similar to this, adapting it to the actual implementation:

```json
{
  "format": "frostbound",
  "formatVersion": 1,
  "mode": "sandbox-config",
  "world": {
    "seed": 48192,
    "generationVersion": 1,
    "resourceSeed": 27341,
    "config": {
      "worldScale": 1,
      "riverDensity": 1,
      "ruinDensity": 1
    }
  },
  "startingState": {
    "resources": {
      "wood": 5000,
      "stone": 250,
      "meat": 20,
      "fish": 40,
      "metal": 10,
      "gold": 100,
      "charcoal": 0
    },
    "health": 100,
    "warmth": 100,
    "furnace": {
      "level": 1
    },
    "inventory": {},
    "weapons": []
  }
}
```

This is illustrative, not a substitute for a complete schema.

## 47. Validation

Validate JSON syntax, required fields, data types, resource ranges, seed ranges, generation versions, building types, entity identifiers, world coordinates, weapon durability, health and warmth, inventory structure, and other fields used by the game.

Accept valid negative resource balances within the configured limits.

Reject malformed numbers, infinity, `NaN`, invalid object structures, and unsafe imported values.

Do not execute imported strings as JavaScript. Do not insert imported text into HTML unsafely.

If an import fails, preserve the existing game state and provide a useful error message.

Confirm before replacing the active world.

## 48. Save interface

Provide:
- Export full save.
- Import full save.
- Export sandbox configuration.
- Import sandbox configuration.
- Generate random world.
- Generate world from custom seed.
- Reset world with confirmation.
- Display active seed.
- Display generation version.
- Display import mode.

Downloads must be valid JSON files that can be reimported.

Do not require a backend or user account.

---

# PART X. TESTING, PERFORMANCE, AND RELIABILITY

## 49. Automated tests

Implement automated tests for deterministic generation, combat, resource transactions, saves, and important gameplay integration.

At minimum, test:

### Procedural generation
- Identical seeds and generation versions reproduce terrain.
- Independent resource seeds do not change terrain geometry or river positions.
- Chunk loading order does not change generated content.
- Village and ruin generation remains deterministic.
- Generation works across supported world coordinates.

### Resource economy
- Positive and negative balances are supported.
- Resource limits are enforced.
- Invalid numeric values are rejected.
- Failed transactions do not partially update inventories.
- Charcoal and fuel values are applied correctly.

### Combat
- Entity health values match the specification.
- Attack cooldowns work.
- Weapon durability is consumed correctly.
- Ammunition remains infinite.
- Bow projectiles use valid collision.
- Shotgun damage decreases with distance.
- Molotov burns last 10 seconds.
- Machete bleeding lasts 5 seconds at 2 HP per second.
- Dead enemies cannot attack.
- Equipment drops are rolled once per eligible death.

### Enemies and villages
- Polar bears deal 5 HP per hit.
- Bandit groups contain 2–10 members.
- Guard groups contain 3–5 members.
- Arsonists use Molotov projectiles.
- Guards retaliate when attacked.
- Snowfall increases encounter pressure without uncontrolled spawning.

### Survival and fire
- Snowfall applies the 3× fuel-consumption multiplier.
- Sprinting applies the 2× warmth-consumption multiplier.
- Charcoal has twice the fuel value and half the baseline consumption rate of wood.
- Fire-related changes persist across chunk unloading and save reload.
- Burned wood cannot be collected twice.

### Save system
- Full saves round-trip correctly.
- Sandbox imports generate fresh worlds.
- Negative resource balances survive export and import.
- Malformed imports do not destroy the active world.
- Older saves receive appropriate migration defaults.
- Modified weapon durability and other permitted fields are loaded correctly.

### Interface
- HUD values update when the game state changes.
- Trading updates both inventories.
- Weapon durability displays correctly.
- Furnace model tiers update at the correct levels.
- Responsive layouts remain usable.

Do not claim gameplay is tested merely because the project compiles.

## 50. Performance

The game must run in a modern browser on ordinary consumer hardware.

Implement chunk-based rendering, instanced meshes or equivalent optimizations, controlled geometry complexity, efficient collision and interaction checks, proper cleanup when chunks unload, incremental world generation, frame-rate-independent movement, correct handling of paused or hidden tabs, responsive viewport resizing, and graceful WebGL failure messaging.

Avoid unbounded mesh creation, duplicate listeners, excessive simulation updates, and unnecessary per-frame object allocation.

Do not generate the entire world on the main thread if doing so causes substantial blocking.

## 51. Definition of a successful major milestone

The project is not considered feature-complete until:
1. The player can explore a real 3D winter world.
2. Terrain generation is deterministic and seed-based.
3. Resource generation uses independent RNG streams.
4. The player can gather wood and stone.
5. The furnace consumes fuel and affects survival.
6. The player can build and upgrade structures.
7. Rivers and fishing work.
8. Ruined settlements can be explored.
9. NPC trading works.
10. Weapons and combat work.
11. Hostile enemies roam and attack.
12. Village guards retaliate when attacked.
13. Snowfall affects fuel consumption and encounter pressure.
14. Molotovs burn eligible objects.
15. Charcoal can be recovered and used as fuel.
16. Furnace models upgrade at the correct milestones.
17. Full saves and sandbox configurations work.
18. Modified JSON loads safely.
19. The UI is coherent and usable.
20. The application builds and automated tests pass.

If the milestone is too large for one implementation cycle, deliver it incrementally. Clearly report completed, incomplete, and blocked requirements.

Never simulate an unfinished feature using a placeholder button or hardcoded success message.

---

# PART XI. IMPLEMENTATION ROADMAP

## Phase 1: Project inspection and 3D foundation
- Inspect the workspace.
- Establish or preserve the appropriate rendering architecture.
- Implement camera and player movement.
- Generate snowy terrain, trees, rocks, and a starting clearing.
- Implement the unsigned 16-bit world seed.
- Implement independent procedural RNG streams.
- Add basic resource collection and HUD.
- Ensure the project builds and runs locally.

**Acceptance criteria:** a navigable, reproducible 3D winter environment.

## Phase 2: Survival and economy
- Implement wood and stone collection.
- Implement inventory and resource transactions.
- Implement the furnace.
- Implement warmth and cold exposure.
- Implement basic construction.
- Implement workers where appropriate.
- Add basic persistence.

**Acceptance criteria:** the player can gather resources, fuel the furnace, survive, build, and save.

## Phase 3: World exploration
- Implement chunks and persistent modifications.
- Generate rivers and riverbanks.
- Implement fishing.
- Generate ruins.
- Generate persistent villages.
- Implement stable points of interest.

**Acceptance criteria:** the player can leave the starting area, explore, collect resources, and revisit locations without losing persistent changes.

## Phase 4: Combat and weapons
- Implement health and damage.
- Implement melee weapons.
- Implement bow and shotgun projectiles.
- Implement Molotovs.
- Implement cooldowns and weapon durability.
- Implement hostile enemy AI.
- Implement enemy equipment drops.

**Acceptance criteria:** combat works with the specified statistics and real damage, collision, and death handling.

## Phase 5: NPCs and village defense
- Implement weapon trading.
- Add village guards.
- Implement guard retaliation and alert behavior.
- Add village furnaces.
- Ensure NPC inventories and hostility state persist correctly.

**Acceptance criteria:** the player can trade, obtain weapons, and experience functioning village defense.

## Phase 6: Weather and fire
- Implement snowfall and weather transitions.
- Apply fuel-consumption multipliers.
- Implement sprinting and warmth consumption.
- Implement burning areas and wood ignition.
- Implement charcoal conversion and fuel properties.
- Add fire-related persistence.

**Acceptance criteria:** weather, fire, and fuel systems interact correctly.

## Phase 7: JSON sandbox and save compatibility
- Implement full-save import/export.
- Implement sandbox-configuration import/export.
- Validate and version the schema.
- Support negative resource balances.
- Preserve generation seeds and persistent state.
- Implement backward-compatible migrations.

**Acceptance criteria:** players can modify JSON, start a fresh sandbox world, and export the resulting world.

## Phase 8: UI polish and optimization
- Polish the HUD, inventory, hotbar, trading, and menus.
- Improve environmental art and combat feedback.
- Optimize rendering and chunk loading.
- Improve responsive layouts.
- Run regression tests.
- Fix bugs before adding optional systems.

**Acceptance criteria:** a cohesive, attractive, stable, playable game.

## Phase 9: GitHub preparation and release readiness
- Verify repository structure.
- Update documentation.
- Ensure the project builds from a clean checkout.
- Verify dependency and asset licenses.
- Prepare release notes.
- Add a suitable license when selected.
- Prepare reproducible development and build instructions.

**Acceptance criteria:** the project is ready for public GitHub hosting, without falsely claiming that a remote repository has already been renamed or published.

---

# PART XII. REPOSITORY IDENTITY, DOCUMENTATION, AND FUTURE DISTRIBUTION

## 52. Official repository name

Use `FYWS-Frostbound`.

Displayed branding: **FYWS: Frostbound**.

The acronym means **Fuck You Whiteout Survival**.

The acronym is an intentional expression of the project's origin. Preserve its meaning in developer-facing documentation.

Do not force the profanity into ordinary gameplay interfaces.

If the existing project is not yet connected to GitHub, prepare the local repository for publication. Do not assume remote access.

If a GitHub remote exists, inspect it and determine whether the repository can actually be renamed. Do not claim that a remote rename has succeeded unless it has.

## 53. README

Create or update a serious, useful README containing:
- Project title and description.
- Project origin and acronym explanation.
- Game features and design goals.
- Current implementation status.
- Technology stack.
- Installation instructions.
- Local development instructions.
- Build and testing commands.
- Save import/export documentation.
- Sandbox configuration instructions.
- World seed and RNG behavior.
- Modifiability and resource-limit rules.
- Roadmap.
- License information where established.
- Asset attribution where required.
- Screenshots from the actual game when available.
- A dedicated **Controls** section containing the exact keyboard/mouse bindings and tablet/mobile touch layout specified in Part III. Keep it synchronized with the real implementation.
- A short explanation of the virtual joystick, camera gestures, attack/aim buttons, interaction prompts, pickup, weapon hotbar, sprint, inventory, pause, and zoom controls.
- A note explaining that weapon attacks share the same cooldown, durability, aiming, collision, and damage rules across desktop and touch input.

The README must distinguish implemented features from planned features. Do not label controls as implemented until they work in the game. If controls are only planned, label them clearly as planned and update the section when implementation is complete.

Never fabricate screenshots, release status, user statistics, or test results.

## 54. Repository hygiene

Maintain a clean repository.

Use a suitable `.gitignore` for the actual toolchain.

Exclude `node_modules`, build outputs, local caches, and secrets as appropriate.

Keep dependency versions and build instructions accurate.

Preserve Git history and useful existing work.

Do not overwrite unrelated user files or discard uncommitted work without authorization.

## 55. Licensing and original identity

Frostbound must have its own game identity.

Do not copy Whiteout Survival's proprietary artwork, logos, characters, source code, or other protected assets.

The project may explain that it was inspired by frustration with misleading mobile-game advertisements.

It must not imply official affiliation with Whiteout Survival or its publisher.

Use original or appropriately licensed assets and document relevant licenses.

If the owner has not selected a license, recommend an appropriate option and prepare the required documentation, but do not silently declare a license that has not been authorized.

## 56. Future executable

The initial deliverable remains a browser-based game.

Keep the architecture suitable for a future standalone Windows executable.

Once the game is stable, investigate an appropriate desktop wrapper such as Tauri or Electron.

Preserve the existing TypeScript gameplay systems and Three.js rendering rather than rewriting the game from scratch.

The eventual desktop version should:
- Run without a mandatory external backend.
- Preserve local saves.
- Support JSON import/export.
- Use appropriate application metadata.
- Have documented build instructions.
- Package required assets correctly.
- Avoid unnecessary network access.

Do not begin desktop packaging while the core game is still unstable.

## Existing Feature Audit and Improvement Rule

Before implementing any requested feature, inspect the current codebase and verify whether that feature already exists, even partially. Do not skip, dismiss, or leave an existing implementation untouched merely because it is already present.

- If the feature is already implemented, review its actual behavior, code quality, edge cases, usability, performance, accessibility where relevant, and integration with the rest of the game.
- Fix bugs, close obvious gaps, improve the implementation, and add or update tests where appropriate. Preserve working behavior unless a change is necessary to satisfy this specification or clearly improve correctness.
- If it is partially implemented, build on and complete the existing work instead of creating a competing duplicate system.
- If it is already complete and sound, verify it with suitable tests and report that finding. Do not make pointless changes just to appear productive.
- Before replacing or refactoring an existing system, understand its callers, dependencies, saved-data compatibility, and current user changes. Prefer focused, incremental changes over destructive rewrites.
- In the final report, state what already existed, what you reviewed or improved, what you added, and which tests or build checks actually passed. Never claim a review, improvement, or verification that you did not perform.

This rule applies to every phase and every feature, including rendering, movement, world generation, resources, combat, NPCs, UI, persistence, and tooling. **Existing is not the same as finished, and existing is not a reason to ignore it.**

## 57. Final instructions

Start by inspecting the existing workspace.

Create a concise implementation plan and immediately begin Phase 1.

Use the requirements in this document as the authoritative specification.

Keep the project runnable after each major phase.

Run the actual build and available automated tests, fix failures, and report the real results.

Do not silently change specified statistics, seed behavior, resource limits, save semantics, or repository identity.

Where a value is unspecified, choose a sensible configurable default and document it.

Do not claim that a feature is implemented until its real gameplay behavior exists.

Do not add monetization, multiplayer, forced online services, or anti-cheat restrictions.

Do not limit the world to a single small arena.

Do not sacrifice core functionality for a long list of unfinished features.

Maintain the official project identity: **FYWS: Frostbound**.

The origin may be spite. The implementation must be sound.

The final objective is a moddable, procedurally generated, browser-based 3D winter survival sandbox with exploration, combat, trading, construction, persistent world state, editable JSON saves, and a coherent original identity, ready for future GitHub publication and eventual standalone desktop distribution.
