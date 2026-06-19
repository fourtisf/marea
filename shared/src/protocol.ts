// Wire protocol between client and server.
//
// The client only ever sends *intent*. The server validates, resolves and
// owns the truth. Private state (credits/inventory/finds/estate) is delivered
// only to its owner via these messages and never via the broadcast schema.

export type ClientMessage =
  | { t: "move"; gridX: number; gridY: number }
  | { t: "start_job"; jobId: string; stationId: string }    // stationId = "x,y"
  | { t: "cast" }                                            // fish at the water's edge
  | { t: "buy_vehicle"; vehicleId: string }
  | { t: "equip_vehicle"; vehicleId: string }
  | { t: "sell_find"; findId: string }
  | { t: "buy_villa"; villaId: string }                     // villaId = "x,y"
  | { t: "lease_berth"; berthId: string }
  | { t: "chat"; text: string };

export type LeaderboardRow = { name: string; netWorth: number };
export type FindReward = { id: string; sell: number };
export type QuestState = { id: string; progress: number };

export type ServerMessage =
  | { t: "credits"; credits: number }                                       // owner only
  | { t: "inventory"; owned: string[]; equipped: string; finds: string[] }  // owner only
  | { t: "estate"; villa: string | null; berths: string[] }                 // owner only
  | { t: "job_done"; payout: number; find: FindReward | null }              // owner only
  | { t: "welcome_back"; offlineEarned: number }                            // owner only
  | { t: "progress"; xp: number; level: number; quests: QuestState[]; done: string[] } // owner only
  | { t: "quest_done"; id: string; xp: number; credits: number }            // owner only
  | { t: "level_up"; level: number }                                        // owner only
  | { t: "announce"; text: string }                                         // broadcast
  | { t: "leaderboard"; rows: LeaderboardRow[] }                            // broadcast
  | { t: "chat"; from: string; text: string }                              // broadcast
  | { t: "error"; message: string };

// Discriminated-union helpers so message handlers stay exhaustive & typed.
export type ClientMessageType = ClientMessage["t"];
export type ServerMessageType = ServerMessage["t"];
export type ClientMessageOf<T extends ClientMessageType> = Extract<ClientMessage, { t: T }>;
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { t: T }>;
