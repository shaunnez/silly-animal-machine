import { planetRadius } from "./surface";
export type Cell = [number, number];
export const spacing = (Math.PI * planetRadius) / 16;
export const cellKey = (c: Cell) => c.join(",");
const wrap = (x: number) => ((((x + 16) % 32) + 32) % 32) - 16;
const ringStep = (z: number) => (Math.abs(z) < 4 ? 1 : Math.abs(z) < 6 ? 2 : 4);
export const worldCells: Cell[] = [];
for (let z = -7; z <= 7; z++)
  for (let x = -16; x < 16; x += ringStep(z)) worldCells.push([x, z]);
worldCells.push([0, -8], [0, 8]);
const graph = new Map(worldCells.map((c) => [cellKey(c), [] as Cell[]]));
function connect(a: Cell, b: Cell) {
  const left = graph.get(cellKey(a)),
    right = graph.get(cellKey(b));
  if (!left || !right) return;
  if (!left.some((c) => cellKey(c) === cellKey(b))) left.push(b);
  if (!right.some((c) => cellKey(c) === cellKey(a))) right.push(a);
}
for (const c of worldCells) {
  const [x, z] = c;
  if (Math.abs(z) === 8) continue;
  connect(c, [wrap(x + ringStep(z)), z]);
  for (const nextZ of [z - 1, z + 1]) {
    if (Math.abs(nextZ) === 8) connect(c, [0, nextZ]);
    else
      connect(c, [
        wrap(Math.round(x / ringStep(nextZ)) * ringStep(nextZ)),
        nextZ,
      ]);
  }
}
export const walkable = (c: Cell) => graph.has(cellKey(c));
export const neighbours = (c: Cell) => graph.get(cellKey(c)) ?? [];
