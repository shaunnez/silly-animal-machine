import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { loadCreatureAsset as asset } from "./helpers/creature-asset.ts";

test("the delivered skin keeps a stable face and reaches the ball at the kick frame", async () => {
  const { gltf, actor, driver } = await asset();
  const jaw = gltf.scene.getObjectByName("Jaw")!;
  driver.sample("idle", 0, 0.2, false);
  const resting = jaw.quaternion.clone();
  for (const [state, time] of [
    ["idle", 3.25],
    ["feed", 0.6],
    ["feed", 1],
    ["magic", 1.6],
  ] as const) {
    driver.sample(state, time, 0.2, false);
    assert.ok(
      resting.angleTo(jaw.quaternion) < 0.001,
      "Jaw stays in its closed resting shape",
    );
    assert.equal(
      gltf.scene.getObjectByName("Eye_L")!.scale.y,
      1,
      "Eyes are not crushed by blink tracks",
    );
  }
  driver.sample("play", 0.45, 0.2, false);
  actor.updateMatrixWorld(true);
  const ball = new THREE.Vector3(0.27, 0.44, 0.7);
  let closest = Infinity;
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    object.skeleton.update();
    const joints = object.geometry.getAttribute("skinIndex"),
      weights = object.geometry.getAttribute("skinWeight");
    const foot = object.skeleton.bones.findIndex((b) => b.name === "Foot_L");
    for (let i = 0; i < joints.count; i++) {
      let influence = 0;
      for (let c = 0; c < 4; c++)
        if (joints.getComponent(i, c) === foot)
          influence += weights.getComponent(i, c);
      if (influence < 0.5) continue;
      const point = object
        .getVertexPosition(i, new THREE.Vector3())
        .applyMatrix4(object.matrixWorld);
      closest = Math.min(closest, point.distanceTo(ball));
    }
  });
  assert.ok(
    closest < 0.34,
    `The foot must touch the ball, nearest surface distance ${closest}`,
  );
  driver.dispose();
});
test("delivered walk deforms alternate legs and keeps a foot on the ground", async () => {
  const { gltf, actor, driver } = await asset();
  for (const time of [0.15, 0.3, 0.6, 0.9]) {
    driver.sample("walk", time, 0.2, false);
    actor.updateMatrixWorld(true);
    let floor = Infinity;
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      for (let i = 0; i < object.geometry.getAttribute("position").count; i++) {
        const point = object
          .getVertexPosition(i, new THREE.Vector3())
          .applyMatrix4(object.matrixWorld);
        floor = Math.min(floor, point.y);
      }
    });
    assert.ok(
      Math.abs(floor - 0.17) < 0.035,
      `Walking foot must stay grounded at ${time}: ${floor}`,
    );
  }
  driver.dispose();
});

test("duplicate meadow friends share geometry but have independent skeletons and animation clocks", async () => {
  const { clone } = await import("three/addons/utils/SkeletonUtils.js");
  const { animateCreature } = await import("../src/world/animation.ts");
  const { gltf, definition, driver } = await asset();
  driver.sample("idle", 0, 0.2, false);
  const first = clone(gltf.scene),
    second = clone(gltf.scene);
  const a = animateCreature(first, gltf.animations, definition);
  const b = animateCreature(second, gltf.animations, definition);
  a.sample("walk", 0.3, 0.2, false);
  b.sample("idle", 0, 0.2, false);
  const before = second.getObjectByName("Foot_L")!.quaternion.clone();
  a.sample("feed", 1, 0.2, false);
  assert.ok(
    before.angleTo(second.getObjectByName("Foot_L")!.quaternion) < 0.000001,
  );
  const skins = (root: THREE.Object3D) => {
    const meshes: THREE.SkinnedMesh[] = [];
    root.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) meshes.push(o);
    });
    return meshes;
  };
  const [one, two] = [skins(first), skins(second)];
  assert.ok(one.length > 0);
  assert.equal(one[0].geometry, two[0].geometry);
  assert.notEqual(one[0].skeleton, two[0].skeleton);
  assert.notEqual(one[0].skeleton.bones[0], two[0].skeleton.bones[0]);
  driver.dispose();
  a.dispose();
  b.dispose();
});
