// Adult-operated, approved one-attempt catalogue batch. Never called by the game.
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const plan = JSON.parse(
  await readFile(path.join(root, "art/catalogue/plan.json"), "utf8"),
);
const ids = process.argv.slice(2);
if (
  !ids.length ||
  new Set(ids).size !== ids.length ||
  ids.some((id) => !plan.entries.some((e) => e.id === id))
)
  throw new Error(
    "Pass unique, reviewed pair IDs from art/catalogue/plan.json",
  );
if (
  plan.entries.length !== 35 ||
  plan.approvedCredits !== 525 ||
  plan.pricePerModel !== 15
)
  throw new Error("The approved generation budget or catalogue changed");
const flags = [
  "--workspace",
  root,
  "--output-schema",
  "v1",
  "--format",
  "json",
  "--no-update-check",
];
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
async function cli(args, receipt) {
  // Exclusive receipt reserves an operation before starting any CLI call.
  await writeFile(receipt, "", { flag: "wx", mode: 0o600 });
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      "npm",
      [
        "exec",
        "--yes",
        "--package=meshy-cli@0.4.0",
        "--",
        "meshy",
        ...args,
        ...flags,
      ],
      { cwd: root },
    );
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (b) => {
      stdout += b;
    });
    child.stderr.on("data", (b) => {
      stderr += b;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  await writeFile(receipt, result.stdout, { mode: 0o600 });
  if (result.stderr)
    await writeFile(receipt + ".stderr", result.stderr, { mode: 0o600 });
  const json = JSON.parse(result.stdout);
  if (result.code || !json.ok)
    throw new Error(`${args[0]} ${args[1]} failed; inspect ${receipt}`);
  return json.result;
}
async function cached(args, file) {
  if (await exists(file)) {
    const json = JSON.parse(await readFile(file, "utf8"));
    if (!json.ok)
      throw new Error(
        `Existing uncertain/failed receipt ${file}; inspect, never resubmit blindly`,
      );
    return json.result;
  }
  return cli(args, file);
}
let stop = false;
async function generate(id) {
  const e = plan.entries.find((e) => e.id === id);
  const privateDir = path.join(root, ".local/catalogue", id);
  const assetDir = path.join(root, "art/catalogue", id);
  await mkdir(privateDir, { recursive: true });
  const receipt = path.join(assetDir, "receipt.json");
  if (await exists(receipt)) {
    console.log(id, "already downloaded");
    return;
  }
  await access(path.join(root, e.reference));
  let submitted;
  const original = path.join(root, `.local/catalogue-${id}-submit.json`);
  if (await exists(original)) {
    const json = JSON.parse(await readFile(original, "utf8"));
    if (!json.ok) throw new Error("Existing submission needs inspection");
    submitted = json.result;
  } else {
    if (stop) return;
    submitted = await cached(
      [
        "image-to-3d",
        "create",
        "--image-url",
        e.reference,
        "--model-type",
        "smart-topology",
        "--target-polycount",
        "15000",
        "--should-texture",
        "true",
        "--enable-pbr",
        "true",
        "--texture-resolution",
        "2k",
        "--target-formats",
        "glb",
        "--async",
        "--operation-id",
        e.operationId,
      ],
      path.join(privateDir, "submit.json"),
    );
  }
  const taskId = submitted.submission?.task_id;
  if (!taskId) throw new Error("Missing accepted task ID; do not submit again");
  console.log(id, "Meshy image-to-3D", taskId, "— waiting (typically minutes)");
  const initialized = await cached(
    [
      "project",
      "init",
      "--root",
      "docs/meshy/catalogue",
      "--name",
      id,
      "--task-id",
      taskId,
      "--task-type",
      "image-to-3d",
    ],
    path.join(privateDir, "init.json"),
  );
  const project = initialized.project_dir;
  if (!project) throw new Error("No project_dir in init receipt");
  const finished = await cached(
    [
      "image-to-3d",
      "wait",
      taskId,
      "--timeout",
      "1800",
      "--project",
      project,
      "--stage",
      "generation",
    ],
    path.join(privateDir, "wait.json"),
  );
  const taskFile = path.join(project, `task_${taskId}.json`);
  const listed = await cached(
    ["download", "--task-json", taskFile, "--list"],
    path.join(privateDir, "assets.json"),
  );
  await cached(
    [
      "download",
      "--task-json",
      taskFile,
      "--model-format",
      "glb",
      "--output",
      path.join(assetDir, "meshy-original.glb"),
      "--project",
      project,
      "--stage",
      "delivered",
    ],
    path.join(privateDir, "model-download.json"),
  );
  // The listing is retained as evidence. Thumbnail selection uses the returned primary key.
  if (!JSON.stringify(listed).includes("thumbnail.primary"))
    throw new Error("Model downloaded; inspect available preview keys");
  await cached(
    [
      "download",
      "--task-json",
      taskFile,
      "--asset",
      "thumbnail.primary",
      "--output",
      path.join(assetDir, "meshy-preview.png"),
      "--project",
      project,
      "--stage",
      "preview",
    ],
    path.join(privateDir, "preview-download.json"),
  );
  const raw = JSON.parse(await readFile(taskFile, "utf8"));
  const credits =
    raw.consumed_credits ?? finished.task?.consumed_credits ?? null;
  const sha256 = createHash("sha256")
    .update(await readFile(path.join(assetDir, "meshy-original.glb")))
    .digest("hex");
  await writeFile(
    receipt,
    JSON.stringify(
      {
        id,
        pair: [e.first, e.second],
        resource: "image-to-3d",
        taskId,
        operationId: e.operationId,
        project,
        consumedCredits: credits,
        sha256,
        status: "downloaded-awaiting-review",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  console.log(id, "downloaded", "credits:", credits);
}
let next = 0;
const failures = [];
await Promise.all(
  Array.from({ length: Math.min(6, ids.length) }, async () => {
    while (!stop && next < ids.length) {
      const id = ids[next++];
      try {
        await generate(id);
      } catch (error) {
        stop = true;
        failures.push({ id, error: String(error) });
        console.error(id, String(error));
      }
    }
  }),
);
if (failures.length) process.exitCode = 1;
