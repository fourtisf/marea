import { MAP, type StationKind } from "@marea/shared";
import { STATION_COLOR } from "../render/draw";
import type { HarborScene } from "../scenes/HarborScene";

// Minimap: a baked base layer (tiles + villa roofs) plus a live overlay of
// stations, dealer, remote players and the local player. Click to travel.
export function setupMinimap(scene: HarborScene): void {
  const mini = document.getElementById("mini") as HTMLCanvasElement;
  const mctx = mini.getContext("2d")!;
  const G = MAP.grid;
  const MS = mini.width / G;

  const base = document.createElement("canvas");
  base.width = mini.width;
  base.height = mini.height;
  const bctx = base.getContext("2d")!;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      bctx.fillStyle = MAP.tiles[y][x] === "water" ? "#2cb4cc" : "#e8d39e";
      bctx.fillRect(x * MS, y * MS, Math.ceil(MS), Math.ceil(MS));
    }
  for (const p of MAP.props) {
    if (p.kind === "villa") {
      bctx.fillStyle = p.roof;
      bctx.fillRect(p.x * MS, p.y * MS, Math.ceil(MS) + 1, Math.ceil(MS) + 1);
    }
  }

  mini.addEventListener("click", (e) => {
    const r = mini.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * G);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * G);
    scene.travelTo(tx, ty, true);
  });

  function frame() {
    mctx.clearRect(0, 0, mini.width, mini.height);
    mctx.drawImage(base, 0, 0);
    for (const p of MAP.props) {
      if (p.kind === "dealer") {
        mctx.fillStyle = "#15323b";
        mctx.fillRect(p.x * MS - 1, p.y * MS - 1, 4, 4);
      } else if (p.kind === "station") {
        mctx.fillStyle = STATION_COLOR[p.station as StationKind];
        mctx.fillRect(p.x * MS, p.y * MS, 3, 3);
      }
    }
    mctx.fillStyle = "rgba(120,120,130,.9)";
    for (const r of scene.remotePlayers.values()) mctx.fillRect(r.pos.x * MS, r.pos.y * MS, 2.4, 2.4);
    const pp = scene.player.pos;
    mctx.fillStyle = "#c9a24a";
    mctx.beginPath();
    mctx.arc(pp.x * MS, pp.y * MS, 3, 0, 7);
    mctx.fill();
    mctx.strokeStyle = "#15323b";
    mctx.lineWidth = 1;
    mctx.stroke();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
