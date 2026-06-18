import type { LeaderboardRow } from "@marea/shared";
import type { HarborScene } from "../scenes/HarborScene";

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

// Toggle panel + render server-broadcast net-worth ranking, highlighting you.
export function setupLeaderboard(scene: HarborScene): { render: (rows: LeaderboardRow[]) => void } {
  const panel = byId("lead");
  byId("leadBtn").onclick = () => panel.classList.toggle("show");
  let last: LeaderboardRow[] = [];

  function render(rows: LeaderboardRow[]): void {
    last = rows;
    if (!panel.classList.contains("show")) return;
    byId("leadList").innerHTML = rows
      .map((e, i) => {
        const me = e.name === scene.player.name ? " me" : "";
        return `<div class="lr${me}"><span class="rk">${i + 1}</span><span class="nm">${escapeHtml(e.name)}</span><span class="nw">${fmt(e.netWorth)}</span></div>`;
      })
      .join("");
  }

  // re-render when toggled open
  byId("leadBtn").addEventListener("click", () => render(last));
  return { render };
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}
