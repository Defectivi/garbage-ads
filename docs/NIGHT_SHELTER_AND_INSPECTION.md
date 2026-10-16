# Night shelter, equipment salvage and field interface

Building inspection extends the existing worker hover/touch treatment. Point at the rendered building or furnace to see its name and current/maximum HP. Ruins use their quarter-health maximum. Touch inspection lasts 3.5 seconds; pointer exit and destroyed structures clear the label. Picking excludes the furnace aura, range ring and health strip, and respects world visibility. Hidden workers cannot expose their inspection label.

Workers walk to their own intact, completed, unburning hut at night. They keep carried resources, stop gathering and tending furnaces, and stay inside until dawn even outside rendered chunks. Existing sheltered-worker recovery continues. At dawn healthy night occupants resume their route; injured workers retain recovery behavior. A hut becoming a ruin ejects hidden workers with half their current HP, once on that transition. Workers already outside do not take the collapse penalty. Burning huts remain unavailable for shelter; dead workers cannot recover or return to work.

Bandits roll a deterministic 25% weapon drop chance once on death. Non-Molotov equipment retains an integer 20-60% of its original uses (40-80% used). Dropped Molotovs contain 1-5 uses and pickup preserves that count. Other armed actors retain their 7% chance, and village Molotov supply pickups still contain one use. Separate loot hash streams keep wear reproducible without changing terrain or existing encounter placement. Saving and reloading retains exact remaining uses.

The UI uses locally bundled Oxanium headings/numerals and Rajdhani reading text under the SIL Open Font License, with notices in public/licenses. HUD panels use etched steel, brass rules, notched corners and segmented meters; the inventory retains its usable slot layout. Menus use the same typography and material palette. Landscape title actions use two columns so both new/continue choices remain accessible.

## Verification

- All 124 unit tests passed, including night rest offscreen, dawn after save/load, single collapse damage, unavailable burning huts, no dead-worker resurrection, drop-rate distribution, wear bounds and exact pickup durability.
- Production TypeScript/Vite build passed.
- Browser suites passed: field, camp, workers, UI, night and production. Coverage includes actual mouse/touch building/furnace/ruin picking, touch expiry, hidden worker visibility, night/collapse visuals, inventory transactions, progression, weather, responsive pause/title menus, font loading and production operation.
- Actual desktop HUD, inventory and pause captures and touch/landscape captures were visually inspected. Tests use headless Edge and touch emulation; no physical-device testing is claimed.
