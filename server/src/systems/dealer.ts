import { vehicleById, findById } from "@marea/shared";
import type { PrivatePlayer } from "../types.js";
import type { PlayerSchema } from "../schema/HarborState.js";

export type DealerResult = { ok: true } | { ok: false; error: string };

// buy_vehicle: verify exists, not owned, enough Credits; deduct, own, equip.
export function buyVehicle(priv: PrivatePlayer, sp: PlayerSchema, vehicleId: string): DealerResult {
  const v = vehicleById(vehicleId);
  if (!v) return { ok: false, error: "No such vehicle." };
  if (priv.owned.includes(vehicleId)) return { ok: false, error: "You already own that." };
  if (priv.credits < v.price) return { ok: false, error: "Not enough Credits." };
  priv.credits -= v.price;
  priv.owned.push(vehicleId);
  priv.equipped = vehicleId;
  sp.equipped = vehicleId; // public
  priv.dirty = true;
  return { ok: true };
}

// equip_vehicle: verify owned; set public equipped.
export function equipVehicle(priv: PrivatePlayer, sp: PlayerSchema, vehicleId: string): DealerResult {
  if (!priv.owned.includes(vehicleId)) return { ok: false, error: "You don't own that." };
  priv.equipped = vehicleId;
  sp.equipped = vehicleId; // public
  priv.dirty = true;
  return { ok: true };
}

// sell_find: verify held; remove one, add sell value to Credits.
export function sellFind(priv: PrivatePlayer, findId: string): DealerResult {
  const i = priv.finds.indexOf(findId);
  if (i < 0) return { ok: false, error: "You aren't holding that." };
  const f = findById(findId);
  if (!f) return { ok: false, error: "Unknown find." };
  priv.finds.splice(i, 1);
  priv.credits += f.sell;
  priv.dirty = true;
  return { ok: true };
}
