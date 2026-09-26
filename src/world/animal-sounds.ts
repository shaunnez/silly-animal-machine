import type { Animal } from "../game";

// Short, friendly synthesized calls: pitch contours and vocal formants, not speech.
export const animalCalls: Record<
  Animal,
  {
    pitch: number[];
    vowel: number;
    length: number;
    pulses: number;
    wave: OscillatorType;
  }
> = {
  cat: {
    pitch: [430, 780, 650, 330],
    vowel: 1100,
    length: 0.65,
    pulses: 1,
    wave: "sawtooth",
  },
  dog: {
    pitch: [170, 115, 95, 80],
    vowel: 640,
    length: 0.42,
    pulses: 2,
    wave: "square",
  },
  frog: {
    pitch: [110, 165, 110, 80],
    vowel: 480,
    length: 0.55,
    pulses: 3,
    wave: "sawtooth",
  },
  lion: {
    pitch: [85, 110, 80, 55],
    vowel: 380,
    length: 0.8,
    pulses: 1,
    wave: "sawtooth",
  },
  elephant: {
    pitch: [170, 360, 390, 185],
    vowel: 950,
    length: 0.8,
    pulses: 1,
    wave: "sawtooth",
  },
  monkey: {
    pitch: [560, 820, 600, 740],
    vowel: 1600,
    length: 0.65,
    pulses: 3,
    wave: "triangle",
  },
  penguin: {
    pitch: [640, 970, 710, 530],
    vowel: 2100,
    length: 0.45,
    pulses: 2,
    wave: "triangle",
  },
  unicorn: {
    pitch: [430, 700, 560, 350],
    vowel: 1700,
    length: 0.8,
    pulses: 4,
    wave: "triangle",
  },
  dinosaur: {
    pitch: [140, 190, 115, 65],
    vowel: 500,
    length: 0.8,
    pulses: 1,
    wave: "sawtooth",
  },
};
