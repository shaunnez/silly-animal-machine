import test from "node:test";
import assert from "node:assert/strict";
import { MeadowSimulation, spacing } from "../src/world/meadow-simulation";
import { newCare } from "../src/world/care";
import {
  attractions,
  rideCells,
  ridePose,
  type Attraction,
} from "../src/world/attractions";
import { createTerrain } from "../src/world/terrain";
import {
  planetRadius,
  planetCenter,
  surfaceDistance,
} from "../src/world/surface";

function playground(kind: Attraction, count = 3) {
  const completed: string[] = [];
  const sim = new MeadowSimulation((id, action) =>
    completed.push(`${id}:${action}`),
  );
  sim.planet = attractions[kind].planet;
  for (let i = 0; i < count; i++) {
    sim.add(String(i), newCare());
    sim.friends[i].loaded = true;
  }
  return { sim, completed };
}

test("every playground routes friends to reserved places, animates there and awards play once", () => {
  for (const kind of Object.keys(attractions) as Attraction[]) {
    const { sim, completed } = playground(kind);
    assert.equal(sim.attraction("0", kind), undefined, kind);
    assert.equal(
      sim.friends.filter((f) => f.outing?.kind === kind).length,
      3,
      kind + " group",
    );
    const owners = new Set(sim.reservations.values());
    assert.equal(owners.size, 3);
    let arrived = false;
    for (let i = 0; i < 2400 && completed.length < 3; i++) {
      sim.step(0.05, true);
      if (sim.friends.some((f) => f.mode === "attraction")) arrived = true;
    }
    assert.ok(arrived, kind + " arrival");
    assert.deepEqual(completed.sort(), ["0:play", "1:play", "2:play"], kind);
    assert.equal(sim.reservations.size, 0, kind + " cleanup");
    assert.ok(
      sim.friends.every((f) => !f.outing && f.care.progress.play === 1),
      kind,
    );
  }
});

test("rides cannot be requested on the wrong world; occupied lanes reject without partial reservations", () => {
  const { sim } = playground("slide", 6);
  assert.match(sim.attraction("0", "ski")!, /another planet/);
  assert.equal(sim.reservations.size, 0);
  sim.attraction("0", "slide");
  const reservations = [...sim.reservations];
  const waiting = sim.friends.find((f) => !f.command)!;
  assert.match(sim.attraction(waiting.id, "slide")!, /busy/);
  assert.deepEqual([...sim.reservations], reservations);
  assert.ok(!waiting.command);
});

test("picking up a rider stops the outing and releases its whole lane without a reward", () => {
  const { sim, completed } = playground("ski", 1);
  sim.attraction("0", "ski");
  for (let i = 0; i < 1600 && sim.friends[0].mode !== "attraction"; i++)
    sim.step(0.05, true);
  const f = sim.friends[0];
  assert.equal(f.mode, "attraction");
  for (let i = 0; i < 60; i++) sim.step(0.05, true);
  assert.ok(f.z > -spacing);
  assert.ok(sim.hold("0"));
  assert.equal(sim.reservations.size, 0);
  const before = structuredClone(f.care);
  for (let i = 0; i < 300; i++) sim.step(0.05, true);
  assert.deepEqual(f.care, before);
  assert.deepEqual(completed, []);
  assert.equal(f.outing, undefined);
});

test("snowball games need two friends and cancel cleanly when the last partner leaves", () => {
  const solo = playground("snowball", 1);
  assert.match(solo.sim.attraction("0", "snowball")!, /another friend/);
  const { sim, completed } = playground("snowball", 2);
  assert.equal(sim.attraction("0", "snowball"), undefined);
  for (let i = 0; i < 1600 && !sim.sessions[0]?.started; i++)
    sim.step(0.05, true);
  assert.ok(sim.sessions[0]?.started);
  sim.hold("0");
  assert.equal(sim.sessions.length, 0);
  assert.equal(sim.reservations.size, 0);
  assert.equal(sim.friends[1].command, undefined);
  assert.deepEqual(completed, []);
});

test("ride paths are continuous and finish at their reserved exits, with a genuine snowy descent", () => {
  const terrain = createTerrain("snow");
  for (const kind of [
    "slide",
    "ski",
    "snowboard",
    "trampoline",
    "fountain",
  ] as const) {
    const seat: [number, number] = [8, -1];
    const end = rideCells(kind, seat).at(-1)!;
    let previous = ridePose(kind, seat, 0);
    for (let t = 0.02; t <= 8; t += 0.02) {
      const p = ridePose(kind, seat, t);
      assert.ok(surfaceDistance(previous.x, previous.z, p.x, p.z) < 0.04);
      assert.ok(Math.abs(p.height - previous.height) < 0.1);
      previous = p;
    }
    const finish = ridePose(kind, seat, 8);
    assert.deepEqual(
      [finish.x, finish.z],
      [end[0] * spacing, end[1] * spacing],
    );
  }
  const top =
    terrain.frame(8 * spacing, -spacing).position.distanceTo(planetCenter) -
    planetRadius;
  const bottom =
    terrain.frame(8 * spacing, spacing).position.distanceTo(planetCenter) -
    planetRadius;
  assert.ok(top > bottom + 0.5, `${top} to ${bottom}`);
  assert.equal(ridePose("trampoline", [8, -1], 3.5, true).height, 0.31);
});
