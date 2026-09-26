import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyProgress,
  parseProgress,
  recordActivity,
  flowerCount,
  progressKey,
} from "../src/world/progress.ts";

test("a new friend grows a flower after three activities and keeps it after loading", () => {
  let progress = emptyProgress();
  progress = recordActivity(progress, "feed");
  progress = recordActivity(progress, "play");
  assert.equal(flowerCount(progress), 0);
  progress = recordActivity(progress, "magic");
  assert.equal(flowerCount(progress), 1);
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  assert.equal(flowerCount(parseProgress(JSON.stringify(progress))), 1);
});
test("each creature has independent progress and the garden has a finite capacity", () => {
  assert.notEqual(
    progressKey("sample-unisaurus"),
    progressKey("another-creature"),
  );
  const full = { version: 1 as const, feed: 9999, play: 9999, magic: 9999 };
  assert.equal(flowerCount(full), 12);
  assert.deepEqual(recordActivity(full, "feed"), full);
});
test("broken, outdated and out-of-range browser saves safely start a fresh garden", () => {
  for (const value of [
    null,
    "",
    "invalid",
    "null",
    "[]",
    '{"version":2,"feed":1,"play":1,"magic":1}',
    '{"version":1,"feed":-1,"play":0,"magic":0}',
    '{"version":1,"feed":0.5,"play":0,"magic":0}',
    '{"version":1,"feed":10000,"play":0,"magic":0}',
    '{"version":1,"feed":"1","play":0,"magic":0}',
  ])
    assert.deepEqual(parseProgress(value), emptyProgress());
});
