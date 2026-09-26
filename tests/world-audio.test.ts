import test from "node:test";
import assert from "node:assert/strict";
import { animalCalls } from "../src/world/animal-sounds.ts";
import type { Animal } from "../src/game.ts";
import { createWorldAudio } from "../src/world/world-audio.ts";

test("sound is opt-in, bounded, rate-limited, and stops on pause/mute/hidden/disposal", () => {
  const savedAudio = Object.getOwnPropertyDescriptor(
    globalThis,
    "AudioContext",
  );
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const doc = { hidden: false };
  let started = 0,
    stopped = 0,
    closed = 0;
  class Audio {
    currentTime = 1;
    state = "running";
    destination = {};
    resume() {
      return Promise.resolve();
    }
    close() {
      closed++;
      return Promise.resolve();
    }
    createBuffer(_channels: number, length: number) {
      return {
        copyToChannel(pcm: Float32Array) {
          assert.equal(pcm.length, length);
          assert.ok(pcm.every(Number.isFinite));
        },
      };
    }
    createBufferSource() {
      return {
        buffer: undefined,
        onended: undefined,
        connect() {},
        disconnect() {},
        start() {
          started++;
        },
        stop() {
          stopped++;
        },
      };
    }
  }
  Object.defineProperty(globalThis, "AudioContext", {
    value: Audio,
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: doc,
    configurable: true,
  });
  try {
    const audio = createWorldAudio();
    audio.play("select");
    assert.equal(started, 0);
    audio.enable(true);
    audio.play("select");
    audio.play("select");
    assert.equal(started, 1);
    for (const event of [
      "join",
      "step",
      "bite",
      "kick",
      "note",
      "sleep",
      "wake",
    ] as const)
      audio.play(event);
    assert.equal(started, 6);
    audio.pause(true);
    assert.equal(stopped, 6);
    audio.play("snow");
    assert.equal(started, 6);
    audio.pause(false);
    doc.hidden = true;
    audio.play("snow");
    assert.equal(started, 6);
    doc.hidden = false;
    audio.play("snow");
    assert.equal(started, 7);
    audio.enable(false);
    assert.equal(stopped, 7);
    audio.play("rain");
    assert.equal(started, 7);
    audio.play("animal:cat");
    assert.equal(started, 7, "animal calls respect mute");
    audio.enable(true);
    for (const animal of Object.keys(animalCalls) as Animal[]) {
      const before: number = started;
      audio.play(`animal:${animal}`);
      assert.equal(started, before + 1, `${animal} has a playable call`);
      audio.play(`animal:${animal}`);
      assert.equal(started, before + 1, "repeated clicks are rate limited");
      audio.silence();
    }
    audio.pause(true);
    audio.play("animal:cat");
    assert.equal(started, 16, "animal calls respect pause");
    audio.dispose();
    assert.equal(closed, 1);
  } finally {
    if (savedAudio)
      Object.defineProperty(globalThis, "AudioContext", savedAudio);
    else Reflect.deleteProperty(globalThis, "AudioContext");
    if (savedDocument)
      Object.defineProperty(globalThis, "document", savedDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
