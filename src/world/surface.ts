import * as THREE from "three";

export const planetRadius = 8;
export const planetCenter = new THREE.Vector3(0, -8, 0);
export const circumference = Math.PI * 2 * planetRadius;
// Longitude/latitude arc coordinates. The home neighbourhood is centred at +Y.
export function surfaceFrame(x: number, z: number, height = 0) {
  const longitude = x / planetRadius,
    latitude = z / planetRadius;
  const normal = new THREE.Vector3(
    Math.sin(longitude) * Math.cos(latitude),
    Math.cos(longitude) * Math.cos(latitude),
    Math.sin(latitude),
  );
  const east = new THREE.Vector3(Math.cos(longitude), -Math.sin(longitude), 0);
  const north = new THREE.Vector3(
    -Math.sin(longitude) * Math.sin(latitude),
    -Math.cos(longitude) * Math.sin(latitude),
    Math.cos(latitude),
  );
  return {
    position: normal
      .clone()
      .multiplyScalar(planetRadius + height)
      .add(planetCenter),
    normal,
    rotation: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(east, normal, north),
    ),
  };
}
export function surfaceDistance(
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  return (
    planetRadius *
    Math.acos(
      THREE.MathUtils.clamp(
        surfaceFrame(ax, az).normal.dot(surfaceFrame(bx, bz).normal),
        -1,
        1,
      ),
    )
  );
}
export function surfaceHeading(ax: number, az: number, bx: number, bz: number) {
  const frame = surfaceFrame(ax, az);
  const direction = surfaceFrame(bx, bz).normal.addScaledVector(
    frame.normal,
    -surfaceFrame(bx, bz).normal.dot(frame.normal),
  );
  direction.applyQuaternion(frame.rotation.clone().invert());
  return Math.atan2(direction.x, direction.z);
}
export function surfaceTravel(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  amount: number,
): [number, number] {
  const a = surfaceFrame(ax, az).normal,
    b = surfaceFrame(bx, bz).normal;
  const angle = a.angleTo(b);
  if (angle < 1e-9) return [bx, bz];
  const t = Math.min(1, amount / (angle * planetRadius));
  if (t === 1) return [bx, bz];
  const normal = a
    .multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
    .addScaledVector(b, Math.sin(t * angle) / Math.sin(angle));
  return [
    Math.atan2(normal.x, normal.y) * planetRadius,
    Math.asin(THREE.MathUtils.clamp(normal.z, -1, 1)) * planetRadius,
  ];
}
export function placeOnSurface(
  object: THREE.Object3D,
  x: number,
  z: number,
  height = 0,
  yaw = 0,
) {
  const frame = surfaceFrame(x, z, height);
  object.position.copy(frame.position);
  object.quaternion
    .copy(frame.rotation)
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    );
}
