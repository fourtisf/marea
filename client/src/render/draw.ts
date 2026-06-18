// Top-down (2D) renderer — flat tiles seen from above, golden-hour palette
// retained. Primitive art so sprites can be swapped in later.
import { vehicleById, lookById } from "@marea/shared";
import type { StationKind } from "@marea/shared";
import { TILE_PX as T } from "../iso/iso";

type Ctx = CanvasRenderingContext2D;

export const STATION_COLOR: Record<StationKind, string> = {
  wash: "#3da7d4",
  fuel: "#e8923c",
  repair: "#8a949a",
};
export const STATION_LABEL: Record<StationKind, string> = {
  wash: "Wash",
  fuel: "Fuel",
  repair: "Repair",
};

const vCol = (id: string) => vehicleById(id)?.col ?? "#9aa7ab";
const vType = (id: string) => vehicleById(id)?.type ?? "boat";

// ---- tiles (drawn from the tile's top-left corner) ----
export function quayTile(ctx: Ctx, cx: number, cy: number, ox: number, oy: number) {
  ctx.fillStyle = (cx + cy) % 2 ? "#e9d6a4" : "#e2cd98";
  ctx.fillRect(ox, oy, T + 1, T + 1);
  ctx.strokeStyle = "rgba(150,120,60,.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, T, T);
}

export function waterTile(ctx: Ctx, cx: number, cy: number, ox: number, oy: number, tsec: number) {
  const w = Math.sin(cx * 0.7 + cy * 1.1 + tsec * 1.1) * 0.5 + 0.5;
  ctx.fillStyle = w < 0.5 ? "#2a9fb6" : "#34b3c9";
  ctx.fillRect(ox, oy, T + 1, T + 1);
  ctx.globalAlpha = 0.08 + w * 0.12;
  ctx.fillStyle = "#dffaff";
  ctx.fillRect(ox, oy + T * 0.5, T + 1, 2);
  ctx.globalAlpha = 1;
}

function softShadow(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#3a2410";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.5, r, r * 0.6, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

// ---- props (drawn centered at the tile center cx,cy) ----
export interface VillaDraw { roof: string; forSale: boolean; owner: string | null }

export function drawVilla(ctx: Ctx, p: VillaDraw, cx: number, cy: number) {
  const s = T * 0.82;
  softShadow(ctx, cx, cy, s * 0.5);
  // walls
  ctx.fillStyle = "#efe3c8";
  ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  // roof inset
  ctx.fillStyle = p.roof;
  ctx.fillRect(cx - s / 2 + 2, cy - s / 2 + 2, s - 4, s * 0.5);
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.fillRect(cx - s / 2, cy + 1, s, 2);
  if (p.owner) {
    nameplate(ctx, p.owner, cx, cy - s / 2 - 3, "#15323b", "#c9a24a");
  } else if (p.forSale) {
    ctx.font = "700 8px Inter";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,251,241,.95)";
    ctx.fillRect(cx - 22, cy - 6, 44, 12);
    ctx.fillStyle = "#b04a3a";
    ctx.fillText("FOR SALE", cx, cy + 3);
  }
}

export function drawDealerProp(ctx: Ctx, cx: number, cy: number) {
  const s = T * 0.86;
  softShadow(ctx, cx, cy, s * 0.5);
  ctx.fillStyle = "#e7d6b0";
  ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  ctx.fillStyle = "#15323b";
  for (let i = -2; i < 2; i++) {
    ctx.fillStyle = i % 2 ? "#15323b" : "#e7c46b";
    ctx.fillRect(cx - s / 2 + (i + 2) * (s / 4), cy - 3, s / 4 - 1, 7);
  }
  ctx.fillStyle = "#15323b";
  ctx.font = "700 8px Inter";
  ctx.textAlign = "center";
  ctx.fillText("DEALER", cx, cy - s / 2 - 3);
}

export function drawStation(ctx: Ctx, station: StationKind, cx: number, cy: number) {
  softShadow(ctx, cx, cy, 7);
  ctx.fillStyle = STATION_COLOR[station];
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#15323b";
  ctx.font = "700 8px Inter";
  ctx.textAlign = "center";
  ctx.fillText(STATION_LABEL[station].toUpperCase(), cx, cy - 12);
}

export function drawPalm(ctx: Ctx, cx: number, cy: number) {
  softShadow(ctx, cx, cy, 7);
  ctx.fillStyle = "#8a6a3e";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#3f8a4a";
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6, 4.5, 2.6, ang, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = "#4fa05a";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, 7);
  ctx.fill();
}

export function drawCafe(ctx: Ctx, cx: number, cy: number) {
  softShadow(ctx, cx, cy, 8);
  const segs = 8, r = 9;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 ? "#e7c46b" : "#f4ecdb";
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawLamp(ctx: Ctx, cx: number, cy: number, glow: boolean) {
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 16);
    g.addColorStop(0, "rgba(255,214,130,.55)");
    g.addColorStop(1, "rgba(255,214,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#ffe6a6";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, 7);
  ctx.fill();
}

export function drawCar(ctx: Ctx, cx: number, cy: number, col: string) {
  softShadow(ctx, cx, cy, 7);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(cx - 9, cy - 5, 18, 10, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(180,220,235,.85)";
  ctx.beginPath();
  ctx.roundRect(cx - 4, cy - 4, 8, 8, 2);
  ctx.fill();
}

export function drawStall(ctx: Ctx, cx: number, cy: number) {
  softShadow(ctx, cx, cy, 7);
  for (let i = -2; i < 2; i++) {
    ctx.fillStyle = i % 2 ? "#b04a3a" : "#f4ecdb";
    ctx.fillRect(cx + i * 5, cy - 6, 5, 12);
  }
}

export function drawFountain(ctx: Ctx, cx: number, cy: number, tsec: number) {
  softShadow(ctx, cx, cy, 9);
  ctx.fillStyle = "#d8c8a4";
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#34b3c9";
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(200,240,250,.8)";
  const o = Math.sin(tsec * 4) * 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy + o, 2, 0, 7);
  ctx.fill();
}

export function drawBoatParked(ctx: Ctx, cx: number, cy: number, tier: string, ph: number, tsec: number) {
  const bob = Math.sin(tsec * 1.4 + ph) * 1.2;
  cy += bob;
  const len = tier === "mega_yacht" ? 26 : tier === "cruiser_sport" ? 21 : tier === "runabout_classic" ? 17 : 13;
  ctx.fillStyle = "rgba(0,0,0,.10)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, len / 2, 4, 0, 0, 7);
  ctx.fill();
  // hull (pointed top-down)
  ctx.fillStyle = vCol(tier);
  ctx.beginPath();
  ctx.moveTo(cx, cy - len / 2);
  ctx.lineTo(cx + 5, cy + len / 2 - 3);
  ctx.lineTo(cx, cy + len / 2);
  ctx.lineTo(cx - 5, cy + len / 2 - 3);
  ctx.closePath();
  ctx.fill();
  if (tier !== "tender_used") {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(cx - 2.5, cy - 3, 5, len * 0.4);
  }
}

function vehBadge(ctx: Ctx, cx: number, cy: number, vid: string) {
  ctx.fillStyle = vCol(vid);
  if (vType(vid) === "land") {
    ctx.beginPath();
    ctx.roundRect(cx - 7, cy - 4, 14, 8, 2);
    ctx.fill();
  } else {
    const len = vid === "mega_yacht" ? 18 : vid === "cruiser_sport" ? 15 : 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy - len / 2);
    ctx.lineTo(cx + 4, cy + len / 2);
    ctx.lineTo(cx - 4, cy + len / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function nameplate(ctx: Ctx, text: string, cx: number, cy: number, fg: string, bg: string) {
  ctx.font = "700 9px Inter";
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - 12, w, 13, 6);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, cx, cy - 2.5);
}

// ---- characters (top-down: body disc + head + hair + face) ----
export interface PersonDraw {
  name: string;
  equipped: string;
  look?: string;
  bubble?: { text: string } | null;
}

// Drawn as a small UPRIGHT person standing on the tile (feet at cx,cy) so the
// body reads like a human even though the map is top-down.
export function drawPerson(ctx: Ctx, ent: PersonDraw, cx: number, cy: number, you: boolean, bare = false) {
  const look = ent.look ? lookById(ent.look) : undefined;
  const body = look?.body ?? (you ? "#2b4d63" : "#5a6e74");
  const skin = look?.skin ?? "#f0c9a0";
  const hair = look?.hair ?? "#3a2a1a";
  const style = look?.hairStyle ?? "short";

  if (!bare) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#3a2410";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 8, 3.2, 0, 0, 7);
    ctx.fill();
    ctx.restore();
    vehBadge(ctx, cx + 14, cy - 3, ent.equipped);
  }

  // legs
  ctx.fillStyle = "#3a3f44";
  ctx.fillRect(cx - 3.4, cy - 6, 3, 6);
  ctx.fillRect(cx + 0.4, cy - 6, 3, 6);

  // long hair behind the shoulders
  if (style === "long") {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.roundRect(cx - 6, cy - 24, 3, 13, 1.5);
    ctx.roundRect(cx + 3, cy - 24, 3, 13, 1.5);
    ctx.fill();
  }

  // arms + torso (clothes)
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(cx - 7, cy - 19, 2.6, 11, 1.3);
  ctx.roundRect(cx + 4.4, cy - 19, 2.6, 11, 1.3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 5, cy - 20, 10, 15, 4);
  ctx.fill();

  // head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, cy - 24, 5, 0, 7);
  ctx.fill();

  // hair cap
  if (style !== "bald") {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(cx, cy - 24, 5.4, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    if (style === "bun") {
      ctx.beginPath();
      ctx.arc(cx, cy - 30, 2.4, 0, 7);
      ctx.fill();
    }
  }

  // face — eyes
  ctx.fillStyle = "#2a1a12";
  ctx.beginPath();
  ctx.arc(cx - 1.9, cy - 23, 0.95, 0, 7);
  ctx.arc(cx + 1.9, cy - 23, 0.95, 0, 7);
  ctx.fill();

  // hat over hair
  if (look?.hat) {
    ctx.fillStyle = look.hat;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 27, 8, 2.6, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx - 4.5, cy - 32, 9, 6, 2);
    ctx.fill();
  }

  if (bare) return;

  nameplate(ctx, ent.name, cx, cy - 35, you ? "#f7eccb" : "#15323b", you ? "rgba(21,50,59,.92)" : "rgba(255,255,255,.85)");

  if (ent.bubble) {
    ctx.font = "600 11px Inter";
    ctx.textAlign = "center";
    const bw = ctx.measureText(ent.bubble.text).width + 16;
    ctx.fillStyle = "rgba(255,251,241,.97)";
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - 54, bw, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#15323b";
    ctx.fillText(ent.bubble.text, cx, cy - 41);
  }
}
