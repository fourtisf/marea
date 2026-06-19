// Solana wallet connection via Wallet Standard (Phantom, Solflare, Backpack…).
// Read-only: we connect and read the public key — no signing, no transactions.
import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";

export interface DetectedWallet {
  wallet: Wallet;
  name: string;
  icon: string;
}

function isSolana(w: Wallet): boolean {
  return w.chains.some((c) => c.startsWith("solana:")) && StandardConnect in w.features;
}

export function getSolanaWallets(): DetectedWallet[] {
  return getWallets()
    .get()
    .filter(isSolana)
    .map((w) => ({ wallet: w, name: w.name, icon: w.icon }));
}

// Wallets register asynchronously after page load — keep a live list.
export function subscribeWallets(cb: () => void): () => void {
  const w = getWallets();
  const off1 = w.on("register", cb);
  const off2 = w.on("unregister", cb);
  return () => {
    off1();
    off2();
  };
}

// Connect a wallet and return its base58 public key.
export async function connectWallet(wallet: Wallet): Promise<string> {
  const feature = wallet.features[StandardConnect] as StandardConnectFeature[typeof StandardConnect] | undefined;
  if (!feature) throw new Error(`${wallet.name} doesn't support connect.`);
  const { accounts } = await feature.connect();
  const account = accounts[0] ?? wallet.accounts[0];
  if (!account) throw new Error("No account was authorized.");
  return account.address; // base58 public key
}
