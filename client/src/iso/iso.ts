// Top-down (2D) projection — CLIENT ONLY. The server stays projection-blind and
// works purely in cartesian grid coordinates; this only affects rendering.
export const TILE_PX = 30; // pixels per tile (square), client render only

export interface ScreenPoint { x: number; y: number }
export interface Tile { x: number; y: number }

// Center of a tile in world pixels.
export const cartToWorld = (cx: number, cy: number): ScreenPoint => ({
  x: (cx + 0.5) * TILE_PX,
  y: (cy + 0.5) * TILE_PX,
});

// Inverse: world/screen point -> tile, given camera (world px at viewport center),
// zoom, and viewport size.
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
  return { x: Math.floor(wx / TILE_PX), y: Math.floor(wy / TILE_PX) };
}
