export const planetIds = ["meadow", "candy", "water", "snow"] as const;
export type PlanetId = (typeof planetIds)[number];
export const planets: Record<
  PlanetId,
  {
    name: string;
    icon: string;
    description: string;
    ground: string;
    sky: string;
    path: string;
    patches: string[];
  }
> = {
  meadow: {
    name: "Meadow",
    icon: "🌼",
    description: "Rainbow slides, apple picnics and flower gardens",
    ground: "#aad389",
    sky: "#dceff7",
    path: "#e5d8a6",
    patches: ["#bbda91", "#97c9a4", "#bfb5d8", "#f3d8a5"],
  },
  candy: {
    name: "Candy",
    icon: "🍭",
    description: "Jelly trampolines and lollipop trees",
    ground: "#edabc9",
    sky: "#f6ddef",
    path: "#fff1ce",
    patches: ["#f6c5dc", "#b8e3d2", "#c3ade9", "#f7dcaa"],
  },
  water: {
    name: "Water",
    icon: "🐚",
    description: "Bubble fountains and floating play islands",
    ground: "#58bdcf",
    sky: "#bce8f1",
    path: "#d6f3ee",
    patches: ["#eed6a1", "#b6dcbb", "#ddc8ee", "#f3dfa7"],
  },
  snow: {
    name: "Snow",
    icon: "❄️",
    description: "Ski slopes, snowboards and friendly snowball games",
    ground: "#e4f0fa",
    sky: "#cfdef3",
    path: "#b7d8ec",
    patches: ["#d4e6f2", "#b3d4e0", "#d5cbea", "#f2e8d7"],
  },
};
export const isPlanet = (id: unknown): id is PlanetId =>
  typeof id === "string" && (planetIds as readonly string[]).includes(id);
