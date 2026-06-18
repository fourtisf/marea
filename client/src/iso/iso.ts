// Isometric projection — CLIENT ONLY. The server never imports this.
import { TILE_W, TILE_H } from "@marea/shared";

export interface ScreenPoint { x: number; y: number }
export interface Tile { x: number; y: number }

export const cartToIso = (cx: number, cy: number): ScreenPoint => ({
  x: (cx - cy) * (TILE_W / 2),
  y: (cx + cy) * (TILE_H / 2),
});

// Inverse projection given the current camera + zoom and viewport center.
export function screenToTile(
  px: number,
  py: number,
  cam: ScreenPoint,
  zoom: number,
  cssW: number,
  cssH: number
): Tile {
  const wx = (px - cssW / 2) / zoom + cam.x;
  const wy = (py - cssH / 2) / zoom + cam.y;
  const ax = wx / (TILE_W / 2);
  const ay = wy / (TILE_H / 2);
  return { x: Math.round((ax + ay) / 2), y: Math.round((ay - ax) / 2) };
}
