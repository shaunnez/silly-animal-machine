import { readFile, writeFile, rename } from "node:fs/promises";
import {
  emptyWorld,
  validateWorld,
  type WorldSave,
} from "../src/world/care.ts";

export class WorldConflict extends Error {}
/** Atomic writes and compare-and-swap prevent a stale tab replacing newer care. */
export function worldStore(file: string) {
  let queue: Promise<unknown> = Promise.resolve();
  async function read(): Promise<WorldSave> {
    try {
      return validateWorld(JSON.parse(await readFile(file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyWorld();
      throw new Error(
        "Couldn't read the meadow save. It has been kept safe; please ask a grown-up.",
      );
    }
  }
  return {
    read: () => queue.then(read),
    write(value: unknown, known: Set<string>) {
      const task = queue.then(async () => {
        if ((value as { version?: number })?.version !== 2)
          throw new Error("Please reload to save with the updated planets.");
        const next = validateWorld(value, known);
        const previous = await read();
        if (next.revision !== previous.revision)
          throw new WorldConflict(
            "Another tab saved this meadow. Reload its latest visit to continue.",
          );
        // Keep the original single-planet save before the first migration write.
        try {
          const original = await readFile(file, "utf8");
          if (JSON.parse(original).version === 1) {
            try {
              await writeFile(file + ".v1-backup", original, { flag: "wx" });
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "EEXIST")
                throw error;
            }
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const saved = { ...next, revision: next.revision + 1 };
        await writeFile(file + ".tmp", JSON.stringify(saved, null, 2));
        await rename(file + ".tmp", file);
        return saved;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
