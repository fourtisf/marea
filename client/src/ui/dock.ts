import { JOBS, BERTH_PRICE, type StationKind } from "@marea/shared";
import { propAt, berthAt } from "../world";
import { STATION_LABEL } from "../render/draw";
import type { HarborScene } from "../scenes/HarborScene";
import type { NetClient } from "../net/room";

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

type Ctx =
  | { type: "dealer"; sig: string }
  | { type: "station"; station: StationKind; x: number; y: number; sig: string }
  | { type: "villa"; x: number; y: number; price: number; sig: string }
  | { type: "berth"; berthId: string; sig: string }
  | null;

// Contextual action dock: shows jobs / dealer / buy-villa / lease-berth based on
// what the local player is standing next to. Mirrors the prototype's behaviour.
export function setupDock(scene: HarborScene, net: NetClient, openDealer: () => void): void {
  const dock = byId("dock");
  let lastSig = "";

  function adjacent(): Ctx {
    const p = scene.player;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.tile.x + dx,
        y = p.tile.y + dy;
      const prop = propAt(x, y);
      if (prop && (prop.kind === "station" || prop.kind === "dealer")) {
        if (prop.kind === "dealer") return { type: "dealer", sig: `dealer${x},${y}` };
        return { type: "station", station: prop.station, x, y, sig: `station${x},${y}` };
      }
      if (prop && prop.kind === "villa" && prop.forSale) {
        const key = `${x},${y}`;
        const owner = scene.estate.villaOwners.get(key);
        if (!owner) return { type: "villa", x, y, price: prop.price, sig: `villa${key}` };
      }
      const berth = berthAt(x, y);
      if (berth && !scene.estate.berthOwners.has(berth.id)) {
        return { type: "berth", berthId: berth.id, sig: `berth${berth.id}` };
      }
    }
    return null;
  }

  function render(): void {
    const p = scene.player;
    if (p.job) {
      if (lastSig !== "") {
        dock.classList.remove("show");
        lastSig = "";
      }
      requestAnimationFrame(render);
      return;
    }
    const a = adjacent();
    const sig = a ? a.sig : "";
    if (sig === lastSig) {
      requestAnimationFrame(render);
      return;
    }
    lastSig = sig;
    if (!a) {
      dock.classList.remove("show");
      dock.innerHTML = "";
      requestAnimationFrame(render);
      return;
    }

    if (a.type === "dealer") {
      dock.innerHTML =
        '<div class="eyebrow">The Dealer</div><div class="jobs"><button class="btn primary" id="od">Browse the Dealer<span class="pay">vehicles · finds · estate</span></button></div>';
      byId("od").onclick = openDealer;
    } else if (a.type === "station") {
      const jobs = JOBS[a.station];
      dock.innerHTML =
        `<div class="eyebrow">${STATION_LABEL[a.station]} station</div><div class="jobs">` +
        jobs.map((j, i) => `<button class="btn" data-j="${i}">${j.name}<span class="pay">${j.dur}s · +${j.pay} cr</span></button>`).join("") +
        "</div>";
      dock.querySelectorAll<HTMLButtonElement>("[data-j]").forEach((b) => {
        b.onclick = () => {
          const j = jobs[Number(b.dataset.j)];
          net.startJob(j.id, `${a.x},${a.y}`, j.dur);
          dock.classList.remove("show");
          lastSig = "";
        };
      });
    } else if (a.type === "villa") {
      const can = scene.player.credits >= a.price;
      dock.innerHTML =
        `<div class="eyebrow">Hillside villa · for sale</div><div class="jobs"><button class="btn ${can ? "primary" : ""}" id="bv" ${can ? "" : "disabled"}>Buy this villa<span class="pay">${fmt(a.price)} cr · visible status</span></button></div>`;
      if (can) byId("bv").onclick = () => net.send({ t: "buy_villa", villaId: `${a.x},${a.y}` });
    } else {
      const can = scene.player.credits >= BERTH_PRICE;
      dock.innerHTML =
        `<div class="eyebrow">Open berth</div><div class="jobs"><button class="btn ${can ? "primary" : ""}" id="bb" ${can ? "" : "disabled"}>Lease this berth<span class="pay">${fmt(BERTH_PRICE)} cr · +passive income</span></button></div>`;
      if (can) byId("bb").onclick = () => net.send({ t: "lease_berth", berthId: a.berthId });
    }
    dock.classList.add("show");
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}
