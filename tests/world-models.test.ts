import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { sample, animals } from "../src/game.ts";
import {
  pairKey,
  resolveModel,
  type CreatureModel,
} from "../src/world/models.ts";
import { animateCreature } from "../src/world/animation.ts";

const definition: CreatureModel = {
  pair: ["dinosaur", "unicorn"],
  url: "/assets/models/unisaurus-v1.glb",
  clips: {
    idle: "Idle",
    walk: "Walk",
    feed: "Eat",
    play: "Play",
    magic: "Magic",
    celebrate: "Celebrate",
  },
  mouth: "Mouth",
};
test("nine animals have 36 unordered unique pairs", () => {
  const pairs = new Set<string>();
  for (const a of animals)
    for (const b of animals) if (a.id !== b.id) pairs.add(pairKey(a.id, b.id));
  assert.equal(pairs.size, 36);
  assert.equal(pairKey("dinosaur", "unicorn"), pairKey("unicorn", "dinosaur"));
});
test("models are tied to a reviewed creature variant and animal pair, independently of its power", () => {
  const manifest = { [sample.id]: definition };
  assert.deepEqual(resolveModel(manifest, sample), definition);
  assert.deepEqual(
    resolveModel(manifest, { ...sample, idea: "Makes music" }),
    definition,
  );
  assert.equal(
    resolveModel(manifest, { ...sample, id: "another-unique-drawing" }),
    undefined,
  );
  assert.equal(resolveModel(manifest, { ...sample, first: "cat" }), undefined);
});
test("malformed and external model paths are not loaded", () => {
  for (const entry of [
    null,
    {},
    { ...definition, url: "https://evil.example/model.glb" },
    { ...definition, url: "/assets/models/../secret.glb" },
    { ...definition, pair: ["cat"] },
    { ...definition, clips: { idle: "Idle" } },
    { ...definition, mouth: "" },
    { ...definition, ballOffset: [10, 0] },
    { ...definition, ballOffset: [0, NaN] },
  ])
    assert.equal(resolveModel({ [sample.id]: entry }, sample), undefined);
});
function fixture() {
  const root = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = "Mouth";
  root.add(bone);
  const clips = Object.values(definition.clips).map(
    (name, i) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.NumberKeyframeTrack(
          "Mouth.position[y]",
          [0, 0.5, 1],
          [0, i + 1, 0],
        ),
      ]),
  );
  return { root, bone, clips };
}
test("one clock samples walking and feeding poses and can return to idle", () => {
  const { root, bone, clips } = fixture();
  const animation = animateCreature(root, clips, definition);
  animation.sample("feed", 0.5, 0.2, false);
  assert.ok(bone.position.y > 2.8);
  animation.sample("walk", 1.5, 0.2, false);
  assert.ok(Math.abs(bone.position.y - 2) < 0.01);
  animation.sample("idle", 0.5, 0.2, false);
  assert.ok(Math.abs(bone.position.y - 1) < 0.01);
  animation.dispose();
});
test("reduced motion freezes the pose and broken animation assets fail explicitly", () => {
  const { root, bone, clips } = fixture();
  const animation = animateCreature(root, clips, definition);
  animation.sample("walk", 0.5, 0.2, true);
  const y = bone.position.y;
  animation.sample("feed", 0.7, 0.2, true);
  assert.equal(bone.position.y, y);
  animation.dispose();
  assert.throws(
    () => animateCreature(root, clips.slice(0, 2), definition),
    /missing/,
  );
});
