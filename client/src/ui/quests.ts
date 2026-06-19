import { QUESTS } from "@marea/shared";
import type { HarborScene } from "../scenes/HarborScene";

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

// Quest log: lists the active starter quests with progress bars (the topmost is
// the current objective the guide arrow points to). Re-rendered on every
// "progress" message from the server.
export function setupQuests(scene: HarborScene): { render: () => void } {
  const panel = byId("quests");
  const list = byId("questList");
  const btn = byId("questsBtn");
  const badge = byId("questsBadge");
  btn.onclick = () => panel.classList.toggle("show");
  byId("questsClose").onclick = () => panel.classList.remove("show");

  function render(): void {
    const active = QUESTS.filter((q) => !scene.questsDone.includes(q.id));
    // the first open quest drives the onboarding guide arrow
    scene.objectiveKind = active[0]?.kind ?? null;

    badge.textContent = String(active.length);
    badge.style.display = active.length ? "" : "none";

    if (!active.length) {
      list.innerHTML = '<div class="q-empty">All quests complete — you run the harbour. ⚓</div>';
      return;
    }
    list.innerHTML = active
      .slice(0, 5)
      .map((q, i) => {
        const prog = scene.quests.find((s) => s.id === q.id)?.progress ?? 0;
        const pct = Math.min(100, (prog / q.target) * 100);
        const reward = q.credits ? `+${q.xp} XP · +${q.credits} cr` : `+${q.xp} XP`;
        return (
          `<div class="quest${i === 0 ? " cur" : ""}">` +
          `<div class="q-top"><span>${q.label}</span><b>${prog}/${q.target}</b></div>` +
          `<div class="q-track"><div class="q-fill" style="width:${pct}%"></div></div>` +
          `<div class="q-reward">${reward}</div></div>`
        );
      })
      .join("");
  }

  render();
  return { render };
}
