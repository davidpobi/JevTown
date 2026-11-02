import type { ForestDecision, ForestPlan } from "@/game/forest/types";
import type { ForestSnapshot } from "@/game/forest/engine";

export type ForestDecisionSnapshot = ForestSnapshot;
export interface ForestDecisionTickRequest { kind: "tick"; matchId: string; turn: number; elapsedMs: number; snapshots: [ForestDecisionSnapshot, ForestDecisionSnapshot] }
export interface ForestDecisionTickResponse { decisions: [ForestDecision, ForestDecision] }
export type { ForestPlan };
