import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createTerrain, terrainHeight } from "../src/world/terrain";
import { planetCenter, planetRadius, surfaceFrame } from "../src/world/surface";
import { MeadowSimulation, spacing } from "../src/world/meadow-simulation";
import { newCare } from "../src/world/care";
import { soundSamples, type WorldSound } from "../src/world/sound-design";

test("terrain is continuous, gently sloped, and frames match actual ground geometry on every planet", () => {
  for (const id of ["meadow", "candy", "water", "snow"] as const) {
    const terrain = createTerrain(id),
      geometry = terrain.geometry();
    const points = geometry.getAttribute("position");
    let max = -Infinity,
      min = Infinity;
    for (let i = 0; i < points.count; i += 7) {
      const p = new THREE.Vector3().fromBufferAttribute(points, i),
        n = p.clone().normalize();
      const x = Math.atan2(n.x, n.y) * planetRadius,
        z = Math.asin(THREE.MathUtils.clamp(n.z, -1, 1)) * planetRadius;
      const frame = terrain.frame(x, z);
      assert.ok(
        frame.position.distanceTo(p.clone().add(planetCenter)) < 0.00001,
      );
      assert.ok(
        frame.normal.angleTo(n) < (id === "snow" && n.x > 0.6 ? 0.55 : 0.3),
        "bounded walking / ski slope",
      );
      assert.ok(
        new THREE.Vector3(0, 1, 0)
          .applyQuaternion(frame.rotation)
          .distanceTo(frame.normal) < 1e-7,
      );
      max = Math.max(max, terrainHeight(n, id));
      min = Math.min(min, terrainHeight(n, id));
    }
    assert.ok(max > 0.1 && max < (id === "snow" ? 1.4 : 0.32));
    assert.ok(id === "water" ? min === 0 : min < -0.1);
    for (const z of [-Math.PI * 4, -3, 0, 3, Math.PI * 4]) {
      assert.ok(
        terrain
          .frame(-Math.PI * 8, z)
          .position.distanceTo(terrain.frame(Math.PI * 8, z).position) < 1e-7,
      );
    }
    for (const pole of [-1, 1]) {
      assert.ok(
        terrain
          .frame(0, pole * Math.PI * 4)
          .normal.distanceTo(terrain.frame(17, pole * Math.PI * 4).normal) <
          0.00001,
      );
    }
    assert.equal(
      terrainHeight(surfaceFrame(0, 0).normal, id),
      0,
      "home clearing stays level",
    );
    geometry.dispose();
  }
});

test("pickup interrupts activities, releases reservations and holds care; cancellation and dropping preserve identity", () => {
  const completions: string[] = [];
  const sim = new MeadowSimulation((id) => completions.push(id));
  for (const id of ["a", "b", "c"]) {
    sim.add(id, newCare());
    sim.friends.at(-1)!.loaded = true;
  }
  sim.command("a", "play");
  assert.ok(sim.sessions[0].participants.includes("a"));
  const friend = sim.friends[0],
    care = friend.care,
    position = [friend.x, friend.z];
  assert.equal(sim.hold("a"), true);
  assert.ok(sim.sessions.every((s) => !s.participants.includes("a")));
  assert.ok(![...sim.reservations.values()].includes("a"));
  const before = structuredClone(care);
  for (let i = 0; i < 100; i++) sim.step(0.1);
  assert.deepEqual(care, before);
  assert.ok(!completions.includes("a"));
  assert.match(sim.command("a", "feed")!, /finish/);
  assert.equal(sim.drop("a"), false);
  assert.deepEqual([friend.x, friend.z], position);
  assert.equal(friend.mode, "idle");
  sim.hold("a");
  assert.equal(
    sim.landing("a", 0, 0, () => false),
    undefined,
  );
  const target = sim.landing("a", 10 * spacing, 0)!;
  assert.ok(target);
  sim.reservations.set(target.join(","), "b");
  assert.equal(sim.drop("a", target), false, "reject a reserved activity node");
  sim.reservations.delete(target.join(","));
  sim.hold("a");
  assert.equal(sim.drop("a", target), true);
  assert.equal(friend.care, care);
  assert.deepEqual(
    [friend.x, friend.z],
    target.map((v) => v * spacing),
  );
  sim.hold("a");
  assert.equal(
    sim.drop("a", sim.friends[1].cell),
    false,
    "reject an occupied node",
  );
  sim.command("a", "feed");
  assert.ok(
    friend.command === "feed",
    "activities still work after relocation",
  );
});

test("original sound recipes are distinct, finite, bounded and fade at both ends", () => {
  const events: WorldSound[] = [
    "bite",
    "kick",
    "land",
    "magic",
    "sleep",
    "note",
    "flight",
    "water",
    "rain",
    "snow",
    "meadow",
    "candy",
    "animal:cat",
    "animal:lion",
  ];
  const signatures = new Set<string>();
  for (const event of events) {
    const pcm = soundSamples(event, 2);
    assert.ok(pcm.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.5));
    assert.ok(pcm.some((v) => Math.abs(v) > 0.001));
    assert.equal(pcm[0], 0);
    assert.ok(Math.abs(pcm[pcm.length - 1]) < 0.001);
    signatures.add(Array.from(pcm.slice(100, 140)).join(","));
  }
  assert.equal(signatures.size, events.length);
});

test("lifting during food, sleep and music stops progress without disturbing other friends", () => {
  for (const action of ["feed", "nap", "magic"] as const) {
    const completions: string[] = [];
    const sim = new MeadowSimulation((id) => completions.push(id));
    for (const id of ["a", "b"]) {
      sim.add(id, newCare(), true);
      sim.friends.at(-1)!.loaded = true;
    }
    sim.command("a", action);
    for (let i = 0; i < 400 && sim.friends[0].mode !== action; i++)
      sim.step(0.05);
    assert.equal(sim.friends[0].mode, action);
    assert.equal(sim.hold("a"), true);
    const care = structuredClone(sim.friends[0].care);
    for (let i = 0; i < 300; i++) sim.step(0.05);
    assert.deepEqual(sim.friends[0].care, care);
    assert.ok(!completions.includes("a"));
    assert.ok(![...sim.reservations.values()].includes("a"));
    assert.ok(sim.sessions.every((s) => !s.participants.includes("a")));
    sim.remove("a");
    assert.equal(sim.friends.length, 1);
    assert.equal(sim.friends[0].id, "b");
  }
});
