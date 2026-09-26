import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  emptyWorld,
  newCare,
  validateWorld,
  moveResident,
  residentPlanet,
} from "../src/world/care.ts";
import { planetIds } from "../src/world/planets.ts";
import { worldStore } from "../server/world.ts";

test("legacy visitors and resting friends migrate without losing care", () => {
  const old = {
    version: 1,
    revision: 12,
    invited: ["ivy"],
    friends: { ivy: newCare(), resting: newCare() },
  };
  old.friends.ivy.progress.feed = 43;
  const migrated = validateWorld(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.revision, 12);
  assert.deepEqual(migrated.planets, {
    meadow: ["ivy"],
    candy: [],
    water: [],
    snow: [],
  });
  assert.deepEqual(migrated.friends, old.friends);
  assert.equal(residentPlanet(migrated, "resting"), undefined);
});
test("24 residents stay unique, full planets reject trips without changing state", () => {
  const state = emptyWorld();
  for (const p of planetIds)
    for (let i = 0; i < 6; i++) {
      const id = `${p}-${i}`;
      state.friends[id] = newCare();
      moveResident(state, id, p);
    }
  assert.equal(Object.values(validateWorld(state).planets).flat().length, 24);
  const before = structuredClone(state);
  assert.throws(() => moveResident(state, "meadow-0", "candy"), /full/);
  assert.deepEqual(state, before);
  state.planets.candy.pop();
  const care = state.friends["meadow-0"];
  care.progress.magic = 17;
  moveResident(state, "meadow-0", "candy");
  assert.equal(residentPlanet(state, "meadow-0"), "candy");
  assert.equal(state.friends["meadow-0"], care);
  assert.equal(state.planets.meadow.length, 5);
  assert.equal(state.friends["candy-5"].needs.food, 80);
  const roundtrip = validateWorld(JSON.parse(JSON.stringify(state)));
  assert.equal(roundtrip.friends["meadow-0"].progress.magic, 17);
  assert.throws(() =>
    validateWorld({
      ...state,
      planets: { ...state.planets, water: ["meadow-0"] },
    }),
  );
  assert.throws(() => validateWorld({ ...state, activePlanet: "unknown" }));
  assert.throws(() =>
    validateWorld({
      ...state,
      planets: { ...state.planets, snow: ["missing"] },
    }),
  );
});
test("migration backup and atomic transfer survive reload; stale clients cannot erase planets", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "galaxy-"));
  try {
    const file = path.join(dir, "world.json");
    const old = {
      version: 1,
      revision: 8,
      invited: ["ivy"],
      friends: { ivy: newCare() },
    };
    await writeFile(file, JSON.stringify(old));
    const store = worldStore(file),
      state = await store.read();
    moveResident(state, "ivy", "snow");
    state.activePlanet = "snow";
    const saved = await store.write(state, new Set(["ivy"]));
    assert.deepEqual(await store.read(), saved);
    assert.deepEqual(
      JSON.parse(await readFile(file + ".v1-backup", "utf8")),
      old,
    );
    await assert.rejects(() => store.write(old, new Set(["ivy"])), /reload/);
    await assert.rejects(
      () => store.write(state, new Set(["ivy"])),
      /Another tab/,
    );
    assert.equal((await store.read()).planets.snow[0], "ivy");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
