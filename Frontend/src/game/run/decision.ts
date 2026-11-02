import type { ClashResult, DecisionSnapshot, JevDecision, JevTactic, RpsMove } from "./types";

const throws = ["ROCK", "PAPER", "SCISSORS"] as const;

const hash = (value: string) => {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
};

export const decisionFromChoice = (
  snapshot: DecisionSnapshot,
  choice: string,
  confidence: number,
): JevDecision => {
  const [tactic, frontierId, extra] = choice.split(":");
  const validPlan = !extra && snapshot.plans.find((plan) => plan.tactic === tactic && plan.frontierId === frontierId);
  if (!validPlan) throw new Error("Jev returned an invalid tactical decision.");
  return {
    battler: snapshot.battler,
    tactic: tactic as JevTactic,
    ...(frontierId ? { frontierId } : {}),
    confidence,
  };
};

export const resolveClash = (
  snapshots: [DecisionSnapshot, DecisionSnapshot],
  context: { matchId: string; turn: number },
): ClashResult => {
  const blueIndex = hash(`${context.matchId}:${context.turn}:blue`) % throws.length;
  const blueMove = throws[blueIndex] as RpsMove;
  // A seeded priority bit guarantees one legal winner; clashes never burn model calls or loop on ties.
  const blueWins = hash(`${context.matchId}:${context.turn}:priority`) % 2 === 0;
  const yellowMove = throws[(blueIndex + (blueWins ? 2 : 1)) % throws.length] as RpsMove;
  const result: ClashResult = {
    throws: [
      { battler: "blue", move: blueMove, confidence: 1 },
      { battler: "yellow", move: yellowMove, confidence: 1 },
    ],
    winner: blueWins ? "blue" : "yellow",
  };
  return result;
};

