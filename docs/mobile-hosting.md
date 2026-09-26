# Mobile and GitHub hosting

The hosted build uses IndexedDB for creatures, PNG blobs and revision-checked world saves. Saves stay on that browser/device; no existing Mac collection is uploaded. Local development still uses `.local` through the original Node API. Static asset paths respect the Pages project prefix.

Mobile changes: three-column animal pickers, compact navigation, safe-area padding, planet/weather/activity/camera toolbars outside the canvas, fixed care tray naming the selected friend, 44px primary controls, larger touch drag threshold and a wider portrait camera. Rendering pixel ratio is capped at 1 on narrow screens. Desktop retains the sidebar.

Verified using the production browser-storage build served as static files beneath `/silly-animal-machine/`: creature creation and portrait completion, collection reopening, world save/reopening, care action dispatch and planet switching. At 320px and 390px widths there is no horizontal overflow; Snow's three activity buttons are at least 44px high. 844x390 landscape also fits horizontally. Physical iPhone/Android touch gestures and Safari GPU performance have not been tested. One initial portrait retry was caused by replacing build files during testing; the saved unfinished creature recovered successfully after reload.

70 unit/integration tests, typecheck, formatting, build and four Sites packaging tests pass. IndexedDB tests cover blob persistence, concurrent collection writes, cross-tab save conflicts and invalid-data preservation. Existing Three.js bundle size warning remains.

The GitHub Actions workflow tests pushes/PRs. Deployment is enabled with repository variable `PAGES_ENABLED=true` after Pages is configured for Actions. It builds with `VITE_STORAGE_MODE=browser` and `VITE_BASE_PATH=/silly-animal-machine/`, then deploys only `dist/client`. Source is in shaunnez/silly-animal-machine; private Pages was rejected by the account plan, so public hosting requires the user's repository-visibility choice.

Original Blender files, provider receipts, `.local` saves and test screenshots stay on the authoring machine. This repository contains the optimized runtime assets, not the full art archive.
