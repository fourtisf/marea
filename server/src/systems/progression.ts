import { QUESTS, levelForXp, type QuestKind, type QuestState } from "@marea/shared";
import type { PrivatePlayer } from "../types.js";

export interface ProgressOutcome {
  questsCompleted: { id: string; xp: number; credits: number }[];
  newLevel: number | null; // set when the player crossed into a new level
}

// Apply an action toward progression: grant base xp, advance every matching
// open quest, and complete + reward any that hit their target. Returns what
// changed so the room can fire owner-only messages (quest_done / level_up).
export function progress(priv: PrivatePlayer, kind: QuestKind, n: number, baseXp: number): ProgressOutcome {
  const levelBefore = levelForXp(priv.xp);
  priv.xp += baseXp;

  const questsCompleted: ProgressOutcome["questsCompleted"] = [];
  for (const q of QUESTS) {
    if (q.kind !== kind || priv.questsDone.includes(q.id)) continue;
    const next = (priv.quests[q.id] ?? 0) + n;
    priv.quests[q.id] = Math.min(q.target, next);
    if (next >= q.target) {
      priv.questsDone.push(q.id);
      priv.xp += q.xp;
      priv.credits += q.credits;
      questsCompleted.push({ id: q.id, xp: q.xp, credits: q.credits });
    }
  }

  priv.dirty = true;
  const levelAfter = levelForXp(priv.xp);
  return { questsCompleted, newLevel: levelAfter > levelBefore ? levelAfter : null };
}

// The owner-only snapshot sent on join and after every change.
export function progressSnapshot(priv: PrivatePlayer): {
  xp: number;
  level: number;
  quests: QuestState[];
  done: string[];
} {
  return {
    xp: priv.xp,
    level: levelForXp(priv.xp),
    quests: QUESTS.map((q) => ({ id: q.id, progress: priv.quests[q.id] ?? 0 })),
    done: [...priv.questsDone],
  };
}
