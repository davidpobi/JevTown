import "server-only";

import { z } from "zod";

import { decisionFromHuntPlan } from "@/game/huntDecision";
import type {
  HuntDecisionSnapshot,
  HuntDecisionTickRequest,
  HuntDecisionTickResponse,
} from "@/interfaces/huntDecision";

import {
  logHuntDecisionTick,
  logHuntJevDecisionPair,
  logHuntJevFailure,
  logHuntJevRequest,
} from "./decision.log";

const endpoint = "https://openrouter.ai/api/alpha/decisions";
const model = "typesafe/jev-1.13";
const timeoutMs = 3_000;

const providerSchema = z.object({
  answers: z.record(z.string(), z.object({
    type: z.literal("choice"),
    choice: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    probabilities: z.record(z.string(), z.number().min(0).max(1)).optional(),
  })),
});

const stateFor = (snapshot: HuntDecisionSnapshot) => ({
  self: snapshot.self,
  rival: snapshot.rival,
  heldTreasures: snapshot.heldTreasures,
  knownCells: snapshot.knownCells,
  visibleTreasures: snapshot.visibleTreasures,
  frontiers: snapshot.frontiers,
  plans: snapshot.plans,
});

const questionFor = (snapshot: HuntDecisionSnapshot) => ({
  type: "choice" as const,
  instructions: [
    "Choose exactly one supplied legal plan.",
    "The game engine owns routes, movement, hidden gems, and all rules.",
    "Choose strategy only; do not infer facts outside this explorer's state.",
  ].join(" "),
  criteria: Object.fromEntries(snapshot.plans.map((plan) => [
    plan.id,
    `${plan.tactic.replaceAll("_", " ")}: target ${plan.target}; ${plan.steps} route steps; rival distance ${plan.rivalDistance}; information gain ${plan.informationGain}.`,
  ])),
});

const decide = async (
  snapshot: HuntDecisionSnapshot,
  fetchImplementation: typeof fetch,
) => {
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
        "X-Title": "Jev Hunt",
      },
      body: JSON.stringify({
        model,
        state: stateFor(snapshot),
        questions: { plan: questionFor(snapshot) },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Jev decision request failed.");

    const parsed = providerSchema.safeParse(await response.json());
    const answer = parsed.success ? parsed.data.answers.plan : null;
    if (!answer) throw new Error("Jev returned an invalid Hunt decision.");

    const confidence = answer.confidence ?? answer.probabilities?.[answer.choice];
    if (confidence === undefined) throw new Error("Jev returned no Hunt confidence.");

    return decisionFromHuntPlan(snapshot, answer.choice, confidence);
  } finally {
    clearTimeout(timer);
  }
};

export const handleHuntDecisionRequest = async (
  request: HuntDecisionTickRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<HuntDecisionTickResponse> => {
  const [blue, yellow] = request.snapshots;
  const startedAt = Date.now();
  logHuntDecisionTick({
    matchId: request.matchId,
    turn: request.turn,
    elapsedMs: request.elapsedMs,
    snapshots: [blue, yellow],
  });
  logHuntJevRequest();

  try {
    const decisions = await Promise.all([
      decide(blue, fetchImplementation),
      decide(yellow, fetchImplementation),
    ]);
    const durationMs = Date.now() - startedAt;
    const pair = decisions as HuntDecisionTickResponse["decisions"];
    logHuntJevDecisionPair(pair, durationMs);
    return { decisions: pair };
  } catch (error) {
    logHuntJevFailure({
      matchId: request.matchId,
      turn: request.turn,
      durationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : "unknown provider error",
    });
    throw error;
  }
};
