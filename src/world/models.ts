import { animals, type Animal, type Creature } from "../game";

export const animationStates = [
  "idle",
  "walk",
  "feed",
  "play",
  "magic",
  "celebrate",
] as const;
export type AnimationState = (typeof animationStates)[number] | "sleep";
export type CreatureModel = {
  pair: [Animal, Animal];
  url: string;
  clips: Record<(typeof animationStates)[number], string> & { sleep?: string };
  worldUrl?: string;
  motion?: "step" | "hop" | "waddle";
  mouth: string;
  ballOffset?: [number, number];
};
export function pairKey(first: Animal, second: Animal): string {
  return [first, second].sort().join("+");
}
export function resolveModel(
  manifest: unknown,
  creature: Creature,
): CreatureModel | undefined {
  if (!manifest || typeof manifest !== "object") return;
  const entry = (manifest as Record<string, unknown>)[
    creature.scene?.version === 1 ? creature.scene.modelId : creature.id
  ];
  if (!entry || typeof entry !== "object") return;
  const model = entry as Record<string, unknown>;
  if (
    !Array.isArray(model.pair) ||
    model.pair.length !== 2 ||
    !model.pair.every((value) => animals.some((animal) => animal.id === value))
  )
    return;
  const pair = model.pair as [Animal, Animal];
  if (
    model.ballOffset !== undefined &&
    (!Array.isArray(model.ballOffset) ||
      model.ballOffset.length !== 2 ||
      !model.ballOffset.every(
        (value) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          Math.abs(value) <= 1,
      ))
  )
    return;
  if (pairKey(...pair) !== pairKey(creature.first, creature.second)) return;
  if (
    typeof model.url !== "string" ||
    !/^\/assets\/models\/[a-z0-9-]+\.glb$/.test(model.url)
  )
    return;
  if (!model.clips || typeof model.clips !== "object") return;
  const clips = model.clips as Record<string, unknown>;
  const isName = (value: unknown): value is string =>
    typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value);
  if (
    !animationStates.every((state) => isName(clips[state])) ||
    !isName(model.mouth)
  )
    return;
  if (
    model.worldUrl !== undefined &&
    (typeof model.worldUrl !== "string" ||
      !/^\/assets\/models\/[a-z0-9-]+\.glb$/.test(model.worldUrl))
  )
    return;
  if (
    model.motion !== undefined &&
    !["step", "hop", "waddle"].includes(String(model.motion))
  )
    return;
  if (clips.sleep !== undefined && !isName(clips.sleep)) return;
  return {
    pair,
    ...(model.worldUrl ? { worldUrl: model.worldUrl as string } : {}),
    ...(model.motion
      ? { motion: model.motion as CreatureModel["motion"] }
      : {}),
    url: model.url,
    clips: {
      idle: clips.idle as string,
      ...(clips.sleep ? { sleep: clips.sleep as string } : {}),
      walk: clips.walk as string,
      celebrate: clips.celebrate as string,
      feed: clips.feed as string,
      play: clips.play as string,
      magic: clips.magic as string,
    },
    mouth: model.mouth,
    ...(model.ballOffset
      ? { ballOffset: model.ballOffset as [number, number] }
      : {}),
  };
}
