import { z } from "zod";

const pointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

const tacticSchema = z.enum([
  "EXPLORE_FAST",
  "EXPLORE_SAFE",
  "COLLECT_TREASURE_FAST",
  "COLLECT_TREASURE_SAFE",
  "CHASE_RIVAL",
]);

const planSchema = z.object({
  id: z.string().min(1).max(80),
  tactic: tacticSchema,
  target: z.string().min(1).max(32),
  steps: z.number().int().nonnegative(),
  rivalDistance: z.number().int().nonnegative(),
  informationGain: z.number().int().nonnegative(),
});

const snapshotSchema = z.object({
  battler: z.enum(["blue", "yellow"]),
  self: pointSchema,
  rival: pointSchema,
  heldTreasures: z.number().int().min(0).max(3),
  knownCells: z.number().int().nonnegative().max(400),
  visibleTreasures: z.array(z.object({ id: z.string().regex(/^T[1-3]$/), position: pointSchema })).max(3),
  frontiers: z.array(z.object({ id: z.string().regex(/^F[1-6]$/), position: pointSchema })).max(6),
  plans: z.array(planSchema).min(1).max(3),
});

export const huntDecisionTickSchema = z.object({
  kind: z.literal("tick"),
  matchId: z.string().min(4).max(80),
  turn: z.number().int().positive(),
  elapsedMs: z.number().int().nonnegative(),
  snapshots: z.array(snapshotSchema).length(2),
});
