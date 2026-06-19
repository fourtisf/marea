// Authoritative world helpers — cartesian grid ONLY. The server is
// projection-blind: nothing here references the isometric projection.
import { MAP, type Berth, type Prop, type StationKind } from "@marea/shared";

const GRID = MAP.grid;
const blocked = new Set<string>(MAP.props.map((p) => p.x + "," + p.y));

export const key = (x: number, y: number): string => x + "," + y;

export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < GRID && y < GRID;

export const walkable = (x: number, y: number): boolean =>
  inBounds(x, y) && MAP.tiles[y][x] === "quay" && !blocked.has(key(x, y));

export const orthogonallyAdjacent = (ax: number, ay: number, bx: number, by: number): boolean =>
  Math.abs(ax - bx) + Math.abs(ay - by) === 1;

export const isWater = (x: number, y: number): boolean =>
  inBounds(x, y) && MAP.tiles[y][x] === "water";

// You can fish from any quay tile that borders the marina water.
export const waterAdjacent = (x: number, y: number): boolean =>
  ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => isWater(x + dx, y + dy));

export function stationAt(x: number, y: number): StationKind | null {
  const p = MAP.props.find((pp): pp is Extract<Prop, { kind: "station" }> =>
    pp.kind === "station" && pp.x === x && pp.y === y
  );
  return p ? p.station : null;
}

export const villaAt = (x: number, y: number): Extract<Prop, { kind: "villa" }> | undefined =>
  MAP.props.find((p): p is Extract<Prop, { kind: "villa" }> =>
    p.kind === "villa" && p.x === x && p.y === y
  );

export const berthById = (id: string): Berth | undefined =>
  MAP.berths.find((b) => b.id === id);

interface Bfs {
  prev: Record<string, [number, number] | undefined>;
  dist: Record<string, number | undefined>;
}

function bfs(sx: number, sy: number): Bfs {
  const prev: Bfs["prev"] = {};
  const dist: Bfs["dist"] = {};
  dist[key(sx, sy)] = 0;
  const q: [number, number][] = [[sx, sy]];
  let h = 0;
  while (h < q.length) {
    const [x, y] = q[h++];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx,
        ny = y + dy;
      if (walkable(nx, ny) && dist[key(nx, ny)] === undefined) {
        dist[key(nx, ny)] = (dist[key(x, y)] as number) + 1;
        prev[key(nx, ny)] = [x, y];
        q.push([nx, ny]);
      }
    }
  }
  return { prev, dist };
}

export interface GridPoint { x: number; y: number }

// Path from (fromX,fromY) to (tx,ty), approaching the nearest walkable neighbour
// when the target itself isn't walkable. Returns the steps after the start tile.
export function pathTo(fromX: number, fromY: number, tx: number, ty: number): GridPoint[] | null {
  const { prev, dist } = bfs(fromX, fromY);
  let g: [number, number] | null = null;
  if (walkable(tx, ty) && dist[key(tx, ty)] !== undefined) {
    g = [tx, ty];
  } else {
    let best = Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = tx + dx,
        ny = ty + dy;
      const d = dist[key(nx, ny)];
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
    c = prev[key(c[0], c[1])];
  }
  return out.slice(1).map(([x, y]) => ({ x, y }));
}
