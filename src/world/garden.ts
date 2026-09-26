import { assetUrl } from "../asset-url";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { powerFor } from "../powers";
import { createPowerEffects } from "./power-effects";
import type { Creature } from "../game";
import type { Activity } from "./progress";
import { resolveModel } from "./models";
import { animateCreature } from "./animation";
import {
  createInteraction,
  sampleStroll,
  home,
  ease,
  type Pose,
} from "./behaviour";

export type Garden = {
  dispose: () => void;
  act: (activity: Activity) => void;
  setFlowers: (count: number) => void;
  camera: (action: "left" | "right" | "in" | "out" | "reset") => void;
};
function disposeTree(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite))
      return;
    if (object instanceof THREE.Mesh) object.geometry.dispose();
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
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
}
export function createGarden(
  host: HTMLElement,
  creature: Creature,
  callbacks: {
    ready: () => void;
    phase: (message: string) => void;
    complete: () => void;
    model: (state: "model" | "picture" | "unavailable") => void;
    error: () => void;
  },
): Garden {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9effb");
  scene.fog = new THREE.Fog("#d9effb", 16, 35);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 13;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.42;
  controls.target.set(0, 1.1, 0);
  camera.position.set(5.3, 4.5, 7.8);
  controls.update();
  controls.saveState();
  scene.add(new THREE.HemisphereLight(0xfff5ec, 0x638e9e, 1.6));
  const sun = new THREE.DirectionalLight(0xffefd8, 1.8);
  sun.position.set(-3, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -7,
    right: 7,
    top: 7,
    bottom: -7,
    near: 0.1,
    far: 20,
  });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0001;
  scene.add(sun);
  const soft = new THREE.DirectionalLight(0xc7ddff, 0.8);
  soft.position.set(5, 4, -4);
  scene.add(soft);
  const colors = ["#fca7d6", "#b7a1fc", "#90dcf2", "#ffe195", "#a5e4bc"];
  function mesh(
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) {
    const object = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.82 }),
    );
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function sphere(
    color: string,
    x: number,
    y: number,
    z: number,
    radius: number,
    parent: THREE.Object3D = scene,
  ) {
    return mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      color,
      x,
      y,
      z,
      parent,
    );
  }
  const island = mesh(
    new THREE.CylinderGeometry(4.1, 3.5, 0.7, 64),
    "#dbbea5",
    0,
    -0.36,
    0,
  );
  island.receiveShadow = true;
  mesh(
    new THREE.CylinderGeometry(4.12, 4.08, 0.15, 64),
    "#b0d992",
    0,
    0.025,
    0,
  );
  mesh(
    new THREE.CylinderGeometry(1.55, 1.65, 0.065, 48),
    "#e8e2c0",
    0,
    0.13,
    0,
  );
  const pond = mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.04, 48),
    "#86cedb",
    -2.2,
    0.13,
    1.1,
  );
  pond.scale.z = 0.65;
  const pondRim = mesh(
    new THREE.TorusGeometry(0.87, 0.065, 8, 48),
    "#f4e4c7",
    -2.2,
    0.15,
    1.1,
  );
  pondRim.rotation.x = -Math.PI / 2;
  pondRim.scale.y = 0.65;
  for (let i = 0; i < 5; i++) {
    const stone = sphere(
      "#f0e9d1",
      0.15 + Math.sin(i) * 0.14,
      0.14,
      1.5 + i * 0.44,
      0.25,
    );
    stone.scale.set(1, 0.22, 0.75);
  }
  for (let i = 0; i < 11; i++) {
    const angle = Math.PI + i * 0.24;
    const x = Math.cos(angle) * 3.5,
      z = Math.sin(angle) * 3.5;
    mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.75, 8),
      "#fff0d9",
      x,
      0.49,
      z,
    );
    sphere("#fff0d9", x, 0.9, z, 0.075);
    if (i < 10) {
      const next = angle + 0.24;
      const end = new THREE.Vector3(
        Math.cos(next) * 3.5,
        0.63,
        Math.sin(next) * 3.5,
      );
      const start = new THREE.Vector3(x, 0.63, z);
      const rail = mesh(
        new THREE.CylinderGeometry(0.038, 0.038, start.distanceTo(end), 8),
        "#fff0d9",
        ...(start.clone().add(end).multiplyScalar(0.5).toArray() as [
          number,
          number,
          number,
        ]),
      );
      rail.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.sub(start).normalize(),
      );
    }
  }
  for (const [x, z, scale] of [
    [-2.6, -1.7, 1],
    [2.7, -1.6, 0.85],
    [-3, 0.1, 0.5],
    [2.8, 0.7, 0.6],
  ]) {
    mesh(
      new THREE.CylinderGeometry(0.13, 0.18, 1.5 * scale, 12),
      "#bf9274",
      x,
      0.8 * scale,
      z,
    );
    const crown = sphere("#92cbae", x, 1.8 * scale, z, 0.9 * scale);
    crown.scale.y = 1.2;
    sphere("#b2ddae", x - 0.4 * scale, 1.6 * scale, z + 0.1, 0.55 * scale);
    sphere("#badfc0", x + 0.35 * scale, 2 * scale, z, 0.55 * scale);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bush = sphere(
      i % 2 ? "#9aca8b" : "#c1dd9e",
      Math.cos(a) * 3.75,
      0.22,
      Math.sin(a) * 3.75,
      0.3,
    );
    bush.scale.y = 0.7;
  }
  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  for (const [x, y, z, s] of [
    [-5, 5, -5, 1],
    [5, 5.5, -7, 1.3],
    [-1, 6, -8, 0.8],
  ]) {
    for (let i = 0; i < 3; i++) {
      const puff = sphere(
        "#ffffff",
        x + (i - 1) * 0.6 * s,
        y + (i === 1 ? 0.2 : 0),
        z,
        0.5 * s,
        cloudGroup,
      );
      puff.scale.z = 0.65;
    }
  }
  const flowers: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2,
      radius = 2.6 + (i % 2) * 0.35;
    const flower = new THREE.Group();
    flower.position.set(
      Math.cos(angle) * radius,
      0.14,
      Math.sin(angle) * radius,
    );
    scene.add(flower);
    flowers.push(flower);
    flower.visible = false;
    mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.4, 6),
      "#72a979",
      0,
      0.2,
      0,
      flower,
    );
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2;
      const petal = sphere(
        colors[i % colors.length],
        Math.cos(a) * 0.13,
        0.46 + Math.sin(a) * 0.13,
        0,
        0.1,
        flower,
      );
      petal.scale.z = 0.5;
    }
    sphere("#ffe07e", 0, 0.46, 0.05, 0.07, flower);
  }
  const actor = new THREE.Group();
  actor.position.y = 0.17;
  scene.add(actor);
  const effectGroup = new THREE.Group();
  scene.add(effectGroup);
  const apple = new THREE.Group();
  effectGroup.add(apple);
  apple.visible = false;
  sphere("#f47c8c", 0, 0, 0, 0.21, apple);
  mesh(
    new THREE.CylinderGeometry(0.025, 0.03, 0.14, 6),
    "#967753",
    0,
    0.25,
    0,
    apple,
  );
  const leaf = sphere("#97ca79", 0.08, 0.27, 0, 0.1, apple);
  leaf.scale.set(1, 0.35, 0.6);
  const ball = mesh(
    new THREE.SphereGeometry(0.3, 24, 16),
    "#b4a0f2",
    0,
    0.45,
    1.4,
    effectGroup,
  );
  ball.visible = false;
  const stripe = mesh(
    new THREE.TorusGeometry(0.3, 0.015, 8, 36),
    "#fff0bb",
    0,
    0,
    0,
    ball,
  );
  stripe.rotation.x = Math.PI / 2;
  const power = powerFor(creature);
  const powerEffects = createPowerEffects(effectGroup, power.id);
  let disposed = false,
    current: Activity | undefined,
    elapsed = 0,
    idleElapsed = 0,
    raf = 0;
  let animation: ReturnType<typeof animateCreature> | undefined;
  let ballOffset: [number, number] = [0, 0];
  let lastFrame = performance.now();
  let interaction: ReturnType<typeof createInteraction> | undefined;
  let pose: Pose = { ...home };
  let idleStart: Pose = { ...home };
  let phase = "";
  let ready = false;
  const forward = new THREE.Vector3();
  const snackStart = new THREE.Vector3();
  const mouthPosition = new THREE.Vector3();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const abort = new AbortController();
  function motionChanged() {
    idleStart = { x: pose.x, z: pose.z, yaw: pose.yaw };
    idleElapsed = 0;
    if (current) {
      interaction = createInteraction(
        current,
        pose,
        reduced.matches || !animation,
      );
      elapsed = 0;
    }
  }
  reduced.addEventListener("change", motionChanged);
  async function picture(state: "picture" | "unavailable") {
    try {
      const texture = await new THREE.TextureLoader().loadAsync(
        assetUrl(creature.image),
      );
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(mat);
      sprite.position.y = 1.45;
      const ratio = texture.image.width / texture.image.height;
      sprite.scale.set(2.6, 2.6 / ratio, 1);
      actor.add(sprite);
      callbacks.model(state);
      ready = true;
      callbacks.ready();
    } catch {
      if (!disposed) callbacks.error();
    }
  }
  async function loadFriend() {
    try {
      const response = await fetch(assetUrl("/assets/models/creatures.json"), {
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("Model directory unavailable");
      const manifest: unknown = await response.json();
      const definition = resolveModel(manifest, creature);
      if (!definition) {
        await picture("picture");
        return;
      }
      const model = await new GLTFLoader().loadAsync(assetUrl(definition.url));
      if (disposed) {
        disposeTree(model.scene);
        return;
      }
      const box = new THREE.Box3().setFromObject(model.scene),
        size = box.getSize(new THREE.Vector3()),
        center = box.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) {
        disposeTree(model.scene);
        throw new Error("Invalid model");
      }
      const scale = Math.min(2.6 / size.y, 3.8 / Math.max(size.x, size.z));
      model.scene.scale.setScalar(scale);
      model.scene.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      );
      model.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      try {
        animation = animateCreature(model.scene, model.animations, definition);
      } catch (error) {
        disposeTree(model.scene);
        throw error;
      }
      actor.add(model.scene);
      ballOffset = definition.ballOffset ?? [0, 0];
      callbacks.model("model");
      ready = true;
      callbacks.ready();
    } catch {
      if (!disposed) await picture("unavailable");
    }
  }
  void loadFriend();
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resize.observe(host);
  function contextLost(event: Event) {
    event.preventDefault();
    cancelAnimationFrame(raf);
    callbacks.error();
  }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  function frame(now: number) {
    if (disposed) return;
    // Pause the whole interaction while hidden; do not let props outrun a frozen rig.
    const delta = document.hidden
      ? 0
      : Math.min(Math.max(0, (now - lastFrame) / 1000), 0.05);
    lastFrame = now;
    if (ready) {
      elapsed += delta;
      idleElapsed += delta;
    }
    const moment = interaction?.sample(elapsed);

    const stroll =
      !moment && animation && !reduced.matches
        ? sampleStroll(idleElapsed, idleStart)
        : undefined;
    if (moment) pose = moment;
    else if (stroll) pose = stroll;
    actor.position.set(pose.x, 0.17, pose.z);
    actor.rotation.set(0, pose.yaw, 0);
    actor.scale.setScalar(1);
    animation?.sample(
      moment?.state === "magic" && power.id === "music"
        ? "celebrate"
        : (moment?.state ?? stroll?.state ?? "idle"),
      moment?.clipTime ?? stroll?.clipTime ?? idleElapsed,
      delta,
      reduced.matches,
    );
    actor.updateMatrixWorld(true);
    forward.set(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
    if (animation) {
      animation.mouth.getWorldPosition(mouthPosition);
      animation.mouth.getWorldDirection(forward);
    } else mouthPosition.set(pose.x, 1.65, pose.z + 0.5);
    apple.visible = false;
    ball.visible = false;
    powerEffects.hide();
    if (moment && !moment.done) {
      if (phase !== moment.phase) {
        phase = moment.phase;
        callbacks.phase(current === "magic" ? power.message : phase);
      }
      if (current === "feed") {
        apple.visible = moment.snack > 0;
        apple.scale.setScalar(moment.snack);
        // Lift from the offering position to the actual moving mouth, then bite.
        const lift = moment.state === "feed" ? ease(moment.clipTime / 0.65) : 0;
        snackStart.set(0.45, 1.0, 1.5);
        if (reduced.matches || !animation)
          snackStart.copy(mouthPosition).addScaledVector(forward, 0.25);
        apple.position
          .copy(snackStart)
          .lerp(
            mouthPosition.clone().addScaledVector(forward, 0.19 * moment.snack),
            lift,
          );
      } else if (current === "play" && moment.ball) {
        ball.visible = true;
        ball.position.set(...moment.ball);
        if (animation && !reduced.matches) {
          ball.position.x += ballOffset[0];
          ball.position.z += ballOffset[1];
        }
        if (!animation && !reduced.matches)
          ball.position.y += Math.abs(Math.sin(elapsed * Math.PI * 2)) * 0.35;
        ball.rotation.x = reduced.matches ? 0 : -elapsed * 3;
      } else if (current === "magic") {
        powerEffects.sample(
          elapsed,
          mouthPosition,
          forward,
          actor.position,
          camera,
          reduced.matches,
        );
      }
    } else if (moment?.done) {
      interaction = undefined;
      current = undefined;
      idleStart = { x: pose.x, z: pose.z, yaw: pose.yaw };
      idleElapsed = 0;
      callbacks.complete();
    }
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    act(activity) {
      if (!ready || interaction) return;
      current = activity;
      interaction = createInteraction(
        activity,
        pose,
        reduced.matches || !animation,
      );
      elapsed = 0;
      phase = "";
    },
    setFlowers(count) {
      flowers.forEach((flower, i) => {
        flower.visible = i < count;
      });
    },
    camera(action) {
      if (action === "reset") {
        controls.reset();
        return;
      }
      const offset = camera.position.clone().sub(controls.target);
      if (action === "left" || action === "right")
        offset.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          action === "left" ? -0.35 : 0.35,
        );
      else
        offset.setLength(
          THREE.MathUtils.clamp(
            offset.length() * (action === "in" ? 0.82 : 1.22),
            controls.minDistance,
            controls.maxDistance,
          ),
        );
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    dispose() {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      resize.disconnect();
      reduced.removeEventListener("change", motionChanged);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      animation?.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
