import { assetUrl } from "../asset-url";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { powerFor } from "../powers";
import { createPowerEffects } from "./power-effects";
import type { Creature } from "../game";
import { resolveModel } from "./models";
import { animateCreature } from "./animation";

/** One fixed camera contract for both the generated plate and saved portrait. */
export async function renderPortrait(creature: Creature): Promise<Blob> {
  if (!creature.scene) throw new Error("This friend has no landscape yet.");
  const response = await fetch(assetUrl("/assets/models/creatures.json"));
  if (!response.ok) throw new Error("Could not load your creature.");
  const definition = resolveModel(await response.json(), creature);
  if (!definition) throw new Error("This animal mix is not available.");
  const background = new Image();
  background.src = assetUrl(creature.scene.background);
  await background.decode();
  const model = await new GLTFLoader().loadAsync(assetUrl(definition.url));
  let renderer: THREE.WebGLRenderer | undefined;
  let animation: ReturnType<typeof animateCreature> | undefined;
  const scene = new THREE.Scene();
  scene.add(model.scene);
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(1024, 683);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const box = new THREE.Box3().setFromObject(model.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = Math.min(2.65 / size.y, 3.1 / Math.max(size.x, size.z));
    model.scene.scale.setScalar(scale);
    model.scene.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    );
    animation = animateCreature(model.scene, model.animations, definition);
    animation.sample("idle", 0, 1, true);
    model.scene.updateMatrixWorld(true);
    // Use the posed feet, including Unisaurus's closed resting jaw, for grounding.
    const posed = new THREE.Box3().setFromObject(model.scene, true);
    model.scene.position.y -= posed.min.y;
    model.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 30);
    camera.position.set(0, 1.5, 7);
    camera.lookAt(0, 1.3, 0);
    scene.add(new THREE.HemisphereLight(0xfff5ec, 0x869e87, 2));
    const sun = new THREE.DirectionalLight(0xffefd8, 2.3);
    sun.position.set(-3, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.1,
      far: 20,
    });
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    if (creature.scene.portraitVersion === 2) {
      const effects = new THREE.Group();
      scene.add(effects);
      camera.updateMatrixWorld(true);
      createPowerEffects(effects, powerFor(creature).id).portrait(camera);
    }
    renderer.render(scene, camera);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 683;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not save the scene picture.");
    const ratio = Math.max(
      canvas.width / background.naturalWidth,
      canvas.height / background.naturalHeight,
    );
    const width = background.naturalWidth * ratio,
      height = background.naturalHeight * ratio;
    context.drawImage(
      background,
      (1024 - width) / 2,
      (683 - height) / 2,
      width,
      height,
    );
    context.drawImage(renderer.domElement, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not save the scene picture.")),
        "image/png",
      ),
    );
  } finally {
    animation?.dispose();
    const textures = new Set<THREE.Texture>();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const value of Object.values(mat))
          if (value instanceof THREE.Texture) textures.add(value);
        mat.dispose();
      }
    });
    for (const texture of textures) {
      texture.dispose();
      if (
        typeof ImageBitmap !== "undefined" &&
        texture.image instanceof ImageBitmap
      )
        texture.image.close();
    }
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
