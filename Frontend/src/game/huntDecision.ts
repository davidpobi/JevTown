import { candidatePlans, snapshot } from "@/game/rules";
import type { Town } from "@/game/types";
import type {
  HuntDecision,
  HuntDecisionSnapshot,
} from "@/interfaces/huntDecision";

export const toHuntDecisionSnapshot = (
  town: Town,
  battler: HuntDecisionSnapshot["battler"],
): HuntDecisionSnapshot => {
  const state = snapshot(town, battler);

  return {
    battler,
    self: state.self,
    rival: state.rival,
    heldTreasures: state.held,
    knownCells: state.knownCells,
    visibleTreasures: state.treasures,
    frontiers: state.frontiers,
    plans: candidatePlans(town, battler),
  };
};

export const decisionFromHuntPlan = (
  snapshot: HuntDecisionSnapshot,
  planId: string,
  confidence: number,
): HuntDecision => {
  const plan = snapshot.plans.find((candidate) => candidate.id === planId);
  if (!plan || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Jev returned an invalid Hunt decision.");
  }

  return {
    battler: snapshot.battler,
    planId: plan.id,
    tactic: plan.tactic,
    target: plan.target,
    confidence,
  };
};
