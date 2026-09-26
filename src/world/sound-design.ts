import { animalCalls } from "./animal-sounds";
import type { Animal } from "../game";
export type EffectSound =
  | "select"
  | "join"
  | "step"
  | "bite"
  | "kick"
  | "note"
  | "sleep"
  | "wake"
  | "rain"
  | "snow"
  | "magic"
  | "land"
  | "flight"
  | "meadow"
  | "candy"
  | "water";
export type WorldSound = EffectSound | `animal:${Animal}`;

// Original procedural foley: deterministic PCM, no recordings, downloads or services.
export function soundSamples(event: WorldSound, variation = 0, rate = 22050) {
  const animal = event.startsWith("animal:")
    ? animalCalls[event.slice(7) as Animal]
    : undefined;
  const duration =
    animal?.length ??
    (
      {
        bite: 0.3,
        kick: 0.2,
        land: 0.22,
        note: 0.65,
        magic: 0.9,
        sleep: 1.3,
        flight: 1.6,
        water: 2.4,
        rain: 2,
        snow: 2,
        meadow: 1.8,
        candy: 1.3,
      } as Partial<Record<WorldSound, number>>
    )[event] ??
    0.4;
  const samples = new Float32Array(Math.ceil(duration * rate));
  let seed = 719 + variation * 131,
    low = 0,
    phase = 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  const sin = (hz: number, t: number) => Math.sin(2 * Math.PI * hz * t);
  const bell = (hz: number, t: number) =>
    (sin(hz, t) +
      0.3 * sin(hz * 2.76, t) * Math.exp(-t * 8) +
      0.15 * sin(hz * 4.1, t) * Math.exp(-t * 12)) *
    Math.exp(-t * 6);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate,
      u = t / duration,
      noise = random();
    low += (noise - low) * 0.08;
    let value = 0;
    if (animal) {
      const p = u * (animal.pitch.length - 1),
        a = Math.floor(p),
        blend = p - a;
      const hz =
        (animal.pitch[a] * (1 - blend) +
          animal.pitch[Math.min(a + 1, animal.pitch.length - 1)] * blend) *
        (1 + 0.025 * sin(17, t));
      phase += (2 * Math.PI * hz) / rate;
      for (let h = 1; h <= 14; h++) {
        const formant = Math.exp(
          -Math.pow((h * hz - animal.vowel * (1 - u * 0.3)) / 650, 2),
        );
        value += (Math.sin(phase * h) * (0.12 + formant)) / h;
      }
      const pulse = Math.pow(
        Math.max(0, Math.sin(Math.PI * ((u * animal.pulses) % 1))),
        0.8,
      );
      value = (value * 0.24 + low * 0.15) * pulse;
    } else if (event === "bite") {
      const pulse = Math.pow(Math.max(0, sin(26 + (variation % 4), t)), 8);
      value =
        (noise - low) * pulse * Math.exp(-t * 8) * 0.55 +
        low * Math.exp(-t * 18) * 0.4;
    } else if (event === "kick" || event === "land" || event === "step") {
      value =
        (sin(event === "kick" ? 92 : 145, t) * 0.45 + low * 0.8) *
        Math.exp(-t * 28) *
        (event === "step" ? 0.13 : 0.7);
    } else if (["sleep", "rain", "snow", "water", "flight"].includes(event)) {
      const envelope = Math.pow(Math.sin(Math.PI * u), 2);
      value =
        (event === "rain" ? noise * 0.06 + low * 0.35 : low * 0.65) * envelope;
      if (event === "sleep")
        value += sin(110, t) * 0.022 * envelope * Math.max(0, sin(1.4, t));
      if (event === "flight") value += sin(90 + 130 * u, t) * 0.06 * envelope;
    } else if (event === "magic") {
      for (let j = 0; j < 4; j++) {
        const time = t - j * 0.17;
        if (time >= 0)
          value +=
            sin(700 + j * 190, time) * Math.exp(-time * 60) * 0.4 +
            bell(1046 + j * 130, time) * 0.06;
      }
    } else if (event === "meadow") {
      value = low * 0.08;
      for (let j = 0; j < 3; j++) {
        const time = t - j * 0.2 - 0.3;
        if (time > 0 && time < 0.13)
          value +=
            sin(1800 + 350 * Math.sin(time * 25), time) *
            Math.sin((time / 0.13) * Math.PI) *
            0.07;
      }
    } else {
      const melody = [523.25, 659.25, 784, 880, 784, 659.25];
      const hz =
        event === "note"
          ? melody[variation % melody.length]
          : event === "select"
            ? 740
            : event === "wake"
              ? 587
              : 880;
      value = bell(hz, t) * 0.2;
      if (event === "join" || event === "candy" || event === "wake") {
        const time = t - 0.13;
        if (time > 0) value += bell(hz * 1.25, time) * 0.13;
      }
    }
    // Short edge fades prevent clicks; headroom permits several simultaneous friends.
    samples[i] =
      Math.tanh(value) * Math.min(1, t / 0.008, (duration - t) / 0.025) * 0.5;
  }
  return samples;
}
