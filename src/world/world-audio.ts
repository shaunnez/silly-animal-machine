import { soundSamples, type WorldSound } from "./sound-design";
export type { WorldSound } from "./sound-design";

export function createWorldAudio() {
  let context: AudioContext | undefined,
    enabled = false,
    blocked = false,
    variation = 0;
  const voices = new Set<AudioBufferSourceNode>();
  const last = new Map<WorldSound, number>();
  const buffers = new Map<string, AudioBuffer>();
  function stop() {
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
      voice.disconnect();
    }
    voices.clear();
  }
  function hidden() {
    if (document.hidden) stop();
  }
  if (typeof document !== "undefined")
    document.addEventListener?.("visibilitychange", hidden);
  return {
    enable(value: boolean) {
      enabled = value;
      if (!value) stop();
      else
        try {
          context ??= new AudioContext();
          void context.resume().catch(() => {});
        } catch {
          enabled = false;
        }
    },
    pause(value: boolean) {
      blocked = value;
      if (value) stop();
    },
    play(event: WorldSound) {
      if (
        !enabled ||
        blocked ||
        document.hidden ||
        !context ||
        context.state !== "running" ||
        voices.size >= 6
      )
        return;
      // Walking and weather no longer create an incessant cue on every simulation tick.
      if (event === "step") return;
      const ambience = ["rain", "snow", "water", "meadow", "candy"].includes(
        event,
      );
      const now = context.currentTime;
      if (
        now - (last.get(event) ?? -20) <
        (ambience ? 9 : event.startsWith("animal:") ? 0.7 : 0.12)
      )
        return;
      last.set(event, now);
      try {
        const variant = variation++ % 6,
          key = `${event}:${variant}`;
        let buffer = buffers.get(key);
        if (!buffer) {
          const pcm = soundSamples(event, variant);
          buffer = context.createBuffer(1, pcm.length, 22050);
          buffer.copyToChannel(pcm, 0);
          buffers.set(key, buffer);
        }
        const voice = context.createBufferSource();
        voice.buffer = buffer;
        voice.connect(context.destination);
        voices.add(voice);
        voice.onended = () => {
          voices.delete(voice);
          voice.disconnect();
        };
        voice.start();
      } catch {
        /* Unsupported or interrupted audio must never interrupt play. */
      }
    },
    silence: stop,
    dispose() {
      stop();
      buffers.clear();
      document.removeEventListener?.("visibilitychange", hidden);
      void context?.close();
      context = undefined;
    },
  };
}
