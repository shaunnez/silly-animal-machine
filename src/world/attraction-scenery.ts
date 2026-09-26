import * as THREE from "three";
import { createTerrain } from "./terrain";
import { rideSeats, snowballSeats } from "./attractions";
import { spacing } from "./world-routes";
import type { PlanetId } from "./planets";

export function createAttractionScenery(
  parent: THREE.Object3D,
  id: PlanetId,
  terrain: ReturnType<typeof createTerrain>,
) {
  const root = new THREE.Group();
  parent.add(root);
  const mesh = (
    geometry: THREE.BufferGeometry,
    color: string,
    target: THREE.Object3D = root,
  ) => {
    const m = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    m.castShadow = m.receiveShadow = true;
    target.add(m);
    return m;
  };
  function ribbon(
    x: number,
    width: number,
    height: (u: number) => number,
    color: string,
  ) {
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 32; i++)
      for (const side of [-1, 1]) {
        const p = terrain.frame(
          x + (side * width) / 2,
          (-1 + (2 * i) / 32) * spacing,
          height(i / 32),
        ).position;
        vertices.push(p.x, p.y, p.z);
      }
    for (let i = 0; i < 32; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return mesh(g, color);
  }
  for (const [i, seat] of rideSeats.entries()) {
    const x = seat[0] * spacing,
      z = seat[1] * spacing;
    const station = new THREE.Group();
    terrain.place(station, x, z, 0.03);
    root.add(station);
    const color = ["#ed86bb", "#a995e8", "#75d1c6"][i];
    if (id === "meadow") {
      ribbon(x, 1.1, (u) => 0.04 + 1.6 * (1 - u) ** 2, color);
      for (const side of [-1, 1]) {
        const points = Array.from(
          { length: 33 },
          (_, j) =>
            terrain.frame(
              x + side * 0.53,
              (-1 + (2 * j) / 32) * spacing,
              0.19 + 1.6 * (1 - j / 32) ** 2,
            ).position,
        );
        mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            32,
            0.065,
            6,
            false,
          ),
          "#fff0af",
        );
        const post = mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 1.65, 8),
          "#e0ae79",
          station,
        );
        post.position.set(side * 0.45, 0.8, 0);
      }
      for (let j = 0; j < 6; j++) {
        const rung = mesh(
          new THREE.BoxGeometry(0.9, 0.08, 0.22),
          "#fff1c5",
          station,
        );
        rung.position.set(0, j * 0.28, -0.16);
      }
    } else if (id === "snow") {
      ribbon(x, 1.15, () => 0.035, "#f6fbff");
      for (const end of [-1, 1])
        for (const side of [-1, 1]) {
          const flag = new THREE.Group();
          terrain.place(flag, x + side * 0.63, end * spacing, 0.03);
          root.add(flag);
          const pole = mesh(
            new THREE.CylinderGeometry(0.025, 0.035, 0.85, 6),
            "#887ba1",
            flag,
          );
          pole.position.y = 0.4;
          const cloth = mesh(
            new THREE.BoxGeometry(0.35, 0.22, 0.025),
            color,
            flag,
          );
          cloth.position.set(0.14, 0.69, 0);
        }
    } else {
      const base = mesh(
        new THREE.CylinderGeometry(0.65, 0.74, 0.18, 24),
        id === "candy" ? "#fff0ce" : "#b8edf5",
        station,
      );
      base.position.y = 0.06;
      const pad = mesh(new THREE.SphereGeometry(0.62, 24, 12), color, station);
      pad.scale.y = id === "candy" ? 0.28 : 0.1;
      pad.position.y = 0.15;
      if (id === "candy") {
        for (let j = 0; j < 7; j++) {
          const sprinkle = mesh(
            new THREE.CapsuleGeometry(0.025, 0.12, 3, 6),
            ["#fff9df", "#c275cf", "#ed9cab"][j % 3],
            station,
          );
          sprinkle.position.set(
            Math.cos(j * 2.4) * 0.4,
            0.27,
            Math.sin(j * 2.4) * 0.4,
          );
          sprinkle.rotation.z = Math.PI / 2;
        }
      } else {
        for (let j = 0; j < 5; j++) {
          const jet = mesh(
            new THREE.ConeGeometry(0.06, 0.65, 8),
            "#b8f4fb",
            station,
          );
          jet.position.set(
            Math.cos(j * 1.25) * 0.46,
            0.42,
            Math.sin(j * 1.25) * 0.46,
          );
          jet.rotation.z = Math.cos(j * 1.25) * -0.28;
        }
      }
    }
  }
  if (id === "snow")
    for (const seat of snowballSeats) {
      const fort = new THREE.Group();
      terrain.place(fort, (seat[0] - 0.65) * spacing, seat[1] * spacing, 0.03);
      root.add(fort);
      for (let i = 0; i < 3; i++) {
        const snow = mesh(
          new THREE.SphereGeometry(0.22, 10, 8),
          "#ffffff",
          fort,
        );
        snow.position.set(0, i === 2 ? 0.36 : 0.13, (i - 1) * 0.22);
      }
    }
  return {
    safe(x: number, z: number) {
      return !rideSeats.some(
        (seat) =>
          Math.abs(x - seat[0] * spacing) < 0.72 &&
          z > -spacing - 0.55 &&
          z <
            (id === "meadow" || id === "snow"
              ? spacing + 0.5
              : -spacing + 0.55),
      );
    },
  };
}

export function createRideGear(parent: THREE.Object3D) {
  const ski = new THREE.Group(),
    board = new THREE.Group(),
    bubble = new THREE.Group();
  parent.add(ski, board, bubble);
  const material = (color: string) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  for (const x of [-0.23, 0.23]) {
    const runner = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 1.15, 4, 10),
      material("#ee9ebc"),
    );
    runner.rotation.x = Math.PI / 2;
    runner.position.set(x, 0.02, 0.12);
    ski.add(runner);
  }
  const deck = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.21, 0.9, 4, 12),
    material("#9b86df"),
  );
  deck.rotation.x = Math.PI / 2;
  deck.scale.z = 0.22;
  board.add(deck);
  board.rotation.y = -Math.PI / 2;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 24, 16),
    new THREE.MeshPhysicalMaterial({
      color: "#b8f0ff",
      transparent: true,
      opacity: 0.24,
      roughness: 0.12,
      metalness: 0.1,
      depthWrite: false,
    }),
  );
  orb.scale.y = 0.45;
  orb.position.y = -0.1;
  bubble.add(orb);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.57, 0.04, 6, 24),
    material("#fbdf91"),
  );
  ring.rotation.x = Math.PI / 2;
  bubble.add(ring);
  ski.visible = board.visible = bubble.visible = false;
  return { ski, board, bubble };
}
