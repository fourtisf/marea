import { VEHICLES, BERTH_RATE_PER_SEC, findById } from "@marea/shared";
import type { HarborScene } from "../scenes/HarborScene";
import type { NetClient } from "../net/room";
import { netWorth } from "./hud";

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

// The Dealer modal: Vehicles / Discoveries / My estate. Buttons send intent to
// the server; the server's owner-only replies trigger refresh() via the bridge.
export function setupDealer(scene: HarborScene, net: NetClient): { open: () => void; refresh: () => void } {
  const scrim = byId("scrim");
  const list = byId("dealerList");
  let tab: "buy" | "sell" | "estate" = "buy";

  const close = () => scrim.classList.remove("show");
  byId<HTMLButtonElement>("closeDealer").onclick = close;
  scrim.onclick = (e) => {
    if (e.target === scrim) close();
  };
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => {
    t.onclick = () => {
      tab = (t.dataset.tab as typeof tab) ?? "buy";
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      refresh();
    };
  });

  function open(): void {
    scrim.classList.add("show");
    tab = "buy";
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", (x as HTMLElement).dataset.tab === "buy"));
    refresh();
  }

  function refresh(): void {
    if (!scrim.classList.contains("show")) return;
    const p = scene.player;
    if (tab === "buy") {
      list.innerHTML = VEHICLES.map((v) => {
        const owned = p.owned.includes(v.id);
        const eq = p.equipped === v.id;
        const can = p.credits >= v.price;
        const act = eq
          ? '<button class="act equipped">Sailing</button>'
          : owned
            ? `<button class="act" data-eq="${v.id}">Equip</button>`
            : `<button class="act buy" data-buy="${v.id}" ${can ? "" : "disabled"}>Buy</button>`;
        const price =
          v.price > 0
            ? `<div class="price"><span class="coin" style="width:12px;height:12px"></span>${fmt(v.price)}</div>`
            : '<div class="dt">starter</div>';
        return `<div class="row"><div class="swatch" style="background:${v.col}"></div><div class="meta"><div class="nm">${v.name}</div><div class="dt">${v.type === "boat" ? "Boat" : "Land"} · visible to the harbor</div></div>${price}${act}</div>`;
      }).join("");
      list.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => {
        b.onclick = () => net.send({ t: "buy_vehicle", vehicleId: b.dataset.buy! });
      });
      list.querySelectorAll<HTMLButtonElement>("[data-eq]").forEach((b) => {
        b.onclick = () => net.send({ t: "equip_vehicle", vehicleId: b.dataset.eq! });
      });
    } else if (tab === "sell") {
      if (!p.finds.length) {
        list.innerHTML =
          '<div class="empty">No Discoveries in hand. Work the marina — every job has a 3% chance to surface a rare find.</div>';
        return;
      }
      const counts: Record<string, number> = {};
      for (const id of p.finds) counts[id] = (counts[id] ?? 0) + 1;
      list.innerHTML = Object.entries(counts)
        .map(([id, n]) => {
          const f = findById(id)!;
          return `<div class="row"><div class="swatch" style="background:${f.col}"></div><div class="meta"><div class="nm">${f.name}${n > 1 ? " ×" + n : ""}</div><div class="dt">rare find</div></div><div class="price"><span class="coin" style="width:12px;height:12px"></span>${fmt(f.sell)}</div><button class="act buy" data-sell="${id}">Sell</button></div>`;
        })
        .join("");
      list.querySelectorAll<HTMLButtonElement>("[data-sell]").forEach((b) => {
        b.onclick = () => net.send({ t: "sell_find", findId: b.dataset.sell! });
      });
    } else {
      const villaTxt = p.villaOwned ? "Owned · your name flies over it" : 'Walk up to a villa marked "for sale"';
      const berthTxt = p.berths.length
        ? `+${(p.berths.length * BERTH_RATE_PER_SEC).toFixed(2)} cr/sec passive`
        : "Lease an open berth at any pier";
      list.innerHTML =
        `<div class="row"><div class="swatch" style="background:${p.villaOwned ? "#c25e3a" : "#cfc6b2"}"></div><div class="meta"><div class="nm">Hillside villa</div><div class="dt">${villaTxt}</div></div></div>` +
        `<div class="row"><div class="swatch" style="background:${p.berths.length ? "#1fa4bd" : "#cfc6b2"}"></div><div class="meta"><div class="nm">Berths leased: ${p.berths.length}</div><div class="dt">${berthTxt}</div></div></div>` +
        `<div class="row"><div class="meta"><div class="nm">Net worth</div><div class="dt">credits + vehicles + estate + finds</div></div><div class="price"><span class="coin" style="width:12px;height:12px"></span>${fmt(netWorth(scene))}</div></div>`;
    }
  }

  return { open, refresh };
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}
