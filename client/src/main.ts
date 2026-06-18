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
import { setupDealer } from "./ui/dealer";
import { setupDock } from "./ui/dock";
import { setupJoystick } from "./ui/joystick";
import { toast, banner } from "./ui/notify";

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

  const ui: UiBridge = {
    hud: () => updateHud(scene),
    refreshDealer: () => dealer.refresh(),
    chatLine: (from, text) => chat.addLine(from, text),
    toast: (title, kicker, sub) => toast(title, kicker, sub),
    banner: (text) => banner(text),
    leaderboard: (rows) => lead.render(rows),
    error: (msg) => toast(msg, "Harbor", ""),
    workHide: () => byId("work").classList.remove("show"),
  };
  net.setUi(ui);
  setupDock(scene, net, () => dealer.open());
  setupJoystick(scene);

  // HUD + work-bar refresh loop
  const tick = () => {
    updateHud(scene);
    const job = scene.player.job;
    const work = byId("work");
    if (job) {
      work.classList.add("show");
      byId("workTitle").textContent = "Working…";
      byId<HTMLElement>("workFill").style.width = Math.min(100, (job.t / job.dur) * 100) + "%";
    }
    byId("zoomLbl").textContent = Math.round(scene.zoom * 100) + "%";
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // zoom buttons
  byId("zoomIn").onclick = () => scene.zoomBy(1.18);
  byId("zoomOut").onclick = () => scene.zoomBy(0.85);

  setupVolume();
  setupIntro(net, chat);

  // CA pill — contract address coming soon
  const caPill = document.getElementById("caPill");
  if (caPill) caPill.addEventListener("click", () => toast("Contract address — coming soon", "$RIV", "Stay tuned · @playmarea"));
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

  // avatar picker — render each character with the real draw routine so faces,
  // skin tones and hair styles are visible.
  let selectedLook = STARTING_LOOK;
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

  const enter = async () => {
    const nm = nameIn.value.trim();
    if (!nm) {
      err.textContent = "Enter a name to continue.";
      return;
    }
    goBtn.disabled = true;
    err.textContent = "";
    try {
      // Phase 6 will supply the connected wallet address here; dev gate is open.
      await net.connect(nm.slice(0, 14), "", selectedLook);
      intro.classList.add("hide");
      ensureAudio();
      chat.addLine("system", `Welcome to Marea, ${nm.slice(0, 14)}.`);
    } catch (e) {
      err.textContent = e instanceof Error ? e.message : "Could not reach the harbor.";
      goBtn.disabled = false;
    }
  };
  goBtn.onclick = enter;
  nameIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enter();
  });
}
