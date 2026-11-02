import type { CandidatePlan } from "@/game/rules";
import type { ExplorerId, Point, Tactic } from "@/game/types";

export interface HuntDecisionSnapshot {
  battler: ExplorerId;
  self: Point;
  rival: Point;
  heldTreasures: number;
  knownCells: number;
  visibleTreasures: Array<{ id: string; position: Point }>;
  frontiers: Array<{ id: string; position: Point }>;
  plans: CandidatePlan[];
}

export interface HuntDecision {
  battler: ExplorerId;
  planId: string;
  tactic: Tactic;
  target: string;
  confidence: number;
}

export interface HuntDecisionTickRequest {
  kind: "tick";
  matchId: string;
  turn: number;
  elapsedMs: number;
  snapshots: [HuntDecisionSnapshot, HuntDecisionSnapshot];
}

export interface HuntDecisionTickResponse {
  decisions: [HuntDecision, HuntDecision];
}
