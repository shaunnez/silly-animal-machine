import test from "node:test";
import assert from "node:assert/strict";
import {
  createInteraction,
  sampleStroll,
  home,
} from "../src/world/behaviour.ts";

const start = { x: 0.2, z: -0.1, yaw: -0.5 };
test("snack sequence approaches, takes three bites at the mouth, celebrates and returns", () => {
  const action = createInteraction("feed", start);
  let previous = action.sample(0);
  let bites = 0;
  const phases = new Set<string>();
  for (let t = 0; t <= action.duration; t += 0.01) {
    const now = action.sample(t);
    phases.add(now.phase);
    assert.ok(
      Math.hypot(now.x - previous.x, now.z - previous.z) < 0.03,
      "no position jumps",
    );
    if (now.snack < previous.snack) {
      assert.equal(now.state, "feed");
      assert.ok(now.clipTime >= 0.99);
      bites++;
    }
    previous = now;
  }
  assert.equal(bites, 3);
  assert.ok(phases.has("Ooh, an apple!"));
  assert.ok(phases.has("Yummy! Thank you!"));
  const end = action.sample(action.duration);
  assert.equal(end.done, true);
  assert.equal(end.x, home.x);
  assert.equal(end.z, home.z);
  assert.equal(end.snack, 0);
});
test("ball stays still until the kick, then moves ahead of the chase and is cleaned up", () => {
  const action = createInteraction("play", home);
  let kickStart: number | undefined;
  let before = action.sample(0).ball!;
  let kicked = false,
    chased = false;
  for (let t = 0; t < action.duration; t += 0.01) {
    const now = action.sample(t);
    if (now.state === "play" && kickStart === undefined) kickStart = t;
    if (now.ball && now.ball[2] > before[2] + 0.001) {
      assert.ok(kickStart !== undefined && t - kickStart >= 0.43);
      kicked = true;
    }
    if (now.phase === "Chasing the ball!") {
      chased = true;
      assert.ok(kicked);
    }
    if (now.ball) before = now.ball;
    assert.ok(Math.hypot(now.x, now.z) < 1.6);
  }
  assert.ok(kicked && chased);
  assert.equal(action.sample(action.duration).ball, undefined);
  assert.equal(action.sample(action.duration).done, true);
});
test("reduced motion and picture guests finish interactions without travel", () => {
  for (const kind of ["feed", "play", "magic"] as const) {
    const action = createInteraction(kind, start, true);
    for (let t = 0; t < action.duration; t += 0.1) {
      const now = action.sample(t);
      assert.equal(now.x, start.x);
      assert.equal(now.z, start.z);
      assert.equal(now.yaw, start.yaw);
    }
    assert.equal(action.sample(action.duration).done, true);
  }
});
test("idle strolls stay bounded and include actual travel, pauses and walk poses", () => {
  let walked = false,
    paused = false,
    last = sampleStroll(0, home);
  for (let t = 0; t < 100; t += 0.02) {
    const now = sampleStroll(t, home);
    assert.ok(Math.hypot(now.x, now.z) < 0.6);
    assert.ok(Math.hypot(now.x - last.x, now.z - last.z) < 0.03);
    if (now.state === "walk" && now.x > 0.1) walked = true;
    if (now.state === "idle") paused = true;
    last = now;
  }
  assert.ok(walked && paused);
});
