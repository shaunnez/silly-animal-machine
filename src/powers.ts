export const powers = [
  {
    id: "bubbles",
    name: "Rainbow bubbles",
    icon: "🫧",
    idea: "Shoots rainbow bubbles",
    action: "Blow rainbow bubbles",
    hint: "Send colourful bubbles floating",
    message: "Rainbow bubbles!",
  },
  {
    id: "flowers",
    name: "Flower magic",
    icon: "🌸",
    idea: "Grows magical flowers",
    action: "Grow flowers",
    hint: "Make a ring of flowers bloom",
    message: "Look at those flowers grow!",
  },
  {
    id: "music",
    name: "Music maker",
    icon: "🎵",
    idea: "Makes music",
    action: "Make music",
    hint: "Dance with floating musical notes",
    message: "A little garden concert!",
  },
  {
    id: "stars",
    name: "Shooting stars",
    icon: "🌟",
    idea: "Creates a shower of shooting stars",
    action: "Send shooting stars",
    hint: "Sprinkle the garden with starlight",
    message: "A shower of shooting stars!",
  },
] as const;
export type PowerId = (typeof powers)[number]["id"];
export function isPowerId(value: unknown): value is PowerId {
  return powers.some((power) => power.id === value);
}
export function powerFor(creature: { powerId?: PowerId; idea: string }) {
  return (
    powers.find((power) => power.id === creature.powerId) ??
    powers.find(
      (power) =>
        power.idea.toLowerCase() === creature.idea.trim().toLowerCase(),
    ) ??
    powers[0]
  );
}
