import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PersistedPlayer, Repo } from "./repo.js";

// Durable, zero-infra persistence: keeps every player record in memory (fast
// reads) and writes the whole set to a JSON file on disk so data survives
// process restarts and deploys. Drop-in for MemoryRepo via the Repo interface.
//
// Writes are debounced (and flushed atomically via a temp file + rename) so a
// burst of saves costs one disk write, and a crash can't leave a half-file.
interface FileShape {
  players: Record<string, PersistedPlayer>;
  seen: string[];
}

export class FileRepo implements Repo {
  private players = new Map<string, PersistedPlayer>();
  private seen = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(private file: string, private flushMs = 1500) {
    this.loadFromDisk();
    // best-effort flush on shutdown so the latest state isn't lost
    const onExit = () => this.flushNow();
    process.once("SIGINT", () => { onExit(); process.exit(0); });
    process.once("SIGTERM", () => { onExit(); process.exit(0); });
    process.once("beforeExit", onExit);
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.file)) return;
      const raw = JSON.parse(readFileSync(this.file, "utf8")) as Partial<FileShape>;
      for (const p of Object.values(raw.players ?? {})) this.players.set(p.wallet, p);
      for (const w of raw.seen ?? []) this.seen.add(w);
      for (const w of this.players.keys()) this.seen.add(w);
      console.log(`FileRepo loaded ${this.players.size} players from ${this.file}`);
    } catch (e) {
      console.error(`FileRepo: could not read ${this.file} — starting empty.`, e);
    }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushNow();
    }, this.flushMs);
  }

  private flushNow(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const data: FileShape = { players: Object.fromEntries(this.players), seen: [...this.seen] };
      const tmp = this.file + ".tmp";
      writeFileSync(tmp, JSON.stringify(data));
      renameSync(tmp, this.file); // atomic replace
    } catch (e) {
      console.error(`FileRepo: failed to write ${this.file}`, e);
      this.dirty = true; // retry on next flush
    }
  }

  async load(wallet: string): Promise<PersistedPlayer | null> {
    return this.players.get(wallet) ?? null;
  }
  async save(p: PersistedPlayer): Promise<void> {
    this.players.set(p.wallet, { ...p });
    this.seen.add(p.wallet);
    this.scheduleFlush();
  }
  async touchLastSeen(wallet: string): Promise<void> {
    const p = this.players.get(wallet);
    if (p) {
      p.lastSeen = Date.now();
      this.scheduleFlush();
    }
  }
  markSeen(wallet: string): void {
    if (!this.seen.has(wallet)) {
      this.seen.add(wallet);
      this.scheduleFlush();
    }
  }
  totalUsers(): number {
    return this.seen.size;
  }
}
