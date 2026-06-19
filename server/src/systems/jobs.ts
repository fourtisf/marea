import { DROP_CHANCE_PER_JOB, FINDS, JOBS, RARE_FINDS, FISH_DUR, FISH_PAY, type FindReward, type Job } from "@marea/shared";
import { orthogonallyAdjacent, stationAt, waterAdjacent } from "../world.js";
import type { PrivatePlayer } from "../types.js";
import type { PlayerSchema } from "../schema/HarborState.js";

export type StartJobResult = { ok: true } | { ok: false; error: string };

// On start_job: verify adjacency to the station and that the station type
// matches the job. Reject if a job is already active. Starts a server-owned timer.
export function startJob(priv: PrivatePlayer, sp: PlayerSchema, jobId: string, stationId: string): StartJobResult {
  if (priv.job) return { ok: false, error: "You're already working." };
  const [sx, sy] = stationId.split(",").map(Number);
  if (Number.isNaN(sx) || Number.isNaN(sy)) return { ok: false, error: "Unknown station." };
  const station = stationAt(sx, sy);
  if (!station) return { ok: false, error: "No station there." };
  if (!orthogonallyAdjacent(sp.gx, sp.gy, sx, sy)) return { ok: false, error: "Walk up to the station first." };
  const def = JOBS[station].find((j) => j.id === jobId);
  if (!def) return { ok: false, error: "That job isn't offered here." };
  priv.path = []; // stop walking
  priv.job = { def, kind: "work", remaining: def.dur };
  return { ok: true };
}

// On cast: verify the player stands beside marina water, then start a fishing
// timer (a job with a near-certain catch instead of a rare treasure).
export function startFishing(priv: PrivatePlayer, sp: PlayerSchema): StartJobResult {
  if (priv.job) return { ok: false, error: "You're already busy." };
  if (!waterAdjacent(sp.gx, sp.gy)) return { ok: false, error: "Stand at the water's edge to cast." };
  const def: Job = { id: "cast", name: "Cast a line", dur: FISH_DUR, pay: FISH_PAY };
  priv.path = [];
  priv.job = { def, kind: "fish", remaining: def.dur };
  return { ok: true };
}

export interface JobCompletion {
  payout: number;
  find: FindReward | null;
  rare: boolean;
  kind: "work" | "fish";
}

function rollFind(): FindReward | null {
  if (Math.random() >= DROP_CHANCE_PER_JOB) return null;
  const pool = FINDS.filter((f) => f.weight > 0);
  const total = pool.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  let chosen = pool[0];
  for (const f of pool) {
    if (r < f.weight) {
      chosen = f;
      break;
    }
    r -= f.weight;
  }
  return { id: chosen.id, sell: chosen.sell };
}

// Fishing almost always lands something — a weighted catch from the fish table.
const FISH_TABLE: { id: string; weight: number }[] = [
  { id: "fish_sardine", weight: 50 },
  { id: "fish_bream", weight: 30 },
  { id: "fish_boot", weight: 12 },
  { id: "fish_tuna", weight: 8 },
];
function rollFish(): FindReward | null {
  const total = FISH_TABLE.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  let id = FISH_TABLE[0].id;
  for (const f of FISH_TABLE) {
    if (r < f.weight) { id = f.id; break; }
    r -= f.weight;
  }
  const sell = FINDS.find((f) => f.id === id)?.sell ?? 0;
  return { id, sell };
}

// Advance the active job timer; returns a completion (and mutates priv) when done.
export function tickJob(priv: PrivatePlayer, dt: number): JobCompletion | null {
  if (!priv.job) return null;
  priv.job.remaining -= dt;
  if (priv.job.remaining > 0) return null;

  const { def, kind } = priv.job;
  priv.job = null;
  priv.credits += def.pay;
  const find = kind === "fish" ? rollFish() : rollFind();
  if (find) priv.finds.push(find.id);
  priv.dirty = true;
  return { payout: def.pay, find, rare: find ? RARE_FINDS.includes(find.id) : false, kind };
}
