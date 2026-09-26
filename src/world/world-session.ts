import type { WorldSave } from "./care";

/** One in-flight save; edits during it are saved with the returned revision. */
export function worldSession(
  state: WorldSave,
  write: (snapshot: WorldSave) => Promise<WorldSave>,
  changed: (error?: Error) => void,
) {
  let pending: Promise<void> | undefined;
  let again = false;
  let stopped = false;
  async function flush(retry = false): Promise<boolean> {
    if (stopped && !retry) return false;
    if (pending) {
      again = true;
      await pending;
      return !stopped;
    }
    stopped = false;
    pending = (async () => {
      do {
        again = false;
        try {
          const saved = await write(structuredClone(state));
          state.revision = saved.revision;
          changed();
        } catch (error) {
          stopped = true;
          changed(
            error instanceof Error
              ? error
              : new Error("Your meadow couldn't save. Please try again."),
          );
          break;
        }
      } while (again);
    })();
    await pending;
    pending = undefined;
    return !stopped;
  }
  return { flush };
}
