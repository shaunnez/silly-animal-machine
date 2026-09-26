import test from "node:test";
import assert from "node:assert/strict";
import { powers, powerFor } from "../src/powers.ts";
import { validateRecipe } from "../src/game.ts";
import {
  powerParticle,
  createPowerEffects,
} from "../src/world/power-effects.ts";
import * as THREE from "three";

test("each selected power is saved explicitly and controls its scenery and play action", () => {
  for (const power of powers) {
    const recipe = validateRecipe({
      first: "cat",
      second: "dog",
      powerId: power.id,
      idea: "tampered scenery",
    });
    assert.equal(recipe.idea, power.idea);
    assert.equal(powerFor(JSON.parse(JSON.stringify(recipe))).id, power.id);
  }
  assert.throws(() =>
    validateRecipe({
      first: "cat",
      second: "dog",
      powerId: "unknown",
      idea: "Hello",
    }),
  );
});
test("old creatures retain their idea with a known power or safe bubble fallback", () => {
  assert.equal(powerFor({ idea: " Makes music " }).id, "music");
  const old = { idea: "Likes pancakes in space" };
  assert.equal(powerFor(old).id, "bubbles");
  assert.equal(old.idea, "Likes pancakes in space");
});
test("all four effects appear, stay bounded, respect reduced motion, and disappear", () => {
  for (const power of powers) {
    const group = new THREE.Group();
    const effect = createPowerEffects(group, power.id);
    effect.sample(
      1,
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(),
      new THREE.PerspectiveCamera(),
      false,
    );
    assert.ok(group.children.some((child) => child.visible));
    for (let i = 0; i < 18; i++) {
      const state = powerParticle(power.id, i, 1, false);
      assert.ok(Number.isFinite(state.x + state.y + state.z));
      assert.ok(Math.hypot(state.x, state.z) < 3);
      assert.equal(powerParticle(power.id, i, 8, false).visible, false);
      const still = powerParticle(power.id, i, 1, true);
      if (power.id !== "flowers") assert.ok(still.z <= 0.25);
    }
    effect.hide();
    assert.ok(group.children.every((child) => !child.visible));
  }
});
