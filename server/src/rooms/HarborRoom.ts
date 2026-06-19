import { Room, type Client } from "@colyseus/core";
import { MAP, SERVER_TICK_HZ, STARTING_LOOK, lookById, type ClientMessage, type ServerMessage } from "@marea/shared";
import { HarborState, PlayerSchema } from "../schema/HarborState.js";
import type { PrivatePlayer } from "../types.js";
import { requestMove, tickMovement } from "../systems/movement.js";
import { startJob, tickJob } from "../systems/jobs.js";
import { buyVehicle, equipVehicle, sellFind } from "../systems/dealer.js";
import { buyVilla, leaseBerth, tickBerthIncome } from "../systems/estate.js";
import { handleChat } from "../systems/chat.js";
import { leaderboard } from "../systems/leaderboard.js";
import {
  type Repo,
  type PersistedPlayer,
  MemoryRepo,
  freshPlayer,
  offlineBerthIncome,
} from "../db/repo.js";
import { type GateConfig, loadGateConfig, checkGate } from "../solana/gate.js";

interface RoomOptions {
  repo?: Repo;
  gateCfg?: GateConfig;
}
interface JoinOptions {
  name?: string;
  wallet?: string;
  look?: string;
}

const LEADERBOARD_INTERVAL = 2000;
const SAVE_INTERVAL = 2000;

export class HarborRoom extends Room<HarborState> {
  private privates = new Map<string, PrivatePlayer>();
  private repo: Repo = new MemoryRepo();
  private gateCfg: GateConfig = loadGateConfig(process.env);
  private leaderboardTimer = 0;
  private saveTimer = 0;

  onCreate(options: RoomOptions): void {
    if (options.repo) this.repo = options.repo;
    if (options.gateCfg) this.gateCfg = options.gateCfg;
    this.maxClients = 200; // one shared harbor
    this.setState(new HarborState());
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / SERVER_TICK_HZ);

    this.onMessage<ClientMessage>("move", (c, m) => {
      if (m.t === "move") this.withPlayer(c, (priv, sp) => requestMove(priv, sp, m.gridX, m.gridY));
    });
    this.onMessage<ClientMessage>("start_job", (c, m) => {
      if (m.t !== "start_job") return;
      this.withPlayer(c, (priv, sp) => {
        const r = startJob(priv, sp, m.jobId, m.stationId);
        if (!r.ok) this.sendMsg(c, { t: "error", message: r.error });
      });
    });
    this.onMessage<ClientMessage>("buy_vehicle", (c, m) => {
      if (m.t !== "buy_vehicle") return;
      this.withPlayer(c, (priv, sp) => {
        const r = buyVehicle(priv, sp, m.vehicleId);
        if (r.ok) {
          this.sendCredits(c, priv);
          this.sendInventory(c, priv);
        } else this.sendMsg(c, { t: "error", message: r.error });
      });
    });
    this.onMessage<ClientMessage>("equip_vehicle", (c, m) => {
      if (m.t !== "equip_vehicle") return;
      this.withPlayer(c, (priv, sp) => {
        const r = equipVehicle(priv, sp, m.vehicleId);
        if (r.ok) this.sendInventory(c, priv);
        else this.sendMsg(c, { t: "error", message: r.error });
      });
    });
    this.onMessage<ClientMessage>("sell_find", (c, m) => {
      if (m.t !== "sell_find") return;
      this.withPlayer(c, (priv) => {
        const r = sellFind(priv, m.findId);
        if (r.ok) {
          this.sendCredits(c, priv);
          this.sendInventory(c, priv);
        } else this.sendMsg(c, { t: "error", message: r.error });
      });
    });
    this.onMessage<ClientMessage>("buy_villa", (c, m) => {
      if (m.t !== "buy_villa") return;
      this.withPlayer(c, (priv) => {
        const r = buyVilla(priv, this.state, m.villaId);
        if (r.ok) {
          this.sendCredits(c, priv);
          this.sendEstate(c, priv);
        } else this.sendMsg(c, { t: "error", message: r.error });
      });
    });
    this.onMessage<ClientMessage>("lease_berth", (c, m) => {
      if (m.t !== "lease_berth") return;
      this.withPlayer(c, (priv) => {
        const r = leaseBerth(priv, this.state, m.berthId);
        if (r.ok) {
          this.sendCredits(c, priv);
          this.sendEstate(c, priv);
        } else this.sendMsg(c, { t: "error", message: r.error });
      });
    });
    this.onMessage<ClientMessage>("chat", (c, m) => {
      if (m.t !== "chat") return;
      this.withPlayer(c, (priv) => {
        const r = handleChat(priv, m.text, Date.now());
        if (r.ok) this.broadcastMsg({ t: "chat", from: priv.name, text: r.text });
        else this.sendMsg(c, { t: "error", message: r.error });
      });
    });
  }

  async onJoin(client: Client, options: JoinOptions): Promise<void> {
    const rawWallet = (options.wallet ?? "").trim();
    const name = (options.name ?? "").trim().slice(0, 14) || "sailor";

    const gate = await checkGate(this.gateCfg, rawWallet);
    if (!gate.ok) throw new Error(gate.reason ?? "Access denied.");

    // a connected wallet is the identity; only fall back to a guest id when the
    // dev-open gate is active (local testing without a wallet extension)
    const wallet = rawWallet || `guest:${client.sessionId}`;
    this.repo.markSeen(wallet);

    let rec = await this.repo.load(wallet);
    let offline = 0;
    if (!rec) {
      rec = freshPlayer(wallet, name);
    } else {
      offline = offlineBerthIncome(rec);
    }

    // chosen appearance (validated against content); falls back to saved/default
    const look = (options.look && lookById(options.look) ? options.look : rec.look) || STARTING_LOOK;

    const priv: PrivatePlayer = {
      sessionId: client.sessionId,
      wallet,
      name,
      credits: rec.credits + offline,
      owned: [...rec.owned],
      equipped: rec.equipped,
      look,
      finds: [...rec.finds],
      villa: rec.villa,
      berths: [...rec.berths],
      path: [],
      job: null,
      berthFraction: 0,
      lastChatAt: 0,
      dirty: offline > 0,
    };
    this.privates.set(client.sessionId, priv);

    const sp = new PlayerSchema();
    sp.name = name;
    sp.gx = MAP.spawn.x;
    sp.gy = MAP.spawn.y;
    sp.rx = MAP.spawn.x;
    sp.ry = MAP.spawn.y;
    sp.equipped = priv.equipped;
    sp.look = priv.look;
    this.state.players.set(client.sessionId, sp);

    // re-apply owned estate to the PUBLIC schema
    if (priv.villa) this.state.villaOwners.set(priv.villa, name);
    for (const berthId of priv.berths) this.state.berthOwners.set(berthId, name);

    // owner-only initial private state
    this.sendCredits(client, priv);
    this.sendInventory(client, priv);
    this.sendEstate(client, priv);
    if (offline > 0) this.sendMsg(client, { t: "welcome_back", offlineEarned: offline });

    this.state.online = this.state.players.size;
    this.state.totalUsers = this.repo.totalUsers();
  }

  async onLeave(client: Client): Promise<void> {
    const priv = this.privates.get(client.sessionId);
    if (priv) {
      await this.repo.save(this.toPersisted(priv));
      this.privates.delete(client.sessionId);
    }
    this.state.players.delete(client.sessionId);
    this.state.online = this.state.players.size;
  }

  // ---- simulation ----
  private tick(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const [sessionId, priv] of this.privates) {
      const sp = this.state.players.get(sessionId);
      if (!sp) continue;
      tickMovement(priv, sp, dt);

      const completion = tickJob(priv, dt);
      if (completion) {
        const client = this.clientById(sessionId);
        if (client) {
          this.sendMsg(client, { t: "job_done", payout: completion.payout, find: completion.find });
          this.sendCredits(client, priv);
          this.sendInventory(client, priv);
        }
        if (completion.find && completion.rare) {
          const f = completion.find;
          this.broadcastMsg({ t: "announce", text: `${priv.name} surfaced a rare find worth ${f.sell} Credits — the whole quay just saw it.` });
        }
      }

      if (tickBerthIncome(priv, dt)) {
        const client = this.clientById(sessionId);
        if (client) this.sendCredits(client, priv);
      }
    }

    this.leaderboardTimer += dtMs;
    if (this.leaderboardTimer >= LEADERBOARD_INTERVAL) {
      this.leaderboardTimer = 0;
      this.broadcastMsg({ t: "leaderboard", rows: leaderboard(this.privates.values()) });
    }

    this.saveTimer += dtMs;
    if (this.saveTimer >= SAVE_INTERVAL) {
      this.saveTimer = 0;
      void this.flushDirty();
    }
  }

  private async flushDirty(): Promise<void> {
    for (const priv of this.privates.values()) {
      if (!priv.dirty) continue;
      priv.dirty = false;
      await this.repo.save(this.toPersisted(priv));
    }
  }

  // ---- helpers ----
  private withPlayer(client: Client, fn: (priv: PrivatePlayer, sp: PlayerSchema) => void): void {
    const priv = this.privates.get(client.sessionId);
    const sp = this.state.players.get(client.sessionId);
    if (priv && sp) fn(priv, sp);
  }

  private clientById(sessionId: string): Client | undefined {
    return this.clients.find((c) => c.sessionId === sessionId);
  }

  private sendMsg(client: Client, msg: ServerMessage): void {
    client.send(msg.t, msg);
  }

  private broadcastMsg(msg: ServerMessage): void {
    this.broadcast(msg.t, msg);
  }

  private sendCredits(client: Client, priv: PrivatePlayer): void {
    this.sendMsg(client, { t: "credits", credits: Math.floor(priv.credits) });
  }
  private sendInventory(client: Client, priv: PrivatePlayer): void {
    this.sendMsg(client, { t: "inventory", owned: [...priv.owned], equipped: priv.equipped, finds: [...priv.finds] });
  }
  private sendEstate(client: Client, priv: PrivatePlayer): void {
    this.sendMsg(client, { t: "estate", villa: priv.villa, berths: [...priv.berths] });
  }

  private toPersisted(priv: PrivatePlayer): PersistedPlayer {
    return {
      wallet: priv.wallet,
      name: priv.name,
      credits: Math.floor(priv.credits),
      equipped: priv.equipped,
      look: priv.look,
      owned: [...priv.owned],
      finds: [...priv.finds],
      villa: priv.villa,
      berths: [...priv.berths],
      lastSeen: Date.now(),
    };
  }
}
