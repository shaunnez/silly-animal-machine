import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { backgroundKey, findBackground } from "../server/backgrounds.ts";
import { sample, type Creature } from "../src/game.ts";

test("background reuse matches ideas rather than animals, excludes portraits and respects versions", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "background-cache-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "abc.png"), "existing plate");
  const plate: Creature = {
    ...sample,
    scene: {
      version: 1,
      modelId: sample.id,
      background: "/api/images/abc.png",
    },
  };
  assert.equal(
    backgroundKey("  Shoots  RAINBOW\n bubbles "),
    backgroundKey(sample.idea),
  );
  assert.equal(
    await findBackground([plate], "Shoots RAINBOW bubbles", directory),
    plate.scene!.background,
  );
  assert.equal(
    await findBackground([plate], "Loves pancakes", directory),
    undefined,
  );
  for (const candidate of [
    { ...plate, scene: undefined },
    { ...plate, scene: { ...plate.scene!, backgroundVersion: 2 } },
    {
      ...plate,
      scene: { ...plate.scene!, background: "/api/images/def.png" },
    },
    {
      ...plate,
      scene: { ...plate.scene!, background: "/api/images/abc-portrait.png" },
    },
    {
      ...plate,
      scene: { ...plate.scene!, background: "https://example.org/abc.png" },
    },
  ])
    assert.equal(
      await findBackground([candidate], sample.idea, directory),
      undefined,
    );
});
