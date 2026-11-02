import "server-only";

import type {
  BattlerId,
  ClashResult,
  DecisionSnapshot,
  JevDecision,
} from "@/game/run/types";

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

const elapsed = (milliseconds: number) => {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  return `${(milliseconds / 1_000).toFixed(2)}s`;
};

const now = () => new Date().toISOString().slice(11, 19);

const write = (
  agent: "JEVX" | "JEV",
  symbol: "→" | "✓" | "✕",
  message: string,
  details: string[] = [],
) => {
  const agentColor = agent === "JEV" ? "yellow" : "cyan";
  const symbolColor = symbol === "✓"
    ? "green"
    : symbol === "✕"
      ? "red"
      : "cyan";
  const output = [
    paint(now(), "dim"),
    paint(agent.padEnd(6), agentColor),
    paint(symbol, symbolColor),
    message,
    ...details.filter(Boolean).map((detail) => paint(detail, "dim")),
  ].join("  ");

  console.info(output);
};

export const logDecisionTick = (input: {
  matchId: string;
  turn: number;
  elapsedMs: number;
  keyHolder: BattlerId | null;
  blueCorridor: string;
  yellowCorridor: string;
  snapshots: [DecisionSnapshot, DecisionSnapshot];
}) => {
  const signalHunt = input.snapshots[0].objectives.mode === "signal-hunt";
  const blueSnapshot = input.snapshots.find((snapshot) => snapshot.battler === "blue")!;
  const yellowSnapshot = input.snapshots.find((snapshot) => snapshot.battler === "yellow")!;
  const progress = signalHunt
    ? [
      `signals Blue ${blueSnapshot.objectives.capturedSignals}/${blueSnapshot.objectives.signalGoal}`,
      `Yellow ${yellowSnapshot.objectives.capturedSignals}/${yellowSnapshot.objectives.signalGoal}`,
    ].join(" · ")
    : input.keyHolder
      ? `${input.keyHolder} has key`
      : "key unclaimed";

  write(
    "JEVX",
    "→",
    `Decision tick ${input.turn} · Blue ${input.blueCorridor} / Yellow ${input.yellowCorridor}`,
    [
      progress,
      `${Math.floor(input.elapsedMs / 1_000)}s`,
      `#${input.matchId.slice(0, 8)}`,
    ],
  );

  input.snapshots.forEach((snapshot) => {
    const knowledge = [
      `${snapshot.objectives.knownCellCount} cells`,
      snapshot.objectives.keyKnown ? "key seen" : "key hidden",
      snapshot.objectives.exitKnown ? "exit seen" : "exit hidden",
      `${snapshot.frontiers.length} frontiers`,
    ].join(" · ");
    const plans = snapshot.plans
      .map((plan) => `${plan.tactic.replaceAll("_", " ")} · ${plan.steps} steps`)
      .join(" / ");

    write("JEVX", "→", `${snapshot.battler.toUpperCase()} map state`, [
      knowledge,
      `plans ${plans}`,
    ]);
  });
};

export const logJevRequest = () => {
  write("JEV", "→", "Evaluating Blue and Yellow", ["typesafe/jev-1.13"]);
};

export const logJevDecision = (
  decision: JevDecision,
  corridor: string,
  durationMs: number,
) => {
  const frontier = decision.frontierId ? ` → ${decision.frontierId}` : "";
  const confidence = Math.round(decision.confidence * 100);

  write(
    "JEV",
    "✓",
    `${decision.battler.toUpperCase()} → ${decision.tactic.replaceAll("_", " ")}${frontier} · ${confidence}%`,
    [`from ${corridor}`, elapsed(durationMs)],
  );
};

export const logJevUsage = (input: {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  requests?: number;
}) => {
  const message = input.requests
    ? `Usage across ${input.requests} model requests`
    : "Decision pair completed";
  const totalTokens = input.inputTokens + input.outputTokens;

  write("JEVX", "✓", message, [
    elapsed(input.durationMs),
    `${input.inputTokens} in / ${input.outputTokens} out / ${totalTokens} total`,
    input.cost === undefined ? "" : `$${input.cost.toFixed(6)}`,
  ]);
};

export const logJevFailure = (input: {
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

export const logClashStarted = (input: {
  matchId: string;
  turn: number;
  corridor: string;
}) => {
  write("JEVX", "→", `Clash at ${input.corridor} · rock paper scissors`, [
    `tick ${input.turn}`,
    `#${input.matchId.slice(0, 8)}`,
  ]);
};

export const logClashResolved = (
  result: ClashResult,
  durationMs: number,
  keyTransfer?: { from: BattlerId; to: BattlerId },
) => {
  const blue = result.throws.find((throwResult) => throwResult.battler === "blue")!;
  const yellow = result.throws.find((throwResult) => throwResult.battler === "yellow")!;
  const resolution = keyTransfer
    ? `${keyTransfer.to} takes key from ${keyTransfer.from}`
    : `${result.winner} passes · seeded resolution`;

  write(
    "JEVX",
    "✓",
    `Clash · Blue ${blue.move} / Yellow ${yellow.move}`,
    [resolution, elapsed(durationMs)],
  );
};

