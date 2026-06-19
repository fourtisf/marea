import { BERTH_PRICE, BERTH_RATE_PER_SEC, VILLA_RATE_PER_SEC, vehicleById, findById } from "@marea/shared";
import { berthById, villaAt } from "../world.js";
import type { PrivatePlayer } from "../types.js";
import type { HarborState } from "../schema/HarborState.js";

export type EstateResult = { ok: true } | { ok: false; error: string };

// buy_villa: verify for-sale + unowned + funds; deduct; set public owner + private villa.
export function buyVilla(priv: PrivatePlayer, state: HarborState, villaId: string): EstateResult {
  const [x, y] = villaId.split(",").map(Number);
  const villa = villaAt(x, y);
  if (!villa) return { ok: false, error: "No villa there." };
  if (!villa.forSale) return { ok: false, error: "That villa isn't for sale." };
  if (state.villaOwners.has(villaId)) return { ok: false, error: "Already owned." };
  if (priv.villa) return { ok: false, error: "You already own a villa." };
  if (priv.credits < villa.price) return { ok: false, error: "Not enough Credits." };
  priv.credits -= villa.price;
  priv.villa = villaId;
  state.villaOwners.set(villaId, priv.name); // public nameplate
  priv.dirty = true;
  return { ok: true };
}

// lease_berth: verify unowned + funds; deduct; set public owner + private berth.
export function leaseBerth(priv: PrivatePlayer, state: HarborState, berthId: string): EstateResult {
  if (!berthById(berthId)) return { ok: false, error: "No such berth." };
  if (state.berthOwners.has(berthId)) return { ok: false, error: "That berth is taken." };
  if (priv.credits < BERTH_PRICE) return { ok: false, error: "Not enough Credits." };
  priv.credits -= BERTH_PRICE;
  priv.berths.push(berthId);
  state.berthOwners.set(berthId, priv.name); // public
  priv.dirty = true;
  return { ok: true };
}

// Each tick accrue passive berth income, carrying a fractional remainder.
// Returns true when whole Credits were committed (room should resend credits).
export function tickBerthIncome(priv: PrivatePlayer, dt: number): boolean {
  const rate = priv.berths.length * BERTH_RATE_PER_SEC + (priv.villa ? VILLA_RATE_PER_SEC : 0);
  if (rate <= 0) return false;
  priv.berthFraction += rate * dt;
  if (priv.berthFraction < 1) return false;
  const add = Math.floor(priv.berthFraction);
  priv.berthFraction -= add;
  priv.credits += add;
  priv.dirty = true;
  return true;
}

// Net worth = credits + vehicles + villa + berths + finds.
export function netWorth(priv: PrivatePlayer): number {
  let n = priv.credits;
  for (const id of priv.owned) n += vehicleById(id)?.price ?? 0;
  if (priv.villa) {
    const [x, y] = priv.villa.split(",").map(Number);
    n += villaAt(x, y)?.price ?? 0;
  }
  n += priv.berths.length * BERTH_PRICE;
  for (const id of priv.finds) n += findById(id)?.sell ?? 0;
  return n;
}
