import { describe, expect, it } from "vitest";
import { applyForestDecision, createForest, decisionFromForestPlan, forestSnapshot, stepForest } from "../src/game/forest/engine";

describe("Jev Forest engine", () => {
  it("keeps undiscovered relics and distant rivals out of a Jev snapshot", () => {
    const forest = createForest("forest-redaction");
    const blue = forestSnapshot(forest, "blue");
    expect(blue.visibleRelics).toEqual([]);
    expect(blue.rival).toBeNull();
    expect(blue.plans.some((plan) => plan.target.startsWith("R"))).toBe(false);
  });

  it("accepts only supplied plans and bounded confidence", () => {
    const forest = createForest("forest-plans");
    const snapshot = forestSnapshot(forest, "blue");
    const plan = snapshot.plans[0];
    expect(decisionFromForestPlan(snapshot, plan.id, .6)).toMatchObject({ planId: plan.id, confidence: .6 });
    expect(() => decisionFromForestPlan(snapshot, "COLLECT_RELIC_FAST:R99", .6)).toThrow("invalid Forest decision");
    expect(() => decisionFromForestPlan(snapshot, plan.id, 2)).toThrow("invalid Forest decision");
  });

  it("executes a chosen engine route without accepting coordinates", () => {
    const forest = { ...createForest("forest-route"), status: "running" as const };
    const plan = forestSnapshot(forest, "blue").plans[0];
    const routed = applyForestDecision(forest, decisionFromForestPlan(forestSnapshot(forest, "blue"), plan.id, .7));
    expect(routed.blue.path.length).toBeGreaterThan(0);
    expect(stepForest(routed, 360).blue.position).not.toEqual(forest.blue.position);
  });

  it("pauses safely when a decision becomes stale before it can be applied", () => {
    const forest = { ...createForest("forest-stale"), status: "running" as const };
    const paused = applyForestDecision(forest, {
      battler: "blue",
      planId: "SCOUT_FRONTIER:expired",
      tactic: "SCOUT_FRONTIER",
      target: "expired",
      confidence: .7,
    });
    expect(paused.status).toBe("paused");
  });
});
