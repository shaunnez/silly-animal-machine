import { assetUrl } from "../asset-url";
import { terrainHeight } from "./terrain";
import { attractions, ridePose, type Attraction } from "./attractions";
import { createRideGear } from "./attraction-scenery";
import type { PlanetId } from "./planets";
import { createPlanet, type Weather } from "./planet";
import { surfaceDistance, planetCenter, planetRadius } from "./surface";
import type { WorldSound } from "./world-audio";
import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Creature } from "../game";
import { powerFor } from "../powers";
import { resolveModel } from "./models";
import { animateCreature } from "./animation";
import { createPowerEffects } from "./power-effects";
import {
  activityText,
  spacing,
  MeadowSimulation,
  type Command,
  type Friend,
  type Cell,
} from "./meadow-simulation";
import type { Care } from "./care";

function disposeResources(roots: THREE.Object3D[]) {
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  for (const root of roots)
    root.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Sprite ||
        o instanceof THREE.Points ||
        o instanceof THREE.Line
      ) {
        if (!(o instanceof THREE.Sprite)) geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
  for (const m of materials) {
    for (const v of Object.values(m))
      if (v instanceof THREE.Texture) textures.add(v);
    m.dispose();
  }
  geometry.forEach((g) => g.dispose());
  textures.forEach((t) => {
    t.dispose();
    if (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap)
      t.image.close();
  });
}
type Visual = {
  creature: Creature;
  actor: THREE.Group;
  props: THREE.Group;
  label: HTMLButtonElement;
  animation?: ReturnType<typeof animateCreature>;
  root?: THREE.Object3D;
  apple: THREE.Group;
  effectsFrame: THREE.Group;
  motion: "step" | "hop" | "waddle";
  sleep: THREE.Sprite;
  ring: THREE.Mesh;
  effects: ReturnType<typeof createPowerEffects>;
  ballOffset: [number, number];
  sizeRatio: number;
  labelHeight: number;
  lift: number;
  gear: ReturnType<typeof createRideGear>;
};
export type Meadow = ReturnType<typeof createMeadow>;
export function createMeadow(
  host: HTMLElement,
  callbacks: {
    select: (id: string) => void;
    placement?: (active: boolean) => void;
    moved?: (id: string, placed: boolean) => void;
    view?: (following: boolean) => void;
    sound: (event: WorldSound) => void;
    complete: (id: string, action: Command) => void;
    update: (friends: Friend[]) => void;
    loaded: (id: string, status: "model" | "picture" | "unavailable") => void;
    error: () => void;
  },
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dceff7");
  scene.fog = new THREE.Fog("#dceff7", 48, 85);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      matchMedia("(max-width: 850px)").matches ? 1 : 1.5,
    ),
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const labels = document.createElement("div");
  labels.className = "meadow-labels";
  host.append(labels);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 70);
  camera.position.set(7, 12, 22);
  const controls = new TrackballControls(camera, renderer.domElement);
  controls.noPan = true;
  controls.staticMoving = true;
  controls.rotateSpeed = 2.2;
  controls.minDistance = 11;
  controls.maxDistance = 45;
  controls.target.copy(planetCenter);
  const homePosition = camera.position.clone(),
    homeUp = camera.up.clone();
  controls.update();
  function overview() {
    following = false;
    callbacks.view?.(false);
    controls.target.copy(planetCenter);
    camera.position.copy(homePosition);
    camera.up.copy(homeUp);
    controls.minDistance = 11;
    controls.update();
  }
  const followNormal = new THREE.Vector3(0, 1, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  scene.add(new THREE.HemisphereLight(0xfff5e8, 0x7292a2, 2));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-6, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 35,
  });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  function mesh(
    g: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) {
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function sphere(
    color: string,
    x: number,
    y: number,
    z: number,
    r: number,
    parent: THREE.Object3D = scene,
  ) {
    return mesh(new THREE.SphereGeometry(r, 12, 8), color, x, y, z, parent);
  }
  let planetId: PlanetId = "meadow";
  let planet = createPlanet(scene);
  const surfaceFrame = (x: number, z: number, h = 0) =>
    planet.terrain.frame(x, z, h);
  const placeOnSurface = (
    o: THREE.Object3D,
    x: number,
    z: number,
    h = 0,
    yaw = 0,
  ) => planet.terrain.place(o, x, z, h, yaw);
  const simulation = new MeadowSimulation(callbacks.complete, callbacks.sound);
  const balls = new Map<number, THREE.Mesh>();
  const visuals = new Map<string, Visual>();
  const cache = new Map<string, Promise<GLTF>>();
  const sources: THREE.Object3D[] = [];
  const abort = new AbortController();
  const manifest = fetch(assetUrl("/assets/models/creatures.json"), {
    signal: abort.signal,
  }).then((r) => {
    if (!r.ok) throw new Error("Model directory unavailable");
    return r.json() as Promise<unknown>;
  });
  // Handle rejection immediately; each arriving friend also gets a picture fallback.
  void manifest.catch(() => {});
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    paused = false,
    selected = "",
    following = false,
    raf = 0,
    last = performance.now(),
    uiElapsed = 0,
    skyTime = 0,
    weather: Weather = "sunny";
  let frames = 0,
    frameMs = 0;
  const mouth = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    projected = new THREE.Vector3();
  function textSprite(text: string, color: string, background = "transparent") {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = "bold 42px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
  }
  async function load(v: Visual) {
    try {
      const definition = resolveModel(await manifest, v.creature);
      if (!definition) {
        await picture(v, "picture");
        return;
      }
      const modelUrl = definition.worldUrl ?? definition.url;
      v.motion = definition.motion ?? "step";
      let promise = cache.get(modelUrl);
      if (!promise) {
        promise = new GLTFLoader()
          .loadAsync(assetUrl(modelUrl))
          .then((gltf) => {
            if (disposed) disposeResources([gltf.scene]);
            else sources.push(gltf.scene);
            return gltf;
          });
        cache.set(modelUrl, promise);
      }
      const gltf = await promise;
      if (disposed || visuals.get(v.creature.id) !== v) return;
      const root = clone(gltf.scene);
      const box = new THREE.Box3().setFromObject(root),
        size = box.getSize(new THREE.Vector3()),
        center = box.getCenter(new THREE.Vector3());
      const scale = Math.min(1.65 / size.y, 1.05 / Math.max(size.x, size.z));
      v.sizeRatio =
        scale / Math.min(2.6 / size.y, 3.8 / Math.max(size.x, size.z));
      v.labelHeight = size.y * scale + 0.4;
      root.scale.setScalar(scale);
      root.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      );
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      v.animation = animateCreature(root, gltf.animations, definition);
      v.root = root;
      v.actor.add(root);
      v.ballOffset = definition.ballOffset ?? [0, 0];
      arrived(v, "model");
    } catch {
      if (!disposed && visuals.get(v.creature.id) === v)
        await picture(v, "unavailable");
    }
  }
  function arrived(v: Visual, status: "model" | "picture" | "unavailable") {
    const f = simulation.friends.find((f) => f.id === v.creature.id);
    if (f) f.loaded = true;
    callbacks.loaded(v.creature.id, status);
  }
  async function picture(v: Visual, status: "picture" | "unavailable") {
    try {
      const t = await new THREE.TextureLoader().loadAsync(
        assetUrl(v.creature.image),
      );
      if (disposed || visuals.get(v.creature.id) !== v) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
      sprite.position.y = 0.8;
      sprite.scale.set(1.2, 0.8, 1);
      v.root = sprite;
      v.actor.add(sprite);
      arrived(v, status);
    } catch {
      if (!disposed) callbacks.loaded(v.creature.id, "unavailable");
    }
  }
  function add(creature: Creature, care: Care) {
    if (visuals.has(creature.id) || visuals.size >= 6) return;
    simulation.add(creature.id, care, powerFor(creature).id === "music");
    const actor = new THREE.Group(),
      props = new THREE.Group();
    scene.add(actor, props);
    const apple = new THREE.Group();
    props.add(apple);
    sphere("#f27b87", 0, 0, 0, 0.13, apple);
    mesh(
      new THREE.CylinderGeometry(0.014, 0.018, 0.09, 6),
      "#947753",
      0,
      0.14,
      0,
      apple,
    );
    sphere("#8aba72", 0.04, 0.16, 0, 0.045, apple).scale.y = 0.3;
    const ring = mesh(
      new THREE.TorusGeometry(0.68, 0.065, 8, 40),
      "#ffcf48",
      0,
      0.02,
      0,
      actor,
    );
    ring.rotation.x = -Math.PI / 2;
    const sleep = textSprite("z z Z", "#977ab5");
    sleep.scale.set(0.95, 0.25, 1);
    props.add(sleep);
    const label = document.createElement("button");
    label.className = "meadow-name";
    label.textContent = creature.name;
    label.setAttribute("aria-label", `Select ${creature.name}`);
    label.onclick = () => callbacks.select(creature.id);
    labels.append(label);
    const effectsFrame = new THREE.Group();
    actor.add(effectsFrame);
    const v: Visual = {
      creature,
      actor,
      props,
      label,
      apple,
      effectsFrame,
      motion: "step",
      ring,
      sleep,
      effects: createPowerEffects(effectsFrame, powerFor(creature).id),
      ballOffset: [0, 0],
      sizeRatio: 0.5,
      labelHeight: 1.4,
      lift: 0,
      gear: createRideGear(actor),
    };
    apple.visible = false;
    sleep.visible = false;
    visuals.set(creature.id, v);
    void load(v);
  }
  function remove(id: string) {
    if (carried?.id === id) cancel();
    simulation.remove(id);
    const v = visuals.get(id);
    if (!v) return;
    v.animation?.dispose();
    if (v.root instanceof THREE.Sprite) disposeResources([v.root]);
    else
      v.root?.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      });
    v.root?.removeFromParent();
    disposeResources([v.props, v.actor]);
    v.actor.removeFromParent();
    v.props.removeFromParent();
    v.label.remove();
    visuals.delete(id);
  }
  function drawFriend(f: Friend, delta: number) {
    const v = visuals.get(f.id)!;
    const lifted = f.mode === "held" && carried?.id === f.id;
    if (lifted && carried) f = { ...f, x: carried.x, z: carried.z };
    v.lift =
      reduced.matches || paused
        ? lifted
          ? 0.85
          : 0
        : THREE.MathUtils.damp(v.lift, lifted ? 0.85 : 0, 14, delta);
    const ride =
      f.mode === "attraction" && f.outing && f.outing.kind !== "snowball"
        ? ridePose(f.outing.kind, f.outing.seat, f.time, reduced.matches)
        : undefined;
    v.gear.ski.visible = !!ride && f.outing?.kind === "ski";
    v.gear.board.visible = !!ride && f.outing?.kind === "snowboard";
    v.gear.bubble.visible =
      !!ride && f.outing?.kind === "fountain" && f.time < 7;
    const t = f.time;
    const session = simulation.sessions.find((s) => s.id === f.session);
    const dance = session?.kind === "music" && session.started;
    const hopping = f.mode === "walk" && v.motion === "hop" && !reduced.matches;
    const remaining = f.next
      ? Math.hypot(f.next[0] * spacing - f.x, f.next[1] * spacing - f.z)
      : 0;
    const bounce = hopping
      ? Math.sin(((f.distance % 0.7) / 0.7) * Math.PI) *
        0.18 *
        Math.min(1, remaining / 0.28, f.speed / 1.2)
      : dance && !reduced.matches
        ? Math.abs(Math.sin(t * Math.PI * 2.5)) * 0.09
        : 0;
    const soloChase =
      f.mode === "play" &&
      session?.participants.length === 1 &&
      !reduced.matches &&
      t > 0.9 &&
      t < 1.9
        ? Math.sin((t - 0.9) * Math.PI) * 0.45
        : 0;
    placeOnSurface(
      v.actor,
      f.x + Math.sin(f.yaw) * soloChase,
      f.z + Math.cos(f.yaw) * soloChase,
      0.055 + v.lift + (ride?.height ?? 0),
      f.yaw,
    );
    if (ride) v.actor.rotateZ(ride.lean);
    if (v.root) {
      v.root.position.y += bounce - (v.root.userData.bounce ?? 0);
      v.root.userData.bounce = bounce;
    }
    v.ring.visible = selected === f.id;
    let state: Parameters<NonNullable<Visual["animation"]>["sample"]>[0] =
        "idle",
      clipTime = t;
    if (f.mode === "walk") {
      state = "walk";
      clipTime = f.distance / 0.9;
    }
    if (f.mode === "feed") {
      state = t < 3.2 ? "feed" : "celebrate";
      if (t >= 3.2) clipTime = t - 3.2;
    }
    if (f.mode === "play") {
      const player =
        session?.participants[Math.floor(t / 2) % session.participants.length];
      state = session?.started
        ? t > 6
          ? "celebrate"
          : player === f.id
            ? "play"
            : "idle"
        : "idle";
      clipTime = t > 6 ? (t - 6) % 1.6 : t % 2;
      if (soloChase > 0) state = "walk";
    }
    if (f.mode === "attraction") {
      state =
        f.outing?.kind === "slide" && t < 2
          ? "walk"
          : f.outing?.kind === "ski" || f.outing?.kind === "snowboard"
            ? "idle"
            : "celebrate";
      clipTime = t % 1.6;
      if (
        ride &&
        (f.outing?.kind === "trampoline" || f.outing?.kind === "fountain") &&
        t >= 7
      )
        state = "walk";
      if (f.outing?.kind === "snowball") {
        state = "magic";
        clipTime = t % 2;
      }
    }
    if (f.mode === "nap") state = "sleep";
    if (dance) {
      state = "celebrate";
      clipTime = t % 1.6;
    }
    if (f.mode === "greet" || lifted) state = "celebrate";
    if (f.mode === "magic" && !dance)
      state = powerFor(v.creature).id === "music" ? "celebrate" : "magic";
    v.animation?.sample(state, clipTime, delta, reduced.matches);
    if (
      v.root &&
      !reduced.matches &&
      f.mode === "walk" &&
      v.motion === "waddle"
    )
      v.root.rotation.z = Math.sin(f.distance * 9) * 0.055;
    else if (v.root)
      v.root.rotation.z =
        dance && !reduced.matches ? Math.sin(t * Math.PI * 2.5) * 0.1 : 0;
    v.actor.updateMatrixWorld(true);
    forward.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    if (v.animation) {
      v.animation.mouth.getWorldPosition(mouth);
      v.animation.mouth.getWorldDirection(forward);
    } else mouth.set(f.x, 1, f.z + 0.25);
    v.apple.visible = false;
    v.sleep.visible = f.mode === "nap";
    v.effects.hide();
    if (f.mode === "feed" && t < 2.1) {
      const size = t < 1 ? 1 : t < 1.55 ? 0.72 : 0.43;
      v.apple.visible = true;
      v.apple.scale.setScalar(size);
      v.apple.position
        .copy(mouth)
        .addScaledVector(
          forward,
          0.12 * size + Math.max(0, 1 - t / 0.65) * 0.5,
        );
      v.apple.position.addScaledVector(
        surfaceFrame(f.x, f.z).normal,
        -Math.max(0, 1 - t / 0.65) * 0.4,
      );
    }
    if (f.mode === "nap")
      v.sleep.position.copy(surfaceFrame(f.x, f.z, 0.85).position);
    if (f.mode === "magic" && (!dance || f.music)) {
      const localMouth = v.actor.worldToLocal(mouth.clone());
      const localForward = forward
        .clone()
        .transformDirection(
          new THREE.Matrix4().copy(v.actor.matrixWorld).invert(),
        );
      effectCamera.quaternion
        .copy(v.actor.quaternion)
        .invert()
        .multiply(camera.quaternion);
      v.effects.sample(
        dance ? t % 3.2 : t,
        localMouth,
        localForward,
        new THREE.Vector3(),
        effectCamera,
        reduced.matches,
      );
    }
    const labelPoint = surfaceFrame(
      f.x,
      f.z,
      (f.mode === "nap" ? 1 : v.labelHeight) + v.lift + (ride?.height ?? 0),
    ).position;
    projected.copy(labelPoint).project(camera);
    const width = host.clientWidth,
      height = host.clientHeight;
    v.label.style.transform = `translate(-50%,-50%) translate(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px)`;
    v.label.hidden =
      projected.z > 1 || projected.z < -1 || planetOccludes(labelPoint);
    v.label.classList.toggle("selected", selected === f.id);
    v.label.title =
      f.mode === "nap"
        ? t < 1.5
          ? "Settling down"
          : t < 14
            ? "Sleeping peacefully"
            : "Waking up"
        : f.outing
          ? f.mode === "attraction"
            ? attractions[f.outing.kind].doing
            : `Going to ${attractions[f.outing.kind].place}`
          : activityText[f.mode];
    v.label.dataset.activity = f.mode;
  }
  const effectCamera = new THREE.PerspectiveCamera();
  const raycaster = new THREE.Raycaster();
  function planetOccludes(point: THREE.Vector3) {
    const direction = point.clone().sub(camera.position),
      distance = direction.length();
    const ray = new THREE.Raycaster(
      camera.position,
      direction.normalize(),
      0,
      distance - 0.08,
    );
    return ray.intersectObject(planet.globe).length > 0;
  }
  type Carried = {
    id: string;
    x: number;
    z: number;
    target?: Cell;
    keyboard: boolean;
  };
  let carried: Carried | undefined;
  let pointer:
    | {
        id: number;
        x: number;
        y: number;
        creature?: string;
        drag: boolean;
        touch: boolean;
      }
    | undefined;
  const landingMarker = mesh(
    new THREE.TorusGeometry(0.62, 0.045, 8, 40),
    "#79dfb4",
    0,
    0,
    0,
  );
  const landingFrame = new THREE.Group();
  scene.add(landingFrame);
  landingFrame.add(landingMarker);
  landingMarker.rotation.x = Math.PI / 2;
  landingFrame.visible = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "Creature planet. Drag a friend to move it. In Move friend mode use arrow keys, Enter to place, Escape to cancel.",
  );
  renderer.domElement.style.touchAction = "none";
  function setRay(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
  }
  function hitCreature(event: PointerEvent) {
    setRay(event);
    for (const v of visuals.values())
      v.root?.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) {
          o.computeBoundingSphere();
          o.computeBoundingBox();
        }
      });
    const hit = raycaster.intersectObjects(
      [
        planet.ground,
        ...[...visuals.values()].flatMap((v) => (v.root ? [v.root] : [])),
      ],
      true,
    )[0];
    if (hit)
      for (const [id, v] of visuals) {
        let object: THREE.Object3D | null = hit.object;
        while (object) {
          if (object === v.root) return id;
          object = object.parent;
        }
      }
  }
  function preview(x: number, z: number) {
    if (!carried) return;
    carried.target = simulation.landing(carried.id, x, z, planet.canLand);
    carried.x = carried.target ? carried.target[0] * spacing : x;
    carried.z = carried.target ? carried.target[1] * spacing : z;
    landingMarker.material.color.set(carried.target ? "#64d7a0" : "#ef9eab");
    placeOnSurface(landingFrame, carried.x, carried.z, 0.09);
    landingFrame.visible = true;
  }
  function lift(id: string, keyboard = false) {
    if (paused || carried || !simulation.hold(id)) return false;
    const f = simulation.friends.find((f) => f.id === id)!;
    const v = visuals.get(id);
    if (v)
      v.lift = Math.max(
        v.lift,
        v.actor.position.distanceTo(surfaceFrame(f.x, f.z).position) - 0.055,
      );
    carried = { id, x: f.x, z: f.z, keyboard };
    following = false;
    if (!keyboard) transition = undefined;
    callbacks.view?.(false);
    controls.enabled = false;
    callbacks.select(id);
    callbacks.placement?.(true);
    callbacks.update(simulation.friends);
    preview(f.x, f.z);
    renderer.domElement.style.cursor = "grabbing";
    renderer.domElement.focus({ preventScroll: true });
    return true;
  }
  function finish(place: boolean) {
    if (carried) {
      const placed = simulation.drop(
        carried.id,
        place ? carried.target : undefined,
        planet.canLand,
      );
      if (placed) callbacks.sound("land");
      callbacks.moved?.(carried.id, placed);
    }
    carried = undefined;
    callbacks.update(simulation.friends);
    landingFrame.visible = false;
    callbacks.placement?.(false);
    controls.enabled = true;
    renderer.domElement.style.cursor = "grab";
    const old = pointer;
    pointer = undefined;
    if (old && renderer.domElement.hasPointerCapture(old.id))
      renderer.domElement.releasePointerCapture(old.id);
  }
  function cancel() {
    finish(false);
  }
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (carried?.keyboard) {
      event.stopImmediatePropagation();
      event.preventDefault();
      setRay(event);
      const hit = raycaster.intersectObject(planet.globe)[0];
      if (hit) {
        const n = hit.point.clone().sub(planetCenter).normalize();
        preview(
          Math.atan2(n.x, n.y) * planetRadius,
          Math.asin(THREE.MathUtils.clamp(n.z, -1, 1)) * planetRadius,
        );
        if (carried.target) finish(true);
      }
      return;
    }
    if (pointer) {
      cancel();
      return;
    }
    const creature = hitCreature(event);
    if (!creature) {
      if (transition) callbacks.view?.(following);
      transition = undefined;
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
    controls.enabled = false;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      creature,
      drag: false,
      touch: event.pointerType === "touch",
    };
    renderer.domElement.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    event.stopImmediatePropagation();
    if (
      !pointer.drag &&
      Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >
        (pointer.touch ? 14 : 6)
    ) {
      pointer.drag = lift(pointer.creature!);
    }
    if (!carried) return;
    setRay(event);
    const hit = raycaster.intersectObject(planet.globe)[0];
    if (!hit) {
      carried.target = undefined;
      landingMarker.material.color.set("#ef9eab");
      return;
    }
    const n = hit.point.clone().sub(planetCenter).normalize();
    preview(
      Math.atan2(n.x, n.y) * planetRadius,
      Math.asin(THREE.MathUtils.clamp(n.z, -1, 1)) * planetRadius,
    );
  };
  const pick = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    event.stopImmediatePropagation();
    if (pointer.drag) finish(true);
    else {
      const id = pointer.creature;
      finish(false);
      if (id) callbacks.select(id);
    }
  };
  const key = (event: KeyboardEvent) => {
    if (!carried) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (!carried.keyboard) return;
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const f = surfaceFrame(carried.x, carried.z);
    const axis = new THREE.Vector3(
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0,
      event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0,
      0,
    ).applyQuaternion(camera.quaternion);
    axis.addScaledVector(f.normal, -axis.dot(f.normal)).normalize();
    const n = f.position
      .clone()
      .sub(planetCenter)
      .addScaledVector(axis, spacing * 1.3)
      .normalize();
    preview(Math.atan2(n.x, n.y) * planetRadius, Math.asin(n.z) * planetRadius);
  };
  const hidden = () => {
    if (document.hidden) cancel();
  };
  renderer.domElement.addEventListener("pointerdown", down, true);
  renderer.domElement.addEventListener("pointermove", move, true);
  renderer.domElement.addEventListener("pointerup", pick, true);
  renderer.domElement.addEventListener("pointercancel", cancel);
  renderer.domElement.addEventListener("lostpointercapture", cancel);
  document.addEventListener("keydown", key);
  document.addEventListener("visibilitychange", hidden);
  let transition:
    | {
        time: number;
        from: THREE.Vector3;
        to: THREE.Vector3;
        targetFrom: THREE.Vector3;
        targetTo: THREE.Vector3;
        upFrom: THREE.Vector3;
        upTo: THREE.Vector3;
        follow: boolean;
      }
    | undefined;
  function preset(kind: "whole" | "playground" | "friend", wide = false) {
    if (carried) cancel();
    const f = simulation.friends.find((f) => f.id === selected);
    const local = kind !== "whole" && f;
    const frame = surfaceFrame(local ? f.x : 0, local ? f.z : 0, 0.6);
    const targetTo = local ? frame.position : planetCenter.clone();
    const to = local
      ? frame.position
          .clone()
          .add(
            new THREE.Vector3(
              kind === "friend" && !wide ? 0 : 3,
              kind === "friend" && !wide ? 3.5 : 5,
              kind === "friend" && !wide ? 5.5 : 9,
            ).applyQuaternion(frame.rotation),
          )
      : homePosition.clone();
    following = false;
    controls.minDistance = local ? 4 : 11;
    callbacks.view?.(kind === "friend" && !!f);
    transition = {
      time: 0,
      from: camera.position.clone(),
      to,
      targetFrom: controls.target.clone(),
      targetTo,
      upFrom: camera.up.clone(),
      upTo: local ? frame.normal : homeUp.clone(),
      follow: kind === "friend" && !!f,
    };
  }
  function frame(now: number) {
    if (disposed) return;
    const raw = now - last,
      delta =
        document.hidden || paused ? 0 : Math.min(Math.max(0, raw / 1000), 0.05);
    last = now;
    if (delta > 0) {
      simulation.step(delta, reduced.matches);
      const before = skyTime;
      skyTime += delta;
      if (Math.floor(before / 12) !== Math.floor(skyTime / 12))
        callbacks.sound(
          weather !== "sunny"
            ? weather
            : planetId === "snow"
              ? "snow"
              : planetId,
        );
      uiElapsed += delta;
      frames++;
      frameMs += raw;
    }
    planet.update(delta, reduced.matches, camera);
    for (const f of simulation.friends) drawFriend(f, delta);
    for (const [id, ball] of balls)
      if (!simulation.sessions.some((s) => s.id === id)) {
        disposeResources([ball]);
        ball.removeFromParent();
        balls.delete(id);
      }
    for (const session of simulation.sessions.filter(
      (s) => s.kind === "ball" || s.kind === "snowball",
    )) {
      let ball = balls.get(session.id);
      if (!ball) {
        ball = sphere(
          session.kind === "snowball" ? "#ffffff" : "#bd9beb",
          0,
          0,
          0,
          session.kind === "snowball" ? 0.13 : 0.19,
        );
        const stripe = mesh(
          new THREE.TorusGeometry(0.19, 0.02, 6, 20),
          "#fff1ad",
          0,
          0,
          0,
          ball,
        );
        stripe.rotation.x = Math.PI / 2;
        stripe.visible = session.kind !== "snowball";
        balls.set(session.id, ball);
      }
      ball.visible = session.started;
      const ids = session.participants,
        turn = Math.floor(Math.min(session.time, 5.99) / 2),
        phase = Math.min(session.time, 5.99) % 2;
      const a = simulation.friends.find((f) => f.id === ids[turn % ids.length]),
        b = simulation.friends.find(
          (f) => f.id === ids[(turn + 1) % ids.length],
        );
      if (a && b) {
        const flight = Math.max(0, Math.min(1, (phase - 0.45) / 1.3));
        const va = visuals.get(a.id)!,
          vb = visuals.get(b.id)!;
        const contact = (f: Friend, v: Visual) => ({
          x:
            f.x +
            Math.cos(f.yaw) * (0.52 + v.ballOffset[0]) * v.sizeRatio +
            Math.sin(f.yaw) * (0.7 + v.ballOffset[1]) * v.sizeRatio,
          z:
            f.z -
            Math.sin(f.yaw) * (0.52 + v.ballOffset[0]) * v.sizeRatio +
            Math.cos(f.yaw) * (0.7 + v.ballOffset[1]) * v.sizeRatio,
        });
        const from = contact(a, va),
          to = contact(b, vb);
        if (a === b) to.z += Math.sin(phase * Math.PI) * 0.7;
        placeOnSurface(
          ball,
          from.x + (to.x - from.x) * flight,
          from.z + (to.z - from.z) * flight,
          (session.kind === "snowball" ? 0.8 : 0.2) +
            (reduced.matches
              ? 0
              : Math.sin(flight * Math.PI) *
                (session.kind === "snowball" ? 1.4 : 0.22)),
        );
        ball.rotateX(-session.time * 3);
      }
    }
    if (transition) {
      transition.time += reduced.matches ? 1 : Math.min(raw / 1000, 0.05);
      const t = Math.min(1, transition.time / 0.6),
        ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transition.from, transition.to, ease);
      controls.target.lerpVectors(
        transition.targetFrom,
        transition.targetTo,
        ease,
      );
      camera.up
        .lerpVectors(transition.upFrom, transition.upTo, ease)
        .normalize();
      if (t === 1) {
        following = transition.follow;
        followNormal.copy(transition.upTo);
        transition = undefined;
      }
    }
    if (following) {
      const f = simulation.friends.find((f) => f.id === selected);
      if (f) {
        const frame = surfaceFrame(f.x, f.z, 0.6);
        const transport = new THREE.Quaternion().setFromUnitVectors(
          followNormal,
          frame.normal,
        );
        const offset = camera.position
          .clone()
          .sub(controls.target)
          .applyQuaternion(transport);
        controls.target.copy(frame.position);
        camera.position.copy(frame.position).add(offset);
        camera.up.applyQuaternion(transport);
        followNormal.copy(frame.normal);
      }
    }
    // Never let zoom/orbit carry the camera inside the planet.
    const outward = camera.position.clone().sub(planetCenter);
    if (outward.length() < planetRadius + 2)
      camera.position
        .copy(planetCenter)
        .add(outward.setLength(planetRadius + 2));
    controls.update();
    const safeOutward = camera.position.clone().sub(planetCenter);
    const safeRadius =
      planetRadius +
      Math.max(
        1,
        terrainHeight(safeOutward.clone().normalize(), planetId) + 0.8,
      );
    if (safeOutward.length() < safeRadius) {
      camera.position.copy(planetCenter).add(safeOutward.setLength(safeRadius));
      camera.lookAt(controls.target);
    }
    renderer.render(scene, camera);
    if (uiElapsed >= 0.5) {
      callbacks.update(simulation.friends);
      uiElapsed = 0;
      host.dataset.frameMs = (frameMs / Math.max(1, frames)).toFixed(1);
      host.dataset.drawCalls = String(renderer.info.render.calls);
      host.dataset.triangles = String(renderer.info.render.triangles);
      host.dataset.geometries = String(renderer.info.memory.geometries);
      host.dataset.textures = String(renderer.info.memory.textures);
      frames = 0;
      frameMs = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (width > 0 && height > 0) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(20)) / Math.min(1, camera.aspect),
          ),
      );
      if (innerWidth > 850)
        camera.setViewOffset(width, height, 144, 0, width, height);
      else camera.clearViewOffset();
      controls.handleResize();
      camera.updateProjectionMatrix();
    }
  });
  resize.observe(host);
  function lost(e: Event) {
    e.preventDefault();
    paused = true;
    cancelAnimationFrame(raf);
    callbacks.error();
  }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  raf = requestAnimationFrame(frame);
  return {
    add,
    remove,
    preset,
    moveFriend() {
      preset("playground");
      return lift(selected, true);
    },
    placeFriend() {
      finish(true);
    },
    cancelMove: cancel,
    planet(id: PlanetId) {
      cancel();
      transition = undefined;
      for (const id of [...visuals.keys()]) remove(id);
      for (const ball of balls.values()) {
        disposeResources([ball]);
        ball.removeFromParent();
      }
      balls.clear();
      disposeResources(planet.roots);
      for (const root of planet.roots) root.removeFromParent();
      planetId = id;
      simulation.planet = id;
      planet = createPlanet(scene, id);
      weather = id === "snow" ? "snow" : "sunny";
      planet.weather(weather);
      sun.intensity = id === "snow" ? 1.6 : 2.2;
      sun.color.set(id === "snow" ? 0xddeaff : 0xfff0d8);
      overview();
    },
    weather(value: Weather) {
      weather = value;
      planet.weather(value);
      sun.intensity = value === "rain" ? 1.1 : value === "snow" ? 1.6 : 2.2;
      sun.color.set(value === "sunny" ? 0xfff0d8 : 0xddeaff);
    },
    select(id: string) {
      selected = id;
    },
    attraction(id: string, kind: Attraction) {
      const message = simulation.attraction(id, kind);
      if (!message) {
        callbacks.update(simulation.friends);
        preset("friend", true);
      }
      return message;
    },
    command(id: string, action: Command) {
      return simulation.command(id, action);
    },
    pause(value: boolean) {
      paused = value;
      if (value) cancel();
    },
    follow(value: boolean) {
      preset(value ? "friend" : "whole");
    },
    camera(action: "left" | "right" | "up" | "down" | "in" | "out" | "reset") {
      if (transition) callbacks.view?.(following);
      transition = undefined;
      if (action === "reset") {
        preset("whole");
        return;
      }
      const offset = camera.position.clone().sub(controls.target);
      if (["left", "right", "up", "down"].includes(action)) {
        const vertical = action === "up" || action === "down";
        const axis = vertical
          ? new THREE.Vector3().crossVectors(camera.up, offset).normalize()
          : camera.up.clone().normalize();
        const rotation = new THREE.Quaternion().setFromAxisAngle(
          axis,
          action === "left" || action === "up" ? -0.4 : 0.4,
        );
        offset.applyQuaternion(rotation);
        camera.up.applyQuaternion(rotation);
      } else
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
      cancel();
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      resize.disconnect();
      controls.dispose();
      document.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hidden);
      renderer.domElement.removeEventListener("lostpointercapture", cancel);
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("pointermove", move, true);
      renderer.domElement.removeEventListener("pointerup", pick, true);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      for (const v of visuals.values()) v.animation?.dispose();
      disposeResources([scene, ...sources]);
      renderer.dispose();
      renderer.domElement.remove();
      labels.remove();
    },
  };
}
