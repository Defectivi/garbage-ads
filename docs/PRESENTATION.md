# Original survivor and collection presentation

The Wayfarer is an original stylized winter survivor authored for this repository, not a downloaded character or a collection of the old capsule parts. `src/rendering/SurvivorAsset.ts` defines tailored contour topology, vertex-coloured clothing, facial covering/goggles, gloves, trousers, boots and a canvas backpack. It produces one skinned character mesh with a 17-bone humanoid armature and 15 reusable animation clips. Model coordinates are metres, feet at y=0, facing +Z, with a height of about 2.16 units. Collision remains the existing gameplay radius; the rendered mesh does not decide hits.

`public/models/wayfarer.glb` is the generated local runtime asset. Rebuild it with `npm.cmd run asset:survivor`. This uses the already-installed Three.js GLTF exporter and `tsx`; no dependency installation, external asset download, account or API is required. The browser uses the standard Three.js GLTF loader. If loading fails, the same original contour model and clips are constructed locally as a fallback. The primitive player is not used as the fallback.

The model, animation poses and six weapon designs are original project work. No third-party character, texture, motion-capture or weapon assets were used. No new asset license has been silently declared; this original work follows the owner's eventual project license decision. Existing Three.js and font notices remain applicable to those dependencies.

`PlayerCharacter` owns the mixer, locomotion and upper-body layers. Movement speed chooses idle, walk or sprint; actual collection/attack events trigger the corresponding clip. Damage and death follow actual HP. Crossfades and smoothed heading handle starts, stops and turns. Melee, bow, shotgun and throw actions use separate poses and follow-through. Bow and shotgun aiming use two-bone arm IK to hold the actual weapon with both hands. Only the equipped model is attached, to HandL for bow or HandR for other weapons. All damage, cooldowns, warmth and durability stay in the simulation.

These are original stylized keyframed animations rather than motion capture. The implementation does not claim photorealistic gait, terrain-adaptive foot IK, finger articulation or cinematic animation quality. Foot placement uses the existing world walking height; locomotion is authored for the game's elevated camera. Further art iteration can replace the GLB without rewriting combat or collision.

## Flicker corrections

Previously every world revision called `refreshChunks`, which removed all chunk groups immediately and repopulated only two per frame. Depleting a resource, burning wood, searching a chest or damaging a trader could therefore erase terrain briefly. Refresh now marks groups dirty and swaps each only after constructing its replacement. Actual world replacement still clears the old world deliberately. This fixes the reproducible scene-blanking path; it is not a claim to have diagnosed every device-specific GPU/driver issue.

The sun's shadow volume now moves in shadow-texel-sized steps to reduce crawling shadows. Heat rings use polygon offset to reduce competing coplanar fragments. HUD resource cells are retained and their numbers updated in place instead of replacing all item markup every refresh.

## Collection feedback

The gameplay transaction awards inventory immediately and exactly once. Only after success does `Game` emit a transient cosmetic collection event. The event queue is capped at 32, does not enter save JSON and has no effect on ownership. It covers gathering, successful fishing catches and supply-chest salvage. Workers and ordinary inventory transfers do not pretend to be new player pickups.

`CollectionEffects` projects the collection point from the live camera, raises the icon for 220ms, then flies it along a curved path to the actual HUD cell rectangle over 730ms. The destination is measured each frame, including after portrait/landscape resize. The icon shrinks/fades near arrival, then the existing number gets a small 230ms pop. The displayed count updates on collection, not after the cosmetic flight. The effect reuses the game's original SVG item sprites rather than introducing external PNG downloads.

At most 12 flights exist simultaneously; extra bursts discard excess visual effects without discarding resource awards. Finished elements and number animations are cleaned up. Menu changes, modals and world replacement clear the effect layer. Reduced-motion mode awards/displays resources normally and omits travel and scale pops; it also removes ambient character sway while preserving deliberate action feedback.

## Verification

`npm.cmd test` includes original model/skin/clip, weapon geometry, event/award atomicity and bounded-event regressions. `npm.cmd run test:presentation` checks terrain swap continuity, actual GLB and fallback loading, locomotion and action states, hand sockets/support grip, damage/death, desktop/touch collections, viewport changes, effect caps, single awards and reduced motion. Screenshots are captured from the real running game in `test-results/`.


Final actual verification: `npm.cmd run build` passed (including TypeScript), `npm.cmd test` passed all 31 tests, and all six browser suites passed: `test:presentation`, `test:foundation`, `test:browser`, `test:ui`, `test:combat`, and `test:production`. The presentation suite also checks RMB+LMB firing/release and weapon switching during an active swing; it was rerun after the final animation transition correction. Production smoke was rerun against the final build. `git diff --check` passed. `preview:survivor` confirmed the GLB path, 17 bones, idle animation and HandR attachment, and captured a close gameplay view. No physical-device or endurance benchmark claim is made.

Actual game captures are included at `docs/screenshots/wayfarer.png` and `docs/screenshots/collection-flight.png`. Runtime geometry, source generator and the generated GLB are all kept in the repository. Existing Phase 1 work remains intact and uncommitted; no push or remote operation was performed.
