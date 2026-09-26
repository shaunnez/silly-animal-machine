export type Activity = "feed" | "play" | "magic";
export type Progress = {
  version: 1;
  feed: number;
  play: number;
  magic: number;
};
export const emptyProgress = (): Progress => ({
  version: 1,
  feed: 0,
  play: 0,
  magic: 0,
});
export const progressKey = (id: string) => `silly-animal-world:v1:${id}`;
export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return emptyProgress();
    const p = value as Record<string, unknown>;
    if (
      p.version !== 1 ||
      ![p.feed, p.play, p.magic].every(
        (n) =>
          typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 9999,
      )
    )
      return emptyProgress();
    return {
      version: 1,
      feed: p.feed as number,
      play: p.play as number,
      magic: p.magic as number,
    };
  } catch {
    return emptyProgress();
  }
}
export function recordActivity(
  progress: Progress,
  activity: Activity,
): Progress {
  return { ...progress, [activity]: Math.min(9999, progress[activity] + 1) };
}
export function flowerCount(p: Progress) {
  return Math.min(12, Math.floor((p.feed + p.play + p.magic) / 3));
}
