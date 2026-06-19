import Phaser from "phaser";
import { LOOKS, STARTING_LOOK } from "@marea/shared";
import { HarborScene } from "./scenes/HarborScene";
import { drawPerson } from "./render/draw";
import { setupMinimap } from "./ui/minimap";
import { updateHud } from "./ui/hud";
import { ensureAudio, setVolume, setMuted, isMuted } from "./ui/audio";
import { NetClient, type UiBridge } from "./net/room";
import { setupChat } from "./ui/chat";
import { setupLeaderboard } from "./ui/leaderboard";
import { setupQuests } from "./ui/quests";
import { setupDealer } from "./ui/dealer";
import { setupDock } from "./ui/dock";
import { setupJoystick } from "./ui/joystick";
import { toast, banner } from "./ui/notify";
import { getSolanaWallets, connectWallet, silentConnect, subscribeWallets } from "./net/wallet";
import type { Wallet } from "@wallet-standard/base";

// Poll the server's /stats so the intro shows live Online/Players before joining.
function setupLiveStats(): void {
  const base = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/^ws/, "http") ?? "";
  const url = base + "/stats";
  const onEl = document.getElementById("lcOnline");
  const usEl = document.getElementById("lcUsers");
  const refresh = async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const s = (await r.json()) as { online: number; totalUsers: number };
      if (onEl) onEl.textContent = String(s.online ?? 0);
      if (usEl) usEl.textContent = String(s.totalUsers ?? 0);
    } catch {
      /* ignore until reachable */
    }
  };
  refresh();
  setInterval(refresh, 5000);
}

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  fps: { target: 60 },
  scene: [HarborScene],
});

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

game.events.once(Phaser.Core.Events.READY, () => {
  const scene = game.scene.getScene("harbor") as HarborScene;
  setupMinimap(scene);

  // net is constructed first (it only connects on intro), then the UI surfaces
  // that need it, then the bridge is handed back to net.
  const net = new NetClient(scene);
  const dealer = setupDealer(scene, net);
  const chat = setupChat(net);
  const lead = setupLeaderboard(scene);
  const questsUi = setupQuests(scene);

  const ui: UiBridge = {
    hud: () => updateHud(scene),
    refreshDealer: () => dealer.refresh(),
    chatLine: (from, text) => chat.addLine(from, text),
    toast: (title, kicker, sub) => toast(title, kicker, sub),
    banner: (text) => banner(text),
    leaderboard: (rows) => lead.render(rows),
    error: (msg) => toast(msg, "Harbor", ""),
    workHide: () => byId("work").classList.remove("show"),
    quests: () => questsUi.render(),
  };
  net.setUi(ui);
  setupDock(scene, net, () => dealer.open());
  setupJoystick(scene);

  // Per-frame loop: ONLY the things that genuinely change every frame (the work
  // bar while working, the zoom label). The HUD is event-driven via ui.hud() on
  // server messages — writing it every frame caused layout thrashing/jank.
  let lastZoomPct = -1;
  const tick = () => {
    const job = scene.player.job;
    if (job) {
      const work = byId("work");
      work.classList.add("show");
      byId("workTitle").textContent = "Working…";
      byId<HTMLElement>("workFill").style.width = Math.min(100, (job.t / job.dur) * 100) + "%";
    }
    const pct = Math.round(scene.zoom * 100);
    if (pct !== lastZoomPct) {
      byId("zoomLbl").textContent = pct + "%";
      lastZoomPct = pct;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // zoom buttons
  byId("zoomIn").onclick = () => scene.zoomBy(1.18);
  byId("zoomOut").onclick = () => scene.zoomBy(0.85);

  setupVolume();
  setupLiveStats();
  setupIntro(net, chat);

  // CA pill — contract address coming soon
  const caPill = document.getElementById("caPill");
  if (caPill) caPill.addEventListener("click", () => toast("Contract address — coming soon", "$RIV", "Stay tuned · @playmarea"));

  // the help hint is just first-run guidance — let it fade on click or after a
  // while so it never sits on top of the map/quest panel.
  const hintEl = document.getElementById("hint");
  if (hintEl) {
    const hideHint = () => hintEl.classList.add("hide");
    hintEl.addEventListener("click", hideHint);
    setTimeout(hideHint, 15000);
  }
});

function setupVolume(): void {
  const volBtn = byId<HTMLButtonElement>("volBtn");
  const volSlider = byId<HTMLInputElement>("volSlider");
  const volIcon = byId("volIcon");
  const spk = (on: boolean) =>
    on
      ? '<svg width="20" height="18" viewBox="0 0 20 18"><path d="M2 6h3l4-3v12l-4-3H2z" fill="#13343c"/><path d="M12 5a4 4 0 010 8M14.5 3a7 7 0 010 12" stroke="#13343c" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'
      : '<svg width="20" height="18" viewBox="0 0 20 18"><path d="M2 6h3l4-3v12l-4-3H2z" fill="#8a949a"/><path d="M12 6l6 6M18 6l-6 6" stroke="#b04a3a" stroke-width="1.7" stroke-linecap="round"/></svg>';
  volIcon.innerHTML = spk(true);
  setVolume(Number(volSlider.value) / 100);
  volBtn.onclick = () => {
    ensureAudio();
    setMuted(!isMuted());
    volIcon.innerHTML = spk(!isMuted());
  };
  volSlider.oninput = () => {
    ensureAudio();
    const v = Number(volSlider.value) / 100;
    if (v > 0 && isMuted()) {
      setMuted(false);
      volIcon.innerHTML = spk(true);
    }
    setVolume(v);
  };
}

function setupIntro(net: NetClient, chat: { addLine: (from: string, text: string) => void }): void {
  const intro = byId("intro");
  const nameIn = byId<HTMLInputElement>("nameIn");
  const goBtn = byId<HTMLButtonElement>("goBtn");
  const err = byId("introErr");

  // remember the last session (name / look / wallet) so returning players skip
  // the intro and auto-reconnect on refresh.
  const SAVE_KEY = "marea.session";
  type Session = { name: string; look: string; wallet: string; walletName?: string };
  const saved: Session | null = (() => {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as Session | null;
    } catch {
      return null;
    }
  })();

  // avatar picker — render each character with the real draw routine so faces,
  // skin tones and hair styles are visible.
  let selectedLook = saved?.look && LOOKS.some((l) => l.id === saved.look) ? saved.look : STARTING_LOOK;
  if (saved?.name) nameIn.value = saved.name;
  const picker = byId("lookPicker");
  picker.innerHTML = "";
  LOOKS.forEach((l) => {
    const btn = document.createElement("button");
    btn.className = "swatch-look" + (l.id === selectedLook ? " sel" : "");
    btn.title = l.name;
    const cv = document.createElement("canvas");
    cv.width = 44;
    cv.height = 52;
    const c = cv.getContext("2d");
    if (c) drawPerson(c, { name: "", equipped: "tender_used", look: l.id, bubble: null }, 22, 48, false, true);
    btn.appendChild(cv);
    btn.onclick = () => {
      selectedLook = l.id;
      picker.querySelectorAll(".swatch-look").forEach((x) => x.classList.toggle("sel", x === btn));
    };
    picker.appendChild(btn);
  });

  const walletChoose = byId("walletChoose");

  // keep a live list of installed Solana wallets (they register asynchronously)
  let wallets = getSolanaWallets();
  subscribeWallets(() => {
    wallets = getSolanaWallets();
  });

  // join the harbor with a resolved wallet address, remember the session, hide intro
  const finishEnter = async (address: string, nm: string, walletName: string | undefined, back: boolean) => {
    const name = nm.slice(0, 14);
    err.style.color = "var(--ink-soft)";
    err.textContent = back ? "Welcome back — entering…" : "Entering the harbor…";
    await net.connect(name, address, selectedLook);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ name, look: selectedLook, wallet: address, walletName }));
    } catch {
      /* storage may be blocked — non-fatal */
    }
    intro.classList.add("hide");
    ensureAudio();
    chat.addLine("system", `Welcome ${back ? "back " : ""}to Marea, ${name}.`);
  };

  // connect a specific wallet (popup), then enter the harbor with its public key
  const enterWith = async (wallet: Wallet, nm: string) => {
    goBtn.disabled = true;
    walletChoose.classList.remove("show");
    err.style.color = "var(--ink-soft)";
    err.textContent = `Connecting ${wallet.name}…`;
    toast(`Approve the connection in ${wallet.name}`, "Connect Wallet", "Read-only · no transaction");
    try {
      const address = await connectWallet(wallet);
      await finishEnter(address, nm, wallet.name, false);
    } catch (e) {
      err.style.color = "#b04a3a";
      const msg = e instanceof Error ? e.message : "Wallet connection was cancelled.";
      err.textContent = msg;
      toast(msg, "Wallet", "");
      goBtn.disabled = false;
    }
  };

  // returning player: silently reconnect the saved wallet (no popup) and enter.
  // Falls back to the manual intro if it isn't pre-authorized.
  const tryAutoLogin = async () => {
    if (!saved?.wallet) return;
    err.style.color = "var(--ink-soft)";
    err.textContent = "Reconnecting…";
    // wallets register asynchronously after load — wait briefly for them
    for (let i = 0; i < 24 && getSolanaWallets().length === 0; i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    const list = getSolanaWallets();
    const w = list.find((x) => x.name === saved.walletName) ?? list[0];
    if (!w) {
      err.textContent = "";
      return;
    }
    const address = await silentConnect(w.wallet);
    if (!address) {
      err.textContent = ""; // not pre-authorized → user connects manually
      return;
    }
    try {
      await finishEnter(address, saved.name || "Sailor", w.name, true);
    } catch {
      err.style.color = "#b04a3a";
      err.textContent = "Couldn't auto-enter — tap Connect to continue.";
    }
  };

  const start = () => {
    // A name is nice-to-have, not a blocker. Defaulting it means "Connect Wallet"
    // ALWAYS opens the wallet prompt (standard wallet-first UX) instead of
    // dead-ending on an empty field. The server also defaults a blank name.
    const nm = nameIn.value.trim() || "Sailor";
    err.style.color = "#b04a3a";
    wallets = getSolanaWallets();
    if (wallets.length === 0) {
      err.innerHTML =
        'No Solana wallet detected. Install <a href="https://phantom.app" target="_blank" rel="noopener">Phantom</a>, Solflare or Backpack, then reload this page.';
      toast("No Solana wallet detected", "Connect Wallet", "Install Phantom, then reload");
      return;
    }
    if (wallets.length === 1) {
      void enterWith(wallets[0].wallet, nm);
      return;
    }
    // multiple wallets → let the player choose
    walletChoose.innerHTML =
      '<div class="wc-label">Choose a wallet</div>' +
      wallets.map((w, i) => `<button class="wc-btn" data-i="${i}"><img src="${w.icon}" alt="" />${w.name}</button>`).join("");
    walletChoose.classList.add("show");
    walletChoose.querySelectorAll<HTMLButtonElement>(".wc-btn").forEach((b) => {
      b.onclick = () => void enterWith(wallets[Number(b.dataset.i)].wallet, nm);
    });
  };

  goBtn.onclick = start;
  nameIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") start();
  });

  // returning player? try to silently reconnect and skip the intro entirely.
  void tryAutoLogin();
}
