# Workers harvest standing trees and large stones

The previous worker code already supported felling and breaking, but the generic 1.6-unit approach point lay inside large-boulder navigation clearance. Grid rounding could also leave a worker outside gathering range. Workers now choose valid 1.5-unit navigation cells inside tool reach while preserving the target's solid collider: 2 units for ordinary resources/trees, 2.65 for large boulders. Blocked sources are skipped for ten simulation seconds so other resources can be attempted. Return paths use the same reachable approach method.

Workers fell trees, follow up on the resulting log, break boulders, then gather the resulting fragments. Wood remains 0.3s and stone 0.7s per action; these are separate breaking and pickup stages. No materials are awarded by the breaking animation. Workers carry finite materials to shared stores or use carried timber for the existing furnace tending. Multiple workers share persistent terrain/depletion records, preventing duplicate tree falls or yields. Harvest progress stays paused with menus, and old saves need no new fields.

Workers face their harvest target and visibly use an original rig-attached axe for wood or pickaxe for stone. Tools are removed/disposed when work stops or the visual is unloaded. Worker tree shaking reuses the existing bounded terrain-feedback effect and respects reduced motion; completed felling reuses the existing fall animation. Live presentation targets and temporary blocked-route caches are not saved.

The simulation tests exercise real solid colliders, logs/fragments and delivery, two-worker depletion, blocked-resource fallback, and save/load of completed terrain changes. The browser test uses actual generated forest and boulder resources, verifies axe/pickaxe/gather animation, and waits for stockpile delivery. See `npm run test:harvest`.

Validation: all 119 simulation tests, the production build and whitespace checks passed. Five browser suites passed across the regression run and focused rerun: harvest, workers, expansion, camp and production. The camp regression also caught a mobile furnace-panel overlap after the added day/night clock; the weather/clock now share space and the upgrade panel is capped below the combat HUD, verified in sunny and storm weather. Tests use headless Edge with touch emulation.

Verified captures: [tree chopping](screenshots/worker-chopping.png), [large-stone mining](screenshots/worker-mining.png).
