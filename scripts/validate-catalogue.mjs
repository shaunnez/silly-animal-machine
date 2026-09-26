import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { validateBytes } from "gltf-validator";
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("public/assets/models/creatures.json", root), "utf8"),
);
assert.equal(Object.keys(manifest).length, 36);
const pairs = new Set();
const results = [];
for (const [id, entry] of Object.entries(manifest)) {
  pairs.add([...entry.pair].sort().join("+"));
  const bytes = await readFile(new URL("public" + entry.url, root));
  const doc = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  const report = await validateBytes(new Uint8Array(bytes), {
    uri: entry.url,
    maxIssues: 100,
  });
  assert.equal(
    report.issues.numErrors,
    0,
    id + ": " + JSON.stringify(report.issues.messages),
  );
  assert.equal(
    report.issues.numWarnings,
    0,
    id + ": " + JSON.stringify(report.issues.messages),
  );
  assert.equal(doc.skins.length, 1, id);
  assert.equal(doc.skins[0].joints.length, 15, id);
  for (const name of [
    "Head",
    "Jaw",
    "Eye_L",
    "Eye_R",
    "Foot_L",
    "Foot_R",
    "Tail",
    "Mouth",
  ])
    assert.ok(
      doc.nodes.some((n) => n.name === name),
      id + " missing " + name,
    );
  assert.deepEqual(doc.animations.map((a) => a.name).sort(), [
    "Celebrate",
    "Eat",
    "Idle",
    "Magic",
    "Play",
    "Walk",
  ]);
  assert.ok(doc.images.every((i) => i.bufferView !== undefined && !i.uri));
  assert.ok(doc.buffers.every((b) => !b.uri));
  assert.ok(bytes.length < 3_000_000, id + " exceeded browser asset budget");
  results.push({
    id,
    bytes: bytes.length,
    errors: 0,
    warnings: 0,
    clips: 6,
    joints: 15,
  });
}
assert.equal(pairs.size, 36);
await writeFile(
  new URL("art/catalogue/validation.json", root),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    models: results.length,
    bytes: results.reduce((n, r) => n + r.bytes, 0),
    errors: 0,
    warnings: 0,
  }),
);
