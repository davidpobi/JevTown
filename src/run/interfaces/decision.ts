import type { ClashResult, DecisionSnapshot, JevDecision } from "@/game/run/types";

export type DecisionTickRequest = {
  kind: "tick";
  matchId: string;
  turn: number;
  elapsedMs: number;
  snapshots: [DecisionSnapshot, DecisionSnapshot];
};

export type DecisionClashRequest = {
  kind: "clash";
  matchId: string;
  turn: number;
  cell: { x: number; y: number };
  snapshots: [DecisionSnapshot, DecisionSnapshot];
};

export type DecisionCompleteRequest = {
  kind: "complete";
  matchId: string;
};

export type DecisionRequest = DecisionTickRequest | DecisionClashRequest | DecisionCompleteRequest;
export type DecisionTickResponse = { decisions: [JevDecision, JevDecision] };
export type DecisionClashResponse = { clash: ClashResult };
export type DecisionCompleteResponse = { ok: true };
export type DecisionResponse = DecisionTickResponse | DecisionClashResponse | DecisionCompleteResponse;

