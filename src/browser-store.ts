import { chooseBackground } from "./backgrounds";
import {
  creatureName,
  modelIdForPair,
  sample,
  validateRecipe,
  type Creature,
  type Job,
} from "./game";
import { emptyWorld, validateWorld, type WorldSave } from "./world/care";

type SavedGame = { creatures: Creature[]; world: WorldSave };
const fresh = (): SavedGame => ({ creatures: [], world: emptyWorld() });

/** IndexedDB read/write transactions serialize changes across tabs, including CAS saves. */
export function createBrowserStore(
  factory: IDBFactory,
  name = "silly-animal-machine-v1",
) {
  let opened: Promise<IDBDatabase> | undefined;
  const pictures = new Map<string, string>();
  function database() {
    return (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("game");
        request.result.createObjectStore("portraits");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          opened = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        opened = undefined;
        reject(
          new Error(
            "This browser could not open your saved game. Try a normal browser tab with storage enabled.",
          ),
        );
      };
      request.onblocked = () =>
        reject(new Error("Close other game tabs, then try again."));
    }));
  }
  async function transact<T>(
    write: boolean,
    action: (game: SavedGame, tx: IDBTransaction) => T,
  ): Promise<T> {
    const db = await database();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(
        ["game", "portraits"],
        write ? "readwrite" : "readonly",
      );
      let result: T;
      let failure: unknown;
      const request = tx.objectStore("game").get("save");
      request.onsuccess = () => {
        try {
          const game: SavedGame = request.result ?? fresh();
          if (!Array.isArray(game.creatures))
            throw new Error(
              "Your collection could not be read. Your stored data has been kept safe.",
            );
          game.world = validateWorld(game.world);
          result = action(game, tx);
          if (write) tx.objectStore("game").put(game, "save");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          failure ??
            new Error(
              tx.error?.name === "QuotaExceededError"
                ? "This device is out of space. Your earlier friends are safe; free some storage and try again."
                : "Your game could not be saved on this device. Keep this tab open and try again.",
            ),
        );
    });
  }
  async function hydrated(creature: Creature): Promise<Creature> {
    if (!creature.scene?.portrait?.startsWith("browser:")) return creature;
    let url = pictures.get(creature.id);
    if (!url) {
      const db = await database();
      const blob = await new Promise<Blob>((resolve, reject) => {
        const request = db
          .transaction("portraits")
          .objectStore("portraits")
          .get(creature.id);
        request.onsuccess = () =>
          request.result instanceof Blob
            ? resolve(request.result)
            : reject(
                new Error(
                  "A saved picture could not be read. Your collection has been kept safe.",
                ),
              );
        request.onerror = () => reject(request.error);
      });
      url = URL.createObjectURL(blob);
      pictures.set(creature.id, url);
    }
    return {
      ...creature,
      image: url,
      scene: { ...creature.scene, portrait: url },
    };
  }
  return {
    async request<T>(url: string, init?: RequestInit): Promise<T> {
      const method = init?.method ?? "GET";
      let result: unknown;
      if (url === "/api/status" && method === "GET") {
        await database();
        result = {
          ready: true,
          token: "browser",
          message:
            "Ready! Creatures and worlds save in this browser on this device.",
        };
      } else if (url === "/api/creatures" && method === "GET") {
        result = await Promise.all(
          (await transact(false, (g) => g.creatures)).map(hydrated),
        );
      } else if (url === "/api/world" && method === "GET") {
        result = await transact(false, (g) => g.world);
      } else if (url === "/api/world" && method === "PUT") {
        const value = JSON.parse(String(init?.body));
        result = await transact(true, (g) => {
          const next = validateWorld(
            value,
            new Set([sample.id, ...g.creatures.map((c) => c.id)]),
          );
          if (next.revision !== g.world.revision)
            throw new Error(
              "Another tab saved this world. Load its latest visit to continue.",
            );
          g.world = { ...next, revision: next.revision + 1 };
          return g.world;
        });
      } else if (url === "/api/generate" && method === "POST") {
        const recipe = validateRecipe(JSON.parse(String(init?.body)));
        result = await transact(true, (g) => {
          const background = chooseBackground(
            g.creatures.find((c) => c.scene?.backgroundId)?.scene?.backgroundId,
          );
          const creature: Creature = {
            ...recipe,
            id: crypto.randomUUID(),
            name: creatureName(recipe),
            description: `Part ${recipe.first}, part ${recipe.second}, and a whole lot of magic. A one-of-a-kind friend made by you!`,
            createdAt: new Date().toISOString(),
            image: background.url,
            scene: {
              version: 1,
              modelId: modelIdForPair(recipe.first, recipe.second),
              background: background.url,
              backgroundId: background.id,
              backgroundVersion: 2,
              portraitVersion: 2,
            },
          };
          g.creatures.unshift(creature);
          return {
            id: creature.id,
            startedAt: creature.createdAt,
            status: "complete",
            creature,
          } satisfies Job;
        });
      } else if (url.startsWith("/api/jobs/") && method === "GET") {
        const creature = await transact(false, (g) =>
          g.creatures.find((c) => c.id === url.split("/").at(-1)),
        );
        if (!creature)
          throw new Error(
            "This creature request was not found. Please try again.",
          );
        result = {
          id: creature.id,
          startedAt: creature.createdAt,
          status: "complete",
          creature: await hydrated(creature),
        } satisfies Job;
      } else if (
        /^\/api\/creatures\/[^/]+\/portrait$/.test(url) &&
        method === "PUT"
      ) {
        const id = url.split("/")[3];
        const blob = init?.body;
        if (
          !(blob instanceof Blob) ||
          blob.type !== "image/png" ||
          blob.size > 8 * 1024 * 1024 ||
          !blob.size
        )
          throw new Error("This picture could not be saved. Please try again.");
        const creature = await transact(true, (g, tx) => {
          const c = g.creatures.find((c) => c.id === id);
          if (!c?.scene) throw new Error("This creature was not found.");
          if (!c.scene.portrait) {
            tx.objectStore("portraits").put(blob, id);
            c.image = c.scene.portrait = `browser:${id}`;
          }
          return c;
        });
        result = await hydrated(creature);
      } else throw new Error("That game action is not available.");
      return result as T;
    },
    async close() {
      (await opened)?.close();
      opened = undefined;
      pictures.forEach((url) => URL.revokeObjectURL(url));
      pictures.clear();
    },
  };
}
