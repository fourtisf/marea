// Client-side view of the authoritative map: walkability + pathfinding for
// local feel (click-to-move). The server still owns the real movement; this
// only computes the intent path so the marker/preview feels instant.
import { MAP, propBlocks, type Berth, type Prop } from "@marea/shared";

const GRID = MAP.grid;
// only solid structures block movement; decorative props are walkable ambiance
const blocked = new Set<string>(MAP.props.filter((p) => propBlocks(p.kind)).map((p) => p.x + "," + p.y));
// O(1) spatial indexes (props/berths never move) — linear scans here were
// called for every neighbour every frame and showed up as input jank.
const propIndex = new Map<string, Prop>(MAP.props.map((p) => [p.x + "," + p.y, p]));
const berthIndex = new Map<string, Berth>(MAP.berths.map((b) => [b.x + "," + b.y, b]));

export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < GRID && y < GRID;

export const walkable = (x: number, y: number): boolean =>
  inBounds(x, y) && MAP.tiles[y][x] === "quay" && !blocked.has(x + "," + y);

export const isWater = (x: number, y: number): boolean =>
  inBounds(x, y) && MAP.tiles[y][x] === "water";

export const waterAdjacent = (x: number, y: number): boolean =>
  ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => isWater(x + dx, y + dy));

export const propAt = (x: number, y: number): Prop | undefined =>
  propIndex.get(x + "," + y);

export const berthAt = (x: number, y: number): Berth | undefined =>
  berthIndex.get(x + "," + y);

interface Bfs {
  prev: Record<string, [number, number] | undefined>;
  dist: Record<string, number | undefined>;
  k: (x: number, y: number) => string;
}

function bfs(sx: number, sy: number): Bfs {
  const prev: Bfs["prev"] = {};
  const dist: Bfs["dist"] = {};
  const k = (x: number, y: number) => x + "," + y;
  dist[k(sx, sy)] = 0;
  const q: [number, number][] = [[sx, sy]];
  let h = 0;
  while (h < q.length) {
    const [x, y] = q[h++];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx,
        ny = y + dy;
      if (walkable(nx, ny) && dist[k(nx, ny)] === undefined) {
        dist[k(nx, ny)] = (dist[k(x, y)] as number) + 1;
        prev[k(nx, ny)] = [x, y];
        q.push([nx, ny]);
      }
    }
  }
  return { prev, dist, k };
}

// Path from (fromX,fromY) to (tx,ty). If the target isn't walkable, walk to the
// nearest walkable orthogonal neighbour (lets you approach stations/berths/villas).
export function pathTo(
  fromX: number,
  fromY: number,
  tx: number,
  ty: number
): Tile[] | null {
  const { prev, dist, k } = bfs(fromX, fromY);
  let g: [number, number] | null = null;
  if (walkable(tx, ty) && dist[k(tx, ty)] !== undefined) {
    g = [tx, ty];
  } else {
    let best = Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = tx + dx,
        ny = ty + dy;
      const d = dist[k(nx, ny)];
      if (d !== undefined && d < best) {
        best = d;
        g = [nx, ny];
      }
    }
  }
  if (!g) return null;
  const out: [number, number][] = [];
  let c: [number, number] | undefined = g;
  while (c) {
    out.unshift(c);
    c = prev[k(c[0], c[1])];
  }
  return out.slice(1).map(([x, y]) => ({ x, y }));
}

export interface Tile { x: number; y: number }
