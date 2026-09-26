import type { PlanetId } from "./planets";
import { spacing, type Cell } from "./world-routes";
export type Attraction =
  "slide" | "trampoline" | "fountain" | "ski" | "snowboard" | "snowball";
export const attractions: Record<
  Attraction,
  { planet: PlanetId; name: string; icon: string; doing: string; place: string }
> = {
  slide: {
    planet: "meadow",
    name: "Rainbow slide",
    place: "the rainbow slide",
    icon: "🛝",
    doing: "Wheee! Down the rainbow slide",
  },
  trampoline: {
    planet: "candy",
    name: "Jelly trampolines",
    place: "the jelly trampolines",
    icon: "🍮",
    doing: "Bouncing on jelly!",
  },
  fountain: {
    planet: "water",
    name: "Bubble fountains",
    place: "the bubble fountains",
    icon: "🫧",
    doing: "Floating on a bubble fountain",
  },
  ski: {
    planet: "snow",
    name: "Go skiing",
    place: "the ski hill",
    icon: "🎿",
    doing: "Swooshing down the ski hill",
  },
  snowboard: {
    planet: "snow",
    name: "Go snowboarding",
    place: "the ski hill",
    icon: "🏂",
    doing: "Carving down the snowy hill",
  },
  snowball: {
    planet: "snow",
    name: "Snowball party",
    place: "the snowball clearing",
    icon: "☃️",
    doing: "Sharing a friendly snowball game",
  },
};
export const planetAttractions = (planet: PlanetId) =>
  (Object.keys(attractions) as Attraction[]).filter(
    (id) => attractions[id].planet === planet,
  );
export const rideSeats: Cell[] = [
  [7, -1],
  [8, -1],
  [9, -1],
];
export const snowballSeats: Cell[] = [
  [5, -2],
  [5, 0],
  [5, 2],
];
export const attractionSeats = (kind: Attraction) =>
  kind === "snowball" ? snowballSeats : rideSeats;
export const travelsDownhill = (kind: Attraction) =>
  ["slide", "ski", "snowboard"].includes(kind);
export function rideCells(kind: Attraction, seat: Cell): Cell[] {
  if (kind === "snowball") return [seat];
  return travelsDownhill(kind)
    ? [seat, [seat[0], 0], [seat[0], 1]]
    : [seat, [seat[0], 0]];
}
// Shared by the simulator and renderer: only the vertical lift/pose is decorative.
export function ridePose(
  kind: Attraction,
  seat: Cell,
  time: number,
  reduced = false,
) {
  const u = Math.max(0, Math.min(1, (time - 2) / 5));
  const down = travelsDownhill(kind);
  const x =
    seat[0] * spacing +
    ((kind === "ski" || kind === "snowboard") && !reduced
      ? Math.sin(u * Math.PI * 4) * Math.sin(u * Math.PI) * 0.18
      : 0);
  const exit = Math.max(0, Math.min(1, time - 7));
  const z = (seat[1] + (down ? 2 * u : exit)) * spacing;
  let height = 0;
  if (kind === "slide")
    height = time < 2 ? (time / 2) * 1.6 : 1.6 * (1 - u) ** 2;
  if (kind === "trampoline")
    height =
      (0.31 +
        (reduced || time >= 7
          ? 0
          : Math.abs(Math.sin(Math.max(0, time - 1) * Math.PI)) *
            Math.min(1, 7 - time) *
            1.2)) *
      (1 - exit);
  if (kind === "fountain")
    height =
      (0.2 + (reduced ? 0 : Math.sin(Math.min(1, time / 7) * Math.PI) * 1.4)) *
      (1 - exit);
  return {
    x,
    z,
    height: Math.max(0, height),
    lean: reduced
      ? 0
      : kind === "snowboard" || kind === "ski"
        ? Math.sin(u * Math.PI * 4) * 0.16
        : 0,
    yaw: kind === "snowboard" ? Math.PI / 2 : 0,
  };
}
