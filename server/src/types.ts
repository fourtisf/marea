import type { Job } from "@marea/shared";
import type { GridPoint } from "./world.js";

// Private, server-owned per-player state. NEVER placed in the broadcast schema.
// Lives in a Map<sessionId, PrivatePlayer> on the room.
export interface PrivatePlayer {
  sessionId: string;
  wallet: string;
  name: string;

  // economy / inventory / estate (owner-only)
  credits: number;
  owned: string[];
  equipped: string;
  look: string;
  finds: string[];
  villa: string | null; // "x,y" or null
  berths: string[]; // berth ids

  // progression (owner-only): total xp, per-quest progress, completed quest ids
  xp: number;
  quests: Record<string, number>;
  questsDone: string[];

  // movement (cartesian path the player is walking)
  path: GridPoint[];

  // active marina job or fishing cast (server-owned timer)
  job: { def: Job; kind: "work" | "fish"; remaining: number } | null;

  // passive berth income carry (fractional credits)
  berthFraction: number;

  // chat rate limit
  lastChatAt: number;

  // persistence bookkeeping
  dirty: boolean;
}
