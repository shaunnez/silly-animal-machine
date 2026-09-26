import * as THREE from "three";
import type { PowerId } from "../powers";

const colours = ["#fca7d6", "#b7a1fc", "#90dcf2", "#ffe195", "#a5e4bc"];
export function powerParticle(
  power: PowerId,
  index: number,
  seconds: number,
  still: boolean,
) {
  const age = seconds - index * 0.1;
  const angle = index * 2.4;
  const visible = age >= 0 && age < (power === "flowers" ? 3.2 : 1.65);
  const travel = still ? 0.2 : Math.max(0, age);
  return {
    visible,
    x: Math.sin(angle) * (power === "flowers" ? 1.25 : travel * 0.6),
    y: power === "flowers" ? 0.18 : travel * (power === "stars" ? 1.1 : 0.6),
    z: power === "flowers" ? Math.cos(angle) * 1.25 : travel * 1.25,
    scale: power === "flowers" ? Math.min(1, Math.max(0, age) * 3) : 1,
    opacity: power === "flowers" ? 1 : Math.max(0, 1 - age / 1.65) * 0.85,
  };
}

/** Small reusable meshes, disposed with the garden's effect group. */
export function createPowerEffects(parent: THREE.Group, power: PowerId) {
  const particles: THREE.Group[] = [];
  const materials: THREE.MeshStandardMaterial[][] = [];
  for (let i = 0; i < 18; i++) {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    function part(
      geometry: THREE.BufferGeometry,
      color: string,
      x = 0,
      y = 0,
      z = 0,
    ) {
      const material =
        power === "bubbles"
          ? new THREE.MeshPhysicalMaterial({
              color,
              metalness: 0.1,
              roughness: 0.12,
              transparent: true,
              opacity: 0.63,
              clearcoat: 1,
            })
          : new THREE.MeshStandardMaterial({
              color,
              roughness: 0.3,
              transparent: true,
              side: THREE.DoubleSide,
            });
      mats.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    }
    if (power === "flowers") {
      part(
        new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6),
        "#58aa74",
        0,
        0.08,
      );
      for (let petal = 0; petal < 5; petal++) {
        const a = (petal * Math.PI * 2) / 5;
        part(
          new THREE.SphereGeometry(0.1, 8, 6),
          colours[i % 5],
          Math.sin(a) * 0.12,
          0.27 + Math.cos(a) * 0.12,
        ).scale.z = 0.4;
      }
      part(new THREE.SphereGeometry(0.07, 8, 6), "#ffe195", 0, 0.27, 0.04);
    } else if (power === "music") {
      part(
        new THREE.SphereGeometry(0.12, 12, 8),
        colours[i % 5],
        -0.04,
        0,
      ).scale.set(1, 0.7, 0.4);
      part(
        new THREE.BoxGeometry(0.035, 0.38, 0.045),
        colours[i % 5],
        0.06,
        0.18,
      );
      part(
        new THREE.BoxGeometry(0.16, 0.06, 0.045),
        colours[i % 5],
        0.12,
        0.34,
      ).rotation.z = -0.4;
    } else if (power === "stars") {
      const shape = new THREE.Shape();
      for (let point = 0; point < 10; point++) {
        const a = (point * Math.PI) / 5;
        const r = point % 2 === 0 ? 0.2 : 0.09;
        if (point === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r);
        else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
      }
      shape.closePath();
      part(new THREE.ShapeGeometry(shape), colours[i % 5]);
    } else {
      part(
        new THREE.SphereGeometry(0.1 + (i % 3) * 0.055, 16, 12),
        colours[i % 5],
      );
    }
    group.visible = false;
    parent.add(group);
    particles.push(group);
    materials.push(mats);
  }
  return {
    hide() {
      particles.forEach((particle) => {
        particle.visible = false;
      });
    },
    portrait(camera: THREE.Camera) {
      particles.forEach((particle, index) => {
        particle.visible = index < 10;
        if (power === "flowers") {
          const angle = (index * Math.PI * 2) / 10;
          particle.position.set(
            Math.sin(angle) * 1.65,
            0.1,
            Math.cos(angle) * 0.6 + 0.6,
          );
        } else {
          const side = index % 2 === 0 ? -1 : 1;
          particle.position.set(
            side * (1.25 + (index % 3) * 0.3),
            0.6 + Math.floor(index / 2) * 0.43,
            0.6,
          );
        }
        particle.scale.setScalar(power === "flowers" ? 1.25 : 1);
        particle.quaternion.copy(camera.quaternion);
        materials[index].forEach((material) => {
          material.opacity = power === "bubbles" ? 0.68 : 1;
        });
      });
    },
    sample(
      seconds: number,
      mouth: THREE.Vector3,
      forward: THREE.Vector3,
      actor: THREE.Vector3,
      camera: THREE.Camera,
      still: boolean,
    ) {
      particles.forEach((particle, index) => {
        const state = powerParticle(power, index, seconds, still);
        particle.visible = state.visible;
        particle.position.copy(power === "flowers" ? actor : mouth);
        if (power === "flowers") particle.position.y = 0.18;
        particle.position.x += state.x;
        particle.position.y += state.y;
        if (power === "flowers") particle.position.z += state.z;
        else particle.position.addScaledVector(forward, state.z);
        particle.scale.setScalar(state.scale);
        particle.quaternion.copy(camera.quaternion);
        materials[index].forEach((material) => {
          material.opacity = state.opacity;
        });
      });
    },
  };
}
