import Phaser from "phaser";
import {
  MAP,
  MOVE_TILES_PER_SEC,
  STARTING_VEHICLE,
  STARTING_CREDITS,
  STARTING_LOOK,
  LOOKS,
  type StationKind,
} from "@marea/shared";
import { cartToWorld, screenToTile, TILE_PX, type ScreenPoint, type Tile } from "../iso/iso";
import { walkable, propAt, berthAt, pathTo, inBounds } from "../world";
import {
  quayTile,
  waterTile,
  drawVilla,
  drawPalm,
  drawDealerProp,
  drawStation,
  drawCafe,
  drawLamp,
  drawCar,
  drawStall,
  drawFountain,
  drawBoatParked,
  drawPerson,
} from "../render/draw";

const ZMIN = 0.28; // zoom out far enough to see (nearly) the whole map
const ZMAX = 2.2;

export interface LocalPlayer {
  name: string;
  tile: Tile;
  pos: { x: number; y: number };
  path: Tile[];
  equipped: string;
  look: string;
  job: { dur: number; t: number } | null;
  bubble: { text: string; t: number } | null;
  // owner-only economic state — mirrored from server messages in later phases.
  credits: number;
  owned: string[];
  finds: string[];
  villaOwned: string | null;
  berths: string[];
}

export interface RemotePlayer {
  name: string;
  // render-interp position, lerped toward the server-tweened target.
  pos: { x: number; y: number };
  target: { x: number; y: number };
  equipped: string;
  look: string;
  bubble: { text: string; t: number } | null;
}

// Client-only ambient resident — decorative wanderer, not synced and not in any
// gameplay (leaderboard etc.). Makes the harbor feel lived-in.
export interface AmbientNpc {
  name: string;
  tile: Tile;
  pos: { x: number; y: number };
  path: Tile[];
  equipped: string;
  look: string;
  wait: number;
  bubble: { text: string; t: number } | null;
}

// Public ownership markers mirrored from the room schema (Phase 4); empty in Phase 0.
export interface EstateMarkers {
  villaOwners: Map<string, string>; // "x,y" -> name
  berthOwners: Map<string, string>; // berthId -> name
}

export class HarborScene extends Phaser.Scene {
  private ctx!: CanvasRenderingContext2D;
  readonly cam: ScreenPoint = { x: 0, y: 0 };
  zoom = 1;
  zoomTarget = 1;
  private tsec = 0;
  private hover: Tile | null = null;
  private marker: { x: number; y: number; t: number } | null = null;
  private pointerDown = false;
  private dragTile: Tile | null = null;

  // networked mode: the server owns position; we lerp toward its tweened values.
  networked = false;
  private serverTarget: { x: number; y: number } | null = null;

  readonly player: LocalPlayer = {
    name: "you",
    tile: { ...MAP.spawn },
    pos: { ...MAP.spawn },
    path: [],
    equipped: STARTING_VEHICLE,
    look: STARTING_LOOK,
    job: null,
    bubble: null,
    credits: STARTING_CREDITS,
    owned: [STARTING_VEHICLE],
    finds: [],
    villaOwned: null,
    berths: [],
  };
  readonly remotePlayers = new Map<string, RemotePlayer>();
  readonly npcs: AmbientNpc[] = [];
  readonly estate: EstateMarkers = { villaOwners: new Map(), berthOwners: new Map() };

  // Hooks the net/UI layers plug into. Default to local behaviour (Phase 0).
  onTravelIntent: ((t: Tile) => void) | null = null;
  onContextChange: (() => void) | null = null;

  constructor() {
    super("harbor");
  }

  create(): void {
    const renderer = this.game.renderer as Phaser.Renderer.Canvas.CanvasRenderer;
    this.ctx = renderer.gameContext;
    const sp = cartToWorld(MAP.spawn.x, MAP.spawn.y);
    this.cam.x = sp.x;
    this.cam.y = sp.y;

    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.POST_RENDER, this.draw, this);
    });

    this.bindInput();
    this.spawnNpcs(12);
  }

  // ---- ambient residents (client-only decoration) ----
  private static readonly NPC_NAMES = [
    "marco", "lucia", "dario", "sofia", "enzo", "bianca", "remy",
    "nina", "leo", "cira", "vito", "aria", "gino", "mila",
  ];
  private static readonly NPC_VEHICLES = [
    "scooter_city", "runabout_classic", "roadster", "cruiser_sport", "tender_used", "mega_yacht",
  ];

  private randomWalkableNear(cx: number, cy: number, r: number): Tile | null {
    for (let i = 0; i < 60; i++) {
      const x = cx + Math.floor(Math.random() * (2 * r + 1)) - r;
      const y = cy + Math.floor(Math.random() * (2 * r + 1)) - r;
      if (walkable(x, y)) return { x, y };
    }
    return null;
  }

  private spawnNpcs(n: number): void {
    const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
    for (let i = 0; i < n; i++) {
      const t = this.randomWalkableNear(MAP.spawn.x, MAP.spawn.y, 14);
      if (!t) continue;
      this.npcs.push({
        name: pick(HarborScene.NPC_NAMES),
        tile: { ...t },
        pos: { ...t },
        path: [],
        equipped: pick(HarborScene.NPC_VEHICLES),
        look: pick(LOOKS).id,
        wait: Math.random() * 3,
        bubble: null,
      });
    }
  }

  private stepNpcs(dt: number): void {
    for (const n of this.npcs) {
      if (n.path.length) {
        this.stepMover(n, dt);
      } else {
        n.wait -= dt;
        if (n.wait <= 0) {
          const t = this.randomWalkableNear(n.tile.x, n.tile.y, 8);
          if (t) {
            const p = pathTo(n.tile.x, n.tile.y, t.x, t.y);
            if (p) n.path = p;
          }
          n.wait = 1.5 + Math.random() * 3;
        }
      }
      if (n.bubble) {
        n.bubble.t -= dt;
        if (n.bubble.t <= 0) n.bubble = null;
      }
    }
  }

  // ---- input (manual; we own rendering, so DOM listeners are simplest) ----
  private get cssW() { return this.scale.width; }
  private get cssH() { return this.scale.height; }

  private toTile(clientX: number, clientY: number): Tile {
    const canvas = this.game.canvas;
    const r = canvas.getBoundingClientRect();
    return screenToTile(clientX - r.left, clientY - r.top, this.cam, this.zoom, this.cssW, this.cssH);
  }

  private bindInput(): void {
    const canvas = this.game.canvas;

    canvas.addEventListener("mousemove", (e) => {
      this.hover = this.toTile(e.clientX, e.clientY);
      if (this.pointerDown && !this.player.job) {
        const t = this.hover;
        if (walkable(t.x, t.y) && (!this.dragTile || this.dragTile.x !== t.x || this.dragTile.y !== t.y)) {
          this.dragTile = t;
          this.travelTo(t.x, t.y, false);
        }
      }
    });
    canvas.addEventListener("mouseleave", () => {
      this.hover = null;
      this.pointerDown = false;
    });
    canvas.addEventListener("mousedown", (e) => this.pointerStart(e.clientX, e.clientY));
    window.addEventListener("mouseup", () => {
      this.pointerDown = false;
      this.dragTile = null;
    });

    canvas.addEventListener(
      "touchstart",
      (e) => {
        const tp = e.touches[0];
        if (tp) this.pointerStart(tp.clientX, tp.clientY);
      },
      { passive: true }
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        const tp = e.touches[0];
        if (!tp || this.player.job) return;
        const t = this.toTile(tp.clientX, tp.clientY);
        if (walkable(t.x, t.y) && (!this.dragTile || this.dragTile.x !== t.x || this.dragTile.y !== t.y)) {
          this.dragTile = t;
          this.travelTo(t.x, t.y, false);
        }
      },
      { passive: true }
    );
    window.addEventListener("touchend", () => {
      this.pointerDown = false;
      this.dragTile = null;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomTarget = Math.max(ZMIN, Math.min(ZMAX, this.zoomTarget * (e.deltaY < 0 ? 1.12 : 0.89)));
      },
      { passive: false }
    );
  }

  private pointerStart(clientX: number, clientY: number): void {
    this.pointerDown = true;
    this.dragTile = null;
    if (this.player.job) return;
    const t = this.toTile(clientX, clientY);
    if (!inBounds(t.x, t.y)) return;
    if (propAt(t.x, t.y) || berthAt(t.x, t.y) || walkable(t.x, t.y)) {
      this.travelTo(t.x, t.y, true);
    }
  }

  zoomBy(factor: number): void {
    this.zoomTarget = Math.max(ZMIN, Math.min(ZMAX, this.zoomTarget * factor));
  }

  // Walk toward a tile. The server is the authority on reachability, so in
  // networked mode we ALWAYS send the intent (and let the server resolve the
  // path / approach). The local path is only used for instant feel offline and
  // for the destination marker.
  travelTo(tx: number, ty: number, setMarker: boolean): void {
    if (this.player.job) return;
    if (!inBounds(tx, ty)) return;
    const p = pathTo(this.player.tile.x, this.player.tile.y, tx, ty);
    if (!this.networked) {
      if (!p) return;
      this.player.path = p;
    }
    if (setMarker && p && p.length) {
      const end = p[p.length - 1];
      this.marker = { x: end.x, y: end.y, t: 0 };
    } else if (setMarker) {
      this.marker = { x: tx, y: ty, t: 0 };
    }
    if (this.onTravelIntent) this.onTravelIntent({ x: tx, y: ty });
  }

  // Analog steering from the on-screen joystick. Converts a normalized
  // screen-space direction into a grid target a few tiles ahead and walks there.
  steer(screenDx: number, screenDy: number): void {
    if (this.player.job) return;
    const reach = 6;
    // top-down: screen direction maps straight to grid direction
    const len = Math.hypot(screenDx, screenDy) || 1;
    const tx = Math.round(this.player.tile.x + (screenDx / len) * reach);
    const ty = Math.round(this.player.tile.y + (screenDy / len) * reach);
    this.travelTo(tx, ty, false);
  }

  // ---- net-driven mutators (called by the room sync) ----
  applySelf(rx: number, ry: number, gx: number, gy: number, equipped: string, look: string): void {
    this.serverTarget = { x: rx, y: ry };
    this.player.tile = { x: gx, y: gy };
    this.player.equipped = equipped;
    this.player.look = look;
  }
  upsertRemote(id: string, name: string, rx: number, ry: number, equipped: string, look: string): void {
    let r = this.remotePlayers.get(id);
    if (!r) {
      r = { name, pos: { x: rx, y: ry }, target: { x: rx, y: ry }, equipped, look, bubble: null };
      this.remotePlayers.set(id, r);
    } else {
      r.name = name;
      r.equipped = equipped;
      r.look = look;
      r.target = { x: rx, y: ry };
    }
  }
  removeRemote(id: string): void {
    this.remotePlayers.delete(id);
  }
  setRemoteBubble(id: string, text: string): void {
    const r = this.remotePlayers.get(id);
    if (r) r.bubble = { text, t: 3 };
  }
  beginJob(dur: number): void {
    this.player.job = { dur, t: 0 };
  }
  clearJob(): void {
    this.player.job = null;
  }

  // ---- simulation (local feel) ----
  private stepMover(m: { pos: { x: number; y: number }; tile: Tile; path: Tile[] }, dt: number): void {
    if (!m.path.length) return;
    const nx = m.path[0];
    const dx = nx.x - m.pos.x,
      dy = nx.y - m.pos.y;
    const d = Math.hypot(dx, dy),
      s = MOVE_TILES_PER_SEC * dt;
    if (d <= s) {
      m.pos.x = nx.x;
      m.pos.y = nx.y;
      m.tile = { x: nx.x, y: nx.y };
      m.path.shift();
    } else {
      m.pos.x += (dx / d) * s;
      m.pos.y += (dy / d) * s;
    }
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.tsec += dt;

    if (this.networked) {
      // server-owned position: lerp toward the latest tweened target
      if (this.serverTarget) {
        const k = Math.min(1, dt * 16);
        this.player.pos.x += (this.serverTarget.x - this.player.pos.x) * k;
        this.player.pos.y += (this.serverTarget.y - this.player.pos.y) * k;
      }
      // local visual job progress (server owns completion via job_done)
      if (this.player.job && this.player.job.t < this.player.job.dur) {
        this.player.job.t = Math.min(this.player.job.dur, this.player.job.t + dt);
      }
    } else {
      this.stepMover(this.player, dt);
    }
    for (const r of this.remotePlayers.values()) {
      const k = Math.min(1, dt * 16);
      r.pos.x += (r.target.x - r.pos.x) * k;
      r.pos.y += (r.target.y - r.pos.y) * k;
    }
    this.stepNpcs(dt);

    if (this.player.bubble) {
      this.player.bubble.t -= dt;
      if (this.player.bubble.t <= 0) this.player.bubble = null;
    }
    for (const r of this.remotePlayers.values()) {
      if (r.bubble) {
        r.bubble.t -= dt;
        if (r.bubble.t <= 0) r.bubble = null;
      }
    }
    if (this.marker) {
      this.marker.t += dt;
      if (this.marker.t > 1.1) this.marker = null;
    }

    const pw = cartToWorld(this.player.pos.x, this.player.pos.y);
    this.cam.x += (pw.x - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (pw.y - this.cam.y) * Math.min(1, dt * 6);
    if (Math.abs(this.zoom - this.zoomTarget) > 0.001) {
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 10);
    }
  }

  // ---- rendering (top-down 2D) ----
  private draw(): void {
    const ctx = this.ctx;
    const W = this.cssW,
      H = this.cssH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // open sea fills everything beyond the map (no empty void when zoomed out)
    ctx.fillStyle = "#1c8aa0";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const T = TILE_PX;
    const hw = W / 2 / this.zoom,
      hh = H / 2 / this.zoom;
    // visible tile range (cull)
    const cx0 = Math.max(0, Math.floor((this.cam.x - hw) / T) - 1);
    const cx1 = Math.min(MAP.grid - 1, Math.ceil((this.cam.x + hw) / T) + 1);
    const cy0 = Math.max(0, Math.floor((this.cam.y - hh) / T) - 1);
    const cy1 = Math.min(MAP.grid - 1, Math.ceil((this.cam.y + hh) / T) + 1);
    const vis = (wx: number, wy: number) =>
      wx >= this.cam.x - hw - T && wx <= this.cam.x + hw + T && wy >= this.cam.y - hh - T && wy <= this.cam.y + hh + T;

    // ground tiles
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const ox = cx * T,
          oy = cy * T;
        if (MAP.tiles[cy][cx] === "water") waterTile(ctx, cx, cy, ox, oy, this.tsec);
        else quayTile(ctx, cx, cy, ox, oy);
      }
    }

    if (this.hover && walkable(this.hover.x, this.hover.y)) {
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.strokeStyle = "rgba(255,255,255,.6)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(this.hover.x * T, this.hover.y * T, T, T);
      ctx.strokeRect(this.hover.x * T + 0.5, this.hover.y * T + 0.5, T, T);
    }
    if (this.marker) {
      const w = cartToWorld(this.marker.x, this.marker.y);
      const r = 10 + Math.sin(this.marker.t * 8) * 2;
      ctx.strokeStyle = "rgba(231,196,107,.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, 7);
      ctx.stroke();
    }

    // depth-sorted objects (by world y so lower things draw on top)
    const objs: { d: number; fn: () => void }[] = [];
    for (const p of MAP.props) {
      const w = cartToWorld(p.x, p.y);
      if (!vis(w.x, w.y)) continue;
      objs.push({
        d: p.y,
        fn: () => {
          switch (p.kind) {
            case "villa": {
              const owner = this.estate.villaOwners.get(p.x + "," + p.y) ?? this.localVillaOwner(p.x, p.y);
              drawVilla(ctx, { roof: p.roof, forSale: p.forSale && !owner, owner }, w.x, w.y);
              break;
            }
            case "palm": drawPalm(ctx, w.x, w.y); break;
            case "dealer": drawDealerProp(ctx, w.x, w.y); break;
            case "station": drawStation(ctx, p.station as StationKind, w.x, w.y); break;
            case "cafe": drawCafe(ctx, w.x, w.y); break;
            case "lamp": drawLamp(ctx, w.x, w.y, true); break;
            case "car": drawCar(ctx, w.x, w.y, p.col ?? "#b23a2e"); break;
            case "stall": drawStall(ctx, w.x, w.y); break;
            case "fountain": drawFountain(ctx, w.x, w.y, this.tsec); break;
          }
        },
      });
    }
    for (const b of MAP.ambientBoats) {
      const w = cartToWorld(b.x, b.y);
      if (!vis(w.x, w.y)) continue;
      objs.push({ d: b.y - 0.1, fn: () => drawBoatParked(ctx, w.x, w.y, b.tier, b.ph, this.tsec) });
    }
    if (this.player.berths.length) {
      const bb = MAP.berths.find((b) => b.id === this.player.berths[0]);
      if (bb) {
        const w = cartToWorld(bb.x, bb.y);
        if (vis(w.x, w.y))
          objs.push({ d: bb.y - 0.1, fn: () => drawBoatParked(ctx, w.x, w.y, this.player.equipped, 1.2, this.tsec) });
      }
    }
    for (const r of this.remotePlayers.values()) {
      const w = cartToWorld(r.pos.x, r.pos.y);
      if (!vis(w.x, w.y)) continue;
      objs.push({ d: r.pos.y, fn: () => drawPerson(ctx, r, w.x, w.y, false) });
    }
    for (const n of this.npcs) {
      const w = cartToWorld(n.pos.x, n.pos.y);
      if (!vis(w.x, w.y)) continue;
      objs.push({ d: n.pos.y, fn: () => drawPerson(ctx, n, w.x, w.y, false) });
    }
    {
      const w = cartToWorld(this.player.pos.x, this.player.pos.y);
      objs.push({
        d: this.player.pos.y + 0.05,
        fn: () => {
          drawPerson(ctx, this.player, w.x, w.y, true);
          if (this.player.job) {
            const f = this.player.job.t / this.player.job.dur;
            ctx.fillStyle = "rgba(0,0,0,.25)";
            ctx.fillRect(w.x - 18, w.y - 26, 36, 5);
            ctx.fillStyle = "#46c7da";
            ctx.fillRect(w.x - 18, w.y - 26, 36 * f, 5);
          }
        },
      });
    }
    objs.sort((a, b) => a.d - b.d).forEach((o) => o.fn());
    ctx.restore();

    // atmosphere pass (screen space)
    const sunX = W * 0.82,
      sunY = H * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(255,220,150,.22)");
    g.addColorStop(0.5, "rgba(255,190,120,.07)");
    g.addColorStop(1, "rgba(255,180,110,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.6, H * 0.9);
    vg.addColorStop(0, "rgba(40,20,8,0)");
    vg.addColorStop(1, "rgba(40,20,8,.26)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  private localVillaOwner(x: number, y: number): string | null {
    return this.player.villaOwned === x + "," + y ? this.player.name : null;
  }
}
