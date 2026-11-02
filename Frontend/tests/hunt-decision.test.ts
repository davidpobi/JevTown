import { afterEach, describe, expect, it, vi } from "vitest";

import { decisionFromHuntPlan, toHuntDecisionSnapshot } from "../src/game/huntDecision";
import { createTown, pointKey } from "../src/game/town";
import { handleHuntDecisionRequest } from "../src/app/api/(routes)/hunt/decision/decision";

describe("Hunt Jev decisions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only exposes treasures the explorer has discovered", () => {
    const town = createTown("hunt-jev-visibility");
    const hiddenSnapshot = toHuntDecisionSnapshot(town, "blue");
    expect(hiddenSnapshot.visibleTreasures).toEqual([]);

    const visibleTreasure = town.treasures[0];
    const knownTown = {
      ...town,
      blue: {
        ...town.blue,
        known: new Set([...town.blue.known, pointKey(visibleTreasure)]),
      },
    };
    const visibleSnapshot = toHuntDecisionSnapshot(knownTown, "blue");

    expect(visibleSnapshot.visibleTreasures).toEqual([{ id: "T1", position: visibleTreasure }]);
  });

  it("accepts only a supplied legal plan and bounded confidence", () => {
    const snapshot = toHuntDecisionSnapshot(createTown("hunt-jev-plan"), "blue");
    const plan = snapshot.plans[0];

    expect(decisionFromHuntPlan(snapshot, plan.id, 0.72)).toMatchObject({
      battler: "blue",
      planId: plan.id,
      tactic: plan.tactic,
      target: plan.target,
      confidence: 0.72,
    });
    expect(() => decisionFromHuntPlan(snapshot, "T99", 0.5)).toThrow("invalid Hunt decision");
    expect(() => decisionFromHuntPlan(snapshot, plan.id, 1.01)).toThrow("invalid Hunt decision");
  });

  it("translates two provider choices into validated Hunt decisions", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const town = createTown("hunt-jev-provider");
    const blue = toHuntDecisionSnapshot(town, "blue");
    const yellow = toHuntDecisionSnapshot(town, "yellow");
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const [choice] = Object.keys(body.questions.plan.criteria);
      return new Response(JSON.stringify({
        answers: { plan: { type: "choice", choice, confidence: 0.68 } },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await handleHuntDecisionRequest({
      kind: "tick",
      matchId: town.seed,
      turn: 1,
      elapsedMs: 0,
      snapshots: [blue, yellow],
    }, fetchImplementation);

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(result.decisions.map((decision) => decision.confidence)).toEqual([0.68, 0.68]);
    expect(result.decisions.map((decision) => decision.battler)).toEqual(["blue", "yellow"]);
  });

  it("rejects a provider choice that is not one of the engine-priced plans", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const town = createTown("hunt-jev-invalid-provider-choice");
    const blue = toHuntDecisionSnapshot(town, "blue");
    const yellow = toHuntDecisionSnapshot(town, "yellow");
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({
      answers: { plan: { type: "choice", choice: "COLLECT_TREASURE_FAST:T99", confidence: 0.8 } },
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(handleHuntDecisionRequest({
      kind: "tick",
      matchId: town.seed,
      turn: 1,
      elapsedMs: 0,
      snapshots: [blue, yellow],
    }, fetchImplementation)).rejects.toThrow("invalid Hunt decision");
  });
});
