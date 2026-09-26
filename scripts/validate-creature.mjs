import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { validateBytes } from "gltf-validator";

const path = new URL(
  "../public/assets/models/unisaurus-v1.glb",
  import.meta.url,
);
const bytes = await readFile(path);
const document = JSON.parse(
  bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
const report = await validateBytes(new Uint8Array(bytes), {
  uri: path.pathname,
  maxIssues: 100,
});
await writeFile(
  new URL("../art/unisaurus/gltf-validation.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
assert.equal(
  report.issues.numErrors,
  0,
  JSON.stringify(report.issues.messages),
);
assert.equal(
  report.issues.numWarnings,
  0,
  JSON.stringify(report.issues.messages),
);
assert.equal(document.skins.length, 1);
for (const name of ["Eye_L", "Eye_R", "Jaw", "Foot_L", "Foot_R"]) {
  assert.ok(
    document.nodes.some((node) => node.name === name),
    `Missing ${name}`,
  );
}
assert.equal(document.skins[0].joints.length, 15);
assert.ok(document.nodes.some((node) => node.name === "Mouth"));
assert.ok(
  document.images.every(
    (image) => image.bufferView !== undefined && !image.uri,
  ),
);
assert.ok(document.buffers.every((buffer) => !buffer.uri));
assert.deepEqual(document.animations.map((clip) => clip.name).sort(), [
  "Celebrate",
  "Eat",
  "Idle",
  "Magic",
  "Play",
  "Walk",
]);
for (const animation of document.animations) {
  assert.ok(
    animation.channels.some(
      (channel) => document.nodes[channel.target.node].name === "Head",
    ),
  );
  assert.ok(
    animation.channels.some(
      (channel) => document.nodes[channel.target.node].name === "Tail",
    ),
  );
  const times = animation.samplers.map(
    (sampler) => document.accessors[sampler.input].max[0],
  );
  assert.ok(
    times.every(
      (end) =>
        Math.abs(
          end -
            {
              Idle: 4.8,
              Walk: 1.2,
              Eat: 3.2,
              Play: 1.2,
              Magic: 3.2,
              Celebrate: 1.6,
            }[animation.name],
        ) < 0.05,
    ),
    `${animation.name} has the wrong duration`,
  );
}
console.log(
  JSON.stringify(
    {
      bytes: bytes.length,
      errors: report.issues.numErrors,
      warnings: report.issues.numWarnings,
      clips: document.animations.map((clip) => clip.name),
      joints: document.skins[0].joints.length,
    },
    null,
    2,
  ),
);
