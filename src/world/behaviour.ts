import type { Activity } from "./progress";
import type { AnimationState } from "./models";

export type Pose = { x: number; z: number; yaw: number };
export type Moment = Pose & {
  state: AnimationState;
  clipTime: number;
  phase: string;
  done: boolean;
  snack: number;
  ball: [number, number, number] | undefined;
};
type Segment = {
  duration: number;
  to: Pose;
  state: AnimationState;
  phase: string;
};
export const home: Pose = { x: 0, z: 0, yaw: 0 };
export const kickContact = 0.45;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export function turn(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * ease(t);
}
function route(segments: Segment[], from: Pose, to: Pose, phase: string): void {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  if (distance > 0.01) {
    const yaw = Math.atan2(to.x - from.x, to.z - from.z);
    segments.push({
      duration: 0.45,
      to: { ...from, yaw },
      state: "idle",
      phase,
    });
    segments.push({
      duration: Math.max(0.6, distance / 0.65),
      to: { ...to, yaw },
      state: "walk",
      phase,
    });
    segments.push({ duration: 0.45, to, state: "idle", phase });
  } else segments.push({ duration: 0.45, to, state: "idle", phase });
}
function sample(segments: Segment[], start: Pose, seconds: number): Moment {
  let from = start,
    elapsed = 0;
  for (const segment of segments) {
    if (seconds < elapsed + segment.duration) {
      const local = Math.max(0, seconds - elapsed),
        t = ease(local / segment.duration);
      return {
        x: from.x + (segment.to.x - from.x) * t,
        z: from.z + (segment.to.z - from.z) * t,
        yaw: turn(from.yaw, segment.to.yaw, local / segment.duration),
        state: segment.state,
        clipTime: local,
        phase: segment.phase,
        done: false,
        snack: 0,
        ball: undefined,
      };
    }
    elapsed += segment.duration;
    from = segment.to;
  }
  return {
    ...from,
    state: "idle",
    clipTime: Math.max(0, seconds - elapsed),
    phase: "All done!",
    done: true,
    snack: 0,
    ball: undefined,
  };
}

/** One shared clock controls travel, poses, prop contact, messages and completion. */
export function createInteraction(
  activity: Activity,
  start: Pose,
  still = false,
) {
  const segments: Segment[] = [];
  const stand = still
    ? start
    : activity === "feed"
      ? { x: 0.45, z: 0.25, yaw: 0 }
      : { x: -0.25, z: 0, yaw: 0 };
  if (activity !== "magic" && !still)
    route(
      segments,
      start,
      stand,
      activity === "feed" ? "Ooh, an apple!" : "Getting ready to kick…",
    );
  const approach = segments.reduce((sum, s) => sum + s.duration, 0);
  const actionDuration = activity === "play" ? 1.2 : 3.2;
  segments.push({
    duration: actionDuration,
    to: activity === "magic" ? start : stand,
    state: activity,
    phase:
      activity === "feed"
        ? "Crunch, crunch!"
        : activity === "play"
          ? "Kick! Let's chase it!"
          : "Rainbow bubbles!",
  });
  if (activity === "play" && !still)
    route(segments, stand, { x: 0.05, z: 1.25, yaw: 0 }, "Chasing the ball!");
  if (activity !== "magic") {
    const at = segments[segments.length - 1].to;
    segments.push({
      duration: 1.6,
      to: at,
      state: "celebrate",
      phase:
        activity === "feed" ? "Yummy! Thank you!" : "Got it! That was fun!",
    });
    if (!still) route(segments, at, home, "Coming back to you…");
  }
  const duration = segments.reduce((sum, s) => sum + s.duration, 0);
  return {
    duration,
    sample(seconds: number): Moment {
      const result = sample(segments, start, seconds);
      const local = seconds - approach;
      if (activity === "feed" && !result.done) {
        if (result.state === "feed" && local < 0.65)
          result.phase = "Here comes your apple!";
        // Full apple until mouth contact, then three distinct bites.
        result.snack =
          local < 1 ? 1 : local < 1.55 ? 0.72 : local < 2.1 ? 0.43 : 0;
      }
      if (activity === "play" && !result.done) {
        const flight = clamp((local - kickContact) / 1.5);
        const x = still ? start.x + 0.55 : 0.27;
        const z = still ? start.z + 0.7 : 0.7;
        result.ball = [
          x + flight * 0.05,
          0.44 +
            (still
              ? 0
              : Math.abs(Math.sin(flight * Math.PI * 2)) * 0.32 * (1 - flight)),
          z + (still ? 0 : ease(flight) * 1.65),
        ];
        if (result.phase === "Coming back to you…") result.ball = undefined;
      }
      return result;
    },
  };
}

/** Short, bounded strolls stay on the open central patch, away from the pond. */
export function sampleStroll(seconds: number, start: Pose): Moment {
  const segments: Segment[] = [
    { duration: 5, to: start, state: "idle", phase: "Happy in the garden" },
  ];
  route(
    segments,
    start,
    { x: 0.55, z: -0.15, yaw: -0.5 },
    "Having a little stroll",
  );
  const away = segments[segments.length - 1].to;
  segments.push({
    duration: 3,
    to: away,
    state: "idle",
    phase: "Looking around",
  });
  route(segments, away, home, "Coming back to you");
  const duration = segments.reduce((sum, s) => sum + s.duration, 0);
  // First loop may start wherever magic was cast; later loops start at home.
  return seconds < duration
    ? sample(segments, start, seconds)
    : sampleStroll((seconds - duration) % 15, home);
}
