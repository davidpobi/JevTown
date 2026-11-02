import "server-only";

import type { HuntDecision, HuntDecisionSnapshot } from "@/interfaces/huntDecision";

const ansi = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  red: "\u001b[31m",
};

const paint = (value: string, color: keyof typeof ansi) => {
  if (!process.stdout.isTTY || process.env.NO_COLOR) return value;
  return `${ansi[color]}${value}${ansi.reset}`;
};

const elapsed = (milliseconds: number) => milliseconds < 1_000
  ? `${milliseconds}ms`
  : `${(milliseconds / 1_000).toFixed(2)}s`;

const now = () => new Date().toISOString().slice(11, 19);

const write = (
  agent: "JEVTOWN" | "JEV",
  symbol: "→" | "✓" | "✕",
  message: string,
  details: string[] = [],
) => {
  const agentColor = agent === "JEV" ? "yellow" : "cyan";
  const symbolColor = symbol === "✓" ? "green" : symbol === "✕" ? "red" : agentColor;
  console.info([
    paint(now(), "dim"),
    paint(agent.padEnd(8), agentColor),
    paint(symbol, symbolColor),
    message,
    ...details.filter(Boolean).map((detail) => paint(detail, "dim")),
  ].join("  "));
};

const location = (snapshot: HuntDecisionSnapshot) =>
  `C${snapshot.self.x + 1}-${snapshot.self.y + 1}`;

export const logHuntDecisionTick = (input: {
  matchId: string;
  turn: number;
  elapsedMs: number;
  snapshots: [HuntDecisionSnapshot, HuntDecisionSnapshot];
}) => {
  if (process.env.JEV_DECISION_LOG_VERBOSE !== "true") return;
  const [blue, yellow] = input.snapshots;
  write("JEVTOWN", "→", `Hunt tick ${input.turn} · Blue ${location(blue)} / Yellow ${location(yellow)}`, [
    `${Math.floor(input.elapsedMs / 1_000)}s`,
    `#${input.matchId.slice(0, 8)}`,
  ]);

  input.snapshots.forEach((snapshot) => {
    const plans = snapshot.plans
      .map((plan) => `${plan.tactic.replaceAll("_", " ")} → ${plan.target} · ${plan.steps} steps`)
      .join(" / ");
    write("JEVTOWN", "→", `${snapshot.battler.toUpperCase()} map state`, [
      `${snapshot.knownCells} cells · ${snapshot.visibleTreasures.length} gems seen · ${snapshot.frontiers.length} frontiers`,
      `plans ${plans}`,
    ]);
  });
};

export const logHuntJevRequest = () => {
  if (process.env.JEV_DECISION_LOG_VERBOSE !== "true") return;
  write("JEV", "→", "Evaluating Blue and Yellow", ["typesafe/jev-1.13"]);
};

export const logHuntJevDecisionPair = (
  decisions: [HuntDecision, HuntDecision],
  durationMs: number,
) => {
  const label = (decision: HuntDecision) => {
    const action = decision.tactic === "EXPLORE_FAST" ? "explore" : "collect";
    return `${decision.battler === "blue" ? "B" : "Y"} ${action} ${decision.target} ${Math.round(decision.confidence * 100)}%`;
  };
  const summary = decisions.map((decision) =>
    label(decision),
  ).join("  ·  ");
  write("JEV", "✓", summary, [
    elapsed(durationMs),
  ]);
};

export const logHuntJevFailure = (input: {
  matchId: string;
  turn: number;
  durationMs: number;
  reason: string;
}) => {
  write("JEV", "✕", `Decision unavailable · ${input.reason}`, [
    elapsed(input.durationMs),
    `#${input.matchId.slice(0, 8)}`,
    `tick ${input.turn}`,
  ]);
};
