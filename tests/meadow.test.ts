import { createTerrain, terrainHeight } from "../src/world/terrain.ts";
import {
  surfaceDistance,
  planetCenter,
  planetRadius,
} from "../src/world/surface.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  newCare,
  emptyWorld,
  tickNeeds,
  validateWorld,
} from "../src/world/care.ts";
import {
  MeadowSimulation,
  spacing,
  walkable,
} from "../src/world/meadow-simulation.ts";
import { worldStore, WorldConflict } from "../server/world.ts";
import { worldSession } from "../src/world/world-session.ts";

function six() {
  const completed: string[] = [];
  const sim = new MeadowSimulation((id, action) =>
    completed.push(`${id}:${action}`),
  );
  for (let i = 0; i < 6; i++) {
    sim.add(`friend-${i}`, newCare());
    sim.friends[i].loaded = true;
  }
  return { sim, completed };
}
const advance = (sim: MeadowSimulation, seconds: number, reduced = false) => {
  for (let i = 0; i < seconds * 20; i++) sim.step(0.05, reduced);
};

test("care changes only with active seconds, remains kind, and rejects malformed saves", () => {
  const c = newCare();
  const before = structuredClone(c);
  tickNeeds(c, 0);
  assert.deepEqual(c, before);
  tickNeeds(c, -1);
  assert.deepEqual(c, before);
  for (let i = 0; i < 20000; i++) tickNeeds(c, 1);
  assert.deepEqual(c.needs, { food: 10, energy: 10, joy: 10 });
  for (let i = 0; i < 30; i++) tickNeeds(c, 1, true);
  assert.equal(c.needs.energy, 100);
  const world = emptyWorld();
  world.friends.a = c;
  world.planets.meadow = ["a"];
  assert.deepEqual(validateWorld(JSON.parse(JSON.stringify(world))), world);
  assert.throws(() =>
    validateWorld({
      ...world,
      planets: { ...world.planets, meadow: Array(7).fill("a") },
    }),
  );
  assert.throws(() =>
    validateWorld({
      ...world,
      planets: { ...world.planets, meadow: ["missing"] },
    }),
  );
  assert.throws(() => validateWorld(world, new Set(["other"])));
  assert.throws(() =>
    validateWorld({
      ...world,
      friends: { a: { ...c, needs: { ...c.needs, food: NaN } } },
    }),
  );
});

test("six independent friends wander within bounds and stay apart over ten active minutes", () => {
  const { sim, completed } = six();
  const initial = sim.friends.map((f) => [f.x, f.z]);
  const terrain = createTerrain("meadow");
  let nearest = Infinity;
  let reachedFarSide = false;
  for (let i = 0; i < 12000; i++) {
    sim.step(0.05);
    for (const f of sim.friends) {
      assert.ok(walkable(f.cell));
      const frame = terrain.frame(f.x, f.z),
        point = frame.position;
      const radial = point.clone().sub(planetCenter).normalize();
      assert.ok(
        Math.abs(
          point.distanceTo(planetCenter) -
            planetRadius -
            terrainHeight(radial, "meadow"),
        ) < 1e-6,
      );
      assert.ok(frame.normal.angleTo(radial) < 0.3);
      if (point.y < planetCenter.y) reachedFarSide = true;
    }
    for (let a = 0; a < 6; a++)
      for (let b = a + 1; b < 6; b++)
        nearest = Math.min(
          nearest,
          surfaceDistance(
            sim.friends[a].x,
            sim.friends[a].z,
            sim.friends[b].x,
            sim.friends[b].z,
          ),
        );
  }
  assert.ok(nearest >= 0.94, `Closest separation ${nearest}`);
  assert.ok(reachedFarSide, "Friends explore the far hemisphere");
  assert.notDeepEqual(
    sim.friends.map((f) => [f.x, f.z]),
    initial,
  );
  assert.ok(
    completed.some((s) => s.endsWith(":feed")),
    "Hungry friends seek snacks",
  );
  assert.ok(
    completed.some((s) => s.endsWith(":play")),
    "Friends seek play",
  );
  assert.equal(new Set(sim.friends.map((f) => f.care)).size, 6);
});

test("concurrent feeding awards each eater once, reservations release on removal", () => {
  const { sim, completed } = six();
  assert.equal(sim.command("friend-0", "feed"), undefined);
  assert.equal(sim.command("friend-1", "feed"), undefined);
  assert.equal(sim.friends[0].care.progress.feed, 0);
  advance(sim, 30);
  assert.ok(completed.includes("friend-0:feed"));
  assert.equal(sim.friends[0].care.progress.feed, 1);
  assert.equal(sim.friends[1].care.progress.feed, 1);
  const eater = sim.friends.find((f) => !f.command && f.mode !== "greet")!;
  if (!sim.command(eater.id, "feed")) {
    sim.remove(eater.id);
    assert.ok(![...sim.reservations.values()].includes(eater.id));
  }
  const first = sim.friends[0];
  first.care.needs.energy = 20;
  advance(sim, 90);
  assert.ok(first.care.needs.energy > 40, "Tired friend naps automatically");
});

test("reduced motion keeps spontaneous wandering still; explicit powers still finish", () => {
  const { sim } = six();
  const positions = sim.friends.map((f) => [f.x, f.z]);
  advance(sim, 30, true);
  assert.deepEqual(
    sim.friends.map((f) => [f.x, f.z]),
    positions,
  );
  assert.equal(sim.command("friend-0", "magic"), undefined);
  advance(sim, 4, true);
  assert.equal(sim.friends[0].care.progress.magic, 1);
});

test("world store reloads exactly, rejects stale concurrent writes, and preserves corrupt files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "meadow-store-"));
  try {
    const file = path.join(dir, "world.json"),
      store = worldStore(file),
      known = new Set(["a", "b"]);
    const world = await store.read();
    world.planets.meadow = ["a", "b"];
    world.friends = { a: newCare(), b: newCare() };
    world.friends.a.progress.feed = 12;
    const results = await Promise.allSettled([
      store.write(world, known),
      store.write(world, known),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected");
    assert.ok(
      rejected?.status === "rejected" &&
        rejected.reason instanceof WorldConflict,
    );
    const reloaded = await worldStore(file).read();
    assert.equal(reloaded.revision, 1);
    assert.equal(reloaded.friends.a.progress.feed, 12);
    assert.equal(reloaded.friends.b.progress.feed, 0);
    assert.deepEqual(reloaded.friends.a.needs, world.friends.a.needs);
    await writeFile(file, "not valid json");
    await assert.rejects(() => store.read());
    await assert.rejects(() => store.write(reloaded, known));
    assert.equal(await readFile(file, "utf8"), "not valid json");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("save session serializes snapshots and freezes retries after a conflict", async () => {
  const state = emptyWorld();
  state.friends.a = newCare();
  state.planets.meadow = ["a"];
  const snapshots: number[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const session = worldSession(
    state,
    async (s) => {
      snapshots.push(s.revision);
      if (snapshots.length === 1) await gate;
      return { ...s, revision: s.revision + 1 };
    },
    () => {},
  );
  const first = session.flush();
  state.friends.a.needs.food = 60;
  const second = session.flush();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(snapshots, [0, 1]);
  assert.equal(state.revision, 2);
  let tries = 0,
    errors = 0;
  const failed = worldSession(
    state,
    async () => {
      tries++;
      throw new WorldConflict("stale");
    },
    (e) => {
      if (e) errors++;
    },
  );
  assert.equal(await failed.flush(), false);
  assert.equal(await failed.flush(), false);
  assert.equal(tries, 1);
  assert.equal(errors, 1);
  assert.equal(state.revision, 2);
});

test("a shared ball group passes together, finishes once per friend, and removal releases membership", () => {
  const { sim, completed } = six();
  assert.equal(sim.command("friend-0", "play"), undefined);
  assert.equal(sim.sessions.length, 1);
  const group = [...sim.sessions[0].participants];
  assert.equal(group.length, 3);
  advance(sim, 45, true);
  for (const id of group)
    assert.equal(completed.filter((c) => c === id + ":play").length, 1);
  assert.equal(sim.sessions.length, 0);
  assert.equal(sim.command("friend-0", "play"), undefined);
  sim.remove("friend-0");
  advance(sim, 45, true);
  assert.equal(sim.sessions.length, 0);
  assert.ok(![...sim.reservations.values()].includes("friend-0"));
});

test("music recruits available neighbours, preserves sleepers, and uses a shared clock", () => {
  const { sim, completed } = six();
  sim.friends[0].music = true;
  assert.equal(sim.command("friend-1", "nap"), undefined);
  assert.equal(sim.command("friend-0", "magic"), undefined);
  const session = sim.sessions[0];
  assert.ok(session.participants.length >= 2);
  assert.ok(!session.participants.includes("friend-1"));
  advance(sim, 2, true);
  const group = sim.friends.filter((f) => session.participants.includes(f.id));
  assert.ok(group.every((f) => f.time === group[0].time));
  advance(sim, 10, true);
  assert.ok(completed.includes("friend-0:magic"));
  assert.ok(completed.some((c) => c.endsWith(":play")));
});

test("three beds support concurrent actual sleeping time without a global nap lock", () => {
  const { sim } = six();
  for (let i = 0; i < 3; i++)
    assert.equal(sim.command("friend-" + i, "nap"), undefined);
  let max = 0;
  for (let i = 0; i < 800; i++) {
    sim.step(0.05, true);
    max = Math.max(max, sim.friends.filter((f) => f.mode === "nap").length);
  }
  assert.ok(max >= 3);
});

test("two independent ball groups can play at once on separate patches", () => {
  const { sim, completed } = six();
  assert.equal(sim.command("friend-0", "play"), undefined);
  const other = sim.friends.find((f) => !f.session)!;
  assert.equal(sim.command(other.id, "play"), undefined);
  assert.equal(sim.sessions.length, 2);
  assert.notEqual(sim.sessions[0].area, sim.sessions[1].area);
  assert.equal(new Set(sim.sessions.flatMap((s) => s.participants)).size, 6);
  advance(sim, 45, true);
  assert.equal(sim.sessions.length, 0);
  for (const f of sim.friends)
    assert.equal(completed.filter((c) => c === f.id + ":play").length, 1);
});
