# Pocket creature animation contract

## Delivered Unisaurus

The existing Meshy model now has 15 bones and six clips, rebuilt locally in Blender without additional provider calls or credits. The immutable Meshy original is unchanged. The previous Blender/runtime pair is backed up under `.local/animation-backup/`.

- Idle (4.8s): breathing, looking around, tail sway, blink.
- Walk (1.2s, looping): alternating steps, arm swing, head motion; lowest foot grounded after skinning.
- Eat (3.2s): arms reach, head lowers, jaw chews. Three bites at 1.0, 1.55 and 2.1 seconds after the clip starts.
- Play (1.2s): left-foot kick, contact at 0.45 seconds, follow-through.
- Celebrate (1.6s): happy head/arm/tail movement and eye squint.
- Magic (3.2s): existing bubble gesture with facial motion.

These are stylized facial deformations on the original continuous mesh. Eye squash gives a blink/squint; jaw weighting closes the mouth. This is not lip sync, independent gaze, a sculpted eyelid rig, or a full set of emotions.

Unisaurus's resting jaw now uses its closed pose through Idle, Walk, Play and Celebrate. Eat opens as the apple arrives and closes at each bite; Magic opens for bubbles. Reduced-motion Idle is closed too. The previous asset/source pair is retained in `.local/mouth-fix-backup/`.

The 35 catalogue rigs use `rig_catalogue.py` and a per-pair `fitting.json` with normalized landmarks. They reuse the clips at 65% rotation strength and 0.08-radian jaw motion because their source mouths are already closed. These are approximate expressions without a new mouth cavity. Trunks and ears follow Head. Each model has an optional X/Z ball offset fitted to its actual kicking foot. `catalogue-assets.test.ts` checks the delivered skins, grounded walk, bounded poses and ball contact across all 36 models. `validate-catalogue.mjs` checks every packaged GLB. Degenerate UV tangent corners receive a stable perpendicular tangent during export; source UVs and normals are preserved.

`src/world/behaviour.ts` sequences turns, walks, actions, props, reactions and return. `animation.ts` samples the authored clip on that same clock. There is no independent UI timeout: completion comes from the scene. Background tabs pause the sequence. Reduced motion and picture guests perform stationary interactions. Switching the motion preference during an action restarts its stationary/moving presentation without awarding another activity.

Snacks approach the real Mouth attachment and shrink at bite times. The ball stays still until the kick contact, rolls/bounces ahead, and the pet follows and celebrates. This is a scripted play routine, not a general physics/fetch simulation. Props are removed at the end. Idle strolling stays within the open central patch.

## Reusing it for another animal

Start with another upright creature with two legs, two arms, a head and a tail. Keep the template rest axes and bone names. Shared animation generation is in `scripts/blender/creature_clips.py`; source-specific landmarks and skin weights remain in `rig_unisaurus.py`.

Skeleton hierarchy:

- Root → Pelvis → Spine → Head → Jaw, Eye_L, Eye_R
- Spine → Arm_L, Arm_R
- Pelvis → Leg_L → Foot_L; Leg_R → Foot_R
- Pelvis → Tail → TailTip
- Mouth attachment follows Head, centered inside the visible mouth opening.

Keep feet grounded, forward +Z after glTF export, embedded textures, and the six exact clip names or an explicit manifest mapping. Keep travel out of the authored clips; only small vertical Root offsets belong in them. Fit facial centers and jaw hinge to each mesh. A jaw hinge with the opposite local axis will reverse chewing; do not copy landmark coordinates blindly.

The garden normalizes height to 2.6 units and caps length/width at 3.8. The kick target and stroll/prop distances are tuned to this size and the present biped proportions. For another body, review foot/ball contact and mouth/food contact before binding the model to a creature. Retargeting is approximate; quadrupeds, wings and trunks require another rig family or extra controls. No universal automatic weighting is claimed.

## Rebuild and acceptance

1. Run Blender background mode with `scripts/blender/rig_unisaurus.py` to create the editable source, poses and weight report.
2. Run Blender background mode with `scripts/blender/export_unisaurus.py` to export the compact runtime. Do not skip this: the first export retains source-resolution textures.
3. Run `npm run test:assets`, `npm test`, `npm run typecheck`, `npm run format:check`, and `npm run build`.
4. Review the actual browser model: idle stroll, blink, snack arrival/chews, kick contact, chase, return, consecutive actions, camera orbit and fallback picture guest.

`tests/world-asset.test.ts` parses the delivered GLB's actual geometry/skin/animation (removing image decoding only). It checks blink compression, jaw rotation, kicking-foot surface contact with the ball and ground contact through the walk cycle. Timeline tests check continuity, bite order, ball timing, reduced-motion travel, cleanup and bounded strolling. The glTF validator checks the packaged model and clip durations.

Remaining qualification: physical phone/tablet performance and manual reduced-motion OS preference testing. The scripted scene has no pathfinding or arbitrary click-to-walk control.

## Stable faces and surface contact revision

Runtime `animation.ts` now discards eye deformation tracks and holds Jaw at the authored Idle rotation for every clip. The retained Blender sources still contain the original experimental facial curves; runtime deliberately does not play them because these meshes have no independent eyelids or proper mouth cavity. Head/body gestures remain. This supersedes the earlier blink/chew acceptance criteria.

On load, the fitted mouth height is projected to the actual forward surface of each mesh, accounting for different muzzle/trunk depth. The apple approaches that moving attachment and its center stays one scaled apple radius in front, so the shrinking apple stays at the face. All-model tests check mouth-to-skin distance during feeding and stable eye/jaw transforms in addition to walking and ball contact.

Portraits use the same stabilized Idle pose, a fixed 3:2 orthographic camera, a transparent shadow-catching ground plane, and the generated background plate. The prompt reserves flat clear ground at the feet line. The actual rendered PNG is persisted and reused, not a second AI drawing of the pet.


## Tiny-planet world copies

The world uses optional `worldUrl` copies with one additional 17-second `Sleep` clip. `scripts/blender/world_sleep.py` opens the retained original source, samples its resting transforms, authors a side-rest/breathing/get-up sequence and grounds every sampled mesh pose in world space. The floor correction converts back through each rig’s scale/rest basis; Unisaurus has a 3.8-scale source rig. Originals and portrait URLs are unchanged. Edited sources are separate `world-rig.blend` files.

The world’s surface frame rotates the complete upright actor to the globe normal. Walk cadence follows distance, turns accelerate smoothly, frog mixes hop with bounded landings, broad elephant/penguin mixes waddle, and social music uses a shared clock for sway and bouncing. Faces continue to use stable eye/Jaw transforms. No quadruped weighting is claimed.

`tests/planet.test.ts` checks all 36 exported copies with glTF validation and sampled actual skinned vertices throughout sleep. A broad elephant’s ears mean side-rest height can be similar to standing height: acceptance checks the Root up-axis rotation and resting width as well as floor contact, rather than assuming every creature becomes thin when sideways. Original asset interaction tests still run.
