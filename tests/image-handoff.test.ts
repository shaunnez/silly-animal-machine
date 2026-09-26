import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  utimes,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateImage, resolveGeneratedImage } from "../server/codex.ts";

const current = "11111111-1111-4111-8111-111111111111";
const unrelated = "22222222-2222-4222-8222-222222222222";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
  "base64",
);
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "animal-handoff-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, current));
  await mkdir(path.join(root, unrelated));
  return root;
}
test("collects a generated image even when the final message omits its filename", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, current, "creature.png"), png);
  const image = await resolveGeneratedImage(
    current,
    [],
    Date.now() - 1000,
    root,
  );
  assert.deepEqual(image.bytes, png);
});
test("ignores wrong textual filenames and unrelated concurrent generations", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, current, "creature.png"), png);
  await writeFile(path.join(root, unrelated, "other.png"), png);
  const image = await resolveGeneratedImage(
    current,
    [path.join(root, unrelated, "other.png"), "/invented/image.png"],
    Date.now() - 1000,
    root,
  );
  assert.equal(path.basename(image.source), "creature.png");
});
test("does not reuse a stale picture, accept symlinks, or borrow another request", async (t) => {
  const root = await fixture(t);
  const old = path.join(root, current, "old.png");
  await writeFile(old, png);
  await utimes(old, new Date(0), new Date(0));
  await writeFile(path.join(root, unrelated, "other.png"), png);
  await symlink(
    path.join(root, unrelated, "other.png"),
    path.join(root, current, "link.png"),
  );
  await assert.rejects(
    resolveGeneratedImage(current, [], Date.now(), root),
    /No new picture/,
  );
  await assert.rejects(
    resolveGeneratedImage("../outside", [], Date.now(), root),
    /did not identify/,
  );
});
test("rejects ambiguous multiple pictures in the same request", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, current, "one.png"), png);
  await writeFile(path.join(root, current, "two.png"), png);
  await assert.rejects(
    resolveGeneratedImage(current, [], Date.now(), root),
    /More than one/,
  );
});
test("rejects a request directory redirected to another session", async (t) => {
  const root = await fixture(t);
  await rm(path.join(root, current), { recursive: true });
  await writeFile(path.join(root, unrelated, "other.png"), png);
  await symlink(path.join(root, unrelated), path.join(root, current));
  await assert.rejects(
    resolveGeneratedImage(current, [], Date.now(), root),
    /Unexpected picture directory/,
  );
});
test("full CLI handoff saves a receipt and succeeds without a textual filename", async (t) => {
  const root = await fixture(t);
  const executable = path.join(root, "fake-codex");
  const originalBin = process.env.CODEX_BIN;
  const originalHome = process.env.CODEX_HOME;
  t.after(async () => {
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    if (originalHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = originalHome;
  });
  await writeFile(
    executable,
    `#!${process.execPath}\nconst fs = require('node:fs'); const path = require('node:path');
if (process.argv[2] === 'login') { console.error('Logged in using ChatGPT'); process.exit(0); }
process.stdin.resume(); process.stdin.on('end',()=>{
const dir=path.join(process.env.CODEX_HOME,'generated_images','${current}'); fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'output.png'),Buffer.from('${png.toString("base64")}','base64'));
console.log(JSON.stringify({type:'thread.started',thread_id:'${current}'}));
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Here is your creature!'}}));
console.log(JSON.stringify({type:'turn.completed'}));
});`,
    { mode: 0o700 },
  );
  process.env.CODEX_BIN = executable;
  process.env.CODEX_HOME = root;
  const workspace = path.join(root, "request");
  const image = await generateImage(
    { first: "elephant", second: "monkey", idea: "Loves cuddles" },
    workspace,
  );
  assert.deepEqual(image.bytes, png);
  const receipt = JSON.parse(
    await readFile(path.join(workspace, "receipt.json"), "utf8"),
  );
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.threadId, current);
  assert.equal(receipt.candidateCount, 0);
  assert.equal(receipt.recipe.idea, "Loves cuddles");
});
