import type { Point } from "@/game/forest/types";

export const forestSceneWidth = 1200;
export const forestArtworkHeight = 675;
export const forestSceneHeight = 900;

const landmarkAnchors: Record<string, Point> = {
  "1,8": { x: 330, y: 430 },
  "13,2": { x: 956, y: 192 },
  "4,2": { x: 360, y: 266 },
  "10,4": { x: 790, y: 355 },
  "5,9": { x: 412, y: 556 },
  "7,5": { x: 600, y: 358 },
};

export const forestSceneAnchor = (point: Point): Point => {
  const landmark = landmarkAnchors[`${point.x},${point.y}`];
  if (landmark) return landmark;

  return {
    x: 105 + point.x * 70,
    y: 104 + point.y * 49,
  };
};
