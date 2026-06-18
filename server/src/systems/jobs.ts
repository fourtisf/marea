import { DROP_CHANCE_PER_JOB, FINDS, JOBS, RARE_FINDS, type FindReward } from "@marea/shared";
import { orthogonallyAdjacent, stationAt } from "../world.js";
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
  priv.job = { def, station, remaining: def.dur };
  return { ok: true };
}

export interface JobCompletion {
  payout: number;
  find: FindReward | null;
  rare: boolean;
}

function rollFind(): FindReward | null {
  if (Math.random() >= DROP_CHANCE_PER_JOB) return null;
  const total = FINDS.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  let chosen = FINDS[0];
  for (const f of FINDS) {
    if (r < f.weight) {
      chosen = f;
      break;
    }
    r -= f.weight;
  }
  return { id: chosen.id, sell: chosen.sell };
}

// Advance the active job timer; returns a completion (and mutates priv) when done.
export function tickJob(priv: PrivatePlayer, dt: number): JobCompletion | null {
  if (!priv.job) return null;
  priv.job.remaining -= dt;
  if (priv.job.remaining > 0) return null;

  const def = priv.job.def;
  priv.job = null;
  priv.credits += def.pay;
  const find = rollFind();
  if (find) priv.finds.push(find.id);
  priv.dirty = true;
  return { payout: def.pay, find, rare: find ? RARE_FINDS.includes(find.id) : false };
}
