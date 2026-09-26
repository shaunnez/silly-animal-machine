import * as THREE from "three";
import {
  animationStates,
  type CreatureModel,
  type AnimationState,
} from "./models";

/** Sample authored poses on the interaction clock so feet, bites and props agree. */
export function animateCreature(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
  definition: CreatureModel,
) {
  // Generated faces have no separate eyelids or cut mouth cavity. Keep their
  // authored resting shape; body/head gestures carry expression without tearing.
  const idle = clips.find((c) => c.name === definition.clips.idle);
  const stableClips = clips.map((clip) => {
    const stable = clip.clone();
    stable.tracks = clip.tracks
      .filter((t) => !/^Eye_[LR]\./.test(t.name))
      .map((track) => {
        if (!track.name.startsWith("Jaw.")) return track;
        const rest = idle?.tracks.find((t) => t.name === track.name);
        if (!rest) return track;
        const fixed = rest.clone();
        fixed.times = new Float32Array([0]);
        fixed.values = rest.values.slice(0, rest.getValueSize());
        return fixed;
      });
    return stable;
  });
  for (const name of ["Eye_L", "Eye_R"])
    root.getObjectByName(name)?.scale.set(1, 1, 1);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<AnimationState, THREE.AnimationAction>();
  for (const state of [...animationStates, "sleep"] as const) {
    const clip = stableClips.find(
      (candidate) => candidate.name === definition.clips[state],
    );
    if (state === "sleep" && !clip) continue;
    if (!clip || clip.duration <= 0)
      throw new Error(`Creature is missing its ${state} animation`);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    actions.set(state, action);
  }
  const mouth = root.getObjectByName(definition.mouth);
  if (!mouth) throw new Error("Creature is missing its mouth attachment");
  fitMouthToSurface(root, mouth);
  let active: THREE.AnimationAction | undefined;
  let previous: THREE.AnimationAction | undefined;
  let blended = 1;
  return {
    mouth,
    sample(
      state: AnimationState,
      seconds: number,
      delta: number,
      reduced: boolean,
    ) {
      const next =
        actions.get(state === "sleep" ? "sleep" : reduced ? "idle" : state) ??
        actions.get("idle")!;
      if (next !== active) {
        previous?.stop();
        previous = active;
        active = next;
        next.reset().play();
        blended = previous && !reduced ? 0 : 1;
      }
      blended = Math.min(1, blended + delta / 0.16);
      active!.setEffectiveWeight(blended);
      previous?.setEffectiveWeight(1 - blended);
      const duration = active!.getClip().duration;
      const loop = state === "idle" || state === "walk";
      active!.time = reduced
        ? state === "sleep"
          ? 8
          : 0
        : loop
          ? seconds % duration
          : Math.min(seconds, duration - 0.00001);
      mixer.update(0);
      if (blended === 1) {
        previous?.stop();
        previous = undefined;
      }
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  };
}

/** Project the fitted mouth height onto the actual front of this mesh.
 * Old template anchors could sit inside a short muzzle or behind a long trunk.
 */
export function fitMouthToSurface(root: THREE.Object3D, mouth: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const reference = mouth.getWorldPosition(new THREE.Vector3());
  const candidates: THREE.Vector3[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    o.skeleton.update();
    for (let i = 0; i < o.geometry.getAttribute("position").count; i++) {
      const point = o
        .getVertexPosition(i, new THREE.Vector3())
        .applyMatrix4(o.matrixWorld);
      if (
        Math.abs(point.x - reference.x) < 0.12 &&
        Math.abs(point.y - reference.y) < 0.08
      )
        candidates.push(point);
    }
  });
  if (!candidates.length || !mouth.parent) return;
  candidates.sort((a, b) => b.z - a.z);
  // Average the front patch rather than snapping to an isolated triangle tip.
  const front = candidates.filter((p) => p.z > candidates[0].z - 0.035);
  const contact = front
    .reduce((sum, p) => sum.add(p), new THREE.Vector3())
    .multiplyScalar(1 / front.length);
  mouth.position.copy(mouth.parent.worldToLocal(contact));
  mouth.updateMatrixWorld(true);
}
