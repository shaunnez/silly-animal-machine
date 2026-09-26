import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { animateCreature } from "../../src/world/animation.ts";
import { resolveModel } from "../../src/world/models.ts";
import { sample, type Creature } from "../../src/game.ts";

export async function loadCreatureAsset(
  creature: Creature = sample,
  world = false,
) {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../public/assets/models/creatures.json", import.meta.url),
      "utf8",
    ),
  );
  const definition = resolveModel(manifest, creature)!;
  const bytes = await readFile(
    new URL(
      "../../public" +
        (world ? (definition.worldUrl ?? definition.url) : definition.url),
      import.meta.url,
    ),
  );
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  // Exercise real geometry, skin and animations without a browser image decoder.
  json.images = [];
  json.textures = [];
  json.materials = [{}];
  const content = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(content.length / 4) * 4;
  const binaryChunk = bytes.subarray(20 + jsonLength);
  const clean = Buffer.alloc(20 + paddedLength + binaryChunk.length, 0x20);
  clean.writeUInt32LE(0x46546c67, 0);
  clean.writeUInt32LE(2, 4);
  clean.writeUInt32LE(clean.length, 8);
  clean.writeUInt32LE(paddedLength, 12);
  clean.writeUInt32LE(0x4e4f534a, 16);
  content.copy(clean, 20);
  binaryChunk.copy(clean, 20 + paddedLength);
  const gltf = await new GLTFLoader().parseAsync(
    new Uint8Array(clean).buffer,
    "",
  );
  const bounds = new THREE.Box3().setFromObject(gltf.scene),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(2.6 / size.y, 3.8 / Math.max(size.x, size.z));
  gltf.scene.scale.setScalar(scale);
  gltf.scene.position.set(
    -center.x * scale,
    -bounds.min.y * scale,
    -center.z * scale,
  );
  const actor = new THREE.Group();
  actor.position.set(-0.25, 0.17, 0);
  actor.add(gltf.scene);
  const driver = animateCreature(gltf.scene, gltf.animations, definition);
  return { gltf, actor, driver, definition };
}
