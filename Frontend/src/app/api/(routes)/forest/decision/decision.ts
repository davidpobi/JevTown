import "server-only";
import { z } from "zod";
import { decisionFromForestPlan } from "@/game/forest/engine";
import type { ForestDecisionSnapshot, ForestDecisionTickRequest, ForestDecisionTickResponse } from "@/interfaces/forestDecision";

const answerSchema = z.object({ answers: z.record(z.string(), z.object({ type: z.literal("choice"), choice: z.string(), confidence: z.number().min(0).max(1).optional(), probabilities: z.record(z.string(), z.number().min(0).max(1)).optional() })) });
const endpoint = "https://openrouter.ai/api/alpha/decisions";
const model = "typesafe/jev-1.13";
const decide = async (snapshot: ForestDecisionSnapshot, fetcher: typeof fetch) => {
  const key = process.env.OPENROUTER_API_KEY; if (!key) throw new Error("Jev is not configured.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetcher(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Jev Forest" }, body: JSON.stringify({ model, state: { self: snapshot.self, rival: snapshot.rival, heldRelics: snapshot.heldRelics, knownCells: snapshot.knownCells, visibleRelics: snapshot.visibleRelics, frontiers: snapshot.frontiers, plans: snapshot.plans }, questions: { plan: { type: "choice", instructions: "Choose exactly one supplied legal forest plan. The engine owns routes, hidden relics, movement, terrain, and all rules.", criteria: Object.fromEntries(snapshot.plans.map((plan) => [plan.id, `${plan.tactic.replaceAll("_", " ")} target ${plan.target}; ${plan.steps} steps; exposure ${plan.exposure}; information ${plan.informationGain}; intercept ${plan.interceptValue}.`])) } } }), signal: controller.signal });
    if (!response.ok) throw new Error("Jev decision request failed."); const parsed = answerSchema.safeParse(await response.json()); const answer = parsed.success ? parsed.data.answers.plan : null; const confidence = answer?.confidence ?? answer?.probabilities?.[answer.choice]; if (!answer || confidence === undefined) throw new Error("Jev returned an invalid Forest decision."); return decisionFromForestPlan(snapshot, answer.choice, confidence);
  } finally { clearTimeout(timer); }
};
export const handleForestDecisionRequest = async (request: ForestDecisionTickRequest, fetcher: typeof fetch = fetch): Promise<ForestDecisionTickResponse> => {
  const started = Date.now(); if (process.env.JEV_DECISION_LOG_VERBOSE === "true") console.info(`JEVFOREST → tick ${request.turn} · Blue ${request.snapshots[0].knownCells} cells / Yellow ${request.snapshots[1].knownCells} cells`);
  try { const decisions = await Promise.all(request.snapshots.map((snapshot) => decide(snapshot, fetcher))); const duration = Date.now() - started; const label = (index: number) => `${index === 0 ? "B" : "Y"} ${decisions[index].tactic === "SCOUT_FRONTIER" ? "scout" : decisions[index].tactic === "INTERCEPT_RIVAL" ? "intercept" : "collect"} ${decisions[index].target} ${Math.round(decisions[index].confidence * 100)}%`; console.info(`JEV ✓ ${label(0)} · ${label(1)} · ${duration}ms`); return { decisions: decisions as ForestDecisionTickResponse["decisions"] }; }
  catch (error) { console.info(`JEV ✕ Forest decision unavailable · tick ${request.turn} · ${Date.now() - started}ms`); throw error; }
};
