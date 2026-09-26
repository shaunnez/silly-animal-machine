import {
  attractions,
  planetAttractions,
  attractionSeats,
  rideCells,
  ridePose,
  type Attraction,
} from "./attractions";
import type { PlanetId } from "./planets";
import { surfaceDistance, surfaceTravel, surfaceHeading } from "./surface";
import {
  spacing,
  worldCells as cells,
  walkable,
  neighbours,
  cellKey as key,
  type Cell,
} from "./world-routes";
export { spacing, walkable } from "./world-routes";
export type { Cell } from "./world-routes";
import type { WorldSound } from "./world-audio";
import { completeCare, tickNeeds, type Care } from "./care";
import type { Activity } from "./progress";
export type Command = Activity | "nap";
export type Friend = {
  id: string;
  care: Care;
  x: number;
  z: number;
  yaw: number;
  cell: Cell;
  next?: Cell;
  goal?: Cell;
  command?: Command;
  outing?: { kind: Attraction; seat: Cell };
  mode:
    | "idle"
    | "walk"
    | "feed"
    | "play"
    | "magic"
    | "nap"
    | "greet"
    | "held"
    | "attraction";
  time: number;
  wait: number;
  blocked: number;
  visits: number;
  loaded: boolean;
  music: boolean;
  session?: number;
  company?: string[];
  distance: number;
  speed: number;
};
export const stations: Record<"feed" | "play" | "nap", Cell> = {
  feed: [-2, -1],
  play: [2, -1],
  nap: [0, -3],
};
const starts: Cell[] = [
  [-2, 1],
  [0, 1],
  [2, 1],
  [-2, 3],
  [0, 3],
  [2, 3],
];
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
export const seats: Record<"feed" | "nap" | "play", Cell[]> = {
  feed: [
    [-3, -1],
    [-2, -1],
    [-3, 0],
    [-2, 0],
    [-3, 1],
    [-2, 1],
  ],
  nap: [
    [-1, -3],
    [0, -3],
    [1, -3],
    [-1, -2],
    [0, -2],
    [1, -2],
  ],
  play: [
    [2, -1],
    [3, 0],
    [2, 1],
    [1, 2],
    [2, 2],
    [1, 3],
  ],
};
export type SocialSession = {
  id: number;
  kind: "ball" | "music" | "snowball";
  area?: number;
  participants: string[];
  time: number;
  waiting: number;
  started: boolean;
};
const durations: Record<Command, number> = {
  feed: 4.8,
  play: 6,
  magic: 3.2,
  nap: 17,
};
export const activityText: Record<Friend["mode"], string> = {
  attraction: "Playing in the planet playground",
  held: "Wheee! Choose a place to land",
  idle: "Watching the clouds",
  walk: "Having a little wander",
  feed: "Crunch, crunch!",
  play: "Passing the ball with friends!",
  magic: "Sharing a little magic",
  nap: "A cosy little nap",
  greet: "Saying hello to a friend!",
};

export class MeadowSimulation {
  friends: Friend[] = [];
  reservations = new Map<string, string>();
  sessions: SocialSession[] = [];
  private serial = 0;
  planet: PlanetId = "meadow";
  constructor(
    private completed: (id: string, action: Command) => void = () => {},
    private sound: (event: WorldSound) => void = () => {},
  ) {}
  add(id: string, care: Care, music = false) {
    if (this.friends.some((f) => f.id === id) || this.friends.length >= 6)
      return;
    const available = [...starts, ...cells].find(
      (c) => !this.blockedCells(id).has(key(c)),
    );
    if (!available) return;
    this.friends.push({
      id,
      care,
      cell: [...available],
      x: available[0] * spacing,
      z: available[1] * spacing,
      yaw: 0,
      mode: "idle",
      time: 0,
      wait: 2 + this.friends.length,
      blocked: 0,
      visits: 0,
      loaded: false,
      music,
      distance: 0,
      speed: 0,
    });
  }
  remove(id: string) {
    this.detach(id);
    this.friends = this.friends.filter((f) => f.id !== id);
  }
  private detach(id: string) {
    this.release(id);
    for (const session of this.sessions) {
      session.participants = session.participants.filter((p) => p !== id);
      if (session.kind === "snowball" && session.participants.length < 2) {
        for (const f of this.friends)
          if (f.id !== id && f.session === session.id) this.idle(f);
        session.participants = [];
      }
      for (const f of this.friends)
        if (f.session === session.id)
          f.company = session.participants.filter((p) => p !== f.id);
    }
    this.sessions = this.sessions.filter((s) => s.participants.length);
  }
  hold(id: string) {
    const f = this.friends.find((f) => f.id === id);
    if (!f?.loaded || f.mode === "held") return false;
    this.detach(id);
    this.idle(f);
    f.mode = "held";
    return true;
  }
  landing(
    id: string,
    x: number,
    z: number,
    safe: (x: number, z: number) => boolean = () => true,
  ): Cell | undefined {
    const blocked = this.blockedCells(id);
    return cells
      .filter(
        (c) =>
          !blocked.has(key(c)) &&
          safe(c[0] * spacing, c[1] * spacing) &&
          surfaceDistance(x, z, c[0] * spacing, c[1] * spacing) < 2.5 &&
          this.friends.every(
            (f) =>
              f.id === id ||
              surfaceDistance(f.x, f.z, c[0] * spacing, c[1] * spacing) >= 1.05,
          ),
      )
      .sort(
        (a, b) =>
          surfaceDistance(x, z, a[0] * spacing, a[1] * spacing) -
          surfaceDistance(x, z, b[0] * spacing, b[1] * spacing),
      )[0];
  }
  drop(
    id: string,
    target?: Cell,
    safe: (x: number, z: number) => boolean = () => true,
  ) {
    const f = this.friends.find((f) => f.id === id);
    if (!f || f.mode !== "held") return false;
    const valid =
      target &&
      walkable(target) &&
      this.landing(id, target[0] * spacing, target[1] * spacing, safe);
    const placed = !!valid && same(valid, target!);
    if (placed) {
      f.cell = [...target!];
      f.x = target![0] * spacing;
      f.z = target![1] * spacing;
    }
    this.idle(f);
    return placed;
  }
  private release(id: string) {
    for (const [action, owner] of this.reservations)
      if (owner === id) this.reservations.delete(action);
  }
  private blockedCells(id: string) {
    const blocked = new Set<string>();
    for (const f of this.friends)
      if (f.id !== id) {
        blocked.add(key(f.cell));
        if (f.next) blocked.add(key(f.next));
      }
    for (const [slot, owner] of this.reservations)
      if (owner !== id) blocked.add(slot);
    return blocked;
  }
  private path(f: Friend, goal: Cell): Cell[] | undefined {
    const blocked = this.blockedCells(f.id);
    if (blocked.has(key(goal))) return;
    const queue = [{ route: [f.cell], cost: 0 }];
    const costs = new Map([[key(f.cell), 0]]);
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const { route, cost } = queue.shift()!,
        last = route[route.length - 1];
      if (same(last, goal)) return route.slice(1);
      if (cost > costs.get(key(last))!) continue;
      for (const c of neighbours(last)) {
        if (
          !walkable(c) ||
          blocked.has(key(c)) ||
          (this.planet === "meadow" && c[1] === 0 && [7, 8, 9].includes(c[0]))
        )
          continue;
        const nextCost =
          cost +
          surfaceDistance(
            last[0] * spacing,
            last[1] * spacing,
            c[0] * spacing,
            c[1] * spacing,
          );
        if (nextCost < (costs.get(key(c)) ?? Infinity)) {
          costs.set(key(c), nextCost);
          queue.push({ route: [...route, c], cost: nextCost });
        }
      }
    }
  }
  command(
    id: string,
    action: Command,
    social = true,
    area?: number,
  ): string | undefined {
    const f = this.friends.find((f) => f.id === id);
    if (!f?.loaded) return "Your friend is still arriving.";
    if (
      f.command ||
      f.mode === "held" ||
      f.mode === "nap" ||
      f.mode === "greet"
    )
      return "Let this little moment finish first.";
    if (action === "play" && area === undefined) {
      area = [0, 1].find(
        (value) =>
          !this.sessions.some((s) => s.kind === "ball" && s.area === value) &&
          seats.play
            .slice(value * 3, value * 3 + 3)
            .some((c) => !this.blockedCells(id).has(key(c))),
      );
      if (area === undefined)
        return "Both ball games are busy. Join the next one!";
    }
    if (action !== "magic") {
      const probe = { ...f, cell: f.next ?? f.cell };
      const availableSeats =
        action === "play"
          ? seats.play.slice(area! * 3, area! * 3 + 3)
          : seats[action];
      const candidates = availableSeats
        .filter((c) => !this.blockedCells(id).has(key(c)))
        .sort(
          (a, b) =>
            surfaceDistance(f.x, f.z, a[0] * spacing, a[1] * spacing) -
            surfaceDistance(f.x, f.z, b[0] * spacing, b[1] * spacing),
        );
      const target =
        candidates.find((c) => this.path(probe, c)) ?? candidates[0];
      if (!target)
        return "Those places are busy. Try another activity for a moment!";
      this.reservations.set(key(target), id);
      f.goal = target;
    } else f.goal = f.next ?? f.cell;
    f.command = action;
    f.blocked = 0;
    if (!f.next && same(f.cell, f.goal)) this.begin(f);
    if (social && (action === "play" || (action === "magic" && f.music))) {
      const session: SocialSession = {
        id: ++this.serial,
        kind: action === "play" ? "ball" : "music",
        area,
        participants: [id],
        time: 0,
        waiting: 0,
        started: false,
      };
      f.session = session.id;
      const available = this.friends
        .filter(
          (o) =>
            o !== f &&
            o.loaded &&
            !o.command &&
            o.mode !== "greet" &&
            surfaceDistance(f.x, f.z, o.x, o.z) < (action === "play" ? 12 : 6),
        )
        .sort(
          (a, b) =>
            surfaceDistance(f.x, f.z, a.x, a.z) -
            surfaceDistance(f.x, f.z, b.x, b.z),
        );
      for (const other of available) {
        if (session.participants.length >= (action === "play" ? 3 : 6)) break;
        if (!this.command(other.id, action, false, area)) {
          other.session = session.id;
          session.participants.push(other.id);
        }
      }
      this.sessions.push(session);
      this.sound("join");
    }
    if (social && action === "nap")
      for (const other of this.friends.filter(
        (o) =>
          o !== f &&
          o.care.needs.energy < 75 &&
          !o.command &&
          surfaceDistance(f.x, f.z, o.x, o.z) < 7,
      ))
        this.command(other.id, "nap", false);
    return;
  }
  attraction(id: string, kind: Attraction, social = true): string | undefined {
    if (attractions[kind].planet !== this.planet)
      return "That playground is on another planet.";
    const f = this.friends.find((f) => f.id === id);
    if (!f?.loaded) return "Your friend is still arriving.";
    if (f.command || f.mode === "held" || f.mode === "greet")
      return "Let this little moment finish first.";
    if (
      kind === "snowball" &&
      social &&
      !this.friends.some(
        (o) =>
          o !== f &&
          o.loaded &&
          !o.command &&
          o.mode !== "held" &&
          o.mode !== "greet",
      )
    )
      return "Invite another friend for a snowball party!";
    const blocked = this.blockedCells(id);
    const seat = attractionSeats(kind).find(
      (c) =>
        rideCells(kind, c).every((slot) => !blocked.has(key(slot))) &&
        this.path({ ...f, cell: f.next ?? f.cell }, c),
    );
    if (!seat) return "The playground is busy. Try again in a moment!";
    for (const cell of rideCells(kind, seat))
      this.reservations.set(key(cell), id);
    f.outing = { kind, seat: [...seat] };
    f.command = "play";
    f.goal = [...seat];
    f.blocked = 0;
    if (!f.next && same(f.cell, seat)) this.begin(f);
    const group = [f];
    if (social)
      for (const other of this.friends
        .filter(
          (o) =>
            o !== f &&
            o.loaded &&
            !o.command &&
            o.mode !== "held" &&
            o.mode !== "greet",
        )
        .sort(
          (a, b) =>
            surfaceDistance(f.x, f.z, a.x, a.z) -
            surfaceDistance(f.x, f.z, b.x, b.z),
        )) {
        if (group.length === 3) break;
        if (!this.attraction(other.id, kind, false)) group.push(other);
      }
    if (kind === "snowball" && social) {
      if (group.length < 2) {
        this.idle(f);
        return "A friend needs a free place to join the snowball game.";
      }
      const session: SocialSession = {
        id: ++this.serial,
        kind: "snowball",
        participants: group.map((f) => f.id),
        time: 0,
        waiting: 0,
        started: false,
      };
      group.forEach((f) => (f.session = session.id));
      this.sessions.push(session);
    }
    return;
  }
  private begin(f: Friend) {
    f.mode = f.outing ? "attraction" : f.command!;
    f.time = 0;
    f.goal = undefined;
    f.speed = 0;
    if (f.mode === "nap") this.sound("sleep");
    if (f.mode === "magic" && !f.music) this.sound("magic");
  }
  private idle(f: Friend) {
    this.release(f.id);
    f.command = undefined;
    f.outing = undefined;
    f.session = undefined;
    f.company = undefined;
    f.speed = 0;
    f.goal = undefined;
    f.next = undefined;
    f.mode = "idle";
    f.time = 0;
    f.wait = 2 + (f.visits % 4);
    f.blocked = 0;
  }
  step(seconds: number, reduced = false) {
    const dt = Math.max(0, Math.min(seconds, 0.1));
    if (!dt) return;
    for (const session of [...this.sessions]) {
      session.participants = session.participants.filter((id) =>
        this.friends.some((f) => f.id === id && f.session === session.id),
      );
      const group = session.participants.map((id) =>
        this.friends.find((f) => f.id === id)!,
      );
      session.waiting += dt;
      if (!group.length) {
        this.sessions = this.sessions.filter((s) => s !== session);
        continue;
      }
      if (!session.started && group.every((f) => !f.goal && !f.next))
        session.started = true;
      if (!session.started && session.waiting > 35) {
        group.forEach((f) => this.idle(f));
        this.sessions = this.sessions.filter((s) => s !== session);
        continue;
      }
      if (!session.started) continue;
      const before = session.time;
      session.time += dt;
      if (
        (session.kind === "ball" || session.kind === "snowball") &&
        Math.floor((before + 1.55) / 2) !==
          Math.floor((session.time + 1.55) / 2) &&
        session.time < 6.5
      )
        this.sound(session.kind === "snowball" ? "land" : "kick");
      if (
        session.kind === "music" &&
        this.sessions.find((s) => s.kind === "music" && s.started) ===
          session &&
        Math.floor(before / 0.4) !== Math.floor(session.time / 0.4)
      )
        this.sound("note");
      for (let i = 0; i < group.length; i++) {
        const f = group[i],
          kicker = Math.floor(Math.min(session.time, 5.99) / 2) % group.length,
          target = group[i === kicker ? (kicker + 1) % group.length : kicker];
        f.company = session.participants.filter((id) => id !== f.id);
        f.time = session.time;
        if (target !== f) f.yaw = surfaceHeading(f.x, f.z, target.x, target.z);
      }
      if (session.time >= 8) {
        for (const f of group) {
          const action =
            session.kind !== "music" ? "play" : f.music ? "magic" : "play";
          completeCare(f.care, action);
          this.idle(f);
          f.visits++;
          this.completed(f.id, action);
        }
        this.sessions = this.sessions.filter((s) => s !== session);
      }
    }
    for (const f of this.friends) {
      if (!f.loaded || f.mode === "held") continue;
      tickNeeds(f.care, dt, f.mode === "nap" && f.time > 1.5 && f.time < 14);
      const before = f.time;
      if (!f.session) f.time += dt;
      if (
        f.mode === "feed" &&
        [1, 1.55, 2.1].some((t) => before < t && f.time >= t)
      )
        this.sound("bite");
      if (f.mode === "nap" && before < 14 && f.time >= 14) this.sound("wake");
      if (f.mode === "attraction" && f.outing) {
        if (f.session) continue;
        const pose = ridePose(f.outing.kind, f.outing.seat, f.time, reduced);
        f.x = pose.x;
        f.z = pose.z;
        f.yaw = pose.yaw;
        if (before < 2 && f.time >= 2)
          this.sound(f.outing.kind === "trampoline" ? "note" : "flight");
        if (f.time >= 8) {
          const route = rideCells(f.outing.kind, f.outing.seat);
          f.cell = [...route[route.length - 1]];
          f.x = f.cell[0] * spacing;
          f.z = f.cell[1] * spacing;
          completeCare(f.care, "play");
          this.idle(f);
          f.visits++;
          this.completed(f.id, "play");
        }
        continue;
      }
      if (["feed", "play", "magic", "nap"].includes(f.mode)) {
        if (f.session) continue;
        if (f.time >= durations[f.mode as Command]) {
          const action = f.mode as Command;
          completeCare(f.care, action);
          this.idle(f);
          f.visits++;
          this.completed(f.id, action);
        }
        continue;
      }
      if (f.mode === "greet") {
        if (f.time >= 2.4) this.idle(f);
        continue;
      }
      if (f.next) {
        const tx = f.next[0] * spacing,
          tz = f.next[1] * spacing;
        const distance = surfaceDistance(f.x, f.z, tx, tz);
        f.speed = Math.min(1.2, f.speed + dt * 3);
        const amount = Math.min(distance, dt * f.speed);
        const candidate = surfaceTravel(f.x, f.z, tx, tz, amount);
        if (
          this.friends.some(
            (other) =>
              other !== f &&
              surfaceDistance(candidate[0], candidate[1], other.x, other.z) <
                0.95,
          )
        ) {
          f.blocked += dt;
          if (f.blocked > 3) this.idle(f);
          continue;
        }
        f.blocked = 0;
        const desired = surfaceHeading(f.x, f.z, tx, tz);
        f.yaw +=
          Math.atan2(Math.sin(desired - f.yaw), Math.cos(desired - f.yaw)) *
          Math.min(1, dt * 9);
        const oldStep = Math.floor(f.distance / 0.55);
        f.distance += amount;
        if (Math.floor(f.distance / 0.55) !== oldStep) this.sound("step");
        if (distance > 0) {
          [f.x, f.z] = surfaceTravel(f.x, f.z, tx, tz, amount);
        }
        f.mode = "walk";
        if (distance <= amount + 0.00001) {
          f.cell = f.next;
          f.next = undefined;
          f.x = tx;
          f.z = tz;
        }
        continue;
      }
      if (f.goal) {
        if (same(f.cell, f.goal)) {
          if (f.command) this.begin(f);
          else this.idle(f);
        } else {
          const path = this.path(f, f.goal);
          if (path?.length) {
            f.next = path[0];
            f.mode = "walk";
            f.blocked = 0;
          } else {
            f.mode = "idle";
            f.blocked += dt;
            if (f.blocked > 5) this.idle(f);
          }
        }
        continue;
      }
      f.mode = "idle";
      f.wait -= dt;
      if (f.wait > 0) continue;
      const need: Command | undefined =
        f.care.needs.energy < 40
          ? "nap"
          : f.care.needs.food < 55
            ? "feed"
            : f.care.needs.joy < 55
              ? "play"
              : undefined;
      if (need && !this.command(f.id, need)) continue;
      const neighbour = this.friends.find(
        (o) =>
          o !== f &&
          o.loaded &&
          o.mode === "idle" &&
          !o.goal &&
          !o.command &&
          surfaceDistance(f.x, f.z, o.x, o.z) < spacing * 1.1,
      );
      if (neighbour && f.visits % 3 === 1) {
        for (const [a, b] of [
          [f, neighbour],
          [neighbour, f],
        ]) {
          a.mode = "greet";
          a.time = 0;
          a.yaw = surfaceHeading(a.x, a.z, b.x, b.z);
          a.visits++;
          a.care.needs.joy = Math.min(100, a.care.needs.joy + 3);
        }
        continue;
      }
      if (
        !reduced &&
        f.visits % 4 === 2 &&
        surfaceDistance(f.x, f.z, 8 * spacing, 0) < 16
      ) {
        const choices = planetAttractions(this.planet);
        if (
          !this.attraction(
            f.id,
            choices[(f.visits + this.friends.indexOf(f)) % choices.length],
          )
        )
          continue;
      }
      // Reduced motion keeps autonomous friends in place; explicit care still works.
      if (!reduced) {
        const offset = this.friends.indexOf(f) * 53 + f.visits * 97;
        const destinations =
          f.visits % 3 === 0
            ? cells.filter(
                (c) =>
                  surfaceDistance(f.x, f.z, c[0] * spacing, c[1] * spacing) < 5,
              )
            : cells;
        for (let i = 0; i < destinations.length; i++) {
          const target = destinations[(offset + i) % destinations.length];
          if (!same(target, f.cell) && this.path(f, target)?.length) {
            f.goal = target;
            break;
          }
        }
      }
      f.visits++;
      f.wait = 5;
    }
  }
}
