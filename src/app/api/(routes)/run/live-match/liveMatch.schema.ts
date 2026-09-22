import { z } from "zod";

const pointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

const tacticSchema = z.enum([
  "GET_KEY_FAST",
  "GET_KEY_SAFE",
  "GO_EXIT_FAST",
  "GO_EXIT_SAFE",
  "CAPTURE_SIGNAL_FAST",
  "CAPTURE_SIGNAL_SAFE",
  "EXPLORE_FAST",
  "EXPLORE_SAFE",
  "CHASE_RIVAL",
]);

const battlerSchema = z.object({
  position: pointSchema,
  path: z.array(pointSchema).max(8),
  tactic: tacticSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

const eventSchema = z.object({
  kind: z.enum(["ready", "started", "decision", "clash", "key", "finished", "paused"]),
  message: z.string().min(1).max(240),
});

const liveMatchStateSchema = z.object({
  matchId: z.string().min(4).max(80),
  seed: z.string().min(4).max(80),
  mode: z.enum(["extraction", "signal-hunt"]),
  difficulty: z.enum(["standard", "hard"]),
  version: z.number().int().nonnegative(),
  status: z.enum(["waiting", "running", "clash", "paused", "finished"]),
  elapsedMs: z.number().int().nonnegative(),
  blue: battlerSchema,
  yellow: battlerSchema,
  keyHolder: z.enum(["blue", "yellow"]).nullable(),
  winner: z.enum(["blue", "yellow"]).nullable(),
  latestEvent: eventSchema,
  updatedAt: z.number().int().nonnegative(),
});

export const publishLiveMatchSchema = z.object({
  state: liveMatchStateSchema,
});

