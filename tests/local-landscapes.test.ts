import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { backgrounds, chooseBackground } from "../src/backgrounds.ts";
import { createPowerEffects } from "../src/world/power-effects.ts";
import { powers } from "../src/powers.ts";
import * as THREE from "three";

test("ten bundled JPEG landscapes exist and random selection avoids the previous one", async () => {
  assert.equal(backgrounds.length, 10);
  assert.equal(new Set(backgrounds.map((b) => b.id)).size, 10);
  const selected = new Set<string>();
  for (let i = 0; i < 10; i++)
    selected.add(chooseBackground(undefined, () => (i + 0.5) / 10).id);
  assert.equal(selected.size, 10);
  for (const background of backgrounds) {
    const bytes = await readFile(
      new URL(`../public${background.url}`, import.meta.url),
    );
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.ok(bytes.length < 1024 * 1024);
    for (let i = 0; i < 10; i++)
      assert.notEqual(
        chooseBackground(background.id, () => i / 10).id,
        background.id,
      );
  }
});

test("saved portrait powers surround the creature and remain visible without an animation clock", () => {
  for (const power of powers) {
    const group = new THREE.Group();
    const effects = createPowerEffects(group, power.id);
    effects.portrait(new THREE.OrthographicCamera());
    const visible = group.children.filter((p) => p.visible);
    assert.equal(visible.length, 10);
    for (const particle of visible) {
      assert.ok(Math.abs(particle.position.x) < 2);
      assert.ok(particle.position.y >= 0);
      if (power.id !== "flowers")
        assert.ok(Math.abs(particle.position.x) >= 1.25);
    }
  }
});
