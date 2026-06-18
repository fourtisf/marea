import Phaser from "phaser";
import { HarborScene } from "./scenes/HarborScene";
import { setupMinimap } from "./ui/minimap";
import { updateHud } from "./ui/hud";
import { ensureAudio, setVolume, setMuted, isMuted } from "./ui/audio";

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  transparent: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
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

  // HUD refresh loop (cheap; reads local mirror of state).
  const hudTick = () => {
    updateHud(scene);
    requestAnimationFrame(hudTick);
  };
  requestAnimationFrame(hudTick);

  // zoom buttons
  byId("zoomIn").onclick = () => scene.zoomBy(1.18);
  byId("zoomOut").onclick = () => scene.zoomBy(0.85);
  const updateZoomLabel = () => {
    byId("zoomLbl").textContent = Math.round(scene.zoom * 100) + "%";
    requestAnimationFrame(updateZoomLabel);
  };
  requestAnimationFrame(updateZoomLabel);

  // volume
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

  // intro / enter gate (Phase 0: local. Phase 6 swaps in the wallet + $RIV check.)
  const intro = byId("intro");
  const nameIn = byId<HTMLInputElement>("nameIn");
  const goBtn = byId<HTMLButtonElement>("goBtn");
  goBtn.onclick = () => {
    const nm = nameIn.value.trim();
    if (!nm) {
      byId("introErr").textContent = "Enter a name to continue.";
      return;
    }
    scene.player.name = nm.slice(0, 14);
    intro.classList.add("hide");
    ensureAudio();
  };
  nameIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") goBtn.click();
  });
});
