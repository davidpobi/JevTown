import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  local: false,
  preview: false,
  limited: false,
  fail: false,
}));

vi.mock("@/utils/environment", () => ({
  isLocalDevelopment: () => state.local,
  isHuntPreviewPlayEnabled: () => state.preview,
}));

vi.mock("@/app/api/(routes)/hunt/decision/rateLimit", () => ({
  huntDecisionClientKey: () => "test-client",
  isHuntDecisionRateLimited: async () => state.limited,
}));

vi.mock("@/app/api/(routes)/hunt/decision/decision", () => ({
  handleHuntDecisionRequest: async () => {
    if (state.fail) throw new Error("provider unavailable");
    return {
      decisions: [
        { battler: "blue", planId: "EXPLORE_FAST:F1", tactic: "EXPLORE_FAST", target: "F1", confidence: 0.7 },
        { battler: "yellow", planId: "EXPLORE_FAST:F1", tactic: "EXPLORE_FAST", target: "F1", confidence: 0.7 },
      ],
    };
  },
}));

import { POST } from "../src/app/api/(routes)/hunt/decision/route";

const validRequest = () => new Request("http://localhost/api/hunt/decision", {
  method: "POST",
  body: JSON.stringify({
    kind: "tick",
    matchId: "test-match",
    turn: 1,
    elapsedMs: 0,
    snapshots: [
      { battler: "blue", self: { x: 0, y: 0 }, rival: { x: 1, y: 1 }, heldTreasures: 0, knownCells: 1, visibleTreasures: [], frontiers: [{ id: "F1", position: { x: 0, y: 1 } }], plans: [{ id: "EXPLORE_FAST:F1", tactic: "EXPLORE_FAST", target: "F1", steps: 1, rivalDistance: 2, informationGain: 1 }] },
      { battler: "yellow", self: { x: 1, y: 1 }, rival: { x: 0, y: 0 }, heldTreasures: 0, knownCells: 1, visibleTreasures: [], frontiers: [{ id: "F1", position: { x: 1, y: 0 } }], plans: [{ id: "EXPLORE_FAST:F1", tactic: "EXPLORE_FAST", target: "F1", steps: 1, rivalDistance: 2, informationGain: 1 }] },
    ],
  }),
});

describe("Hunt decision route", () => {
  beforeEach(() => Object.assign(state, { local: false, preview: false, limited: false, fail: false }));

  it("denies requests outside local development and preview mode", async () => {
    expect((await POST(validRequest() as never)).status).toBe(403);
  });

  it("rejects malformed payloads", async () => {
    state.local = true;
    const response = await POST(new Request("http://localhost/api/hunt/decision", { method: "POST", body: "{}" }) as never);
    expect(response.status).toBe(400);
  });

  it("rate limits the public preview", async () => {
    state.preview = true;
    state.limited = true;
    expect((await POST(validRequest() as never)).status).toBe(429);
  });

  it("returns a safe provider failure", async () => {
    state.local = true;
    state.fail = true;
    const response = await POST(validRequest() as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Jev decision is temporarily unavailable." });
  });
});
