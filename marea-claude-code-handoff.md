# Marea — Claude Code Build Handoff

**For:** Michael (MichaelCoinsult)
**From:** ALFA
**Reference prototype:** `marea-v3.html` (approved — this is the source of truth for the look, the core loop, and every gameplay number)

---

## How to use this

Paste the section **"BUILD PROMPT FOR CLAUDE CODE"** below into Claude Code at the root of an empty repo. Build **one phase at a time** — finish a phase, verify it against its acceptance criteria, commit, then start the next. Do not skip ahead; later phases assume earlier ones are stable.

Three things in the prototype are **stubs** that this build replaces with the real thing:
- NPCs that wander the harbor → **real players** over Colyseus.
- The "Connect wallet & enter" button → a real **$RIV balance gate** read with gill.
- Browser-storage save → **Postgres** via Prisma, keyed by wallet.

Everything else in the prototype (numbers, loop, layout, look) ships as-is.

---

# BUILD PROMPT FOR CLAUDE CODE

You are building **Marea**, a browser-based isometric multiplayer "luxury harbor" RPG on Solana. Players walk a shared harbor at golden hour, take marina work for Credits, surface rare Discoveries, and spend on visible status — boats, a berth, a villa on the hill that the whole quay can see. Build it end to end in TypeScript following the phases and specs below exactly.

## 0. Prime directive (read first, never violate)

- **All gameplay state and validation run in cartesian integer grid coordinates on the server.** The isometric projection exists **only on the client at render time**. The server is projection-blind — it never imports, references, or computes anything isometric.
- The client sends **intent** ("move to tile", "start job", "buy vehicle"), never authoritative state. The server validates, resolves, and broadcasts the truth. Position, Credits, inventory, estate, and every reward are server-owned.
- **Public vs private state is a security boundary.** Public state (name, grid position, equipped vehicle, owned villa/berth markers) lives in the Colyseus schema and is synced to everyone. Private state (Credits, inventory, held Discoveries) is sent only to its owner via direct messages and **never** placed in the broadcast schema.
- **No private keys or signers ever touch client or shared code.** The Solana integration in this build is **read-only** (a balance gate). No on-chain programs, no $RIV settlement, no transfers, no marketplace — those are explicitly out of scope.
- Game content (prices, payouts, durations, drop rates, the map) lives in `/shared/content/*.json`, never inlined. Dimensional/timing constants live in `/shared/constants.ts`, never inlined.
- TypeScript strict, end to end.

## 1. Tech stack

| Layer | Technology |
| --- | --- |
| Client render | Phaser 3 (latest 3.x), Vite, 2D isometric, TypeScript |
| Netcode | Colyseus (authoritative rooms, Schema state, server sim @ 20 Hz) |
| Server | Node + Colyseus + Express (health/auth endpoints) |
| Persistence | Postgres + Prisma |
| Cache (optional, later) | Redis (presence/leaderboard cache) — only if needed |
| Solana | Wallet Standard (connect) + `gill` (read-only RPC balance read) |
| Process mgmt | PM2 on Hostinger VPS (deploy target) |
| Language | TypeScript strict, end to end |

> Note: this deviates from the usual Next.js product stack on purpose — Marea is a realtime MMO, so Phaser + Colyseus is the correct tooling (same architecture family as the Goldcrest MMO). Solana RPC can use the existing Helius RPC URL via env.

## 2. Repo structure (monorepo, npm workspaces)

```
marea/
  package.json                 # workspaces: client, server, shared
  shared/
    src/
      constants.ts             # GRID, TW, TH, tick rate, move speed, prices
      protocol.ts              # ClientMessage / ServerMessage union types
      content/
        vehicles.json
        finds.json
        jobs.json
        map.json               # tile grid + prop/berth placements (authoritative)
  server/
    src/
      index.ts                 # Colyseus + Express bootstrap
      rooms/HarborRoom.ts
      schema/HarborState.ts     # PlayerSchema, public room state
      systems/
        movement.ts            # server-side pathing + tween on tick
        jobs.ts                # job timers, payouts, discovery rolls
        dealer.ts              # buy/equip/sell validation
        estate.ts             # villa purchase + berth lease + passive income
        leaderboard.ts         # net-worth ranking broadcast
        chat.ts                # relay + rate limit + sanitize
      db/
        repo.ts                # Prisma load/save by wallet
      solana/gate.ts           # gill balance read
  client/
    index.html
    src/
      main.ts                  # Phaser game config
      iso/iso.ts               # cartToIso (CLIENT ONLY)
      scenes/HarborScene.ts    # render, input, camera, zoom, minimap
      net/room.ts              # Colyseus client + message handlers
      ui/                      # HUD, dealer modal, chat, leaderboard, intro/gate
      render/                  # tile + prop + person draw helpers (port from prototype)
  prisma/schema.prisma
  .env.example
```

## 3. Shared constants (`shared/src/constants.ts`)

```ts
export const GRID = 52;             // harbor tiles (x and y); map.json must match
export const TILE_W = 64;           // iso diamond width (px) — CLIENT render only
export const TILE_H = 32;           // iso diamond height (px) — CLIENT render only
export const SERVER_TICK_HZ = 20;   // authoritative sim rate
export const MOVE_TILES_PER_SEC = 4.4;
export const DROP_CHANCE_PER_JOB = 0.03;
export const STARTING_CREDITS = 40;
export const STARTING_VEHICLE = "tender_used";
export const BERTH_PRICE = 900;
export const BERTH_RATE_PER_SEC = 0.12;     // passive Credits per leased berth
export const OFFLINE_CAP_MINUTES = 480;     // berth income while away, capped
export const CHAT_RATE_LIMIT_MS = 1500;
export const LEADERBOARD_TOP = 8;
```

## 4. Content (single source of truth — copy values exactly from the prototype)

`shared/src/content/vehicles.json`
```json
[
  {"id":"tender_used","name":"Used Tender","type":"boat","price":0},
  {"id":"scooter_city","name":"City Scooter","type":"land","price":150},
  {"id":"runabout_classic","name":"Classic Runabout","type":"boat","price":600},
  {"id":"roadster","name":"Coastal Roadster","type":"land","price":1400},
  {"id":"cruiser_sport","name":"Sport Cruiser","type":"boat","price":2800},
  {"id":"mega_yacht","name":"Mega Yacht","type":"boat","price":12000}
]
```

`shared/src/content/finds.json` (weight = chance the find is this item, *given* a find occurred)
```json
[
  {"id":"find_compass","name":"Vintage Brass Compass","weight":40,"sell":220},
  {"id":"find_watch","name":"Lost Designer Watch","weight":25,"sell":650},
  {"id":"find_pearl","name":"Black Pearl","weight":20,"sell":900},
  {"id":"find_plate","name":"Rare License Plate","weight":12,"sell":1500},
  {"id":"find_ring","name":"Diamond Signet Ring","weight":3,"sell":4200}
]
```
Rare announcement (harbor-wide): `find_plate` and `find_ring`.

`shared/src/content/jobs.json`
```json
{
  "wash":   [{"id":"hull_clean","name":"Clean a hull","dur":6,"pay":12},
             {"id":"deck_polish","name":"Polish the deck","dur":9,"pay":20}],
  "fuel":   [{"id":"refuel","name":"Refuel a boat","dur":5,"pay":10}],
  "repair": [{"id":"hull_repair","name":"Patch a hull","dur":14,"pay":38}]
}
```

`shared/src/content/map.json` — generate once from the prototype's seeded map (seed `91237`, `GRID=52`, coastline `40 + round(sin(x*0.42)*4)`), then **freeze it to JSON** so client and server share the exact same authoritative map. It must contain: `tiles` (2D array of `"water"|"quay"`), `props` (villas with `{x,y,h,roof,forSale,price}`, stations `{x,y,station}`, dealer, cafes/lamps/cars/stalls/fountain/palms for decor), `berths` (`{id,x,y}`), `spawn` (`{x,y}`), and `ambientBoats` (decorative). Decor props block their tile but are otherwise cosmetic. Villa `for-sale` prices in the prototype = `1500 + n*900`.

## 5. Message protocol (`shared/src/protocol.ts`)

```ts
export type ClientMessage =
  | { t: "move"; gridX: number; gridY: number }
  | { t: "start_job"; jobId: string; stationId: string }   // stationId = "x,y"
  | { t: "buy_vehicle"; vehicleId: string }
  | { t: "equip_vehicle"; vehicleId: string }
  | { t: "sell_find"; findId: string }
  | { t: "buy_villa"; villaId: string }                    // villaId = "x,y"
  | { t: "lease_berth"; berthId: string }
  | { t: "chat"; text: string };

export type ServerMessage =
  | { t: "credits"; credits: number }                                  // owner only
  | { t: "inventory"; owned: string[]; equipped: string; finds: string[] } // owner only
  | { t: "estate"; villa: string | null; berths: string[] }            // owner only
  | { t: "job_done"; payout: number; find: { id: string; sell: number } | null } // owner only
  | { t: "welcome_back"; offlineEarned: number }                       // owner only
  | { t: "announce"; text: string }                                    // broadcast
  | { t: "leaderboard"; rows: { name: string; netWorth: number }[] }   // broadcast
  | { t: "chat"; from: string; text: string }                          // broadcast
  | { t: "error"; message: string };
```

Public position/name/equipped/villa-owner/berth-owner sync via the Colyseus schema (not messages).

## 6. Server room schema (`server/src/schema/HarborState.ts`)

```ts
class PlayerSchema extends Schema {
  @type("string") name = "";
  @type("number") gx = 0;          // grid x (authoritative)
  @type("number") gy = 0;          // grid y
  @type("number") rx = 0;          // render-interp x (float, server-tweened)
  @type("number") ry = 0;
  @type("string") equipped = "tender_used";
}
class HarborState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: "string" }) villaOwners = new MapSchema<string>();  // "x,y" -> name
  @type({ map: "string" }) berthOwners = new MapSchema<string>();  // berthId -> name
}
```
Private per-player data (credits, owned[], finds[], villa, berths, jobTimer, berthFraction, lastChatAt) lives in a plain server-side `Map<sessionId, PrivatePlayer>` — **never** in the schema.

## 7. Game systems (rules — match the prototype exactly)

**Movement** (`systems/movement.ts`): on `move`, validate target is a walkable quay tile; BFS a path on the cartesian grid; advance the player along it at `MOVE_TILES_PER_SEC` on each server tick; write `gx,gy,rx,ry` to the schema. Reject moves while a job is active.

**Marina work** (`systems/jobs.ts`): on `start_job`, verify the player is orthogonally adjacent to the station at `stationId` and the station type matches the job; reject if a job is already active. Start a **server-owned** timer of `dur` seconds. On completion: add `pay` to Credits, roll `DROP_CHANCE_PER_JOB`; if it hits, pick a find by relative weight; push to inventory; send `job_done` (+ `credits`, `inventory`) to the owner. If the find is `find_plate` or `find_ring`, broadcast `announce`.

**Dealer** (`systems/dealer.ts`): `buy_vehicle` — verify exists, not owned, enough Credits; deduct, add to owned, set equipped; send `credits`+`inventory`. `equip_vehicle` — verify owned; set public `equipped`. `sell_find` — verify held; remove one, add `sell` to Credits.

**Estate** (`systems/estate.ts`): `buy_villa` — verify the villa is `forSale` and unowned; verify funds; deduct; set `villaOwners["x,y"] = name` (public) and private `villa`. `lease_berth` — verify berth unowned and funds; deduct `BERTH_PRICE`; set `berthOwners[berthId] = name` (public) and add to private `berths`. Each tick, accrue `berths.length * BERTH_RATE_PER_SEC * dt` Credits (carry a fractional remainder; commit whole Credits and send `credits`).

**Net worth** (used by leaderboard & estate tab) = Credits + sum(owned vehicle prices) + (villa price if owned) + (berths × `BERTH_PRICE`) + sum(held find sell values).

**Leaderboard** (`systems/leaderboard.ts`): every ~2 s, compute net worth for all connected players, sort desc, broadcast top `LEADERBOARD_TOP` as `leaderboard`.

**Chat** (`systems/chat.ts`): on `chat`, enforce `CHAT_RATE_LIMIT_MS` per player, trim to 80 chars, strip control chars, broadcast `chat {from,text}`.

## 8. Solana $RIV gate (`server/src/solana/gate.ts`) — read-only

- Client connects a wallet via **Wallet Standard** and sends its public key in the Colyseus join options.
- On join, the **server** reads the wallet's `MAREA_TOKEN_MINT` SPL token balance over RPC using `gill`. If balance ≥ `MAREA_GATE_MIN`, allow join; otherwise reject with a clear message.
- **No transaction, no contract call, no signature** is required to enter (soft balance gate — same model as the reference). If stronger proof-of-ownership is ever needed, add a sign-in-with-Solana signature check later; not in this build.
- Build and test on **devnet** with a test mint first; swap to the mainnet mint at launch via env only.

`.env.example`
```
DATABASE_URL=postgresql://user:pass@localhost:5432/marea
SOLANA_RPC_URL=                 # Helius RPC URL works here
SOLANA_NETWORK=devnet
MAREA_TOKEN_MINT=               # devnet test mint first
MAREA_GATE_MIN=1                # minimum balance to enter
PORT=2567
```

## 9. Persistence (`prisma/schema.prisma`)

```prisma
model Player {
  id        String   @id @default(cuid())
  wallet    String   @unique
  name      String
  credits   Int      @default(40)
  equipped  String   @default("tender_used")
  owned     String[]                          // vehicle ids
  finds     String[]                          // find ids
  villa     String?                            // "x,y" or null
  berths    String[]                          // berth ids
  lastSeen  DateTime @default(now())
  createdAt DateTime @default(now())
}
```
On join (after the gate passes): load by `wallet`, or create with `STARTING_CREDITS` + `STARTING_VEHICLE`. Re-apply owned villa/berths to the public schema. Compute offline berth income = `min(minutesAway, OFFLINE_CAP_MINUTES) * 60 * BERTH_RATE_PER_SEC * berths.length`, add to Credits, send `welcome_back`. Debounce-save private state on every mutation; update `lastSeen` on disconnect.

## 10. Client (`client/`)

Port the prototype's rendering and feel directly:
- `iso/iso.ts`: `cartToIso(cx,cy) => { x:(cx-cy)*TILE_W/2, y:(cx+cy)*TILE_H/2 }`. **Client only.**
- Render order: ground tiles back-to-front by `cx+cy`; then depth-sorted objects (props, parked boats, players) by `cx+cy`. Apply the **golden-hour atmosphere pass** from the prototype (directional shadows, lamp glow, warm sun radial + vignette in screen space).
- Camera follows the local player; mouse wheel + on-screen buttons zoom (`0.4`–`2.0`); minimap (click to travel). Mouse: click-to-move and hold-drag-to-steer; touch supported.
- Input emits **intent** messages only. The client may show a local progress bar for a job for feel, but the reward arrives only via `job_done`.
- UI: intro + wallet-connect gate, HUD (Credits, net worth, equipped), contextual dock (jobs / dealer / buy villa / lease berth based on adjacency), Dealer modal (Vehicles / Discoveries / My estate), leaderboard panel, chat box + emotes, volume on/off with procedural ambient + SFX (port from prototype).

## 11. Build sequence (do these in order; verify each before moving on)

| Phase | Delivers | Acceptance |
| --- | --- | --- |
| 0 · Scaffold | Monorepo, shared constants/content, `map.json`, Vite+Phaser client renders the harbor from `map.json` with golden-hour look, click/drag move, zoom, minimap (single client, no server) | Walk the full harbor solo; it looks like the prototype |
| 1 · Shared movement | Colyseus server + `HarborRoom`; client connects; authoritative movement; players see each other | Two browser tabs see each other walk in real time |
| 2 · Marina & Credits | Server jobs, payouts, 3% discovery rolls; private `credits`/`inventory`; HUD updates | Earn Credits; occasionally surface a find |
| 3 · Dealer | Buy + equip vehicle (public `equipped` broadcasts); sell a find | Buy a boat; the other tab sees your new boat |
| 4 · Estate | Buy a for-sale villa (public owner nameplate); lease a berth (public + passive income) | Own a visible villa/berth; Credits trickle in |
| 5 · Persistence | Prisma + Postgres; load/save by wallet; offline berth income + `welcome_back` | Reload keeps progress; away time pays out (capped) |
| 6 · $RIV gate | Wallet Standard connect + gill balance read at join on devnet | Holding the min devnet balance lets you in; otherwise rejected |
| 7 · Social | Chat (relay + rate limit), leaderboard broadcast, rare-find announcements | Chat works; leaderboard ranks by net worth; rings announce harbor-wide |
| 8 · Polish | Mobile/touch pass, reduced-motion, art-asset hooks (swap primitive shapes for sprites later) | Plays on a phone; respects reduced motion |

## 12. Out of scope for this build (do NOT add)

$RIV settlement / payments / transfers, any on-chain program, a player-to-player marketplace, the buy-back-and-burn / staking tokenomics, racing or diving minigames, day/night cycle, multiple districts/rooms, NPC dialogue. Keep the token strictly an access gate. Ship the one harbor and the one loop, clean and stable, first.

## 13. Guardrails checklist (verify before each commit)

- Server never imports anything isometric; all server logic is in cartesian grid coords.
- Credits / inventory / finds / estate are never in the broadcast schema — owner-only messages.
- No private keys or signers anywhere in client or shared code; Solana is read-only.
- Content values come from `/shared/content`; dimensions/timings from `/shared/constants.ts`; nothing inlined.
- TypeScript strict passes; no `any` in shared or server gameplay code.

---

*Visual + numeric source of truth: `marea-v3.html`. When in doubt about a number, a price, a duration, or how something should feel — match the prototype.*
