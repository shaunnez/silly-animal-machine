# Silly Animal Machine

A browser game for phones, tablets and computers: choose two animals, choose one of four powers, make a magical creature, and play together in a pocket garden. Built from the supplied reference image, with original generated artwork.

## Hosted play and mobile

**[Play Silly Animal Machine](https://shaunnez.github.io/silly-animal-machine/)**

The GitHub Pages build runs entirely in the browser, including creature creation, portrait composition and world saves. It requires no local server, ChatGPT account or API keys. Use the same browser on the same device to keep your collection. Saves are separate on each device and from the original local Mac game; clearing site data/private browsing may remove them. Models and scenery need an internet connection to load; offline installation and cross-device syncing are not implemented.

Mobile has a three-column animal picker, safe-area spacing, separate planet/camera toolbars and a fixed care-action tray with the selected friend's name. Drag the ground to rotate, pinch to zoom, tap a creature to select, or drag its body to carry it. **Move friend** plus a ground tap is an alternative. Mobile rendering uses a capped pixel ratio and fits the globe to portrait screens. Desktop keeps its existing sidebar.

The Pages workflow tests and deploys `main` to `/silly-animal-machine/`. To reproduce its build:

```sh
VITE_STORAGE_MODE=browser VITE_BASE_PATH=/silly-animal-machine/ npm run build
```

Only `dist/client` is deployed. Runtime art is bundled under `public/assets`; original Blender sources/provider receipts stay on the authoring workstation. No `.local` saves or credentials belong in the repository.

## Local play

Double-click **Start Silly Animal Machine.command**, or run:

```sh
npm install
npm start
```

Open http://127.0.0.1:4173. Node.js 22+ is required. Codex and a ChatGPT login are not needed to play. Keep the terminal open while playing; Control-C stops the game. The launcher reuses an already running instance.

## Instant local pictures

The game randomly chooses one of ten bundled landscapes, reuses the selected animal pair's existing 3D model, and renders its shadow and selected power into a single PNG. No LLM, external image request, subscription login, API key, or generation credits are needed during gameplay. Consecutive creations avoid the previous landscape, including after a helper restart. Existing pictures remain unchanged.

The four powers are rainbow bubbles, flower magic, music maker, and shooting stars. Each appears in the saved portrait and has its own garden action; music plays a short tune if sound is enabled. Live click-to-save checks on this Mac took 0.78 seconds for flower Unisaurus and 0.27 seconds for music Kittyfrog. Performance depends on model loading and the device's GPU.

The landscapes were generated once with built-in imagegen. Runtime JPEGs are in `public/assets/backgrounds/` (about 4.9 MB total); original PNGs and exact prompts/provenance are in `art/backgrounds/manifest.json`. The normal generation endpoint contains no provider calls. The old `server/codex.ts` adapter and earlier `.local/generator` receipts remain as historical recovery tools, outside the runtime path.

## Saved creatures

Generated pictures and collection metadata are stored under `.local/`, which is excluded from Git. Back up that directory to keep the collection. Clearing browser data does not erase it. The bundled Unisaurus is always available as a starter friend. Download any picture with the download button.

The bundled artwork was generated and reviewed during development; names and short descriptions are constructed locally. New recipes use the four fixed power choices. No advertising, analytics, public gallery, account creation, or scoring penalties.

## Local boundaries

- Binds to `127.0.0.1` only. It is for this computer, not LAN or public hosting.
- Recipe validation, same-origin checks, host allowlist, and per-process request token protect the generation endpoint.
- Animal pair and power IDs are validated. New powers use canonical descriptions; stored legacy ideas remain readable.
- Portrait uploads have bounded size and PNG dimensions. Atomic serialized writes preserve other creatures and handle duplicate saves safely.
- The app's local API does not load credentials, launch Codex, or contact an image provider. Existing legacy images and receipts are retained.

## Development and checks

```sh
npm run typecheck
npm test
npm run build
npm run test:sites
npm run format:check
```

React + TypeScript + Vite. `src/game.ts` owns recipe validation and naming; `src/powers.ts` owns the power catalogue; `src/backgrounds.ts` owns the bundled landscapes; `server/api.ts` owns local jobs and storage; `src/App.tsx` implements the game.

Sites packaging is retained. The default local build uses the Node API; static hosts must build with `VITE_STORAGE_MODE=browser` to use IndexedDB. `npm start` continues to use the original `.local` save files. `src/game-request.ts` selects the storage mode, and `src/browser-store.ts` uses atomic IndexedDB transactions with revision checks across tabs. Portraits are saved as blobs; storage failures preserve earlier saves and pause care.

See `design-qa.md` for browser acceptance and `docs/artwork.md` for asset provenance.

## Pocket Creature World

Use the sun/rain/snow buttons to change the sky, clouds, lighting, precipitation and terrain. The globe has local grass texture and flower patches. Clouds drift and the sun moves; pause freezes the sky too. Sound starts muted and uses the main sound toggle; selecting a friend plays a synthesized cartoon call based on its first animal. The four neighbourhoods are the apple picnic, ball garden, music clearing and nap nook.

Open **My World**, or **Play with my creature**, for four spherical worlds: Meadow, Candy, Water and Snow, with six residents each (24 total). **Invite friends** lets you invite, swap, or send a friend home to rest without deleting them. The first visit brings the starter and up to five recently made 3D friends to Meadow. Use the planet buttons to look around; select a friend and choose **Fly to another planet** to move them by spaceship. Progress travels with them, and residents elsewhere keep their care. Legacy saves migrate automatically with an original backup. Click a creature’s body, name or thumbnail to select it; **Follow friend** travels with it around the whole sphere, and the house camera button returns to the whole meadow. Drag freely over the poles or use the four rotation buttons.

Each friend has Tummy, Energy, and Happiness. Friends wander, greet one another, share picnic snacks, pass a ball in groups of two or three, and lie down in separate beds when tired. A music-powered friend invites nearby available friends to dance. You can also ask for an apple, a ball game, a nap, or their special power. Friendship progress continues to accumulate in the save; its large flower panel is hidden to keep care controls visible. Needs change only during active visible play and pause while the invite dialog is open. Nothing declines while away; there is no illness, death, or absence penalty. **Pause meadow** stops the simulation.

Invited friends, needs, and friendship are saved to `.local/world.json`, separately for each creature ID. Existing browser friendship progress is imported the first time each friend visits, without deleting the old save. Back up `.local/` to keep creatures, pictures, and care together. Autosave runs every five seconds and after completed activities/roster edits; a browser crash can lose the last few seconds. Interrupted activities are not awarded on reload, and friends restart at safe positions. A conflicting tab or failed save pauses play and offers recovery rather than overwriting another visit.

The scene shares model geometry and textures and independently clones skeletons/animation clocks. The same animal model can appear as several saved friends with different powers and care. Faces keep their stable authored shape; apples follow fitted mouth anchors. Missing models fall back to labelled picture guests. All care, pathfinding, rendering, and powers run locally without AI calls or credits.

Use the normal **Play** screen: select two animals, choose a power, then **Generate My Creature**. The pair selects one of the 36 existing models. A fixed-camera Three.js render places the real model, its contact shadow, and the power effect into a randomly selected bundled landscape, then saves the resulting PNG. **Your Magical Creature** and **My Creatures** use exactly that same picture. Play opens the matching model and power in the interactive garden. The garden remains the shared 3D play space; the landscape is a composed portrait backdrop, not reconstructed 3D terrain.

New collection entries retain `powerId`, `scene.version`, `scene.modelId`, `scene.backgroundId`, `scene.background`, `scene.portraitVersion` and `scene.portrait`. Original backgrounds are preserved. If composition fails or the browser closes mid-render, open the unfinished card and choose **Finish my picture**; this does not request another AI image. Portrait saves are bounded, authenticated, serialized and idempotent. Existing legacy drawings are kept as picture guests rather than being silently replaced.

The model catalogue lives in `public/assets/models/creatures.json`. An explicit model ID and matching unordered animal pair are required. There is no separate 3D Friends menu. Models and powers remain independent; all four powers work with every animal pair. Older creatures keep their original idea text; exact matching ideas use the matching power and other legacy ideas fall back to bubbles. No Meshy credits are used by this recipe flow.

World code: `src/world/PocketWorld.tsx` (UI), `meadow.ts` (shared renderer), `meadow-simulation.ts` (navigation, reservations, activities), `care.ts` (needs/save contract), `world-session.ts` (serialized browser saves), and `server/world.ts` (atomic revision-checked persistence). `animation.ts`, `models.ts`, `progress.ts`, and the power effects are shared with the existing assets. Reduced-motion users get still poses, no spontaneous wandering, and restrained effects; explicitly requested care still travels to its activity spot. Failed model loads fall back to the saved picture; WebGL failures offer retry/back. Meshy is an adult-approved asset preparation step; the local game has no Meshy credentials or generation endpoint.

### Rebuilding Unisaurus

- Immutable provider asset: `art/unisaurus/meshy-original.glb`.
- Editable source: `art/unisaurus/unisaurus-rig.blend` (Blender 5.2.1).
- Rebuild the reviewed custom rig: run Blender in background mode with `scripts/blender/rig_unisaurus.py`.
- Export the compact runtime model: run Blender with `scripts/blender/export_unisaurus.py`. This keeps source textures intact and downsizes runtime textures to 1024px.
- Runtime: `public/assets/models/unisaurus-v1.glb`.
- Verify: `npm run test:assets` runs the Khronos glTF validator and checks the required joints, clips, attachment and embedded resources.

The rig script's landmarks and skin masks are specific to this exact Meshy geometry. Do not use it as an automatic rigging pipeline for other animal bodies. Shared animation curves live in `scripts/blender/creature_clips.py`; mesh fitting remains in `rig_unisaurus.py`. The 15-bone rig includes feet, jaw and two eye squash controls. These are stylized blinks and chewing, not a full facial expression/viseme system. See `docs/creature-animation-contract.md` for reuse and acceptance. Original assets, project/task records, sampled pose renders, validation and weight reports are retained under `art/unisaurus/` and `docs/meshy/`.

### Catalogue sources and checks

The 35 new assets retain sources in `art/catalogue/<pair>/`: `meshy-original.glb`, `reference.png`, `receipt.json`, `fitting.json`, and `creature-rig.blend`. Rebuild one with Blender's `scripts/blender/rig_catalogue.py -- <pair>`; re-export existing sources with `scripts/blender/export_catalogue.py -- <pair> ...`. These tools make no provider calls. Run `node scripts/validate-catalogue.mjs` for all 36 models, plus the normal test/type/build checks. The skin tests check grounded walking, bounded deformations and fitted foot/ball contact for every pet.

Generation cost **525 Meshy credits**, leaving **1,468** at delivery. See `docs/meshy/catalogue-delivery.md` for all producing task IDs and limitations. `scripts/generate-catalogue.mjs` is an adult-operated, receipt-backed one-attempt utility, never a child-facing endpoint; do not use it to rerun a paid task without a new decision.

## Shared-world proposal

Desktop pages share a viewport-height frame; My Creatures scrolls its cards internally. Mobile and very short screens retain natural page scrolling.

Ivy’s shared world and tiny-planet upgrade are implemented. See `docs/pocket-world-next.md` for current behaviour and `docs/pocket-world-upgrade-plan.md` for the upgrade and verification record.
