import { Client, Room, getStateCallbacks } from "colyseus.js";
import { questById, FISH_DUR, type ClientMessage, type LeaderboardRow, type ServerMessage } from "@marea/shared";
import type { HarborScene } from "../scenes/HarborScene";
import { sfx } from "../ui/audio";

// The UI surfaces the room drives. main.ts supplies the implementations.
export interface UiBridge {
  hud(): void;
  refreshDealer(): void;
  chatLine(from: string, text: string): void;
  toast(title: string, kicker: string, sub: string): void;
  banner(text: string): void;
  leaderboard(rows: LeaderboardRow[]): void;
  error(msg: string): void;
  workHide(): void;
  quests(): void;
}

// In dev, set VITE_SERVER_URL (client/.env.development → ws://localhost:2567).
// In production the client is served same-origin by the server behind nginx, so
// we connect to the same host/port as the page — works for both http→ws and
// https→wss with no rebuild when SSL is added.
const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

export class NetClient {
  private room: Room | null = null;
  private ui!: UiBridge; // set via setUi before connect()
  constructor(private scene: HarborScene) {}

  setUi(ui: UiBridge): void {
    this.ui = ui;
  }

  async connect(name: string, wallet: string, look: string): Promise<void> {
    const client = new Client(SERVER_URL);
    // joinOrCreate rejects (throws) if the server's gate denies entry.
    const room = await client.joinOrCreate("harbor", { name, wallet, look });
    this.room = room;
    this.scene.networked = true;
    this.scene.onTravelIntent = (t) => this.send({ t: "move", gridX: t.x, gridY: t.y });
    this.bindState(room);
    this.bindMessages(room);
  }

  send(msg: ClientMessage): void {
    this.room?.send(msg.t, msg);
  }

  startJob(jobId: string, stationId: string, dur: number): void {
    this.scene.beginJob(dur);
    this.send({ t: "start_job", jobId, stationId });
  }

  cast(): void {
    this.scene.beginJob(FISH_DUR);
    this.send({ t: "cast" });
  }

  private bindState(room: Room): void {
    const $ = getStateCallbacks(room);
    const state = $(room.state);

    state.players.onAdd((player: any, sid: string) => {
      const apply = () => {
        if (sid === room.sessionId) {
          this.scene.applySelf(player.rx, player.ry, player.gx, player.gy, player.equipped, player.look);
        } else {
          this.scene.upsertRemote(sid, player.name, player.rx, player.ry, player.equipped, player.look);
        }
      };
      apply();
      $(player).onChange(apply);
    });
    state.players.onRemove((_player: any, sid: string) => {
      if (sid !== room.sessionId) this.scene.removeRemote(sid);
    });

    state.villaOwners.onAdd((name: string, key: string) => this.scene.estate.villaOwners.set(key, name));
    state.villaOwners.onRemove((_v: string, key: string) => this.scene.estate.villaOwners.delete(key));
    state.berthOwners.onAdd((name: string, key: string) => this.scene.estate.berthOwners.set(key, name));
    state.berthOwners.onRemove((_v: string, key: string) => this.scene.estate.berthOwners.delete(key));

    this.scene.online = room.state.online ?? 0;
    this.scene.totalUsers = room.state.totalUsers ?? 0;
    state.listen("online", (v: number) => { this.scene.online = v; this.ui.hud(); });
    state.listen("totalUsers", (v: number) => { this.scene.totalUsers = v; this.ui.hud(); });
  }

  private bindMessages(room: Room): void {
    const on = <T extends ServerMessage["t"]>(t: T, cb: (m: Extract<ServerMessage, { t: T }>) => void) =>
      room.onMessage(t, cb as (m: unknown) => void);

    on("credits", (m) => {
      const delta = m.credits - this.scene.player.credits;
      this.scene.player.credits = m.credits;
      // float a "+N" over the player for meaningful gains (skip tiny berth drips)
      if (delta >= 8) this.scene.popFloater("+" + delta.toLocaleString("en-US"));
      this.ui.hud();
      this.ui.refreshDealer();
    });
    on("inventory", (m) => {
      this.scene.player.owned = m.owned;
      this.scene.player.equipped = m.equipped;
      this.scene.player.finds = m.finds;
      this.ui.hud();
      this.ui.refreshDealer();
    });
    on("estate", (m) => {
      this.scene.player.villaOwned = m.villa;
      this.scene.player.berths = m.berths;
      this.ui.hud();
      this.ui.refreshDealer();
    });
    on("job_done", (m) => {
      this.scene.clearJob();
      this.ui.workHide();
      if (m.find) {
        const rare = m.find.id === "find_plate" || m.find.id === "find_ring";
        this.ui.toast(findName(m.find.id), "Discovery", `Worth ${m.find.sell.toLocaleString("en-US")} cr at the Dealer`);
        rare ? sfx.rare() : sfx.find();
      } else {
        sfx.job();
      }
    });
    on("welcome_back", (m) => {
      this.ui.toast(`+${m.offlineEarned.toLocaleString("en-US")} Credits`, "While you were away", "Your berths earned for you");
    });
    on("progress", (m) => {
      this.scene.xp = m.xp;
      this.scene.level = m.level;
      this.scene.quests = m.quests;
      this.scene.questsDone = m.done;
      this.ui.hud();
      this.ui.quests();
    });
    on("quest_done", (m) => {
      const def = questById(m.id);
      const reward = m.credits ? `+${m.xp} XP · +${m.credits} Credits` : `+${m.xp} XP`;
      this.ui.toast(def?.label ?? "Quest complete", "Quest complete", reward);
      sfx.rare();
    });
    on("level_up", (m) => {
      this.ui.banner(`You reached <b>Level ${m.level}</b>`);
      sfx.rare();
    });
    on("announce", (m) => this.ui.banner(m.text));
    on("leaderboard", (m) => this.ui.leaderboard(m.rows));
    on("chat", (m) => {
      this.ui.chatLine(m.from, m.text);
      // best-effort speech bubble by matching name
      if (m.from === this.scene.player.name) {
        this.scene.player.bubble = { text: m.text, t: 3 };
      } else {
        for (const [id, r] of this.scene.remotePlayers) {
          if (r.name === m.from) {
            this.scene.setRemoteBubble(id, m.text);
            break;
          }
        }
      }
    });
    on("error", (m) => {
      // an optimistic job may have been rejected; clear the visual
      this.scene.clearJob();
      this.ui.workHide();
      this.ui.error(m.message);
    });
  }
}

import { findById } from "@marea/shared";
const findName = (id: string) => findById(id)?.name ?? id;
