import * as THREE from "three";
import { planetCenter, planetRadius, surfaceFrame } from "./surface";
import type { PlanetId } from "./planets";

// Direction-space waves are continuous across the longitude seam and both poles.
export function terrainHeight(n: THREE.Vector3, id: PlanetId) {
  const home = THREE.MathUtils.smoothstep(n.y, 0.55, 0.84);
  const waves =
    Math.sin(n.x * 7 + n.z * 3) * Math.cos(n.y * 6 - n.z * 4) * 0.19 +
    Math.sin(n.z * 11 + n.x * 4 + 1.2) * 0.075;
  if (id === "water") return Math.max(0, waves - 0.13) * 1.2 * (1 - home);
  const skiHill =
    id === "snow"
      ? 1.25 *
        Math.exp(
          (-((n.x - 0.981) ** 2 + n.y ** 2 + (n.z + 0.195) ** 2) *
            planetRadius ** 2) /
            6,
        )
      : 0;
  return (
    waves * (id === "snow" ? 1.15 : id === "candy" ? 0.9 : 1) * (1 - home) +
    skiHill * (1 - home)
  );
}
export function createTerrain(id: PlanetId) {
  function point(n: THREE.Vector3) {
    return n
      .clone()
      .multiplyScalar(planetRadius + terrainHeight(n, id))
      .add(planetCenter);
  }
  function frame(x: number, z: number, height = 0) {
    const base = surfaceFrame(x, z),
      n = base.normal;
    const east = new THREE.Vector3(1, 0, 0).applyQuaternion(base.rotation);
    const north = new THREE.Vector3(0, 0, 1).applyQuaternion(base.rotation);
    const tangent = (axis: THREE.Vector3) =>
      point(n.clone().addScaledVector(axis, 0.001).normalize())
        .sub(point(n.clone().addScaledVector(axis, -0.001).normalize()))
        .normalize();
    const e = tangent(east),
      northTangent = tangent(north);
    const normal = new THREE.Vector3()
      .crossVectors(northTangent, e)
      .normalize();
    const forward = new THREE.Vector3().crossVectors(e, normal).normalize();
    return {
      position: point(n).addScaledVector(normal, height),
      normal,
      rotation: new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(e, normal, forward),
      ),
    };
  }
  return {
    frame,
    point,
    place(object: THREE.Object3D, x: number, z: number, height = 0, yaw = 0) {
      const f = frame(x, z, height);
      object.position.copy(f.position);
      object.quaternion
        .copy(f.rotation)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw,
          ),
        );
    },
    geometry() {
      const geometry = new THREE.SphereGeometry(planetRadius, 128, 80);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const n = new THREE.Vector3()
          .fromBufferAttribute(positions, i)
          .normalize();
        n.multiplyScalar(planetRadius + terrainHeight(n, id));
        positions.setXYZ(i, n.x, n.y, n.z);
      }
      geometry.computeVertexNormals();
      return geometry;
    },
  };
}
