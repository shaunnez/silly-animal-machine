# Pocket Creature World — tiny planet and social play

Status: implemented on 26 September 2026 after the user’s “go for it”. This document retains the original plan below. Current behaviour and limits are in `docs/pocket-world-next.md`.

Delivery: A–D implemented. Verification passed: 53 tests, typecheck, format check and build; all 36 copied world GLBs validate with zero errors/warnings and grounded, stable-face sleep samples. Live browser checks confirmed body selection versus drag, simultaneous naps, shared ball and dancing, weather, mute, follow/overview, saved roster reload and both desktop sidebar sizes. Mobile has no horizontal overflow. Upright profiles are step/hop/waddle; no compatible quadruped family was introduced. Audio is synthesized cues, not recorded foley. Physical touch-device, OS reduced-motion and actual audio-device listening remain unverified. The upper hemisphere remains the intentionally bounded playable area.

## Intended experience

A cheerful little spherical planet where Ivy can tap an actual creature, immediately see which friend she selected, and watch friends play together. Actions should produce social scenes: a small group passes a ball, nearby friends dance to music, and several friends curl up in a cosy sleeping area. Movement should feel lively and intentional rather than like rigid figures sliding along a grid.

Keep the six-visitor cap, exact saved creature identities, existing portraits/powers, local-only play, reversible invites/swaps, gentle care and no absence penalties. Keep the current storybook visual language. No runtime AI, external generation, new paid jobs or deployment are part of this plan.

## Requested changes and concrete behaviour

### 1. Direct selection and unmistakable focus

- Click/tap a creature's visible body to select it. Names and thumbnail buttons remain equivalent keyboard-accessible choices.
- Distinguish a tap from camera drag with a small pointer movement threshold; dragging/pinching must not change selection.
- Raycast visible posed meshes (or carefully fitted hit proxies if needed for touch), map hits to saved creature IDs, and choose the nearest visible hit. The planet and foreground occluders must prevent selecting a hidden creature through them.
- Selected friend gets a conspicuous ground halo aligned to the surface, a small overhead marker, and a matching highlighted thumbnail/card. Avoid recolouring the creature's actual textures. Reduced motion uses a static highlight.
- Sidebar explicitly says “Selected: [name]”, shows the portrait and power, and keeps selection stable while creatures move or change activities. Duplicate names remain distinguishable by portrait/power and unique IDs.
- Selecting should not automatically interrupt an activity or jerk the camera. Follow is a separate control.

### 2. Multiple friends and shared activity sessions

The current `Map<Command, string>` allows only one visitor per activity type. Replace that with reservations for concrete seats/beds/playing positions and explicit shared activity sessions. A session owns its participants, phase, clock, targets and shared props. Each friend belongs to at most one incompatible activity at a time; different sessions run concurrently.

- **Snacks:** a picnic with up to six eating spots. Several friends eat simultaneously, each with food attached to its own fitted mouth. An occupied seat does not block the entire action type.
- **Ball:** selected friend plus one or two nearby available friends form a game. They approach playing positions, face the current player/ball, kick one shared ball, watch it travel, receive it, then pass again. Use two or three passes before celebrating. Do not give every participant its own unrelated ball. If alone, retain a solo kick-and-chase fallback. Allow another independent group if enough participants and a separate playing area are available.
- **Music:** a music-powered friend starts a short concert. Nearby available awake friends turn toward it and join a beat-aligned dance. Music radius is measured over the planet surface, not straight through it. Sleepers and friends already eating/playing are not forcibly interrupted. Animation works when muted; sound is presentation, not the simulation clock.
- **Naps:** multiple beds/cushions. The selected friend lies down; nearby tired available friends can independently choose other beds and join the nap. No one-bed global lock. Wake/stretch/get up before resuming walking.
- Other powers remain per-creature and may overlap, with bounded effects and audio. Nearby friends may give a brief happy reaction when idle.
- Show a concise status such as “Playing ball with Kittyfrog and Ellilion” or “Two friends joined the dance”. Selection never changes activity ownership or rewards.
- Invitations use available idle/wandering friends first. Explicit actions take precedence over autonomous ideas. Do not repeatedly interrupt manual care, take actors out of existing groups, or wake sleepers for a song.
- If a participant rests at home, fails to load, or leaves: release its slot, stop targeting it, continue with remaining participants where sensible, otherwise finish/cancel cleanly. Never strand a ball/session or double-award friendship.
- Credit each participant once on successful completion. Only actual eaters restore food; dancers/players gain joy; actual sleeping time restores energy. Keep one authoritative simulation clock.

Use deterministic scripted ball flight and contact events first. A general physics engine is unnecessary for a friendly passing game and would make contact, spherical gravity and reproducibility harder to control.

### 3. Real rest poses and better movement

- Replace standing-with-Zs with a genuine lower/lie-down → rest/breathe → wake/stretch → stand-up sequence.
- Add authored movement personalities: springy steps, little hops, waddles, and occasional happy jumps where suitable. Smooth turning and acceleration; do not pivot instantly at each grid corner.
- Drive walk cadence from travel speed/distance and blend starts/stops. Keep feet or the body grounded when appropriate, land hops cleanly, and prevent double vertical offsets from both a clip and the renderer.
- Assign a reviewed movement profile per model. Audit representative shapes first: Unisaurus, a frog mix, and a penguin or broad elephant mix. Then check all 36 catalogue models.
- Existing assets have upright 15-bone rigs. Do not promise that every one can become a convincing quadruped by rotating it forward. Four-legged movement requires compatible mesh proportions and suitable foreleg/spine weights; use a separate rig/profile only for suitable models. Upright bodies get polished biped/hopping movement.
- Use the retained Blender sources and local animation tools first. Preserve original GLBs, `.blend` files, fitting data and receipts. An actual missing-geometry gap is a separate asset decision, not permission for paid regeneration.
- Keep faces stable. Do not restore the eye squash/jaw stretching that previously distorted these meshes.
- Add optional extended clips/profile fields to the model manifest with safe fallback to existing clips; old saved scenes and portrait rendering must continue to work. Fall back only for missing assets, not as acceptance of a visibly standing “nap”.

### 4. A spherical planet with distinct places

- Replace the flat cylinder island with a visibly spherical toy planet. Proposed first release: four walkable neighbourhoods arranged across the upper/visible hemisphere, with the globe continuing beneath them. This delivers a spherical world and curved-ground movement without initially hiding most friends around the back. Full back-side exploration is a separate expansion.
- Ground attachment must be genuinely curved: position, local up, tangent heading, selection halos, trees/props, shadows, food, balls, sleep poses and powers must use the same surface frame. Do not merely place a round mesh below unchanged flat movement.
- Introduce one small surface-coordinate module: sample ground position/normal/tangent, measure distance, follow surface routes and offset vertically. Rendering, navigation and activities consume that contract.
- For the bounded first hemisphere, project the walkable route graph onto the sphere and use surface-distance edge costs; smooth routes only where collision clearance permits. Do not introduce a full engine or global navmesh framework speculatively.
- **Picnic grove:** checkered blankets, apple baskets and individual eating places under fruit trees.
- **Ball garden:** clearly open grass, playful boundary markings, flower/hedge edges and room for two small groups. Decorative props must stay out of routes and ball lanes.
- **Music clearing:** a colourful little stage/mushroom instruments and an open dance circle.
- **Nap nook:** sheltered soft beds/cushions, sleepy flowers, warm shade and a quiet palette.
- Link places with readable paths and landmarks. Distinguish them by geometry/props/layout as well as colour; no more nearly identical pastel discs with signs as the only clue.
- Whole-planet overview should keep the playable area readable. Close follow respects the current local up and avoids clipping through the sphere. Labels/markers must be occlusion-aware.

### 5. Living sky and gentle weather

- Slow drifting/orbiting clouds, a visible friendly sun with subtle motion and changing warm light.
- Sunny, light rain, and snow presets. A small world-level weather control near the scene/camera, not four extra blocks in the care sidebar. Default sunny; no aggressive flashing, storms, forced darkness or care penalties.
- Rain and snow are cosmetic particle systems emitted over the visible play area, falling toward the curved ground. Cap particle counts, reuse buffers/materials and avoid per-particle objects.
- Puddles/snow accents can be simple preset scenery changes; do not add terrain deformation, slippery navigation, seasons or offline weather simulation in this slice.
- Weather, clouds, sun and effects stop with world pause/hidden tabs. Reduced-motion mode restrains or disables drifting/falling/bouncing effects while preserving clear state.

### 6. A sidebar that fits and appropriate audio

- Replace the large six-card roster with a compact thumbnail strip/grid. Keep the selected portrait/name/power, three short labelled need bars, four compact actions, follow/pause and save status visible together.
- Remove the friendship flower panel from the main sidebar; preserve every saved friendship value. A small optional detail view can expose it later, but is not required for this delivery.
- Desktop acceptance: all primary care controls visible without sidebar or page scrolling at both 1280×720 and 1440×900. Do not achieve this with illegibly small text or tiny hit targets. Mobile retains natural scrolling or a compact bottom care panel, with no horizontal overflow.
- Event-based audio: light selection pop, invitation/join cue, soft footsteps/hops/landings, apple crunch at bites, ball tap at kick/contact, a melodic loop for group music, gentle yawn/wake cue, and quiet weather ambience.
- Reuse the existing Web Audio entrypoint and global sound toggle. Unlock/resume audio on a user gesture; respect mute everywhere, including weather and autonomous actions. Keep initial sound-off behaviour unless the user later changes it.
- Audio follows semantic simulation events, not React renders or independent timers. Stop/fade loops on pause, mute, hiding, scene disposal, or session end. Cap simultaneous voices and rate-limit repetitive sounds; do not play six competing melodies. Prioritise the selected/nearby friends. Selection has a visual equivalent.
- Start with local synthesized sounds or existing appropriately licensed assets; no remote audio service is needed.

## Ordered implementation slices and acceptance gates

### Slice A — selecting and controlling a friend

Owns body picking, drag/tap discrimination, strong selection feedback, compact sidebar and audio selection/action event plumbing. Use the current flat world to verify this independent slice.

Gate: mouse and touch selection on moving creatures; overlapping/duplicate models choose the intended ID; orbit gestures do not select; keyboard equivalents work; selected markers/card agree; primary controls fit both desktop sizes; old care/flowers remain saved; mute is respected.

### Slice B — one polished spherical social scene

Owns the surface frame, curved navigation/camera, distinct place layout and shared activity sessions. Make a vertical slice with three existing creatures: a shared ball game, concurrent eating, and music causing nearby idle friends to dance. Support six visitors without raising the cap.

Gate: grounded actors/props on different slopes, no planet/prop intersections, sensible route/slot allocation, clear kick/receive events, one ball per game, no conflicting ownership, independent simultaneous actions, and safe participant departure. Test behaviour separately from Three.js. Compare frame time to the six-model baseline before adding weather polish.

### Slice C — convincing sleep and locomotion

Owns local Blender animation/profile changes and smooth movement blending. Preview three representative bodies at ordinary play-camera size before fitting the rest. Audit all 36 for lying/resting ground contact, stepping/hopping, food and kick contact, face stability and duplicate skeleton independence.

Gate: visible lie-down/get-up transitions and at least three simultaneous sleepers; music dancers visibly share a beat; turns/steps do not slide or snap; hops have clean landings; incompatible quadruped profiles are rejected rather than distorting upright meshes. Run actual GLB skin/clip checks and validators for every changed asset.

### Slice D — weather, sound and final integrated polish

Owns animated sky, rain/snow presets, complete event audio, final visual balancing and error/performance checks.

Gate: six mixed creatures with simultaneous activities, weather and sound; mute/pause/hidden/reduced-motion rules work; bounded voices/particles/resources; save/reload and two-tab conflicts remain correct; whole-world and follow cameras work; compact controls stay visible. Target 60 fps on this Mac and investigate sustained regression below 45 fps at the agreed desktop viewport. A physical tablet is a separate device test, not an inferred pass.

Do not call the entire upgrade delivered after only Slice A. Keep a delivery checklist and identify which slices remain. No tests are needed merely for this planning document; implementation requires focused behavioural/asset tests and final type/format/build checks.

## Code ownership and constraints for continuation

- `src/world/PocketWorld.tsx`, `src/world/world.css`: compact care UI, selected state, invitations, accessible controls.
- `src/world/meadow.ts`: picking, renderer, shared world/props, selection, camera and resource lifecycle. It currently owns per-actor ball props and assumes world-up Y throughout; these are deliberate refactor points.
- `src/world/meadow-simulation.ts`: currently flat cells, instant yaw changes, global per-action reservations and independent per-actor action timers. Replace only the pieces required by surface navigation and group sessions; preserve deterministic care timing and ID attribution.
- New narrowly scoped surface/activity modules are justified by those responsibilities; avoid speculative entity-component or physics frameworks.
- `src/world/animation.ts`, `src/world/models.ts`, `scripts/blender/creature_clips.py` and per-model fitting/source files: optional motion profiles, stable faces, new sleep/dance/hop clips, model validation.
- `src/world/power-effects.ts`: effects need the planet's local surface frame; preserve the existing static portrait behaviour through an explicit default frame or adapter.
- `src/App.tsx` audio hook: replace generic chimes with typed events/shared audio lifecycle without duplicating audio contexts.
- `src/world/care.ts`, `world-session.ts`, `server/world.ts`: preserve needs/progress contracts, autosave serialization, revision conflicts, corrupt-save preservation. Keep in-flight social sessions transient; no offline replay or rewards on reload. Add a versioned migration only if persistent fields truly change.
- `tests/meadow.test.ts`, asset tests and `tests/portrait-api.test.ts`: extend for group membership, simultaneous care, surface orientation, completion attribution and persistence regression. Add meaningful input/audio lifecycle checks where practical, plus live browser verification.
- Do not modify `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, or `tests/sites-worker.test.mjs` for this local feature. No deploy, commits, paid generation or service restart implied.

## Current baseline and resumable handoff

Workspace: `/Users/shaun/Documents/ChatGPT/girls-game`. Local app: `http://127.0.0.1:4173/`. The existing server is already running; inspect/reuse it rather than restarting it. The repository files are untracked, so ordinary `git diff` is not a complete change inventory. Preserve all local collection data, generated art, original assets and receipts.

Current implementation has six visitors, local needs, per-ID progress, invitations/swaps, shared geometry with independent skeletons, stable faces, fitted food contact, basic individual care and safe saves. The preceding delivery passed 46 tests, type checking, formatting and build; that is a historical baseline, not verification of future changes. It measured around 16.7 ms per frame with six distinct models at 1440×900. The current build has the existing large Three.js chunk advisory. Physical tablet testing remains outstanding.

Read `AGENTS.md`, this plan, `docs/pocket-world-next.md`, relevant source/tests and `docs/creature-animation-contract.md` before editing. Later sections of that animation contract supersede earlier experimental facial behaviour. Product Design context should be used before the new planet visual work if the visual source is unclear; no skill/paid asset call was required just to write this plan.

Suggested continuation prompt:

> Implement `docs/pocket-world-upgrade-plan.md` in order, starting with Slice A and continuing through the complete upgrade. Keep the six-creature cap and existing saves/assets. Use the current local server, existing models and local Blender/Web Audio first. Preserve stable faces, no absence penalties and no runtime AI. Verify each slice in the browser and keep the document's delivery status honest. Do not launch paid generation, restart user services or deploy.
