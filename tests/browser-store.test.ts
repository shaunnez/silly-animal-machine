import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { createBrowserStore } from "../src/browser-store";
import { emptyWorld, newCare, type WorldSave } from "../src/world/care";
import { type Creature, type Job, sample } from "../src/game";
import { assetUrl } from "../src/asset-url";
const recipe = {
  first: "cat",
  second: "dinosaur",
  powerId: "bubbles",
  idea: "bubbles",
};
const put = (body: unknown) => ({ method: "PUT", body: JSON.stringify(body) });

test("hosted creatures and actual portrait blobs survive a new browser store connection", async () => {
  const factory = new IDBFactory();
  const first = createBrowserStore(factory);
  const job = await first.request<Job>("/api/generate", {
    method: "POST",
    body: JSON.stringify(recipe),
  });
  assert.equal(job.status, "complete");
  const portrait = new Blob(["test PNG bytes"], { type: "image/png" });
  const saved = await first.request<Creature>(
    `/api/creatures/${job.id}/portrait`,
    { method: "PUT", body: portrait },
  );
  assert.match(saved.image, /^blob:/);
  assert.equal(await (await fetch(saved.image)).text(), "test PNG bytes");
  await first.close();
  const next = createBrowserStore(factory);
  const [creature] = await next.request<Creature[]>("/api/creatures");
  assert.equal(creature.id, job.id);
  assert.equal(await (await fetch(creature.image)).text(), "test PNG bytes");
  assert.equal(creature.image, creature.scene!.portrait);
  assert.equal(
    (await next.request<Job>(`/api/jobs/${job.id}`)).status,
    "complete",
  );
  await next.close();
});

test("simultaneous hosted saves preserve CAS and collection writes from both tabs", async () => {
  const factory = new IDBFactory();
  const a = createBrowserStore(factory),
    b = createBrowserStore(factory);
  const world = emptyWorld();
  world.friends[sample.id] = newCare();
  world.planets.meadow = [sample.id];
  const saves = await Promise.allSettled([
    a.request<WorldSave>("/api/world", put(world)),
    b.request<WorldSave>("/api/world", put(world)),
  ]);
  assert.equal(saves.filter((s) => s.status === "fulfilled").length, 1);
  const rejected = saves.find(
    (s) => s.status === "rejected",
  ) as PromiseRejectedResult;
  assert.match(rejected.reason.message, /Another tab/);
  await Promise.all(
    [a, b].map((s) =>
      s.request("/api/generate", {
        method: "POST",
        body: JSON.stringify(recipe),
      }),
    ),
  );
  assert.equal((await a.request<Creature[]>("/api/creatures")).length, 2);
  assert.equal((await b.request<WorldSave>("/api/world")).revision, 1);
  await a.close();
  await b.close();
});

test("hosted storage rejects invalid recipes and unknown world residents without overwriting saves", async () => {
  const store = createBrowserStore(new IDBFactory());
  await assert.rejects(
    store.request("/api/generate", {
      method: "POST",
      body: JSON.stringify({ ...recipe, second: "cat" }),
    }),
    /different/,
  );
  const world = emptyWorld();
  world.planets.meadow = ["unknown"];
  world.friends.unknown = newCare();
  await assert.rejects(store.request("/api/world", put(world)));
  assert.deepEqual(await store.request("/api/world"), emptyWorld());
  assert.deepEqual(await store.request("/api/creatures"), []);
  await store.close();
});

test("project-path assets work without changing blobs, API URLs or local root paths", () => {
  assert.equal(
    assetUrl("/assets/models/cat.glb", "/silly-animal-machine/"),
    "/silly-animal-machine/assets/models/cat.glb",
  );
  assert.equal(assetUrl("/assets/test.png", "/"), "/assets/test.png");
  assert.equal(assetUrl("blob:test", "/game/"), "blob:test");
  assert.equal(assetUrl("/api/images/test.png", "/"), "/api/images/test.png");
});
