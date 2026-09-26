import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { catalogue } from "../src/world/catalogue.ts";
import { loadCreatureAsset } from "./helpers/creature-asset.ts";

test("all catalogue skins stay grounded while walking and remain bounded through their interactions", async () => {
  for (const creature of catalogue) {
    const { gltf, actor, driver, definition } =
      await loadCreatureAsset(creature);
    driver.sample("idle", 0, 0.2, false);
    const restJaw = gltf.scene.getObjectByName("Jaw")!.quaternion.clone();
    for (const [state, time] of [
      ["walk", 0.3],
      ["walk", 0.9],
      ["feed", 0.6],
      ["play", 0.45],
      ["magic", 1.6],
      ["celebrate", 0.8],
    ] as const) {
      driver.sample(state, time, 0.2, false);
      actor.updateMatrixWorld(true);
      const bounds = new THREE.Box3();
      let contactDistance = Infinity;
      let mouthDistance = Infinity;
      const mouth = driver.mouth.getWorldPosition(new THREE.Vector3());
      assert.ok(
        restJaw.angleTo(gltf.scene.getObjectByName("Jaw")!.quaternion) < 0.001,
        creature.id + " distorts its jaw",
      );
      for (const eye of ["Eye_L", "Eye_R"])
        assert.deepEqual(
          gltf.scene.getObjectByName(eye)!.scale.toArray(),
          [1, 1, 1],
          creature.id + " distorts its eyes",
        );
      const ball = new THREE.Vector3(
        0.27 + (definition.ballOffset?.[0] ?? 0),
        0.44,
        0.7 + (definition.ballOffset?.[1] ?? 0),
      );
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update();
        const joints = object.geometry.getAttribute("skinIndex"),
          weights = object.geometry.getAttribute("skinWeight");
        const foot = object.skeleton.bones.findIndex(
          (b) => b.name === "Foot_L",
        );
        for (
          let i = 0;
          i < object.geometry.getAttribute("position").count;
          i++
        ) {
          const point = object
            .getVertexPosition(i, new THREE.Vector3())
            .applyMatrix4(object.matrixWorld);
          assert.ok(point.toArray().every(Number.isFinite), creature.id);
          bounds.expandByPoint(point);
          if (state === "feed")
            mouthDistance = Math.min(mouthDistance, point.distanceTo(mouth));
          if (state === "play") {
            let influence = 0;
            for (let k = 0; k < 4; k++)
              if (joints.getComponent(i, k) === foot)
                influence += weights.getComponent(i, k);
            if (influence > 0.5)
              contactDistance = Math.min(
                contactDistance,
                point.distanceTo(ball),
              );
          }
        }
      });
      if (state === "feed")
        assert.ok(
          mouthDistance < 0.1,
          `${creature.id} mouth anchor misses face: ${mouthDistance}`,
        );
      if (state === "play")
        assert.ok(
          contactDistance < 0.34,
          `${creature.id} misses the ball: ${contactDistance}`,
        );
      if (state === "walk")
        assert.ok(
          Math.abs(bounds.min.y - 0.17) < 0.05,
          `${creature.id} foot floor ${bounds.min.y}`,
        );
      assert.ok(
        bounds.getSize(new THREE.Vector3()).length() < 6,
        `${creature.id} ${state} deformation escaped the garden`,
      );
    }
    driver.dispose();
  }
});
