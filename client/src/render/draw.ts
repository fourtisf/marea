// Faithful port of the prototype's canvas drawing (golden-hour primitives).
// These are CLIENT render helpers only. Art is intentionally primitive shapes
// so sprites can be swapped in later (Phase 8) without touching gameplay.
import { TILE_W as TW, TILE_H as TH, TILE_THICK as THICK, vehicleById } from "@marea/shared";
import type { StationKind } from "@marea/shared";

type Ctx = CanvasRenderingContext2D;

const SUN = { dx: 0.55, dy: -0.83 }; // light from upper-right

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

export function diamond(ctx: Ctx, sx: number, sy: number, fill: string, stroke: string | null) {
  ctx.beginPath();
  ctx.moveTo(sx, sy - TH / 2);
  ctx.lineTo(sx + TW / 2, sy);
  ctx.lineTo(sx, sy + TH / 2);
  ctx.lineTo(sx - TW / 2, sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function quayTile(ctx: Ctx, cx: number, cy: number, sx: number, sy: number) {
  ctx.fillStyle = "#c0a468";
  ctx.beginPath();
  ctx.moveTo(sx - TW / 2, sy);
  ctx.lineTo(sx, sy + TH / 2);
  ctx.lineTo(sx, sy + TH / 2 + THICK);
  ctx.lineTo(sx - TW / 2, sy + THICK);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ab9159";
  ctx.beginPath();
  ctx.moveTo(sx + TW / 2, sy);
  ctx.lineTo(sx, sy + TH / 2);
  ctx.lineTo(sx, sy + TH / 2 + THICK);
  ctx.lineTo(sx + TW / 2, sy + THICK);
  ctx.closePath();
  ctx.fill();
  diamond(ctx, sx, sy, (cx + cy) % 2 ? "#efddae" : "#e8d39e", "rgba(150,120,60,.2)");
}

export function waterTile(ctx: Ctx, cx: number, cy: number, sx: number, sy: number, tsec: number) {
  const w = Math.sin(cx * 0.9 + cy * 1.3 + tsec * 1.25) * 0.5 + 0.5;
  const warm = Math.max(0, 1 - (cx + cy) / 70);
  diamond(ctx, sx, sy, w < 0.5 ? "#1c9fb8" : "#2cb4cc", null);
  ctx.globalAlpha = 0.12 + w * 0.16;
  diamond(ctx, sx, sy - 1, "#c9f1f7", null);
  ctx.globalAlpha = 0.1 + warm * 0.2;
  diamond(ctx, sx, sy - 1, "#ffe5a6", null);
  ctx.globalAlpha = 1;
}

export function shadow(ctx: Ctx, sx: number, sy: number, h: number, w: number) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#3a2410";
  ctx.beginPath();
  ctx.ellipse(sx - SUN.dx * h * 0.55, sy - SUN.dy * h * 0.18 + 3, w + h * 0.22, (w + h * 0.22) * 0.42, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

export function box(ctx: Ctx, sx: number, sy: number, h: number, top: string, left: string, right: string): number {
  const t = sy - h;
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(sx - TW / 2, sy);
  ctx.lineTo(sx, sy + TH / 2);
  ctx.lineTo(sx, sy + TH / 2 - h);
  ctx.lineTo(sx - TW / 2, sy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(sx + TW / 2, sy);
  ctx.lineTo(sx, sy + TH / 2);
  ctx.lineTo(sx, sy + TH / 2 - h);
  ctx.lineTo(sx + TW / 2, sy - h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx, t - TH / 2);
  ctx.lineTo(sx + TW / 2, t);
  ctx.lineTo(sx, t + TH / 2);
  ctx.lineTo(sx - TW / 2, t);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();
  return t;
}

export interface VillaDraw { h: number; roof: string; forSale: boolean; owner: string | null }

export function drawVilla(ctx: Ctx, p: VillaDraw, sx: number, sy: number) {
  shadow(ctx, sx, sy, p.h, 24);
  box(ctx, sx, sy, p.h, "#f4ecdb", "#dac9ac", "#c9b78f");
  const ry = sy - p.h;
  ctx.fillStyle = p.roof;
  ctx.beginPath();
  ctx.moveTo(sx, ry - TH / 2 - 15);
  ctx.lineTo(sx + TW / 2, ry);
  ctx.lineTo(sx, ry + TH / 2);
  ctx.lineTo(sx - TW / 2, ry);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(40,70,90,.5)";
  ctx.fillRect(sx - 8, sy - p.h * 0.55, 6, 8);
  ctx.fillRect(sx + 3, sy - p.h * 0.55, 6, 8);
  if (p.owner) {
    ctx.fillStyle = "#15323b";
    ctx.fillRect(sx - 1, ry - TH / 2 - 30, 2, 16);
    ctx.fillStyle = "#c9a24a";
    ctx.beginPath();
    ctx.moveTo(sx + 1, ry - TH / 2 - 30);
    ctx.lineTo(sx + 16, ry - TH / 2 - 26);
    ctx.lineTo(sx + 1, ry - TH / 2 - 22);
    ctx.closePath();
    ctx.fill();
    ctx.font = "600 9px Inter";
    ctx.textAlign = "center";
    ctx.fillStyle = "#15323b";
    ctx.fillText(p.owner, sx, ry - TH / 2 - 34);
  } else if (p.forSale) {
    ctx.font = "600 8px Inter";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,251,241,.92)";
    ctx.fillRect(sx - 22, sy - p.h * 0.5, 44, 13);
    ctx.fillStyle = "#b04a3a";
    ctx.fillText("FOR SALE", sx, sy - p.h * 0.5 + 9);
  }
}

export function drawPalm(ctx: Ctx, sx: number, sy: number) {
  shadow(ctx, sx, sy, 30, 8);
  ctx.strokeStyle = "#8a6a3e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(sx + 3, sy - 18, sx, sy - 30);
  ctx.stroke();
  ctx.fillStyle = "#3f8a4a";
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 30);
    ctx.quadraticCurveTo(sx + Math.cos(ang) * 10, sy - 34 + Math.sin(ang) * 5, sx + Math.cos(ang) * 18, sy - 28 + Math.sin(ang) * 8);
    ctx.quadraticCurveTo(sx + Math.cos(ang) * 10, sy - 30 + Math.sin(ang) * 6, sx, sy - 30);
    ctx.fill();
  }
}

export function drawDealerProp(ctx: Ctx, sx: number, sy: number) {
  shadow(ctx, sx, sy, 30, 22);
  box(ctx, sx, sy, 30, "#f1e7d2", "#d8c39a", "#c9b289");
  const ay = sy - 30 + TH / 2;
  for (let i = -2; i < 2; i++) {
    ctx.fillStyle = i % 2 ? "#15323b" : "#e7c46b";
    ctx.fillRect(sx + i * 11, ay - 2, 11, 7);
  }
  ctx.fillStyle = "#15323b";
  ctx.font = "600 9px Inter";
  ctx.textAlign = "center";
  ctx.fillText("DEALER", sx, sy - 30 - 6);
}

export function drawStation(ctx: Ctx, station: StationKind, sx: number, sy: number) {
  shadow(ctx, sx, sy, 26, 8);
  ctx.fillStyle = "#e9e2d2";
  ctx.fillRect(sx - 4, sy - 26, 8, 28);
  ctx.fillStyle = STATION_COLOR[station];
  ctx.beginPath();
  ctx.arc(sx, sy - 30, 9, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#15323b";
  ctx.font = "600 8px Inter";
  ctx.textAlign = "center";
  ctx.fillText(STATION_LABEL[station].toUpperCase(), sx, sy - 44);
}

export function drawCafe(ctx: Ctx, sx: number, sy: number) {
  shadow(ctx, sx, sy, 18, 16);
  ctx.fillStyle = "#caa24a";
  ctx.fillRect(sx - 1, sy - 22, 2, 22);
  const segs = 8,
    r = 15;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 ? "#e7c46b" : "#f4ecdb";
    const a0 = (i / segs) * Math.PI * 2,
      a1 = ((i + 1) / segs) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 22);
    ctx.lineTo(sx + Math.cos(a0) * r, sy - 19 + Math.sin(a0) * r * 0.5);
    ctx.lineTo(sx + Math.cos(a1) * r, sy - 19 + Math.sin(a1) * r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#b39a63";
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 7, 4, 0, 0, 7);
  ctx.fill();
}

export function drawLamp(ctx: Ctx, sx: number, sy: number, glow: boolean) {
  shadow(ctx, sx, sy, 28, 5);
  ctx.strokeStyle = "#3a3f44";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, sy - 26);
  ctx.stroke();
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(sx, sy - 28, 1, sx, sy - 28, 22);
    g.addColorStop(0, "rgba(255,214,130,.6)");
    g.addColorStop(1, "rgba(255,214,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy - 28, 22, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#ffe6a6";
  ctx.beginPath();
  ctx.arc(sx, sy - 28, 4, 0, 7);
  ctx.fill();
}

export function drawCar(ctx: Ctx, sx: number, sy: number, col: string) {
  shadow(ctx, sx, sy, 10, 14);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(sx - 15, sy - 11, 30, 11, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(180,220,235,.85)";
  ctx.beginPath();
  ctx.roundRect(sx - 7, sy - 16, 16, 7, 3);
  ctx.fill();
  ctx.fillStyle = "#1b1b1f";
  ctx.beginPath();
  ctx.arc(sx - 9, sy, 3.4, 0, 7);
  ctx.arc(sx + 9, sy, 3.4, 0, 7);
  ctx.fill();
}

export function drawStall(ctx: Ctx, sx: number, sy: number) {
  shadow(ctx, sx, sy, 16, 14);
  ctx.fillStyle = "#8a6a3e";
  ctx.fillRect(sx - 12, sy - 8, 24, 8);
  for (let i = -2; i < 2; i++) {
    ctx.fillStyle = i % 2 ? "#b04a3a" : "#f4ecdb";
    ctx.fillRect(sx + i * 6, sy - 16, 6, 8);
  }
  ctx.fillStyle = "#c25e3a";
  ctx.beginPath();
  ctx.arc(sx - 5, sy - 2, 2, 0, 7);
  ctx.arc(sx + 1, sy - 2, 2, 0, 7);
  ctx.arc(sx + 6, sy - 2, 2, 0, 7);
  ctx.fill();
}

export function drawFountain(ctx: Ctx, sx: number, sy: number, tsec: number) {
  shadow(ctx, sx, sy, 8, 18);
  ctx.fillStyle = "#d8c8a4";
  ctx.beginPath();
  ctx.ellipse(sx, sy, 18, 9, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#2cb4cc";
  ctx.beginPath();
  ctx.ellipse(sx, sy - 1, 13, 6, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#cfb88c";
  ctx.fillRect(sx - 2, sy - 12, 4, 11);
  ctx.fillStyle = "rgba(200,240,250,.8)";
  for (let i = 0; i < 3; i++) {
    const o = Math.sin(tsec * 4 + i) * 2;
    ctx.beginPath();
    ctx.arc(sx + (i - 1) * 4, sy - 13 + o, 1.6, 0, 7);
    ctx.fill();
  }
}

export function drawBoatParked(ctx: Ctx, sx: number, sy: number, tier: string, ph: number, tsec: number) {
  const bob = Math.sin(tsec * 1.4 + ph) * 1.5;
  sy += bob;
  const len = tier === "mega_yacht" ? 42 : tier === "cruiser_sport" ? 32 : tier === "runabout_classic" ? 24 : 16;
  ctx.fillStyle = "rgba(0,0,0,.10)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4, len / 2, 5, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = vCol(tier);
  ctx.beginPath();
  ctx.moveTo(sx - len / 2, sy - 3);
  ctx.lineTo(sx + len / 2, sy - 3);
  ctx.lineTo(sx + len / 2 - 6, sy + 4);
  ctx.lineTo(sx - len / 2 + 4, sy + 4);
  ctx.closePath();
  ctx.fill();
  if (tier !== "tender_used") {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(sx - len / 5, sy - 9, len / 2.2, 6);
  }
  if (tier === "cruiser_sport" || tier === "mega_yacht") {
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(sx - len / 5, sy - 12, len / 2.6, 3);
  }
  if (tier === "mega_yacht") {
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(sx - len / 6, sy - 16, len / 3, 5);
  }
}

function vehBadge(ctx: Ctx, sx: number, sy: number, vid: string) {
  if (vType(vid) === "land") {
    ctx.fillStyle = vCol(vid);
    ctx.fillRect(sx - 9, sy - 6, 18, 5);
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(sx - 7, sy, 3.4, 0, 7);
    ctx.arc(sx + 7, sy, 3.4, 0, 7);
    ctx.fill();
  } else {
    const len = vid === "mega_yacht" ? 34 : vid === "cruiser_sport" ? 28 : vid === "runabout_classic" ? 22 : 16;
    ctx.fillStyle = vCol(vid);
    ctx.beginPath();
    ctx.moveTo(sx - len / 2, sy - 3);
    ctx.lineTo(sx + len / 2, sy - 3);
    ctx.lineTo(sx + len / 2 - 5, sy + 3);
    ctx.lineTo(sx - len / 2 + 3, sy + 3);
    ctx.closePath();
    ctx.fill();
    if (vid !== "tender_used") {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(sx - len / 6, sy - 8, len / 2.4, 5);
    }
    if (vid === "cruiser_sport" || vid === "mega_yacht") {
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(sx - len / 6, sy - 11, len / 3, 3);
    }
  }
}

export interface PersonDraw {
  name: string;
  equipped: string;
  bubble?: { text: string } | null;
}

export function drawPerson(ctx: Ctx, ent: PersonDraw, sx: number, sy: number, you: boolean) {
  shadow(ctx, sx, sy, 18, 8);
  const land = vType(ent.equipped) === "land";
  vehBadge(ctx, sx + (land ? 0 : 14), sy + (land ? 6 : 0), ent.equipped);
  ctx.fillStyle = you ? "#15323b" : "#5a6e74";
  ctx.beginPath();
  ctx.roundRect(sx - 5, sy - 20, 10, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#f0c9a0";
  ctx.beginPath();
  ctx.arc(sx, sy - 24, 5, 0, 7);
  ctx.fill();
  ctx.font = "600 10px Inter";
  ctx.textAlign = "center";
  const w = ctx.measureText(ent.name).width + 12;
  ctx.fillStyle = you ? "rgba(21,50,59,.92)" : "rgba(255,255,255,.82)";
  ctx.beginPath();
  ctx.roundRect(sx - w / 2, sy - 44, w, 15, 7);
  ctx.fill();
  ctx.fillStyle = you ? "#f7eccb" : "#15323b";
  ctx.fillText(ent.name, sx, sy - 33);
  if (ent.bubble) {
    ctx.font = "600 11px Inter";
    const bw = ctx.measureText(ent.bubble.text).width + 16;
    ctx.fillStyle = "rgba(255,251,241,.97)";
    ctx.beginPath();
    ctx.roundRect(sx - bw / 2, sy - 66, bw, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#15323b";
    ctx.fillText(ent.bubble.text, sx, sy - 53);
  }
}
