import { describe, expect, it } from "vitest";
import { forestSceneAnchor, forestSceneHeight, forestSceneWidth } from "../src/components/forest/sceneLayout";
import { createForest } from "../src/game/forest/engine";

describe("Forest scenic layout", () => {
  it("gives every engine cell a drawable, unique scene anchor", () => {
    const forest = createForest("scene-layout");
    const anchors = forest.terrain.flatMap((row, y) => row.map((_, x) => forestSceneAnchor({ x, y })));
    const unique = new Set(anchors.map(({ x, y }) => `${x},${y}`));

    expect(unique.size).toBe(anchors.length);
    anchors.forEach(({ x, y }) => {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(forestSceneWidth);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(forestSceneHeight);
    });
  });

  it("aligns the bridge and player starts with authored landmarks", () => {
    expect(forestSceneAnchor({ x: 7, y: 5 })).toEqual({ x: 600, y: 358 });
    expect(forestSceneAnchor({ x: 1, y: 8 })).toEqual({ x: 330, y: 430 });
    expect(forestSceneAnchor({ x: 13, y: 2 })).toEqual({ x: 956, y: 192 });
  });
});
