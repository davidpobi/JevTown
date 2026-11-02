import type { Point, Terrain } from "./types";

export const forestWidth = 15;
export const forestHeight = 11;
export const pointKey = ({ x, y }: Point) => `${x},${y}`;

const water = new Set(["7,0", "7,1", "7,2", "7,3", "7,4", "7,6", "7,7", "7,8", "7,9", "7,10", "8,8", "9,8", "10,8"]);
const bridge = new Set(["7,5"]);
const ruins = new Set(["3,2", "3,3", "11,6", "11,7"]);
const brush = new Set(["1,1", "1,2", "2,1", "2,2", "4,7", "4,8", "5,8", "10,2", "11,2", "12,2", "12,3", "12,4", "9,9", "10,9"]);

export const createForestTerrain = (): Terrain[][] => Array.from({ length: forestHeight }, (_, y) =>
  Array.from({ length: forestWidth }, (_, x): Terrain => {
    const key = `${x},${y}`;
    if (water.has(key)) return "water";
    if (bridge.has(key)) return "bridge";
    if (ruins.has(key)) return "ruins";
    if (brush.has(key)) return "brush";
    return "trail";
  }),
);

export const relicSites: Point[] = [{ x: 4, y: 2 }, { x: 10, y: 4 }, { x: 5, y: 9 }];
export const blueSpawn: Point = { x: 1, y: 8 };
export const yellowSpawn: Point = { x: 13, y: 2 };
