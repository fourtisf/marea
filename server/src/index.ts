import { createServer } from "node:http";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { HarborRoom } from "./rooms/HarborRoom.js";
import { MemoryRepo } from "./db/repo.js";
import { loadGateConfig } from "./solana/gate.js";

const PORT = Number(process.env.PORT ?? "2567");

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "marea", ts: Date.now() });
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Shared singletons handed to every room instance.
const repo = new MemoryRepo();
const gateCfg = loadGateConfig(process.env);

gameServer.define("harbor", HarborRoom, { repo, gateCfg });

gameServer
  .listen(PORT)
  .then(() => {
    const gate = gateCfg.devOpen || !gateCfg.mint ? "open (dev)" : `gated (≥${gateCfg.min} $RIV on ${gateCfg.network})`;
    console.log(`Marea server listening on :${PORT} — access ${gate}`);
  })
  .catch((err: unknown) => {
    console.error("Failed to start Marea server:", err);
    process.exit(1);
  });
