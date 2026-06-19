// Typed loaders for the JSON content — the single source of truth for prices,
// payouts, durations, drop rates and the map. Nothing here is inlined.

import vehiclesJson from "./vehicles.json" with { type: "json" };
import findsJson from "./finds.json" with { type: "json" };
import jobsJson from "./jobs.json" with { type: "json" };
import looksJson from "./looks.json" with { type: "json" };
import mapJson from "./map.json" with { type: "json" };

export type VehicleType = "boat" | "land";
export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  price: number;
  col: string;
  speed: number; // movement multiplier (1 = base)
}

export interface Find {
  id: string;
  name: string;
  weight: number; // chance the find is this item, given a find occurred
  sell: number;
  col: string;
}

export interface Job {
  id: string;
  name: string;
  dur: number; // seconds
  pay: number; // credits
}

export type StationKind = "wash" | "fuel" | "repair";

export type TileKind = "water" | "quay";

export interface VillaProp {
  kind: "villa";
  x: number;
  y: number;
  h: number;
  roof: string;
  forSale: boolean;
  price: number;
}
export interface StationProp {
  kind: "station";
  x: number;
  y: number;
  station: StationKind;
}
export interface DealerProp { kind: "dealer"; x: number; y: number }
export interface DecorProp {
  kind: "cafe" | "lamp" | "car" | "stall" | "palm" | "fountain";
  x: number;
  y: number;
  col?: string;
}
export type Prop = VillaProp | StationProp | DealerProp | DecorProp;

export interface Berth { id: string; x: number; y: number }
export interface AmbientBoat { x: number; y: number; tier: string; ph: number }

export interface MareaMap {
  grid: number;
  tiles: TileKind[][];
  spawn: { x: number; y: number };
  props: Prop[];
  berths: Berth[];
  ambientBoats: AmbientBoat[];
}

export type HairStyle = "short" | "long" | "bun" | "bald";
export interface Look {
  id: string;
  name: string;
  body: string; // body/clothing color
  skin: string; // face/skin tone
  hair: string; // hair color
  hairStyle: HairStyle; // short/bald read masc, long/bun read fem
  hat: string | null; // hat color, or null for none
}

export const VEHICLES = vehiclesJson as Vehicle[];
export const FINDS = findsJson as Find[];
export const JOBS = jobsJson as Record<StationKind, Job[]>;
export const LOOKS = looksJson as Look[];
export const MAP = mapJson as unknown as MareaMap;

export const lookById = (id: string): Look | undefined => LOOKS.find((l) => l.id === id);

// Which props physically block movement. Decorative props (palms, lamps, parked
// cars) are walkable ambiance you stroll past; only solid structures you act on
// or that are buildings block the path.
const SOLID_PROP_KINDS = new Set(["villa", "dealer", "station", "cafe", "stall", "fountain"]);
export const propBlocks = (kind: string): boolean => SOLID_PROP_KINDS.has(kind);

// Rare finds that trigger a harbor-wide announcement.
export const RARE_FINDS: readonly string[] = ["find_plate", "find_ring"];

export const vehicleById = (id: string): Vehicle | undefined =>
  VEHICLES.find((v) => v.id === id);
export const findById = (id: string): Find | undefined =>
  FINDS.find((f) => f.id === id);

// Convenience views over the frozen map.
export const villas = (): VillaProp[] =>
  MAP.props.filter((p): p is VillaProp => p.kind === "villa");
export const stations = (): StationProp[] =>
  MAP.props.filter((p): p is StationProp => p.kind === "station");
export const dealer = (): DealerProp | undefined =>
  MAP.props.find((p): p is DealerProp => p.kind === "dealer");
