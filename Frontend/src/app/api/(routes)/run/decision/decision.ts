import "server-only";

import { decisionFromChoice, resolveClash } from "@/game/run/decision";
import type { DecisionSnapshot, JevDecision, JevTactic } from "@/game/run/types";
import type {
  DecisionRequest,
  DecisionResponse,
  DecisionTickRequest,
} from "@/run/interfaces/decision";
import { z } from "zod";

import {
  logClashResolved,
  logClashStarted,
  logDecisionTick,
  logJevDecision,
  logJevFailure,
  logJevRequest,
  logJevUsage,
} from "./decision.log";

const endpoint = "https://openrouter.ai/api/alpha/decisions";
const model = "typesafe/jev-1.13";
const timeoutMs = 3_000;
type MatchUsage = {
  requests: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

const matchUsage = new Map<string, MatchUsage>();

const providerSchema = z.object({
  answers: z.record(
    z.string(),
    z.object({
      type: z.literal("choice"),
      choice: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      probabilities: z.record(z.string(), z.number().min(0).max(1)).optional(),
    }),
  ),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cost: z.number().nonnegative().optional(),
  }).optional(),
});

const tacticDescription: Record<JevTactic, string> = {
  GET_KEY_FAST: "Go directly to the available key using the shortest route.",
  GET_KEY_SAFE: "Go to the available key while avoiding the rival's nearby route.",
  GO_EXIT_FAST: "Carry the key directly to the unlocked exit using the shortest route.",
  GO_EXIT_SAFE: "Carry the key to the unlocked exit while avoiding the rival's nearby route.",
  CAPTURE_SIGNAL_FAST: "Capture a discovered signal using the shortest route.",
  CAPTURE_SIGNAL_SAFE: "Capture a discovered signal while avoiding the rival's nearby route.",
  EXPLORE_FAST: "Explore this frontier on the shortest known route.",
  EXPLORE_SAFE: "Explore this frontier while prioritizing distance from the rival.",
  CHASE_RIVAL: "Move toward the rival's current corridor to contest their route.",
};
const choiceKey = (tactic: JevTactic, frontierId?: string) => {
  return frontierId ? `${tactic}:${frontierId}` : tactic;
};

const compactHistory = (
  history: DecisionSnapshot["self"]["routeHistory"],
) => ({
  corridorVisits: history.visits,
  corridorTransitions: history.transitions,
  recentCorridors: history.recentCorridors,
  keyEvents: history.keyEvents,
  encounters: history.encounters,
});

const stateFor = (snapshot: DecisionSnapshot) => ({
  self: {
    position: snapshot.self.position,
    corridor: snapshot.self.corridor,
    hasKey: snapshot.self.hasKey,
    routeHistory: compactHistory(snapshot.self.routeHistory),
  },
  rival: {
    position: snapshot.rival.position,
    corridor: snapshot.rival.corridor,
    hasKey: snapshot.rival.hasKey,
    routeHistory: compactHistory(snapshot.rival.routeHistory),
  },
  objectives: snapshot.objectives,
  frontiers: snapshot.frontiers,
  plans: snapshot.plans,
  legalTactics: snapshot.legalTactics,
});

const questionFor = (snapshot: DecisionSnapshot) => ({
  type: "choice" as const,
  instructions: [
    "Choose exactly one supplied plan.",
    "The engine has already calculated the legal route and its cost.",
    "Choose strategy, not individual moves.",
    "Never infer facts not present in the state.",
  ].join(" "),
  criteria: Object.fromEntries(snapshot.plans.map((plan) => [
    choiceKey(plan.tactic, plan.frontierId),
    [
      tacticDescription[plan.tactic],
      `Target: ${plan.target}.`,
      `${plan.steps} route steps, rival distance ${plan.rivalDistance},`,
      `information gain ${plan.informationGain}.`,
    ].join(" "),
  ])),
});

const recordUsage = (
  matchId: string,
  input: {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    cost?: number;
  },
) => {
  const current = matchUsage.get(matchId) ?? {
    requests: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
  matchUsage.set(matchId, {
    requests: current.requests + 2,
    durationMs: current.durationMs + input.durationMs,
    inputTokens: current.inputTokens + input.inputTokens,
    outputTokens: current.outputTokens + input.outputTokens,
    cost: current.cost + (input.cost ?? 0),
  });
};

const callJev = async (
  snapshot: DecisionSnapshot,
  fetchImplementation: typeof fetch,
): Promise<{
  decision: JevDecision;
  usage: { input_tokens: number; output_tokens: number; cost?: number };
}> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Jev is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "JevX",
      },
      body: JSON.stringify({
        model,
        state: stateFor(snapshot),
        questions: { tactic: questionFor(snapshot) },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Jev decision request failed.");
    const parsed = providerSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Jev returned an invalid tactical decision.");
    const answer = parsed.data.answers.tactic;
    if (!answer) throw new Error("Jev returned an invalid tactical decision.");
    return {
      decision: decisionFromChoice(
        snapshot,
        answer.choice,
        answer.confidence ?? answer.probabilities?.[answer.choice] ?? 0,
      ),
      usage: parsed.data.usage ?? { input_tokens: 0, output_tokens: 0 },
    };
  } finally {
    clearTimeout(timer);
  }
};

const decidePair = async (
  request: DecisionTickRequest,
  fetchImplementation: typeof fetch,
) => {
  const startedAt = Date.now();
  const [blue, yellow] = request.snapshots;
  logDecisionTick({
    ...request,
    keyHolder: request.snapshots.find((snapshot) => snapshot.self.hasKey)?.battler ?? null,
    blueCorridor: blue.self.corridor,
    yellowCorridor: yellow.self.corridor,
  });
  logJevRequest();
  try {
    const results = await Promise.all(
      request.snapshots.map((snapshot) => callJev(snapshot, fetchImplementation)),
    );
    const durationMs = Date.now() - startedAt;
    results.forEach((result, index) => {
      logJevDecision(
        result.decision,
        request.snapshots[index].self.corridor,
        durationMs,
      );
    });
    recordUsage(request.matchId, {
      durationMs,
      inputTokens: results.reduce(
        (total, result) => total + result.usage.input_tokens,
        0,
      ),
      outputTokens: results.reduce(
        (total, result) => total + result.usage.output_tokens,
        0,
      ),
      cost: results.reduce(
        (total, result) => total + (result.usage.cost ?? 0),
        0,
      ),
    });
    return results.map((result) => result.decision) as [JevDecision, JevDecision];
  } catch (error) {
    logJevFailure({
      matchId: request.matchId,
      turn: request.turn,
      durationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : "provider error",
    });
    throw error;
  }
};

const finalizeMatchUsage = (matchId: string) => {
  const usage = matchUsage.get(matchId);
  if (!usage) return;
  matchUsage.delete(matchId);
  logJevUsage(usage);
};

export const handleDecisionRequest = async (
  request: DecisionRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<DecisionResponse> => {
  if (request.kind === "complete") {
    finalizeMatchUsage(request.matchId);
    return { ok: true };
  }
  if (request.kind === "clash") {
    const startedAt = Date.now();
    logClashStarted({
      matchId: request.matchId,
      turn: request.turn,
      corridor: request.snapshots[0].self.corridor,
    });
    const clash = resolveClash(request.snapshots, { matchId: request.matchId, turn: request.turn });
    const keyHolder = request.snapshots.find((snapshot) => snapshot.self.hasKey)?.battler;
    const keyTransfer = keyHolder && clash.winner && keyHolder !== clash.winner
      ? { from: keyHolder, to: clash.winner }
      : undefined;
    logClashResolved(clash, Date.now() - startedAt, keyTransfer);
    return { clash };
  }
  return { decisions: await decidePair(request, fetchImplementation) };
};

