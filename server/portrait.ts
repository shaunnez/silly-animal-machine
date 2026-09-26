/** Portraits are bounded local browser renders, never arbitrary paths or URLs. */
export function validatePortrait(bytes: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    bytes.length < 45 ||
    bytes.length > 5 * 1024 * 1024 ||
    !bytes.subarray(0, 8).equals(signature) ||
    bytes.toString("ascii", 12, 16) !== "IHDR" ||
    bytes.readUInt32BE(16) !== 1024 ||
    bytes.readUInt32BE(20) !== 683 ||
    bytes.toString("ascii", bytes.length - 8, bytes.length - 4) !== "IEND"
  )
    throw new Error("Please save a complete creature scene picture.");
  return bytes;
}
