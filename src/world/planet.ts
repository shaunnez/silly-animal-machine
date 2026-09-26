import { createAttractionScenery } from "./attraction-scenery";
import { planets, type PlanetId } from "./planets";
import { createTerrain, terrainHeight } from "./terrain";
import { surfaceDistance } from "./surface";
import { grassTexture } from "./grass-texture";
import * as THREE from "three";
import { planetRadius, planetCenter } from "./surface";
import { seats, spacing } from "./meadow-simulation";

export type Weather = "sunny" | "rain" | "snow";
export function createPlanet(scene: THREE.Scene, id: PlanetId = "meadow") {
  const theme = planets[id];
  const terrain = createTerrain(id);
  const surfaceFrame = terrain.frame,
    placeOnSurface = terrain.place;
  const obstacles: [number, number, number][] = [
    [-1.5, 4.6, 1.3],
    [5.5, -0.1, 1],
    [5.5, 4, 1],
  ];
  const before = new Set(scene.children);
  const grass = grassTexture();
  const ground = new THREE.Group();
  scene.add(ground);
  function mesh(
    geometry: THREE.BufferGeometry,
    color: string,
    parent: THREE.Object3D = ground,
  ) {
    const m = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const globe = mesh(terrain.geometry(), theme.ground);
  if (id === "water") {
    const positions = globe.geometry.getAttribute("position"),
      colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const n = new THREE.Vector3()
        .fromBufferAttribute(positions, i)
        .normalize();
      const color = new THREE.Color(theme.ground).lerp(
        new THREE.Color("#eedda8"),
        THREE.MathUtils.smoothstep(terrainHeight(n, id), 0.005, 0.055),
      );
      colors.set(color.toArray(), i * 3);
    }
    globe.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    globe.material.vertexColors = true;
    globe.material.color.set("#ffffff");
  }
  globe.position.copy(planetCenter);
  globe.material.map = grass;
  globe.material.bumpMap = grass;
  globe.material.bumpScale = id === "water" ? 0.025 : 0.008;
  globe.material.roughness = id === "water" ? 0.26 : 0.9;
  function patch(
    x: number,
    z: number,
    width: number,
    depth: number,
    color: string,
  ) {
    const geometry = new THREE.PlaneGeometry(width, depth, 12, 12);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const p = surfaceFrame(
        x + position.getX(i),
        z + position.getY(i),
        0.026,
      ).position;
      position.setXYZ(i, p.x, p.y, p.z);
    }
    geometry.setIndex(Array.from(geometry.index!.array).reverse());
    geometry.computeVertexNormals();
    const result = mesh(geometry, color);
    result.material.map = grass;
    result.castShadow = false;
    return result;
  }
  // Readable sandy paths join the four destinations.
  patch(0, 1, 8.4, 0.48, theme.path);
  patch(0, -0.7, 0.48, 7.4, theme.path);
  patch(-4, 0, 3.1, 4.2, theme.patches[0]);
  patch(3.2, 1.2, 4.8, 6, theme.patches[1]);
  patch(0, -4, 4.9, 2.9, theme.patches[2]);
  patch(-1.4, 4, 3.8, 2.4, theme.patches[3]);
  function anchored(x: number, z: number, height = 0) {
    const g = new THREE.Group();
    placeOnSurface(g, x, z, height);
    ground.add(g);
    return g;
  }
  for (const [i, c] of seats.feed.entries()) {
    const blanket = anchored(c[0] * spacing, c[1] * spacing, 0.045);
    for (let j = 0; j < 4; j++) {
      const tile = mesh(
        new THREE.BoxGeometry(0.48, 0.025, 0.48),
        (j + i) % 2 ? "#fff7df" : "#e9a2b3",
        blanket,
      );
      tile.position.set(
        ((j % 2) - 0.5) * 0.48,
        0,
        (Math.floor(j / 2) - 0.5) * 0.48,
      );
    }
  }
  for (const c of seats.nap) {
    const bed = anchored(c[0] * spacing, c[1] * spacing, 0.04);
    const cushion = mesh(new THREE.SphereGeometry(0.66, 16, 8), "#e7daf3", bed);
    cushion.scale.set(1, 0.13, 0.75);
    const pillow = mesh(new THREE.SphereGeometry(0.24, 12, 8), "#fff4d2", bed);
    pillow.scale.y = 0.42;
    pillow.position.set(-0.4, 0.12, 0);
  }
  const stage = anchored(-1.5, 4.6, 0.04);
  mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.12, 24), "#d9adcc", stage);
  for (let i = 0; i < 3; i++) {
    const drum = mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 0.32, 12),
      ["#af91d5", "#efaab4", "#eec669"][i],
      stage,
    );
    drum.position.set((i - 1) * 0.48, 0.22, 0.35);
  }
  // Goal arches distinguish the open ball garden; all scenery stays outside routes.
  for (const z of [-0.1, 4]) {
    const goal = anchored(5.5, z);
    for (const x of [-0.5, 0.5]) {
      const post = mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.75, 8),
        "#fff6d9",
        goal,
      );
      post.position.set(x, 0.38, 0);
    }
    const cross = mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 1.1, 8),
      "#fff6d9",
      goal,
    );
    cross.rotation.z = Math.PI / 2;
    cross.position.y = 0.76;
  }
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2,
      x = (Math.round((Math.cos(angle) * 6.9) / spacing - 0.5) + 0.5) * spacing,
      z = (Math.round((Math.sin(angle) * 6.9) / spacing - 0.5) + 0.5) * spacing;
    const tree = anchored(x, z);
    obstacles.push([x, z, 1]);
    if (id === "candy") {
      const stick = mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 1.35, 8),
        "#fff7e9",
        tree,
      );
      stick.position.y = 0.65;
      const sweet = mesh(
        new THREE.SphereGeometry(0.5, 16, 12),
        ["#ed74b5", "#ad88dc", "#72d4bf"][i % 3],
        tree,
      );
      sweet.position.y = 1.45;
      sweet.scale.z = 0.35;
      const swirl = mesh(
        new THREE.TorusGeometry(0.3, 0.07, 8, 20),
        "#fff5cf",
        tree,
      );
      swirl.position.set(0, 1.45, 0.16);
    } else if (id === "water") {
      const island = mesh(
        new THREE.SphereGeometry(0.7, 16, 8),
        "#eedda8",
        tree,
      );
      island.scale.set(1.5, 0.12, 1);
      for (let j = 0; j < 3; j++) {
        const coral = mesh(
          new THREE.CapsuleGeometry(0.09, 0.4 + j * 0.12, 4, 8),
          ["#ed9eb4", "#baace5", "#f6c37d"][j],
          tree,
        );
        coral.position.set((j - 1) * 0.2, 0.3, 0);
        coral.rotation.z = (j - 1) * 0.45;
      }
      const pearl = mesh(
        new THREE.SphereGeometry(0.18, 12, 8),
        "#fff5e7",
        tree,
      );
      pearl.position.set(0.35, 0.18, 0.3);
    } else if (id === "snow") {
      if (i % 2) {
        for (let j = 0; j < 2; j++) {
          const snowball = mesh(
            new THREE.SphereGeometry(j ? 0.25 : 0.36, 12, 8),
            "#fffaff",
            tree,
          );
          snowball.position.y = j ? 0.82 : 0.3;
        }
        const nose = mesh(
          new THREE.ConeGeometry(0.06, 0.23, 8),
          "#eea360",
          tree,
        );
        nose.position.set(0, 0.82, 0.29);
        nose.rotation.x = Math.PI / 2;
      } else {
        const trunk = mesh(
          new THREE.CylinderGeometry(0.06, 0.13, 0.9, 8),
          "#987054",
          tree,
        );
        trunk.position.y = 0.42;
        for (let j = 0; j < 3; j++) {
          const peak = mesh(
            new THREE.ConeGeometry(0.65 - j * 0.14, 0.75, 8),
            j % 2 ? "#548d83" : "#d8eceb",
            tree,
          );
          peak.position.y = 0.45 + j * 0.43;
        }
      }
    } else if (i % 2 === 0) {
      const trunk = mesh(
        new THREE.CylinderGeometry(0.08, 0.2, 1.25, 9),
        "#987054",
        tree,
      );
      trunk.position.y = 0.6;
      trunk.material.bumpMap = grass;
      trunk.material.bumpScale = 0.035;
      for (let j = 0; j < 5; j++) {
        const angle = j * 2.4 + i;
        const tip = new THREE.Vector3(
          Math.cos(angle) * 0.48,
          1.25 + (j % 3) * 0.19,
          Math.sin(angle) * 0.48,
        );
        const start = new THREE.Vector3(0, 0.62 + j * 0.09, 0);
        const branch = mesh(
          new THREE.CylinderGeometry(0.025, 0.07, tip.distanceTo(start), 7),
          "#987054",
          tree,
        );
        branch.position.copy(start).add(tip).multiplyScalar(0.5);
        branch.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          tip.clone().sub(start).normalize(),
        );
        const crown = mesh(
          new THREE.IcosahedronGeometry(0.48 + (j % 2) * 0.12, 2),
          ["#80b16b", "#96c57b", "#649b70"][j % 3],
          tree,
        );
        crown.position.copy(tip).add(new THREE.Vector3(0, 0.25, 0));
        crown.scale.set(1, 0.85 + (i % 3) * 0.1, 0.85);
        crown.material.map = grass;
        crown.material.bumpMap = grass;
        crown.material.bumpScale = 0.025;
      }
      if (x < 0) {
        const apple = mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          "#ed9093",
          tree,
        );
        apple.position.set(0.32, 1.12, 0.49);
      }
    } else {
      const bush = mesh(new THREE.SphereGeometry(0.42, 12, 8), "#8bbd88", tree);
      bush.position.y = 0.25;
      const flower = mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        i % 3 ? "#f8c6dc" : "#fff0a3",
        tree,
      );
      flower.position.set(0.1, 0.6, 0.12);
    }
  }
  // Low gardens make the far hemisphere inviting without blocking walking lanes.
  for (let row = -6; row <= 6; row += 3) {
    for (let column = -14; column <= 14; column += 4) {
      if (Math.abs(column) < 5 && Math.abs(row) < 5) continue;
      if (column >= 6 && column <= 10 && row === 0) continue;
      const x = (column + 0.5) * spacing,
        z = (row + 0.4) * spacing;
      patch(x, z, 2.2, 1.4, theme.patches[Math.abs(column + row) % 4]);
      const garden = anchored(x, z, 0.04);
      for (let i = 0; i < 3; i++) {
        const bloom = mesh(
          id === "snow"
            ? new THREE.ConeGeometry(0.16, 0.38, 5)
            : id === "candy"
              ? new THREE.CapsuleGeometry(0.06, 0.18, 4, 6)
              : new THREE.SphereGeometry(0.14, 8, 6),
          ["#f8c7dc", "#fff0ae", "#c5b8e8"][i],
          garden,
        );
        bloom.position.set((i - 1) * 0.32, 0.12, 0.2);
        bloom.scale.y = 0.5;
      }
    }
  }
  const playground = createAttractionScenery(ground, id, terrain);
  const sky = new THREE.Group();
  scene.add(sky);
  const clouds: THREE.Group[] = [];
  for (let j = 0; j < 4; j++) {
    const cloud = new THREE.Group();
    sky.add(cloud);
    clouds.push(cloud);
    for (let i = 0; i < 3; i++) {
      const p = mesh(new THREE.SphereGeometry(0.65, 12, 8), "#fffaf4", cloud);
      p.position.set((i - 1) * 0.7, (i % 2) * 0.22, 0);
      p.scale.z = 0.65;
      p.castShadow = false;
    }
  }
  const sun = mesh(new THREE.SphereGeometry(0.8, 20, 12), "#ffde83", sky);
  (sun.material as THREE.MeshStandardMaterial).emissive.set("#ffcc66");
  (sun.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
  const eyeGeo = new THREE.SphereGeometry(0.065, 8, 6);
  for (const x of [-0.23, 0.23]) {
    const eye = mesh(eyeGeo, "#997255", sun);
    eye.position.set(x, 0.09, 0.76);
  }
  const geometry = new THREE.BufferGeometry(),
    positions = new Float32Array(420 * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#ffffff",
    size: 0.07,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const particles = new THREE.Points(geometry, material);
  scene.add(particles);
  particles.frustumCulled = false;
  const rainGeometry = new THREE.BufferGeometry(),
    rainPositions = new Float32Array(420 * 6);
  rainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3),
  );
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({
      color: "#d4e8ff",
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const originalColours = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  ground.traverse((o) => {
    if (
      o instanceof THREE.Mesh &&
      o.material instanceof THREE.MeshStandardMaterial
    )
      originalColours.set(o.material, o.material.color.clone());
  });
  let weather: Weather = "sunny",
    time = 0;
  return {
    ground,
    globe,
    terrain,
    canLand(x: number, z: number) {
      return (
        playground.safe(x, z) &&
        obstacles.every(
          ([ox, oz, radius]) => surfaceDistance(x, z, ox, oz) > radius,
        )
      );
    },
    roots: scene.children.filter((child) => !before.has(child)),
    weather(value: Weather) {
      weather = value;
      const skyColour = new THREE.Color(
        value === "rain" ? "#8296b5" : value === "snow" ? "#c4d4e8" : theme.sky,
      );
      scene.background = skyColour;
      if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(skyColour);
      for (const [material, original] of originalColours)
        material.color
          .copy(original)
          .lerp(
            new THREE.Color(value === "snow" ? "#ffffff" : "#6d8c87"),
            value === "snow"
              ? id === "snow"
                ? 0.18
                : 0.72
              : value === "rain"
                ? 0.18
                : 0,
          );
      for (const cloud of clouds)
        cloud.traverse((o) => {
          if (o instanceof THREE.Mesh)
            (o.material as THREE.MeshStandardMaterial).color.set(
              value === "rain"
                ? "#8494ae"
                : value === "snow"
                  ? "#eef2fa"
                  : "#fffaf4",
            );
        });
      sun.visible = value === "sunny";
      material.size = 0.105;
    },
    update(delta: number, reduced: boolean, camera: THREE.Camera) {
      if (!reduced) time += delta;
      for (let i = 0; i < clouds.length; i++) {
        const a = i * Math.PI * 0.5 + time * 0.016;
        clouds[i].position.set(
          Math.cos(a) * 8,
          4 + (i % 2),
          Math.sin(a) * 8 - 3,
        );
      }
      for (const cloud of clouds)
        cloud.visible = cloud.position.distanceTo(camera.position) > 9;
      sun.position.set(-9 + Math.sin(time * 0.05) * 0.6, 1.5, -3);
      particles.visible = weather === "snow" && !reduced;
      rain.visible = weather === "rain" && !reduced;
      if (particles.visible || rain.visible)
        for (let i = 0; i < 420; i++) {
          const x = (((i * 2.399963) % (Math.PI * 2)) - Math.PI) * planetRadius,
            z = Math.asin(1 - (2 * (i + 0.5)) / 420) * planetRadius;
          const h =
            5 - ((time * (weather === "rain" ? 3 : 0.65) + i * 0.117) % 5);
          const p = surfaceFrame(
            x + (weather === "snow" ? Math.sin(time + i) * 0.25 : 0),
            z,
            h,
          ).position;
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
          const end = surfaceFrame(x, z, Math.max(0, h - 0.28)).position;
          rainPositions.set([p.x, p.y, p.z, end.x, end.y, end.z], i * 6);
        }
      geometry.getAttribute("position").needsUpdate = true;
      rainGeometry.getAttribute("position").needsUpdate = true;
    },
  };
}
