import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { createServer } from "vite";
import { backgrounds } from "../src/backgrounds.ts";
import { sample } from "../src/game.ts";

function png() {
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c ^= byte;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const b = Buffer.alloc(data.length + 12);
    b.writeUInt32BE(data.length);
    b.write(type, 4);
    data.copy(b, 8);
    b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4);
    return b;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1024);
  header.writeUInt32BE(683, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc((1024 * 4 + 1) * 683))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("portrait saves preserve the collection, survive reload and handle two tabs idempotently", async (t) => {
  const cwd = process.cwd();
  const originalBin = process.env.CODEX_BIN;
  const temp = await mkdtemp(path.join(os.tmpdir(), "creature-portrait-"));
  const id = "11111111-1111-4111-8111-111111111111";
  const pending = {
    ...sample,
    id,
    scene: {
      version: 1,
      modelId: sample.id,
      background: "/api/images/11111111.png",
    },
  };
  await mkdir(path.join(temp, ".local/images"), { recursive: true });
  await writeFile(path.join(temp, ".local/images/11111111.png"), png());
  await writeFile(
    path.join(temp, ".local/creatures.json"),
    JSON.stringify([pending, { ...sample, id: "legacy-picture" }]),
  );
  process.chdir(temp);
  const { gameApi } = await import("../server/api.ts");
  const server = await createServer({
    configFile: false,
    root: temp,
    plugins: [gameApi()],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  t.after(async () => {
    await server.close();
    process.chdir(cwd);
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    await rm(temp, { recursive: true, force: true });
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const { token } = await (await fetch(base + "/api/status")).json();
  const url = base + `/api/creatures/${id}/portrait`;
  const bytes = png();
  assert.equal(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: bytes,
      })
    ).status,
    403,
  );
  const send = () =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "image/png", "X-Game-Token": token },
      body: bytes,
    });
  const responses = await Promise.all([send(), send()]);
  for (const response of responses) assert.equal(response.status, 200);
  const [a, b] = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(a, b);
  assert.equal(a.scene.background, pending.scene.background);
  assert.equal(a.image, a.scene.portrait);
  assert.equal(
    (await fetch(base + a.image)).headers.get("content-type"),
    "image/png",
  );
  const saved = JSON.parse(
    await readFile(path.join(temp, ".local/creatures.json"), "utf8"),
  );
  assert.equal(saved.length, 2);
  assert.ok(saved.some((c: { id: string }) => c.id === "legacy-picture"));
  assert.equal(saved[0].image, a.image);
  assert.equal((await send()).status, 200);
  // Every recipe stays available with the image helper disconnected.
  process.env.CODEX_BIN = path.join(temp, "unavailable-codex");
  const generate = (idea: string, powerId?: string) =>
    fetch(base + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Game-Token": token },
      body: JSON.stringify({ first: "cat", second: "frog", idea, powerId }),
    });
  const started = await generate("  SHOOTS rainbow   bubbles ", "bubbles");
  assert.equal(started.status, 202);
  let job = await started.json();
  for (let i = 0; i < 50 && job.status === "working"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    job = await (await fetch(base + `/api/jobs/${job.id}`)).json();
  }
  assert.equal(job.status, "complete");
  assert.equal(job.creature.powerId, "bubbles");
  const persisted = await (await fetch(base + "/api/creatures")).json();
  assert.equal(
    persisted.find((c: { id: string }) => c.id === job.id).powerId,
    "bubbles",
  );
  assert.ok(backgrounds.some((b) => b.url === job.creature.scene.background));
  assert.equal(job.creature.scene.portraitVersion, 2);
  assert.equal(job.creature.scene.modelId, "catalogue-cat-frog-v1");
  assert.ok(job.creature.scene.backgroundId);
  assert.equal(
    job.creature.scene.portrait,
    undefined,
    "Must render the selected animal, not borrow a different portrait",
  );
  const second = await generate("A completely different new idea", "stars");
  assert.equal(second.status, 202);
  const next = await second.json();
  assert.equal(next.status, "complete");
  assert.notEqual(
    next.creature.scene.backgroundId,
    job.creature.scene.backgroundId,
  );
  assert.equal(next.creature.powerId, "stars");
  const status = await (await fetch(base + "/api/status")).json();
  assert.equal(status.ready, true);
  assert.equal(status.mode, "local");
  const { readdir } = await import("node:fs/promises");
  assert.equal(
    (await readdir(path.join(temp, ".local"))).includes("generator"),
    false,
  );
  // Meadow storage uses the same loopback and request-token boundaries.
  const world = await (await fetch(base + "/api/world")).json();
  world.planets.meadow = [id];
  world.friends[id] = {
    needs: { food: 70, energy: 80, joy: 90 },
    progress: { version: 1, feed: 3, play: 0, magic: 0 },
  };
  const saveWorld = (value: unknown, authenticated = true) =>
    fetch(base + "/api/world", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { "X-Game-Token": token } : {}),
      },
      body: JSON.stringify(value),
    });
  assert.equal((await saveWorld(world, false)).status, 403);
  assert.equal(
    (
      await fetch(base + "/api/world", {
        headers: { Origin: "https://untrusted.example" },
      })
    ).status,
    403,
  );
  const worldSaved = await saveWorld(world);
  assert.equal(worldSaved.status, 200);
  const currentWorld = await worldSaved.json();
  assert.equal(currentWorld.revision, 1);
  assert.equal((await saveWorld(world)).status, 409);
  assert.equal(
    (
      await saveWorld({
        ...currentWorld,
        planets: { ...currentWorld.planets, meadow: ["unknown"] },
      })
    ).status,
    400,
  );
  assert.deepEqual(
    await (await fetch(base + "/api/world")).json(),
    currentWorld,
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(temp, ".local/world.json"), "utf8")),
    currentWorld,
  );
});
