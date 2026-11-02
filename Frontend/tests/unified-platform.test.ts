import { describe, expect, it } from "vitest";

import { createTown } from "../src/game/town";
import {
  fromLiveHuntMatchState,
  toLiveHuntMatchState,
} from "../src/game/townLiveMatch";
import {
  crowdApiPathFor,
  crowdStateEventFor,
  crowdStoragePrefixFor,
} from "../src/interfaces/game";

describe("unified platform boundaries", () => {
  it("keeps Crowd Pick browser state and API paths game-scoped", () => {
    expect(crowdApiPathFor("hunt")).toBe("/api/crowd/hunt");
    expect(crowdApiPathFor("run")).toBe("/api/crowd/run");
    expect(crowdStoragePrefixFor("hunt")).not.toBe(crowdStoragePrefixFor("run"));
    expect(crowdStateEventFor("hunt")).not.toBe(crowdStateEventFor("run"));
  });

  it("round-trips a compact Hunt live projection from its deterministic seed", () => {
    const town = createTown("hunt-live-projection", "hard");
    const state = toLiveHuntMatchState(town, 3, {
      kind: "ready",
      message: "Hunt ready to begin.",
    });
    const restored = fromLiveHuntMatchState(state);

    expect(restored.seed).toBe(town.seed);
    expect(restored.difficulty).toBe("hard");
    expect(restored.blue.position).toEqual(town.blue.position);
    expect(restored.yellow.position).toEqual(town.yellow.position);
    expect(restored.treasures).toEqual(town.treasures);
  });
});
