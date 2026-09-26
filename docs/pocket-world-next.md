# Ivy’s pocket galaxy — delivered

Open **My World** from the main navigation, or **Play with my creature**. Four planets host up to six unique saved friends each, for 24 residents across the galaxy. Invite, swap and Rest at home remain reversible; collection deletion is separate.

## Play

- Click a visible creature body, its overhead name or roster thumbnail. The gold surface halo, arrow/name tag and selected portrait agree. Camera drags do not select a new friend. Follow gives a close view; the house button restores the whole planet.
- The entire toy globe is walkable, including its back and both poles. Longitude routes wrap without a seam; a connected latitude graph keeps spacing practical near poles. Drag in any direction or use the four rotate buttons. Curved paths connect picnic blankets, two ball playing areas, a music clearing and six nap cushions. Surface frames drive creature up vectors, terrain props, halos and ball travel. Routes use geodesic edge costs and occupied/reserved cells.
- Picnic seats and beds reserve individual cells. Multiple friends can eat or sleep together. Apples track each eater’s fitted moving mouth. Sleep has a 1.5-second settle, side-rest/breathing, and three-second rise; energy grows only during actual rest.
- Ball sessions recruit up to three available participants and own one shared ball. Two separate groups can run concurrently. Friends approach, kick/pass and celebrate, receiving one completion reward each. Solo play retains a small kick/chase. No physics engine.
- Music recruits nearby available awake friends. They share one simulation beat, body sway and bounce; music effects come from music-powered actors. Other activities and sleepers are not interrupted. Only one session supplies the audible melody.
- Upright bodies use stepping, frog mixes hop and broad elephant/penguin mixes waddle. Speed drives cadence, turns ease, and hops settle at cell boundaries. These meshes remain upright rigs; no quadruped conversion is claimed.
- Sunny, gentle rain and snow presets change sky/fog colour, lighting, cloud colour and terrain. Rain uses 420 short falling strokes; snow uses 420 flakes. Seeded grass texture and small flower gardens cover the globe. Sound is optional local synthesis, capped at six short voices, with nine cartoon animal calls (selection uses the first animal of the hybrid), joining, footstep, bite, kick, melody, sleep/wake, magic and weather cues. Mute/pause/hidden/disposal stop audio. Reduced motion restrains movement/effects; the sleep pose remains a lying pose.
- A full-height floating care card uses four full-width action rows that stretch into the remaining space. Desktop care controls fit at 1280×720 and 1440×900. The smaller logo and navigation gap retain mobile scrolling. Friendship flowers are no longer in the sidebar, but their saved values remain intact. Mobile retains natural vertical scrolling.

## Persistence and boundaries

Version-2 `.local/world.json` stores `activePlanet`, per-planet resident IDs, per-ID needs/progress and a revision. Version-1 invited IDs migrate to Meadow; all care remains. The first migration write retains the original `.local/world.json.v1-backup`. Old clients must reload before writing. Independent identities include duplicate models. Active visible play alone changes needs; pause, invite dialogs, hidden tabs and save failures stop care. No absence penalties. Atomic serialized saves and conflict recovery remain in place; activities/positions are transient and interrupted actions earn no completion.

True quadruped rigs, physical ball simulation and device-specific tablet qualification are separate work. There is no runtime AI, Meshy call, additional spend, dependency or deployment.

## Assets and verification

Original models and source rigs remain unchanged. `scripts/blender/world_sleep.py` creates `world-rig.blend` copies and `*-world.glb` assets; the manifest’s optional `worldUrl`, `clips.sleep` and `motion` fields are used in the shared world. Portraits retain original URLs. All 36 world copies pass glTF validation, grounded sleep samples and stable face checks.

Verification: 57 tests, typecheck, formatting and production build passed. Live browser checks cover body selection/drag discrimination, three simultaneous naps, three-player ball passing, a four-friend dance, follow/overview, rain/snow/mute, saved roster reload, desktop fit and mobile overflow. Six-model desktop rendering remained approximately 16.6–16.7 ms per frame during checks. This is not a physical tablet or audio-output-device qualification. The existing Three.js bundle-size advisory remains.


## Planets and spaceships

Use the four planet buttons to visit Meadow, Candy, Water or Snow without moving residents. Candy has pink terrain and lollipop trees; Water has a magical walkable ocean, sandy islands and coral; Snow has icy peaks and snowmen. The existing activity neighbourhoods and powers work on each planet.

Select a resident and choose **Fly [name] to another planet**. Destinations show occupancy and disable when full. The transfer saves atomically before a short local spaceship animation shows the friend in its window. Arrival selects that same friend on the destination. Changing pages during an already saved flight does not lose the resident. Duplicate clicks are locked during transfer; a failed save pauses play and blocks the journey. Needs on unvisited planets remain unchanged. Existing positions/actions reset when leaving a planet, with no reward for an interrupted action.

**Invite friends** adds an unassigned saved creature to the current planet. Friends already elsewhere link to their planet; they must use a spaceship to relocate. **Play with my creature** opens that creature's current planet, while **My World** remembers the last planet. The spaceship is an illustrated travel sequence, not a piloting game or a 3D flight simulator. No runtime AI or new Meshy assets are used.
