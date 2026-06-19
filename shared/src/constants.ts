// Dimensional and timing constants — the single source of truth for both
// client and server. Never inline these values anywhere else.
//
// IMPORTANT: TILE_W / TILE_H are *client render only* (isometric projection).
// The server is projection-blind and must never read them.

export const GRID = 130;            // harbor tiles (x and y); map.json must match
export const TILE_W = 64;           // iso diamond width (px) — CLIENT render only
export const TILE_H = 32;           // iso diamond height (px) — CLIENT render only
export const TILE_THICK = 11;       // quay slab thickness (px) — CLIENT render only
export const SERVER_TICK_HZ = 20;   // authoritative sim rate
export const MOVE_TILES_PER_SEC = 4.4;
export const DROP_CHANCE_PER_JOB = 0.03;
export const STARTING_CREDITS = 40;
export const STARTING_VEHICLE = "tender_used";
export const STARTING_LOOK = "skipper";
export const BERTH_PRICE = 900;
export const BERTH_RATE_PER_SEC = 0.12;     // passive Credits per leased berth
export const OFFLINE_CAP_MINUTES = 480;     // berth income while away, capped
export const CHAT_RATE_LIMIT_MS = 1500;
export const LEADERBOARD_TOP = 8;

// Map generation seed + coastline — used only to (re)generate map.json.
// The frozen map.json is the authoritative map at runtime.
export const MAP_SEED = 91237;
