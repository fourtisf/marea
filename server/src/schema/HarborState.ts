import { Schema, MapSchema, type } from "@colyseus/schema";
import { STARTING_VEHICLE, STARTING_LOOK } from "@marea/shared";

// PUBLIC state only — synced to everyone. Private state (credits, inventory,
// finds, estate details) is never declared here; it is delivered via owner-only
// messages instead. This is the security boundary.
export class PlayerSchema extends Schema {
  @type("string") name = "";
  @type("number") gx = 0; // grid x (authoritative tile)
  @type("number") gy = 0; // grid y
  @type("number") rx = 0; // render-interp x (float, server-tweened)
  @type("number") ry = 0;
  @type("string") equipped: string = STARTING_VEHICLE;
  @type("string") look: string = STARTING_LOOK; // public appearance preset
}

export class HarborState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: "string" }) villaOwners = new MapSchema<string>(); // "x,y" -> name
  @type({ map: "string" }) berthOwners = new MapSchema<string>(); // berthId -> name
  @type("number") online = 0;      // currently connected players
  @type("number") totalUsers = 0;  // distinct wallets seen (this server session)
}
