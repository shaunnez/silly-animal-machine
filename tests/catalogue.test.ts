import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { catalogue } from "../src/world/catalogue.ts";
import { animals, sample } from "../src/game.ts";
import { pairKey, resolveModel } from "../src/world/models.ts";

test("the catalogue covers every distinct unordered animal pair without replacing custom drawings", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/assets/models/creatures.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(catalogue.length, 36);
  assert.equal(new Set(catalogue.map((c) => c.id)).size, 36);
  const pairs = new Set(catalogue.map((c) => pairKey(c.first, c.second)));
  for (const a of animals)
    for (const b of animals) {
      if (a.id !== b.id) assert.ok(pairs.has(pairKey(a.id, b.id)));
    }
  assert.equal(catalogue.filter((c) => c.id === sample.id).length, 1);
  for (const creature of catalogue) {
    const model = resolveModel(manifest, creature);
    assert.ok(model, creature.id);
    assert.equal(
      resolveModel(manifest, { ...creature, id: "custom-drawing" }),
      undefined,
    );
    await access(new URL("../public" + model.url, import.meta.url));
    await access(new URL("../public" + creature.image, import.meta.url));
  }
});
