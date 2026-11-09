# Frostbound native desktop preview

This folder is a separate Rust/Bevy project. The TypeScript/Three.js game in the parent folder is unchanged. This is the first playable migration milestone, **not a complete port**.

## Run on Windows

The generated local build is `build/Frostbound.exe`. Keep its `assets` directory beside it. It does not open a browser or run a JavaScript server. Build outputs and the project-local Rust toolchain are ignored by Git.

From PowerShell, with Rust and Visual Studio C++ build tools available:

```powershell
cd 'D:\garbage ads\Frostbound-native'
.\Run.ps1 -Seed '42'
.\Run.ps1 -Seed 'Snow Home'
.\Run.cmd --seed "Snow Home"
.\Build.ps1
# Optional optimized build, with a longer first compile:
.\Build.ps1 -Release
```

The scripts use `.tools/cargo` and `.tools/rustup` if the project-local toolchain exists, otherwise your normal Rust installation. `Run.cmd` works when the machine's PowerShell script policy blocks `.ps1` files. New checkouts must install Rust from [rustup.rs](https://rustup.rs) and the Windows C++ build tools. Bevy prerequisites: [official setup guide](https://bevy.org/learn/quick-start/getting-started/setup/).

Compilation downloads Cargo dependencies; gameplay uses bundled local assets. Bevy is pinned to **0.17.3**, the version used for this migration milestone and its API checks. It is not a claim that this is the latest Bevy release. `Cargo.lock` pins resolved dependencies.

## Controls

| Action | Control |
| --- | --- |
| Move / sprint | WASD or arrows / hold Shift |
| Orbit / zoom | Right-drag / mouse wheel |
| Gather nearest source / fuel nearby furnace | Hold F / press F within 4m of the furnace |
| Upgrade furnace | T within 5m |
| Start hut construction | B; placement is four metres ahead along world Z in this preview |
| Punch nearby bear | Space or left click |
| Inventory / pause | E / Escape |
| Eat fish | Q, or inventory button |
| Save / load native slot | F5 / F9 |
| Keyboard menus | Tab selects next action; Enter activates |

Menus pause the simulation, including food cooldowns. Losing window focus pauses play. Seed selection uses `--seed` on the executable or `-Seed` in `Run.ps1`; the title also has a next-seed button. Starting presets are a subset of the original difficulty rules and are identified as such in Settings.

## What is ported

- Native Windows window, Bevy 3D rendering, bundled survivor/bear GLBs, locomotion/punch/gather clips, follow/orbit camera, incrementally generated terrain chunks and HUD.
- A Rust simulation crate independent of Bevy and the display server, with a 60 Hz fixed step.
- Browser-compatible integer RNG primitives with reference fixtures. Seeded noise, meandering/intersecting rivers, bridge detection and regional highlands. Tree placement avoids steep ground.
- Finite nearby resource gathering with original wood/stone/metal/gold durations, inventory limits at signed-32-bit maximum, atomic resource spending and paused shared food cooldown.
- Starting furnace, fuel preference (charcoal first), 10/30-second fuel additions, storm consumption, level-50 cap, original upgrade costs and range milestones at 5/10/20, repeating warmth/healing.
- Movement-based hunger, sprint hunger, simple bear encounters, punches, furnace entry/burn effects and native death recovery.
- Hut cost, footprint checks, HP and construction timer. Worker production is explicitly pending.
- Native inventory, pause, settings and title actions; measured loop FPS and a reversible 30 FPS loop cap. Native FPS is loop-frame measurement, not GPU presentation timing.
- Validated native JSON saves in `%LOCALAPPDATA%\FYWS-Frostbound-native\world.json`, with previous-slot backup and detached validation before load.

## What is still pending

Full terrain parity with browser generation 7 is **not** established: lakes, ore cliffs, ruins and placement exclusions are not fully ported, and source identities can differ. Native terrain is its own preview generation. Do not use native output to overwrite a browser world.

Workers and persistent village economies/security, traders, NPC sheltering, all weapons/projectiles/status effects, map exploration/markers/routes, complete building services and destruction, staged tree/log/stone harvesting, richer weather/night visibility, full difficulty hardships, the complete character IK/tool animation system, audio, configurable input and browser-save conversion remain migration work. Water currently slows movement; full hypothermia behavior is pending. Basic bears do not yet reproduce all critical-hit, stun, night and loot rules. Starting presets do not grant equipment until that subsystem is ported. Core source depletion is finite, but staged natural-resource animations are not ported.

Browser full saves and sandbox JSON are deliberately rejected by the native reader. They contain state this milestone cannot safely represent. The browser save key/files and application code are untouched. A future converter must preserve original documents and pass generation/entity/inventory equivalence tests before import is enabled.

## Architecture and migration

`crates/core` owns serializable state, transactions, deterministic generation, survival, gathering and basic combat. `crates/desktop` owns the Bevy window, rendering, input and UI. Assets are copied from the existing project's original models; no asset-generation request is required for reuse. Oxanium is bundled under its existing OFL license.

Next milestones: (1) browser state/schema and terrain parity, (2) full combat/statuses and rig animation, (3) worker/settlement simulation and all building services, (4) village/trade/map systems, (5) save conversion, native accessibility/settings and performance profiling. Each milestone needs parity fixtures and native runtime checks. No performance improvement from Rust alone is claimed.

Validation commands and actual results are recorded in `VERIFICATION.md`. `Smoke.ps1` launches the native window, captures gameplay/inventory and validates the native save; use `-Budget` for the capped run. On this machine it is run with a process-scoped `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Smoke.ps1` invocation; no global execution policy is changed.

Windows uses DirectX 12 with direct drawing in this preview. This avoids an observed wgpu indirect-batch assertion and a stale Vulkan capture hook on the development host. Other graphics adapters and platforms have not been verified. See `THIRD_PARTY.md` for asset/font provenance and release-notice limitations.
