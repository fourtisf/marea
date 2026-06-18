import { MOVE_TILES_PER_SEC } from "@marea/shared";
import { pathTo } from "../world.js";
import type { PrivatePlayer } from "../types.js";
import type { PlayerSchema } from "../schema/HarborState.js";

// Server-side pathing + per-tick tween. All cartesian. Moves are rejected while
// a job is active. The client only sent an intent; we own the resolved path.
export function requestMove(priv: PrivatePlayer, sp: PlayerSchema, gridX: number, gridY: number): boolean {
  if (priv.job) return false;
  const path = pathTo(sp.gx, sp.gy, gridX, gridY);
  if (!path) return false;
  priv.path = path;
  return true;
}

export function tickMovement(priv: PrivatePlayer, sp: PlayerSchema, dt: number): void {
  if (!priv.path.length) return;
  const next = priv.path[0];
  const dx = next.x - sp.rx;
  const dy = next.y - sp.ry;
  const d = Math.hypot(dx, dy);
  const step = MOVE_TILES_PER_SEC * dt;
  if (d <= step || d === 0) {
    sp.rx = next.x;
    sp.ry = next.y;
    sp.gx = next.x; // authoritative tile updates only on arrival
    sp.gy = next.y;
    priv.path.shift();
  } else {
    sp.rx += (dx / d) * step;
    sp.ry += (dy / d) * step;
  }
}
