import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { HarborRoom } from "./rooms/HarborRoom.js";
import { MemoryRepo, type Repo } from "./db/repo.js";
import { FileRepo } from "./db/fileRepo.js";
import { loadGateConfig } from "./solana/gate.js";

const PORT = Number(process.env.PORT ?? "2567");

// Player data is persisted to a JSON file by default (survives restarts and
// deploys); set MAREA_DATA_FILE to relocate it. Falls back to in-memory only if
// a repo can't be created. Built before the routes so /stats can read it.
const dataFile = process.env.MAREA_DATA_FILE ?? resolve(process.cwd(), "data/marea.json");
let repo: Repo;
try {
  repo = new FileRepo(dataFile);
  console.log(`Persistence: file repo at ${dataFile}`);
} catch (e) {
  console.error("Persistence: file repo unavailable, using in-memory (data will NOT survive restarts).", e);
  repo = new MemoryRepo();
}
const gateCfg = loadGateConfig(process.env);

// live online count (the room keeps this fresh; total players is read live from
// the repo so it's correct immediately after a restart, before anyone joins).
const stats = { online: 0, totalUsers: 0 };

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "marea", ts: Date.now() });
});
app.get("/stats", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ online: stats.online, totalUsers: repo.totalUsers() });
});

// Serve the built client (same-origin with the game server). In production the
// whole domain sits behind nginx, which proxies everything here. Colyseus owns
// its own matchmaking/WS routes; Express only serves the static client.
const here = dirname(fileURLToPath(import.meta.url)); // server/dist
const clientDist = process.env.CLIENT_DIST
  ? resolve(process.env.CLIENT_DIST)
  : resolve(here, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(resolve(clientDist, "index.html")));
  console.log(`Serving client from ${clientDist}`);
} else {
  console.log(`Client build not found at ${clientDist} — run the client build to serve it.`);
}

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("harbor", HarborRoom, { repo, gateCfg, stats });

gameServer
  .listen(PORT)
  .then(() => {
    const gate =
      gateCfg.devOpen || !gateCfg.mint
        ? "wallet required (no $RIV gate)"
        : `wallet required + ≥${gateCfg.min} $RIV on ${gateCfg.network}`;
    console.log(`Marea server listening on :${PORT} — access: ${gate}`);
  })
  .catch((err: unknown) => {
    console.error("Failed to start Marea server:", err);
    process.exit(1);
  });
