// Progression: XP / levels and a small data-driven quest line. Shared so the
// server (authority) and client (display) agree on the curve and the goals.

// ---- XP & levels ----
export const XP_PER_JOB = 8;   // base xp for finishing a marina job
export const XP_PER_SELL = 5;  // base xp for selling a find
export const XP_PER_BUY = 12;  // base xp for buying a vehicle

// Cumulative XP needed to *start* a given level. Level L→L+1 costs L*60 xp, so
// the curve eases up gently (60, 120, 180, …) like a cozy ranch game.
export function xpToReach(level: number): number {
  let acc = 0;
  for (let l = 1; l < level; l++) acc += l * 60;
  return acc;
}

export function levelForXp(xp: number): number {
  let l = 1;
  while (xpToReach(l + 1) <= xp) l++;
  return l;
}

// Position within the current level, for an XP bar: { level, into, span }.
export function levelProgress(xp: number): { level: number; into: number; span: number } {
  const level = levelForXp(xp);
  const floor = xpToReach(level);
  const span = level * 60;
  return { level, into: xp - floor, span };
}

// ---- ranks ----
// A visible title that climbs with level — gives the harbour a sense of place.
const RANKS: [number, string][] = [
  [1, "Deckhand"],
  [3, "Sailor"],
  [5, "Skipper"],
  [8, "First Mate"],
  [12, "Captain"],
  [18, "Harbor Master"],
  [25, "Harbor Legend"],
];
export function rankForLevel(level: number): string {
  let title = RANKS[0][1];
  for (const [lv, name] of RANKS) if (level >= lv) title = name;
  return title;
}

// ---- quests ----
export type QuestKind = "work" | "sell" | "buy_vehicle" | "lease_berth" | "fish";

export interface QuestDef {
  id: string;
  label: string;
  kind: QuestKind;
  target: number;
  xp: number;
  credits: number;
  repeatable?: boolean; // resets on completion so it can be earned again
}

// Ordered starter line, then repeatable "bounties" so there's always a goal.
export const QUESTS: QuestDef[] = [
  { id: "q_work3", label: "Work 3 marina jobs", kind: "work", target: 3, xp: 30, credits: 120 },
  { id: "q_sell1", label: "Sell a find at the Dealer", kind: "sell", target: 1, xp: 25, credits: 100 },
  { id: "q_fish3", label: "Catch 3 fish at the marina", kind: "fish", target: 3, xp: 35, credits: 120 },
  { id: "q_buy1", label: "Buy a boat from the Dealer", kind: "buy_vehicle", target: 1, xp: 40, credits: 0 },
  { id: "q_lease1", label: "Lease a berth for passive income", kind: "lease_berth", target: 1, xp: 60, credits: 0 },
  { id: "q_work10", label: "Work 10 marina jobs in total", kind: "work", target: 10, xp: 80, credits: 300 },
  { id: "b_work", label: "Bounty: work 5 jobs", kind: "work", target: 5, xp: 40, credits: 200, repeatable: true },
  { id: "b_fish", label: "Bounty: catch 5 fish", kind: "fish", target: 5, xp: 40, credits: 200, repeatable: true },
];

export const questById = (id: string): QuestDef | undefined => QUESTS.find((q) => q.id === id);
