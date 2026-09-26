# Planet playgrounds

Implemented 26 September 2026.

In My World, choose a planet and a friend, then use the scene's “Only on…” buttons. Meadow has a rainbow slide, Candy has jelly trampolines, Water has bubble fountains, and Snow has skiing, snowboarding and a snowball party. Available friends join, with three participants maximum. Snowballs require at least two available residents on Snow. Friends also occasionally choose their local attraction while wandering.

## Behaviour and ownership

`src/world/attractions.ts` defines the planet mapping, reserved seats/exits and continuous ride paths. `attraction-scenery.ts` builds local Three.js props and ride gear. The simulation owns walking, reservations, group membership, cancellation and completion; the renderer adds height, lean, gear and projectiles. Snow's hill is geometric terrain shared with actors and scenery. Skiing and boarding use simple toy poses and existing clips, not newly generated sports rigs.

Completed outings award existing play/happiness progress once. Pickup interrupts an outing without a reward and frees its reserved lane. A snowball group with fewer than two remaining friends cancels. Pause/hidden lifecycle, safe saves and planet ownership remain unchanged. No schema migration, paid generation, new models or dependencies.

## Verification

66 tests passed, including all six attraction routes/completion, occupied lanes, wrong planets, pickup interruption, snowball partner removal, continuous ride exits and real snowy descent. TypeScript, Prettier and production build passed. Existing large Three.js bundle advisory remains.

Browser QA used copied saves on temporary port 4183. Observed the slide, jelly bouncing and skiing with visible skis. Screenshots: `qa/planet-slide.png`, `qa/planet-ski.png`. Snowboarding and a two-friend snowball game were requested and routing observed, but final gear/projectile visuals were not captured. Browser subsequently blocked the isolated page (`ERR_BLOCKED_BY_CLIENT`), so final fountain visuals and new mobile layout were not verified. Do not infer physical touchscreen or audio listening acceptance from these tests.

The original 4173 service and user saves were not restarted or replaced. The isolated QA server was stopped and the in-app preview returned to Play on 4173.
