// Generates shared/src/content/map.json by replaying the prototype's seeded
// world generation EXACTLY (seed 91237, GRID=52, coastline 40+round(sin(x*0.42)*4)),
// then freezes the result to JSON so client and server share one authoritative map.
//
// Run with: npm run genmap   (from repo root or the shared workspace)
//
// The RNG call order below is identical to marea-v3.html — do not reorder the
// random draws or the frozen map will drift from the approved prototype.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { GRID, MAP_SEED } from "../src/constants.js";

type Tile = "water" | "quay";

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(MAP_SEED);
const ri = (n: number) => Math.floor(rng() * n);
const rPick = <T>(a: T[]): T => a[ri(a.length)];

// ---------- tiles ----------
const tiles: Tile[][] = [];
// Land-dominant coastline: most of the grid is walkable quay (a big, full
// harbour), with the sea pushed out to the bottom-right corner as a marina.
const coast = (x: number) => 73 + Math.round(Math.sin(x * 0.3) * 5);
for (let y = 0; y < GRID; y++) {
  tiles[y] = [];
  for (let x = 0; x < GRID; x++) tiles[y][x] = x + y >= coast(x) ? "water" : "quay";
}

// ---------- props / berths ----------
interface Prop {
  x: number;
  y: number;
  kind: string;
  station?: string;
  h?: number;
  roof?: string;
  forSale?: boolean;
  price?: number;
  col?: string;
}
interface Berth { id: string; x: number; y: number }

const props: Prop[] = [];
const berthsArr: Berth[] = [];
const occ = new Set<string>();
const isOcc = (x: number, y: number) => occ.has(x + "," + y);
const mark = (x: number, y: number) => occ.add(x + "," + y);
function place(p: Prop): Prop {
  props.push(p);
  mark(p.x, p.y);
  return p;
}
function setQuay(x: number, y: number) {
  if (x >= 0 && y >= 0 && x < GRID && y < GRID) tiles[y][x] = "quay";
}

// piers jutting into the sea, lined with yachts + buyable berths
let berthId = 0;
function buildPier(bx: number, by: number, len: number) {
  for (let i = 0; i < len; i++) {
    const x = bx + Math.ceil(i / 2),
      y = by + Math.floor(i / 2);
    if (x >= GRID || y >= GRID) break;
    setQuay(x, y);
    ([[1, -1], [-1, 1]] as const).forEach(([dx, dy]) => {
      const wx = x + dx,
        wy = y + dy;
      if (wx >= 0 && wy >= 0 && wx < GRID && wy < GRID && tiles[wy][wx] === "water") {
        berthsArr.push({ id: "b" + berthId++, x: wx, y: wy });
      }
    });
  }
}
// piers sit along the new coast (≈ x+y 73) so berths land on the marina water
buildPier(40, 30, 9);
buildPier(32, 38, 9);
buildPier(46, 24, 8);
buildPier(26, 44, 7);

place({ x: 24, y: 18, kind: "dealer" });
const SPAWN = { x: 22, y: 20 };
(
  [
    ["wash", 30, 12],
    ["wash", 18, 26],
    ["fuel", 26, 16],
    ["fuel", 16, 24],
    ["repair", 34, 10],
    ["repair", 12, 30],
  ] as const
).forEach(([s, x, y]) => {
  if (tiles[y][x] === "quay" && !isOcc(x, y)) place({ x, y, kind: "station", station: s });
});

// villas up the hill (some for sale)
let saleN = 0;
for (let y = 0; y < GRID; y++)
  for (let x = 0; x < GRID; x++) {
    if (tiles[y][x] !== "quay" || isOcc(x, y)) continue;
    const s = x + y;
    if (s < 4 || s > 26) continue;
    const near = ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const).some(([dx, dy]) =>
      isOcc(x + dx, y + dy)
    );
    if (near) continue;
    if (rng() < 0.17) {
      const h = 34 + ri(22);
      const forSale = saleN < 8 && rng() < 0.32;
      if (forSale) saleN++;
      place({
        x,
        y,
        kind: "villa",
        h,
        roof: ["#c25e3a", "#b9542f", "#cf6a45", "#a8492a"][ri(4)],
        forSale,
        price: 1500 + ri(7) * 900,
      });
    }
  }

// scattered palm groves across the land so the harbor reads as a big, full
// world when zoomed out (never an empty plain). Skips the central plaza/spawn.
for (let y = 0; y < GRID; y++)
  for (let x = 0; x < GRID; x++) {
    if (tiles[y][x] !== "quay" || isOcc(x, y)) continue;
    const s = x + y;
    if (s < 6 || s > coast(x) - 2) continue;
    if (Math.abs(x - SPAWN.x) < 4 && Math.abs(y - SPAWN.y) < 4) continue;
    if (rng() < 0.08) place({ x, y, kind: "palm" });
  }

// promenade life: cafes, lamps, cars, stalls, planters along the waterfront band
for (let y = 0; y < GRID; y++)
  for (let x = 0; x < GRID; x++) {
    if (tiles[y][x] !== "quay" || isOcc(x, y)) continue;
    const s = x + y;
    if (s < 28 || s > coast(x) - 1) continue;
    const r = rng();
    if (r < 0.05) place({ x, y, kind: "cafe" });
    else if (r < 0.1) place({ x, y, kind: "lamp" });
    else if (r < 0.135)
      place({ x, y, kind: "car", col: ["#b23a2e", "#1d1f24", "#e8e2d2", "#2b4d63", "#c9a24a"][ri(5)] });
    else if (r < 0.16) place({ x, y, kind: "stall" });
    else if (r < 0.21) place({ x, y, kind: "palm" });
  }

// a fountain plaza near spawn
place({ x: 25, y: 23, kind: "fountain" });

// keep spawn clear
for (let dx = -1; dx <= 1; dx++)
  for (let dy = -1; dy <= 1; dy++) {
    const i = props.findIndex(
      (p) =>
        p.x === SPAWN.x + dx &&
        p.y === SPAWN.y + dy &&
        ["villa", "palm", "cafe", "car", "stall", "lamp"].includes(p.kind)
    );
    if (i >= 0) {
      occ.delete(props[i].x + "," + props[i].y);
      props.splice(i, 1);
    }
  }

// ambient yachts owned by 'regulars' near coast
const ambientBoats: { x: number; y: number; tier: string; ph: number }[] = [];
for (let y = 0; y < GRID; y++)
  for (let x = 0; x < GRID; x++) {
    if (tiles[y][x] !== "water") continue;
    const edge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
      const nx = x + dx,
        ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && tiles[ny][nx] === "quay";
    });
    if (edge && !berthsArr.some((b) => b.x === x && b.y === y) && rng() < 0.3) {
      ambientBoats.push({
        x,
        y,
        tier: rPick(["runabout_classic", "cruiser_sport", "mega_yacht", "runabout_classic"]),
        ph: rng() * 6,
      });
    }
  }

const map = {
  grid: GRID,
  spawn: SPAWN,
  tiles,
  props,
  berths: berthsArr,
  ambientBoats,
};

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/content/map.json");
writeFileSync(out, JSON.stringify(map));
console.log(
  `Wrote ${out}\n  ${GRID}x${GRID} tiles · ${props.length} props · ` +
    `${berthsArr.length} berths · ${ambientBoats.length} ambient boats`
);
