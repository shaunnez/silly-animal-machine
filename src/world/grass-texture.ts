import * as THREE from "three";

/** Seeded fine grain and grass flecks: bundled code, no image service. */
export function grassTexture() {
  const width = 512,
    height = 256,
    data = new Uint8Array(width * height * 4);
  let seed = 7183;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const shade = Math.min(
        255,
        Math.round(
          234 + random() * 16 + Math.sin(x * 0.16) * Math.sin(y * 0.13) * 4,
        ),
      );
      const i = (y * width + x) * 4;
      data[i] = shade;
      data[i + 1] = shade;
      data[i + 2] = shade;
      data[i + 3] = 255;
    }
  for (let n = 0; n < 6000; n++) {
    const x = Math.floor(random() * width),
      y = Math.floor(random() * height),
      shade = 185 + Math.round(random() * 45);
    for (let j = 0; j < 2 + Math.floor(random() * 3); j++) {
      const i = (((y + j) % height) * width + ((x + (j % 2)) % width)) * 4;
      data[i] = shade;
      data[i + 1] = shade;
      data[i + 2] = shade;
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 3);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
