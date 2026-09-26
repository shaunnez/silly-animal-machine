import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import { validateBytes } from "gltf-validator";
import {
  surfaceFrame,
  surfaceDistance,
  planetCenter,
  planetRadius,
} from "../src/world/surface.ts";
import { catalogue } from "../src/world/catalogue.ts";
import { loadCreatureAsset } from "./helpers/creature-asset.ts";

test("surface frames keep feet and up vectors on a curved cap, with arc distance", () => {
  for (const [x, z] of [
    [0, 0],
    [5, 0],
    [0, -5],
    [-4, 4],
  ]) {
    const frame = surfaceFrame(x, z, 0.2);
    assert.ok(
      Math.abs(frame.position.distanceTo(planetCenter) - planetRadius - 0.2) <
        1e-8,
    );
    assert.ok(
      new THREE.Vector3(0, 1, 0)
        .applyQuaternion(frame.rotation)
        .distanceTo(frame.normal) < 1e-8,
    );
  }
  assert.ok(Math.abs(surfaceDistance(0, 0, 5, 0) - 5) < 1e-8);
  assert.ok(surfaceFrame(5, 0).position.y < -1);
});

test("all 36 world copies validate and sleep on their sides without stretching faces or sinking", async () => {
  for (const creature of catalogue) {
    const { gltf, actor, driver, definition } = await loadCreatureAsset(
      creature,
      true,
    );
    const bytes = await readFile(
      new URL("../public" + definition.worldUrl, import.meta.url),
    );
    const report = await validateBytes(new Uint8Array(bytes), {
      maxIssues: 20,
    });
    assert.equal(
      report.issues.numErrors,
      0,
      creature.id + JSON.stringify(report.issues.messages),
    );
    assert.equal(
      report.issues.numWarnings,
      0,
      creature.id + JSON.stringify(report.issues.messages),
    );
    assert.ok(gltf.animations.some((c) => c.name === "Sleep"));
    driver.sample("idle", 0, 0.2, false);
    actor.updateMatrixWorld(true);
    const jaw = gltf.scene.getObjectByName("Jaw")!.quaternion.clone();
    let restWidth = 0;
    const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(
      gltf.scene
        .getObjectByName("Root")!
        .getWorldQuaternion(new THREE.Quaternion()),
    );
    for (const time of [0, 0.7, 1.5, 8, 14, 15.5, 17]) {
      driver.sample("sleep", time, 0.2, false);
      actor.updateMatrixWorld(true);
      const box = new THREE.Box3();
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) {
          o.skeleton.update();
          for (let i = 0; i < o.geometry.getAttribute("position").count; i++)
            box.expandByPoint(
              o
                .getVertexPosition(i, new THREE.Vector3())
                .applyMatrix4(o.matrixWorld),
            );
        }
      });
      assert.ok(
        Math.abs(box.min.y - 0.17) < 0.07,
        `${creature.id} sleep floor ${time}: ${box.min.y}`,
      );
      if (time === 0) restWidth = box.max.x - box.min.x;
      if (time === 8)
        assert.ok(
          box.max.y - box.min.y < restWidth * 1.2 &&
            Math.abs(
              upright.dot(
                new THREE.Vector3(0, 1, 0).applyQuaternion(
                  gltf.scene
                    .getObjectByName("Root")!
                    .getWorldQuaternion(new THREE.Quaternion()),
                ),
              ),
            ) < 0.2,
          creature.id + " remains upright",
        );
      assert.ok(
        jaw.angleTo(gltf.scene.getObjectByName("Jaw")!.quaternion) < 0.001,
      );
      for (const eye of ["Eye_L", "Eye_R"])
        assert.deepEqual(
          gltf.scene.getObjectByName(eye)!.scale.toArray(),
          [1, 1, 1],
        );
    }
    driver.dispose();
  }
});

test("routes connect both hemispheres, cross the longitude seam and reach both poles", async () => {
  const { worldCells, neighbours, cellKey, spacing } =
    await import("../src/world/world-routes.ts");
  const seen = new Set<string>(),
    queue: [number, number][] = [[0, 0]];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (seen.has(cellKey(cell))) continue;
    seen.add(cellKey(cell));
    queue.push(...neighbours(cell));
  }
  assert.equal(seen.size, worldCells.length);
  assert.ok(seen.has("0,8") && seen.has("0,-8") && seen.has("-16,0"));
  assert.ok(neighbours([15, 0]).some((c) => c[0] === -16 && c[1] === 0));
  const { surfaceTravel } = await import("../src/world/surface.ts");
  for (const [a, b] of [
    [
      [15, 0],
      [-16, 0],
    ],
    [
      [0, 7],
      [0, 8],
    ],
    [
      [0, 8],
      [4, 7],
    ],
  ] as const) {
    let [x, z] = [a[0] * spacing, a[1] * spacing];
    for (let i = 0; i < 300; i++) {
      const previous = surfaceFrame(x, z).position;
      [x, z] = surfaceTravel(x, z, b[0] * spacing, b[1] * spacing, 0.04);
      assert.ok(
        previous.distanceTo(surfaceFrame(x, z).position) <= 0.041,
        "No seam or pole teleport",
      );
    }
    assert.ok(surfaceDistance(x, z, b[0] * spacing, b[1] * spacing) < 1e-5);
  }
});
