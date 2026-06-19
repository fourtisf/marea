// Read-only $RIV access gate. NO private keys, NO signers, NO transactions —
// just an SPL token balance read over RPC. Build/test on devnet first; swap to
// the mainnet mint at launch via env only.
//
// A connected Solana wallet is ALWAYS mandatory — it is the player's identity.
// `devOpen` (and an unconfigured mint) only relaxes the $RIV balance check, so
// the harbor stays playable before launch; it never lets a wallet-less client in.
// Phase 6 fills in the real `gill` balance read (the `readSplBalance` stub).

export interface GateConfig {
  devOpen: boolean;
  rpcUrl: string;
  network: string;
  mint: string;
  min: number;
}

export interface GateResult {
  ok: boolean;
  reason?: string;
}

export function loadGateConfig(env: NodeJS.ProcessEnv): GateConfig {
  return {
    devOpen: (env.MAREA_DEV_OPEN ?? "false").toLowerCase() === "true",
    rpcUrl: env.SOLANA_RPC_URL ?? "",
    network: env.SOLANA_NETWORK ?? "devnet",
    mint: env.MAREA_TOKEN_MINT ?? "",
    min: Number(env.MAREA_GATE_MIN ?? "1"),
  };
}

// Phase 6: read the wallet's SPL balance for `mint` over RPC using gill.
// Kept isolated so no signing libraries ever leak into shared/client code.
async function readSplBalance(_cfg: GateConfig, _wallet: string): Promise<number> {
  throw new Error("Solana balance read not implemented yet (Phase 6).");
}

// Basic shape check for a Solana address (base58, 32–44 chars). Not proof of
// ownership — the soft gate just needs a plausible public key.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function isLikelySolanaAddress(s: string): boolean {
  return BASE58.test(s);
}

export async function checkGate(cfg: GateConfig, wallet: string): Promise<GateResult> {
  // A connected wallet is mandatory regardless of the token gate — no guest entry.
  if (!wallet) return { ok: false, reason: "Connect a Solana wallet to enter." };
  if (!isLikelySolanaAddress(wallet)) return { ok: false, reason: "That doesn't look like a valid wallet address." };

  // The $RIV balance check is the optional part: dev-open or an unconfigured mint
  // lets a connected wallet in without holding the token (pre-launch).
  if (cfg.devOpen) return { ok: true };
  if (!cfg.mint) return { ok: true };
  if (!cfg.rpcUrl) {
    return { ok: false, reason: "Access gate misconfigured: set SOLANA_RPC_URL." };
  }
  try {
    const balance = await readSplBalance(cfg, wallet);
    if (balance >= cfg.min) return { ok: true };
    return { ok: false, reason: `You need at least ${cfg.min} $RIV to enter (you hold ${balance}).` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Gate check failed." };
  }
}
