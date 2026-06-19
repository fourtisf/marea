import { BERTH_PRICE, MAP, vehicleById, findById, levelProgress, rankForLevel } from "@marea/shared";
import type { HarborScene } from "../scenes/HarborScene";

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

function villaPrice(villaId: string): number {
  const [x, y] = villaId.split(",").map(Number);
  const v = MAP.props.find((p) => p.kind === "villa" && p.x === x && p.y === y);
  return v && v.kind === "villa" ? v.price : 0;
}

// Net worth = credits + owned vehicle prices + villa price + berths*price + finds.
export function netWorth(scene: HarborScene): number {
  const p = scene.player;
  let n = p.credits;
  for (const id of p.owned) n += vehicleById(id)?.price ?? 0;
  if (p.villaOwned) n += villaPrice(p.villaOwned);
  n += p.berths.length * BERTH_PRICE;
  for (const id of p.finds) n += findById(id)?.sell ?? 0;
  return n;
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export function updateHud(scene: HarborScene): void {
  const p = scene.player;
  byId("creditsVal").textContent = fmt(p.credits);
  byId("nwVal").textContent = fmt(netWorth(scene));
  byId("vehVal").textContent = vehicleById(p.equipped)?.name ?? p.equipped;
  const online = document.getElementById("onlineVal");
  if (online) online.textContent = String(scene.online);
  const users = document.getElementById("usersVal");
  if (users) users.textContent = String(scene.totalUsers);

  const lp = levelProgress(scene.xp);
  const lvl = document.getElementById("lvlVal");
  if (lvl) lvl.textContent = String(lp.level);
  const rank = document.getElementById("rankVal");
  if (rank) rank.textContent = rankForLevel(lp.level);
  const xpFill = document.getElementById("xpFill");
  if (xpFill) xpFill.style.width = Math.min(100, (lp.into / lp.span) * 100) + "%";
}
