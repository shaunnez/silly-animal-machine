# Creature catalogue and powers

## Current playable slice

All 36 unordered animal combinations are available under **3D Friends**. Unisaurus retains its custom rig and now has a closed resting mouth. The other 35 use a fitted upright biped template, six clips (Idle, Walk, Eat, Play, Magic, Celebrate), and a Mouth attachment. Custom saved drawings remain picture guests. No batch generation is triggered by the game. The nine existing animal choices and free-text picture generation remain available.

Model selection uses the exact creature ID plus a checked, unordered animal pair. Catalogue IDs use `catalogue-<pair>-v1`; each has separate browser progress. A different drawing of the same pair must not silently become the same model.

## Scale the creature set separately from powers

Nine animals produce 36 unique unordered pairs, excluding self-pairs. If animal order should produce different anatomy, this becomes 72 and needs an explicit product decision. The approved 35-model batch consumed 525 credits. Per-model source, task trail, fit and limitations are retained in `art/catalogue/` and `docs/meshy/catalogue-delivery.md`.

Every model should meet the same runtime contract: grounded rest pose, forward +Z in glTF, embedded textures, named Idle/Walk/Eat/Play/Magic/Celebrate clips, and a Mouth attachment. The shared biped clip authoring and fitting contract is in `docs/creature-animation-contract.md`. More attachments (Head, Back, Feet) can be added when an implemented power needs them. The source Blender rig remains species-specific: bipeds, quadrupeds, winged creatures, trunks, and long tails need different anatomy/weight checks. Do not assume this hand-tuned Unisaurus script can auto-rig 36 different meshes.

Runtime budgets: about 10–20k triangles and 1k textures per creature, load only the selected pet, keep model and power versioning independent. Physical phone/tablet performance remains to be qualified. Some generated seams and facial deformations need further art polish; no extra paid reruns were made.

## Curated power direction — proposed, not implemented

Use 12 selectable powers initially. Each has a stable power ID, child-facing label, controlled illustration prompt fragment, and deterministic game effect. Add only ready effects to the picker. Keep old custom idea text visible on existing creations; never silently claim that arbitrary text has an implemented game effect.

1. Rainbow bubbles — bubbles emerge from Mouth (Unisaurus prototype implemented).
2. Musical notes — floating notes and optional short tones.
3. Flower footsteps — flowers along a small play path; locomotion is now available; the flower effect is still a follow-up.
4. Pancake party — a pancake snack instead of the apple.
5. Sparkle sneeze — a short sparkle puff from Mouth.
6. Rainbow trail — a ribbon behind a hop or movement.
7. Dancing feet — a reviewed dance clip with optional music.
8. Butterfly friends — a few butterflies orbit the pet.
9. Cloud hopper — small clouds and a gentle hop.
10. Snowflake twirl — soft snowflakes that melt away.
11. Heart hugs — a cuddle reaction and floating hearts.
12. Firefly glow — gentle lights around the pet.

Keep the effect as a reusable game component, not baked into every model or generated as a video per combination. That turns 36 pets × 12 powers into 36 reviewed pet assets plus 12 effects, with compatibility checks, rather than 432 separate generated models. This is an implementation roadmap; only rainbow bubbles are currently present.
