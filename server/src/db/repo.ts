import {
  OFFLINE_CAP_MINUTES,
  BERTH_RATE_PER_SEC,
  STARTING_CREDITS,
  STARTING_VEHICLE,
} from "@marea/shared";

// Persisted, owner-private player record (keyed by wallet).
export interface PersistedPlayer {
  wallet: string;
  name: string;
  credits: number;
  equipped: string;
  owned: string[];
  finds: string[];
  villa: string | null;
  berths: string[];
  lastSeen: number; // epoch ms
}

export interface Repo {
  load(wallet: string): Promise<PersistedPlayer | null>;
  save(p: PersistedPlayer): Promise<void>;
  touchLastSeen(wallet: string): Promise<void>;
}

// In-memory repo — survives for the life of the server process. Phase 5 swaps
// this for a Prisma/Postgres implementation behind the same interface.
export class MemoryRepo implements Repo {
  private store = new Map<string, PersistedPlayer>();

  async load(wallet: string): Promise<PersistedPlayer | null> {
    return this.store.get(wallet) ?? null;
  }
  async save(p: PersistedPlayer): Promise<void> {
    this.store.set(p.wallet, { ...p });
  }
  async touchLastSeen(wallet: string): Promise<void> {
    const p = this.store.get(wallet);
    if (p) p.lastSeen = Date.now();
  }
}

export function freshPlayer(wallet: string, name: string): PersistedPlayer {
  return {
    wallet,
    name,
    credits: STARTING_CREDITS,
    equipped: STARTING_VEHICLE,
    owned: [STARTING_VEHICLE],
    finds: [],
    villa: null,
    berths: [],
    lastSeen: Date.now(),
  };
}

// Offline berth income, capped. Computed on load from the persisted record.
export function offlineBerthIncome(p: PersistedPlayer): number {
  if (!p.berths.length || !p.lastSeen) return 0;
  const minutes = Math.min(OFFLINE_CAP_MINUTES, (Date.now() - p.lastSeen) / 60000);
  if (minutes <= 0) return 0;
  return Math.floor(minutes * 60 * BERTH_RATE_PER_SEC * p.berths.length);
}
