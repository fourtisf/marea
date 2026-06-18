import { LEADERBOARD_TOP, type LeaderboardRow } from "@marea/shared";
import type { PrivatePlayer } from "../types.js";
import { netWorth } from "./estate.js";

// Compute net worth for all connected players, sort desc, take top N.
export function leaderboard(players: Iterable<PrivatePlayer>): LeaderboardRow[] {
  const rows: LeaderboardRow[] = [];
  for (const p of players) rows.push({ name: p.name, netWorth: netWorth(p) });
  rows.sort((a, b) => b.netWorth - a.netWorth);
  return rows.slice(0, LEADERBOARD_TOP);
}
