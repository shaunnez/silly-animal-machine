import { stat } from "node:fs/promises";
import path from "node:path";
import type { Creature } from "../src/game.ts";

// Bump when the landscape prompt's composition contract changes.
export const backgroundVersion = 1;
export function backgroundKey(idea: string): string {
  return idea.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Only reuse background plates, never a portrait containing another animal. */
export async function findBackground(
  creatures: Creature[],
  idea: string,
  imagesDirectory: string,
): Promise<string | undefined> {
  const key = backgroundKey(idea);
  for (const creature of creatures) {
    const scene = creature.scene;
    if (
      scene?.version !== 1 ||
      (scene.backgroundVersion ?? 1) !== backgroundVersion ||
      backgroundKey(creature.idea) !== key ||
      !/^\/api\/images\/[a-f0-9-]+\.(png|webp|jpg)$/.test(scene.background)
    )
      continue;
    try {
      const file = await stat(
        path.join(imagesDirectory, path.basename(scene.background)),
      );
      if (file.isFile() && file.size > 0 && file.size <= 25 * 1024 * 1024)
        return scene.background;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
