import { planetIds, isPlanet, type PlanetId } from "./planets";
import {
  emptyProgress,
  type Progress,
  type Activity,
  recordActivity,
} from "./progress";

export type Needs = { food: number; energy: number; joy: number };
export type Care = { needs: Needs; progress: Progress };
export type WorldSave = {
  version: 2;
  revision: number;
  activePlanet: PlanetId;
  planets: Record<PlanetId, string[]>;
  friends: Record<string, Care>;
};
export const newCare = (): Care => ({
  needs: { food: 80, energy: 85, joy: 80 },
  progress: emptyProgress(),
});
export const emptyWorld = (): WorldSave => ({
  version: 2,
  revision: 0,
  activePlanet: "meadow",
  planets: { meadow: [], candy: [], water: [], snow: [] },
  friends: {},
});
export const maxFriends = 6;
export const clampNeed = (n: number) => Math.max(10, Math.min(100, n));

/** Only simulation seconds count. No wall-clock timestamp means no absence penalty. */
export function tickNeeds(care: Care, seconds: number, sleeping = false): void {
  const dt = Math.max(0, Math.min(seconds, 1));
  care.needs.food = clampNeed(care.needs.food - dt * 0.07);
  care.needs.energy = clampNeed(
    care.needs.energy + dt * (sleeping ? 3 : -0.045),
  );
  care.needs.joy = clampNeed(care.needs.joy - dt * 0.055);
}
export function completeCare(care: Care, action: Activity | "nap") {
  if (action === "feed") care.needs.food = clampNeed(care.needs.food + 35);
  if (action === "play") care.needs.joy = clampNeed(care.needs.joy + 30);
  if (action === "magic") care.needs.joy = clampNeed(care.needs.joy + 15);
  if (action !== "nap") care.progress = recordActivity(care.progress, action);
}
export function validateWorld(value: unknown, known?: Set<string>): WorldSave {
  const fail = (): never => {
    throw new Error("The meadow save is invalid. Your previous save is safe.");
  };
  if (!value || typeof value !== "object") return fail();
  const raw = value as Record<string, unknown>;
  const v = (
    raw.version === 1
      ? {
          ...raw,
          version: 2,
          activePlanet: "meadow",
          planets: { meadow: raw.invited, candy: [], water: [], snow: [] },
        }
      : raw
  ) as WorldSave;
  if (
    v.version !== 2 ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    !isPlanet(v.activePlanet) ||
    !v.planets ||
    typeof v.planets !== "object" ||
    Array.isArray(v.planets) ||
    Object.keys(v.planets).length !== planetIds.length ||
    !v.friends ||
    typeof v.friends !== "object" ||
    Array.isArray(v.friends) ||
    Object.keys(v.friends).length > 2000
  )
    return fail();
  const friends: Record<string, Care> = {};
  for (const [id, c] of Object.entries(v.friends)) {
    if (
      !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
      ["constructor", "prototype", "__proto__"].includes(id) ||
      (known && !known.has(id)) ||
      !c?.needs ||
      !c.progress
    )
      return fail();
    if (
      ![c.needs.food, c.needs.energy, c.needs.joy].every(
        (n) =>
          typeof n === "number" && Number.isFinite(n) && n >= 10 && n <= 100,
      ) ||
      c.progress.version !== 1 ||
      ![c.progress.feed, c.progress.play, c.progress.magic].every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 9999,
      )
    )
      return fail();
    friends[id] = {
      needs: { food: c.needs.food, energy: c.needs.energy, joy: c.needs.joy },
      progress: {
        version: 1,
        feed: c.progress.feed,
        play: c.progress.play,
        magic: c.progress.magic,
      },
    };
  }
  const residents = new Set<string>();
  const worlds = {} as Record<PlanetId, string[]>;
  for (const planet of planetIds) {
    const ids = v.planets[planet];
    if (!Array.isArray(ids) || ids.length > maxFriends) return fail();
    for (const id of ids) {
      if (
        typeof id !== "string" ||
        !Object.hasOwn(friends, id) ||
        residents.has(id)
      )
        return fail();
      residents.add(id);
    }
    worlds[planet] = [...ids];
  }
  return {
    version: 2,
    revision: v.revision,
    activePlanet: v.activePlanet,
    planets: worlds,
    friends,
  };
}

export function residentPlanet(
  state: WorldSave,
  id: string,
): PlanetId | undefined {
  return planetIds.find((p) => state.planets[p].includes(id));
}
/** Move one identity; its care object and all other residents are untouched. */
export function moveResident(
  state: WorldSave,
  id: string,
  destination: PlanetId,
) {
  if (!Object.hasOwn(state.friends, id))
    throw new Error("Invite this friend first.");
  if (!isPlanet(destination)) throw new Error("Choose a planet.");
  const source = residentPlanet(state, id);
  if (source === destination) return;
  if (state.planets[destination].length >= maxFriends)
    throw new Error("That planet is full. Make room for your friend first.");
  if (source)
    state.planets[source] = state.planets[source].filter((c) => c !== id);
  state.planets[destination].push(id);
}
