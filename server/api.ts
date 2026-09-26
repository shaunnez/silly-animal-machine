import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  sample,
  creatureName,
  modelIdForPair,
  validateRecipe,
  type Creature,
  type Job,
} from "../src/game.ts";

import { validatePortrait } from "./portrait.ts";
import { worldStore, WorldConflict } from "./world.ts";
import { chooseBackground } from "../src/backgrounds.ts";

const dataDir = path.resolve(".local");
const meadow = worldStore(path.join(dataDir, "world.json"));
const token = randomBytes(24).toString("hex");
const jobs = new Map<string, Job>();
let active: Job | undefined;
let creatures: Creature[] = [];
// Serialize collection writes so a portrait save cannot overwrite a new background job.
let saving: Promise<void> = Promise.resolve();
function saveCreature(creature: Creature, portrait?: Buffer) {
  const result = saving.then(async () => {
    if (portrait) {
      const existing = creatures.find((c) => c.id === creature.id);
      if (existing?.scene?.portrait) return existing;
      const filename = `${creature.id}-portrait.png`;
      await writeFile(
        path.join(dataDir, "images", filename + ".tmp"),
        portrait,
      );
      await rename(
        path.join(dataDir, "images", filename + ".tmp"),
        path.join(dataDir, "images", filename),
      );
    }
    const next = [creature, ...creatures.filter((c) => c.id !== creature.id)];
    await writeFile(
      path.join(dataDir, "creatures.json.tmp"),
      JSON.stringify(next, null, 2),
    );
    await rename(
      path.join(dataDir, "creatures.json.tmp"),
      path.join(dataDir, "creatures.json"),
    );
    creatures = next;
    return creature;
  });
  saving = result.then(
    () => {},
    () => {},
  );
  return result;
}
async function initialize() {
  await mkdir(path.join(dataDir, "images"), { recursive: true });
  try {
    creatures = JSON.parse(
      await readFile(path.join(dataDir, "creatures.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "Could not read the creature collection; preserving the file.",
      );
  }
  if (!Array.isArray(creatures))
    throw new Error("Invalid creature collection; preserving the file.");
}
const initialized = initialize();
function json(res: ServerResponse, code: number, value: unknown) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
export function trustedRequest(req: IncomingMessage) {
  const host = req.headers.host || "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  const origin = req.headers.origin;
  return (
    (!origin || origin === `http://${host}`) &&
    req.headers["sec-fetch-site"] !== "cross-site"
  );
}
function validToken(req: IncomingMessage) {
  const received = req.headers["x-game-token"];
  return (
    typeof received === "string" &&
    received.length === token.length &&
    timingSafeEqual(Buffer.from(received), Buffer.from(token))
  );
}
async function body(req: IncomingMessage, limit = 4096) {
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > limit)
      throw new Error("That idea is a little too long.");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Please send a valid creature recipe.");
  }
}
async function run(job: Job, recipe: ReturnType<typeof validateRecipe>) {
  try {
    const background = chooseBackground(
      creatures.find((c) => c.scene?.backgroundId)?.scene?.backgroundId,
    );
    const creature: Creature = {
      ...recipe,
      id: job.id,
      name: creatureName(recipe),
      description: `Part ${recipe.first}, part ${recipe.second}, and a whole lot of magic. A one-of-a-kind friend made by you!`,
      image: background.url,
      scene: {
        version: 1,
        modelId: modelIdForPair(recipe.first, recipe.second),
        background: background.url,
        backgroundId: background.id,
        backgroundVersion: 2,
        portraitVersion: 2,
      },
      createdAt: new Date().toISOString(),
    };
    await saveCreature(creature);
    job.creature = creature;
    job.status = "complete";
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.";
  } finally {
    active = undefined;
  }
}
export function gameApi(): Plugin {
  const middleware = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    if (!req.url?.startsWith("/api/")) return next();
    void (async () => {
      await initialized;
      if (!trustedRequest(req))
        return json(res, 403, {
          error: "This game is available on this computer only.",
        });
      const url = new URL(req.url!, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/status")
        return json(res, 200, {
          ready: true,
          mode: "local",
          message:
            "Ready! Pictures are made locally with 10 saved landscapes. No AI account needed.",
          token,
          activeJob: active?.id,
        });
      if (url.pathname === "/api/world") {
        if (req.method === "GET") return json(res, 200, await meadow.read());
        if (req.method === "PUT") {
          if (!validToken(req))
            return json(res, 403, {
              error: "Please refresh the game and try again.",
            });
          if (!req.headers["content-type"]?.startsWith("application/json"))
            return json(res, 415, { error: "Please send a meadow save." });
          try {
            return json(
              res,
              200,
              await meadow.write(
                await body(req, 512000),
                new Set([sample.id, ...creatures.map((c) => c.id)]),
              ),
            );
          } catch (error) {
            if (error instanceof WorldConflict)
              return json(res, 409, { error: error.message });
            throw error;
          }
        }
      }
      if (req.method === "GET" && url.pathname === "/api/creatures")
        return json(res, 200, creatures);
      if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
        const job = jobs.get(url.pathname.split("/").pop()!);
        return json(
          res,
          job ? 200 : 404,
          job || {
            error:
              "This picture request ended when the game restarted. Please try again.",
          },
        );
      }
      if (
        req.method === "GET" &&
        /^\/api\/images\/[a-f0-9-]+(?:-portrait)?\.(png|webp|jpg)$/.test(
          url.pathname,
        )
      ) {
        try {
          const filename = path.basename(url.pathname);
          const bytes = await readFile(path.join(dataDir, "images", filename));
          res.writeHead(200, {
            "Content-Type": filename.endsWith(".png")
              ? "image/png"
              : filename.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg",
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
          });
          res.end(bytes);
        } catch {
          json(res, 404, { error: "Picture not found." });
        }
        return;
      }
      if (
        req.method === "PUT" &&
        /^\/api\/creatures\/[a-f0-9-]+\/portrait$/.test(url.pathname)
      ) {
        if (!validToken(req))
          return json(res, 403, {
            error: "Please refresh the game and try again.",
          });
        if (req.headers["content-type"] !== "image/png")
          return json(res, 415, { error: "Please save a PNG scene picture." });
        const id = url.pathname.split("/")[3];
        const creature = creatures.find((c) => c.id === id);
        if (!creature?.scene)
          return json(res, 404, {
            error: "This creature scene was not found.",
          });
        if (creature.scene.portrait) return json(res, 200, creature);
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 5 * 1024 * 1024)
            throw new Error("The scene picture is too large.");
          chunks.push(Buffer.from(chunk));
        }
        const bytes = validatePortrait(Buffer.concat(chunks));
        const filename = `${id}-portrait.png`;
        const image = `/api/images/${filename}`;
        const updated = {
          ...creature,
          image,
          scene: { ...creature.scene, portrait: image },
        };
        const saved = await saveCreature(updated, bytes);
        const job = jobs.get(id);
        if (job) job.creature = saved;
        return json(res, 200, saved);
      }
      if (req.method === "POST" && url.pathname === "/api/generate") {
        if (!validToken(req))
          return json(res, 403, {
            error: "Please refresh the game and try again.",
          });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(res, 415, { error: "Please use a creature recipe." });
        const recipe = validateRecipe(await body(req));
        if (active)
          return json(res, 409, {
            error: "A creature is already being made. It will be ready soon!",
            jobId: active.id,
          });
        const job: Job = {
          id: randomUUID(),
          status: "working",
          startedAt: new Date().toISOString(),
        };
        if (jobs.size > 100) {
          const oldest = jobs.keys().next().value;
          if (oldest) jobs.delete(oldest);
        }
        jobs.set(job.id, job);
        active = job;
        await run(job, recipe);
        return json(res, 202, job);
      }
      json(res, 404, { error: "Not found." });
    })().catch((error) =>
      json(res, 400, {
        error: error instanceof Error ? error.message : "Please try again.",
      }),
    );
  };
  return {
    name: "silly-animal-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
