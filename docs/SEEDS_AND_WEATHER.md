# Open-ended survival, weather and seeds

Frostbound has no victory goal, completion target or expedition finish timer. Death/recovery remains part of survival. The weather HUD now uses Sunny and Storm icons; storms retain the triple-fuel warning. The only world-phase countdown shown beside weather is Day/Night, counting to the next ten-minute phase boundary. Internal weather timing still drives storms and persists through saves. Fuel reserves and action/status cooldowns remain gameplay feedback.

Numeric world/stream seeds accept 0-4294967295. Randomization samples Uint32. Numeric seeds 0-65535 retain their original masked 16-bit stream derivation; larger seeds use full 32-bit derived streams, preserving high bits. Existing saved world specifications retain explicit streams and generation version, so their terrain does not change.

The menu also accepts text up to 128 UTF-16 code units, trimmed and normalized to Unicode NFC. Hashing covers every UTF-16 code unit (including both surrogate halves), uses stable FNV-1a plus the existing avalanche, and is case-sensitive. Decimal numeric input is validated as a number rather than hashed; fractions, negatives and numeric overflow are rejected. Empty/oversized seeds are rejected. Text labels render through DOM value/textContent, not HTML. Saves retain numeric `world.seed` and optional original `world.seedText`; imports reject mismatches. Explicit stream seeds remain authoritative.

Resource accounts default to signed 32-bit bounds: -2147483648 to 2147483647 inclusive. Imports, transactions, NPC trades, shared stores, ground loot and settings support those limits. Costs/credits validate before committing and never wrap on overflow. Custom limits remain supported; the exact old default bound pair migrates to the new defaults on load. Optional carrying capacity caps at 2147483647 including storage bonuses; aggregate arithmetic remains safely above 32 bits when summing several resource types.

Billion-sized slot labels use compact notation (for example 2.15B); the selected item inspector, tooltips, accessibility labels and saved balances retain exact integers. Seed errors clear when the input changes.

Validation: all 115 simulation tests passed, including legacy generation fixtures, Unicode text hashing, signed-boundary round trips and atomic overflow rejection. Six browser suites passed across the regression run and focused reruns: seeds, foundation, browser, combat, UI and production. Build and whitespace checks passed. Browser coverage uses headless Edge and touch emulation.

Verified captures: [text seed input](screenshots/seed-text-input.png), [mobile weather and phase clock](screenshots/seed-weather-mobile.png), [32-bit inventory](screenshots/seed-inventory-mobile.png).
