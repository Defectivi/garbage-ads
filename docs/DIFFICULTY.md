# Expedition difficulty

Select difficulty on the title screen before **New expedition**. Enter current world, local saves and full JSON imports preserve the world's selected mode. Old saves without a mode use Normal. The separate relaxed/survival exposure setting is retained for compatibility and does not switch expedition rules.

| Rule | December Mosw (Easy) | Frostbound (Normal) | Siberia (Hard) |
| --- | --- | --- | --- |
| Starting health | 100 | 100 | 80% of maximum (40 with Frail Heart) |
| Starting equipment | Machete, 100 uses | Unarmed | One-use Molotov |
| Resources | Normal inventory plus 20 of each of all seven resources | 12 wood, 3 fish | Normal inventory |
| Home fuel | 120 base seconds | 60 base seconds | 60, or zero with Cold Hearth |
| Actor maximum health | 70% of base | Existing base values | Existing base values |
| Hunger drain | Half the normal walking/sprint rate | 1 per 30 walking seconds; 2 per 15 sprint seconds | Normal, multiplied by 1.5 with Hollow Belly |
| Clear weather | First 240s; subsequent 240-300s | First 90s; subsequent 90-150s | Normal |
| Snowstorm duration | 55s | 55s | 55s |
| Villages | Six additional fixed villages; 95% fewer potential ruins | Existing three fixed villages and ruins | Twice the scattered village loot; five additional bandits per village |
| Bears | Neutral until the player attacks | Hostile | Hostile |
| Nearby natural resources | Normal | Normal | No trees, loose nodes, cliff ores or fishing sites within 200m of home |
| Wolf targets | Existing behavior | Existing behavior | Bandits excluded |

Every mode retains the initial hut and two workers. Village supplies, traders, ruined-settlement chests and combat drops remain available inside the Hard-mode barren radius. Natural resources beyond 200m remain deterministic and gatherable, including by workers. Easy changes settlement distribution and resource eligibility without changing Normal world layouts. Both old and new worlds retain their generation version.

## Siberia hardships

The request listed five effects despite saying three; all five are available, with exactly one selected at creation:

- **Hollow Belly:** hunger clocks advance 50% faster, including sprinting.
- **Leadfoot:** movement speed reduced 20%, combined multiplicatively with other slow effects.
- **Cold Hearth:** no starting home fuel. If gained from a village, immediately removes the home's current wood and charcoal fuel once. Refueling remains possible.
- **Frail Heart:** base maximum HP reduced from 100 to 50. Hypothermia and starvation reductions still apply. Healing and recovery respect the reduced maximum.
- **Unclaimed:** no initial or recovery safe zone and no five-second recovery immunity.

Each village's first discovery has a deterministic 30% trial chance. A successful trial chooses a random hardship not already held; penalties do not stack duplicates. Successful and unsuccessful trials are recorded in the full save, so returning, dying or reloading never rerolls them. If all five are already held, no additional penalty is applied. Permanent hardships appear in the player effect cards. Starting HP reduction and free items apply only at world creation, never when loading a full save. Resetting the world restores its originally selected starting hardship.

The sandbox format preserves world mode but intentionally uses the explicitly imported resource, equipment and furnace overrides. All saves remain editable JSON.

## Verification

`tests/difficulty.test.ts` covers Normal compatibility, startup bonuses, hunger rates, all five hardships, resource scarcity, settlement frequency and loot, first-visit persistence, neutral bears, wolf/bandit targeting, additional patrols, recovery protection and invalid imports. `npm run test:difficulty` covers desktop and touch selection, portrait/landscape layouts, loadouts, saved settings, HUD hardships and pause difficulty.
