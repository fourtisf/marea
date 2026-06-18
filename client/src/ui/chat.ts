import type { NetClient } from "../net/room";

// Local chat log + input. Sending goes through the server (rate-limited there);
// incoming lines arrive via the room and are appended through addLine().
export function setupChat(net: NetClient): { addLine: (from: string, text: string) => void } {
  const clog = byId("clog");
  const input = byId<HTMLInputElement>("chatIn");
  const log: { from: string; text: string }[] = [];

  function addLine(from: string, text: string): void {
    log.push({ from, text });
    if (log.length > 5) log.shift();
    clog.innerHTML = log
      .map((m) =>
        m.from === "system"
          ? `<div class="cm" style="opacity:.8"><i>${escapeHtml(m.text)}</i></div>`
          : `<div class="cm"><b>${escapeHtml(m.from)}</b> ${escapeHtml(m.text)}</div>`
      )
      .join("");
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      net.send({ t: "chat", text: input.value.trim().slice(0, 80) });
      input.value = "";
    }
  });
  document.querySelectorAll<HTMLButtonElement>(".emotes button").forEach((b) => {
    b.onclick = () => net.send({ t: "chat", text: b.dataset.e ?? "" });
  });

  return { addLine };
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}
