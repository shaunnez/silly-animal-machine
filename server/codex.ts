import { spawn, spawnSync } from "node:child_process";
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  stat,
  writeFile,
  rename,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { imagePrompt, type Recipe } from "../src/game.ts";

export function subscriptionStatus() {
  const result = spawnSync(
    process.env.CODEX_BIN || "codex",
    ["login", "status"],
    { encoding: "utf8", timeout: 10000 },
  );
  const output = `${result.stdout ?? ""} ${result.stderr ?? ""}`;
  return {
    ready: result.status === 0 && /logged in using chatgpt/i.test(output),
    message: result.error
      ? "Install the Codex CLI, then run codex login."
      : /logged in using chatgpt/i.test(output)
        ? "Connected to your ChatGPT subscription"
        : "Run codex login and choose Sign in with ChatGPT.",
  };
}
export function codexArgs(workspace: string) {
  return [
    "exec",
    "--ignore-user-config",
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--disable",
    "shell_tool",
    "--disable",
    "apps",
    "--disable",
    "plugins",
    "--disable",
    "multi_agent",
    "--disable",
    "memories",
    "--disable",
    "skill_search",
    "-c",
    'forced_login_method="chatgpt"',
    "-c",
    'web_search="disabled"',
    "-c",
    "project_doc_max_bytes=0",
    "--json",
    "-C",
    workspace,
    "-",
  ];
}
export function collectPaths(event: unknown): string[] {
  if (typeof event === "string")
    return [
      ...event.matchAll(/\/(?:[^\s"'<>`]|\\ )+\.(?:png|webp|jpg|jpeg)/g),
    ].map((m) => m[0]);
  if (Array.isArray(event)) return event.flatMap(collectPaths);
  if (event && typeof event === "object")
    return Object.values(event).flatMap(collectPaths);
  return [];
}
function generatedImagesRoot() {
  return path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    "generated_images",
  );
}
export async function approvedImage(
  candidate: string,
  started: number,
  imageRoot = generatedImagesRoot(),
) {
  const root = await realpath(imageRoot);
  const resolved = await realpath(candidate);
  if (!resolved.startsWith(root + path.sep))
    throw new Error("Unexpected image location.");
  const info = await stat(resolved);
  if (
    !info.isFile() ||
    info.mtimeMs < started - 2000 ||
    info.size > 25 * 1024 * 1024
  )
    throw new Error("No new image was returned.");
  const bytes = await readFile(resolved);
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216;
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpeg && !webp)
    throw new Error("The generator did not return a valid image.");
  return { bytes, extension: png ? "png" : jpeg ? "jpg" : "webp" };
}
export async function resolveGeneratedImage(
  threadId: string | undefined,
  candidates: string[],
  started: number,
  imageRoot = generatedImagesRoot(),
) {
  if (
    !threadId ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      threadId,
    )
  ) {
    throw new Error("The image helper did not identify its picture request.");
  }
  const root = await realpath(imageRoot);
  const directory = path.join(root, threadId);
  // Never scan other sessions or select the newest image globally.
  if ((await realpath(directory)) !== directory)
    throw new Error("Unexpected picture directory.");
  const filenames = await readdir(directory);
  const paths = [
    ...new Set([
      ...candidates,
      ...filenames.map((name) => path.join(directory, name)),
    ]),
  ];
  const images = new Map<string, Awaited<ReturnType<typeof approvedImage>>>();
  for (const candidate of paths) {
    try {
      const resolved = await realpath(candidate);
      if (path.dirname(resolved) !== directory) continue;
      images.set(resolved, await approvedImage(resolved, started, root));
    } catch {
      // Ignore stale files, invalid formats, broken links and non-image entries.
    }
  }
  if (images.size !== 1)
    throw new Error(
      images.size
        ? "More than one picture arrived for this request."
        : "No new picture arrived for this request.",
    );
  const [source, image] = [...images.entries()][0];
  return { ...image, source };
}

export async function generateImage(
  recipe: Recipe,
  workspace: string,
): Promise<{ bytes: Buffer; extension: string }> {
  if (!subscriptionStatus().ready)
    throw new Error(
      "Ask a grown-up to sign in to Codex with ChatGPT, then try again.",
    );
  const started = Date.now();
  await mkdir(workspace, { recursive: true });
  const receipt: {
    recipe: Recipe;
    startedAt: string;
    status: string;
    threadId?: string;
    candidateCount?: number;
    image?: string;
    failure?: string;
  } = { recipe, startedAt: new Date(started).toISOString(), status: "working" };
  const saveReceipt = async () => {
    await writeFile(
      path.join(workspace, "receipt.json.tmp"),
      JSON.stringify(receipt, null, 2),
      { mode: 0o600 },
    );
    await rename(
      path.join(workspace, "receipt.json.tmp"),
      path.join(workspace, "receipt.json"),
    );
  };
  await saveReceipt();
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.CODEX_BIN || "codex",
      codexArgs(workspace),
      { env, stdio: ["pipe", "pipe", "pipe"] },
    );
    let buffer = "";
    let total = 0;
    let timedOut = false;
    let reportedFailure = false;
    const candidates: string[] = [];
    let threadId: string | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 360000);
    const hardKill = setTimeout(() => child.kill("SIGKILL"), 370000);
    const consume = (line: string) => {
      try {
        const event = JSON.parse(line);
        candidates.push(...collectPaths(event));
        if (
          event.type === "thread.started" &&
          typeof event.thread_id === "string"
        )
          threadId = event.thread_id;
        if (event.type === "turn.failed" || event.type === "error")
          reportedFailure = true;
      } catch {
        /* Ignore non-JSON progress lines. */
      }
    };
    child.stdout.on("data", (chunk) => {
      total += chunk.length;
      if (total > 8 * 1024 * 1024) {
        child.kill("SIGTERM");
        return;
      }
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consume);
    });
    // Drain diagnostics without exposing local paths, account details, or prompts to clients.
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      clearTimeout(hardKill);
      reject(
        new Error(
          "The image helper could not start. Ask a grown-up to check Codex.",
        ),
      );
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      clearTimeout(hardKill);
      consume(buffer);
      receipt.threadId = threadId;
      receipt.candidateCount = candidates.length;
      try {
        if (timedOut)
          throw new Error(
            "The picture took too long. Please try again later. Your other creatures are safe.",
          );
        if (code !== 0 || reportedFailure)
          throw new Error(
            "The image helper could not finish. Check your ChatGPT usage limits or connection, then try again.",
          );
        const image = await resolveGeneratedImage(
          threadId,
          candidates,
          started,
        );
        receipt.status = "complete";
        receipt.image = image.source;
        await saveReceipt();
        resolve(image);
      } catch (error) {
        receipt.status = "failed";
        receipt.failure =
          error instanceof Error
            ? error.message
            : "Unknown image helper failure.";
        try {
          await saveReceipt();
        } catch {
          console.error("Could not save the local image request receipt.");
        }
        reject(
          new Error(
            timedOut || code !== 0 || reportedFailure
              ? receipt.failure
              : "The picture could not be collected. Ask a grown-up to check the saved request before trying again.",
          ),
        );
      }
    });
    child.stdin.end(
      `Use the built-in image generation tool exactly once for this illustration. Do not use shell commands, API keys, external providers, or other tools. After generation return only the absolute local path of the generated image. If image generation is unavailable, say unavailable.\n\n${imagePrompt(recipe)}`,
    );
  });
}
